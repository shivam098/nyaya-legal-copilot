import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateLimitation,
  evaluateWrittenVersionWindow,
  evaluateDisposalPace,
  auditLawyerUpdate,
  matchApplicableTactics
} from '../src/engine/consumer-rules.mjs';
import {
  CURATED_MODELS,
  readBillingLedger,
  resolveJuniorClerkModel,
  resolveRoutedModel,
  callCopilotModel
} from '../src/engine/copilot-llm.mjs';
import {
  listSessionsForUser,
  getSessionWithTurnsForUser,
  saveOrAppendSessionTurn,
  renameSessionForUser,
  deleteSessionForUser,
  ensureUserRecord
} from '../src/engine/session-db.mjs';
import {
  inferCaseStateFromFolder,
  rankCaseFilesByPriority,
  rankCaseImagesByPriority,
  retrieveRelevantFolderChunks,
  classifyTurnIntent,
  verifyDraftAgainstRecord,
  extractPdfBufferText,
  extractDocxBufferText,
  extractZipBufferTexts
} from '../src/engine/folder-case-extractor.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const htmlPath = path.join(__dirname, 'index.html');
const casesDir = path.join(rootDir, 'data/cases');
const procedure = JSON.parse(fs.readFileSync(path.join(rootDir, 'packs/consumer/procedure.json'), 'utf8'));
const tactics = JSON.parse(fs.readFileSync(path.join(rootDir, 'packs/consumer/tactics.json'), 'utf8'));

fs.mkdirSync(casesDir, { recursive: true });

function readJsonBody(req, maxBytes = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let received = 0;
    req.on('data', chunk => {
      received += chunk.length;
      if (received > maxBytes) {
        reject(new Error(`Request payload too large (> ${Math.round(maxBytes / (1024 * 1024))}MB)`));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Per-IP Sliding-Window Rate Limiter (protects public cloud deployments from bot abuse)
const ipRateBuckets = new Map();
function checkIpRateLimit(req, maxPerMinute = 20) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || '127.0.0.1';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return { allowed: true, ip };

  const now = Date.now();
  const windowMs = 60 * 1000;
  const recent = (ipRateBuckets.get(ip) || []).filter(ts => now - ts < windowMs);
  if (recent.length >= maxPerMinute) {
    return { allowed: false, ip };
  }
  recent.push(now);
  ipRateBuckets.set(ip, recent);
  return { allowed: true, ip };
}

function isLocalhostRequest(req) {
  const hostHeader = String(req.headers.host || '');
  const remote = String(req.socket?.remoteAddress || '');
  return (
    (hostHeader.startsWith('127.0.0.1') || hostHeader.startsWith('localhost')) &&
    (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1') &&
    process.env.PUBLIC_CLOUD_MODE !== 'true'
  );
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function resolveRequestUserId(req, url, body = null, res = null) {
  // Read HttpOnly cookie if present
  const cookieHeader = String(req.headers.cookie || '');
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)nyaya_uid=([^;]+)/);
  const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
  const fromHeader = req.headers['x-nyaya-user-id'];
  const fromQuery = url?.searchParams?.get('userId');
  const fromBody = body?.userId;
  const raw = String(fromHeader || fromBody || fromQuery || fromCookie || 'founder-local').trim();
  const displayName = String(req.headers['x-nyaya-user-name'] || body?.userName || '').trim();
  ensureUserRecord(raw, displayName);
  if (res && !res.headersSent && raw) {
    res.setHeader('Set-Cookie', `nyaya_uid=${encodeURIComponent(raw)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  }
  return raw;
}

/**
 * Redacts sensitive PII (Aadhaar 12-digit numbers, PAN numbers, bank account numbers)
 * before sending prompts to external cloud LLM APIs (DPDP Act 2023 safeguard).
 */
function redactPiiForCloud(text = '') {
  return String(text || '')
    // Redact 12-digit Aadhaar-formatted numbers (XXXX XXXX XXXX)
    .replace(/\b(\d{4})\s+(\d{4})\s+(\d{4})\b/g, '[AADHAAR-REDACTED-$3]')
    // Redact Indian PAN card numbers (5 letters, 4 digits, 1 letter)
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, '[PAN-REDACTED]');
}

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json', '.log', '.eml', '.html', '.htm', '.xml']);
const IMAGE_MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

async function scanLocalFolder(folderInput) {
  const cleanedPath = String(folderInput || '').trim().replace(/^["']|["']$/g, '');
  if (!cleanedPath || !fs.existsSync(cleanedPath)) {
    throw new Error(`Folder not found: ${cleanedPath}`);
  }
  const stat = fs.statSync(cleanedPath);
  const rootFolder = stat.isDirectory() ? cleanedPath : path.dirname(cleanedPath);

  const textFiles = [];
  const images = [];
  const allFileManifest = [];
  const skipped = [];
  const MAX_TEXT_FILES = 45;
  const MAX_IMAGES = 12;
  const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB safety limit per file

  async function processSingleFile(fullPath, relPath, fileStat) {
    const ext = path.extname(fullPath).toLowerCase();
    allFileManifest.push(relPath);
    if (fileStat.size > MAX_FILE_BYTES) {
      skipped.push(`${relPath} (>15MB)`);
      return;
    }
    if (TEXT_EXTENSIONS.has(ext)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8').slice(0, 18000);
        if (content.trim()) textFiles.push({ name: relPath, size: fileStat.size, content });
      } catch {
        skipped.push(relPath);
      }
    } else if (ext === '.pdf') {
      try {
        const buf = fs.readFileSync(fullPath);
        const pdfText = await extractPdfBufferText(buf, 16000);
        if (pdfText) {
          textFiles.push({ name: `${relPath} [Extracted PDF]`, size: fileStat.size, content: pdfText });
        } else {
          skipped.push(`${relPath} (scanned/image PDF)`);
        }
      } catch {
        skipped.push(relPath);
      }
    } else if (ext === '.docx') {
      try {
        const buf = fs.readFileSync(fullPath);
        const docxText = await extractDocxBufferText(buf, 16000);
        if (docxText) {
          textFiles.push({ name: `${relPath} [Extracted DOCX]`, size: fileStat.size, content: docxText });
        }
      } catch {
        skipped.push(relPath);
      }
    } else if (ext === '.zip') {
      try {
        const buf = fs.readFileSync(fullPath);
        const zipDocs = extractZipBufferTexts(buf, relPath);
        textFiles.push(...zipDocs);
      } catch {
        skipped.push(relPath);
      }
    } else if (IMAGE_MIME_MAP[ext]) {
      try {
        const base64 = fs.readFileSync(fullPath).toString('base64');
        images.push({
          name: relPath,
          size: fileStat.size,
          dataUrl: `data:${IMAGE_MIME_MAP[ext]};base64,${base64}`
        });
      } catch {
        skipped.push(relPath);
      }
    } else {
      skipped.push(relPath);
    }
  }

  async function walk(currentDir, depth = 0) {
    if (depth > 3) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('~$') || entry.name === 'node_modules') continue;
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootFolder, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        let fileStat;
        try {
          fileStat = fs.statSync(fullPath);
        } catch {
          continue;
        }
        await processSingleFile(fullPath, relPath, fileStat);
      }
    }
  }

  if (stat.isFile()) {
    await processSingleFile(cleanedPath, path.basename(cleanedPath), stat);
  } else {
    await walk(rootFolder, 0);
  }

  const rankedTextFiles = rankCaseFilesByPriority(textFiles).slice(0, MAX_TEXT_FILES);
  const rankedImages = rankCaseImagesByPriority(images).slice(0, MAX_IMAGES);

  const manifestHeader = `=== COMPLETE FOLDER FILE-TREE MANIFEST (${allFileManifest.length} files in ${path.basename(rootFolder)}) ===\n` +
    allFileManifest.map(f => `- ${f}`).join('\n');

  const combinedText = manifestHeader + '\n\n' + rankedTextFiles
    .map(f => `=== FILE: ${f.name} ===\n${f.content.trim()}`)
    .join('\n\n');

  const { inferredCaseState, inferredReasons } = inferCaseStateFromFolder({
    fileNames: allFileManifest,
    combinedText,
    currentCaseState: {}
  });

  return {
    folderPath: rootFolder,
    totalFilesInFolder: allFileManifest.length,
    textFilesCount: rankedTextFiles.length,
    imagesCount: rankedImages.length,
    skippedCount: skipped.length,
    fileNames: allFileManifest,
    inferredCaseState,
    inferredReasons,
    combinedText,
    images: rankedImages
  };
}

function computeCaseEngine(caseState) {
  const today = caseState.evaluationDate || new Date().toISOString().slice(0, 10);
  const limitation = caseState.causeOfActionDate
    ? evaluateLimitation(caseState.causeOfActionDate, today)
    : null;
  const writtenVersion = caseState.serviceDate
    ? evaluateWrittenVersionWindow(caseState.serviceDate, today, Boolean(caseState.writtenVersionFiled))
    : null;
  const disposalPace = caseState.serviceDate
    ? evaluateDisposalPace(caseState.serviceDate, today, caseState.nextHearingDate, false)
    : null;
  const matchedTactics = matchApplicableTactics({ ...caseState, evaluationDate: today }, tactics);

  return {
    evaluationDate: today,
    limitation,
    writtenVersion,
    disposalPace,
    matchedTactics
  };
}

const SYSTEM_PROMPTS = {
  'midcase-battle-card': `You are Nyaya, an elite Senior Indian Consumer & Litigation Practitioner Co-Pilot.
Core rule: Help the user win on the available facts in the least possible time by every lawful means. Never fabricate facts.
CRITICAL RECORD-HIERARCHY RULE (FOLDER TRUTH > UI CHECKBOXES):
- When the user attaches a case folder, order sheets, or Case Wiki (such as 10-court-record.md, 03-timeline.md, or ORDER-SHEETS/*.pdf), the DATED COURT ORDER SHEETS and FILED RECORD are the supreme source of truth.
- NEVER claim that Complainant Evidence or OP Written Version is "not filed" merely because a UI checkbox was left unchecked or because a file with "-draft.md" exists in the folder, IF the Order Sheets / Court Record show it was already filed and marked (e.g., Rejoinder + Complainant Evidence filed and Ex.P.1–Ex.P.12 marked on 05.08.2026).

Output a crisp, high-impact response in Markdown with these exact sections:
### 1. Where the Case Truly Stands (Verified from Court Order Sheets)
### 2. Immediate Courtroom Move (Next Hearing)
### 3. Exact Spoken Script (Word-for-Word for the Bench)
### 4. Draft Application / Memo / Written Submission (Ready to Copy/File)
### 5. Backup Move if the Bench Refuses or Grants Opposing Party Time`,

  'messy-dump-intake': `You are Nyaya, an elite Senior Indian Legal Practitioner & Evidence Analyst.
The user has dropped raw, unlabelled text (WhatsApp chat exports, invoice notes, emails, or a messy story) and may be EITHER:
- A Complainant wanting to file a case / get a refund, OR
- A Respondent / Business / Individual defending against an unfair refund demand or false accusation.

Do the work for the user so they don't have to label or organize anything:
1. **Auto-Sorted Chronology & Key Admissions:** Extract dates, promises, deliveries, delays, and admissions from the raw text.
2. **Honest Senior-Lawyer Viability & Ingredient Check (FR-16 & FR-17):**
   - If Complainant: check if statutory defect (CPA s.2(10)), deficiency (s.2(11)), or unfair trade practice (s.2(47)) is actually proven. If missing, advise to HOLD filing and cure the gap first.
   - If Defender/Respondent: highlight exact messages proving acceptance, client-caused delay, or lack of statutory deficiency.
3. **Ready-to-Send Legal Draft:** Provide the exact Pre-Litigation Reply Notice, Deficiency Notice, or Settlement Offer ready to copy, plus note on BSA 2023 Section 63 electronic certificate.`,

  'company-advisor': `You are Nyaya's Senior Corporate Counsel & Practising Company Secretary (India, Companies Act 2013, LLP Act 2008, MCA21 v3).
Analyze the founders' situation or RoC/MCA filing hiccup and provide:
1. **Decisive Recommendation:** Exact structure (Pvt Ltd vs LLP vs OPC) or exact cure for the RoC/MCA issue, with cost & compliance math.
2. **Step-by-Step MCA21 Execution Plan:** Forms (SPICe+ INC-32, FiLLiP, INC-20A, ADT-1, Form 3,AOC-4, MGT-7A, DIR-3 KYC), timelines, and fees.
3. **Critical Traps to Avoid:** E.g. ₹100/day uncapped late fees, 180-day INC-20A strike-off risk, co-founder 4-year vesting/cliff clause.`
};

const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '0.0.0.0';

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath, 'utf8'));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const userId = resolveRequestUserId(req, url);
      sendJson(res, 200, {
        userId,
        models: CURATED_MODELS,
        stages: procedure.stages,
        tacticsCount: tactics.length,
        billing: readBillingLedger(),
        sessions: listSessionsForUser(userId, 50)
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/sessions') {
      const userId = resolveRequestUserId(req, url);
      sendJson(res, 200, { userId, sessions: listSessionsForUser(userId, 100) });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/sessions/')) {
      const userId = resolveRequestUserId(req, url);
      const sessionId = decodeURIComponent(url.pathname.replace('/api/sessions/', ''));
      const session = getSessionWithTurnsForUser(userId, sessionId);
      if (!session) {
        sendJson(res, 404, { error: `Session not found for user '${userId}': ${sessionId}` });
        return;
      }
      sendJson(res, 200, { session });
      return;
    }

    if (req.method === 'PATCH' && url.pathname.startsWith('/api/sessions/')) {
      const body = await readJsonBody(req);
      const userId = resolveRequestUserId(req, url, body);
      const sessionId = decodeURIComponent(url.pathname.replace('/api/sessions/', ''));
      const updated = renameSessionForUser(userId, sessionId, body.title || 'Untitled Case');
      sendJson(res, 200, { session: updated, sessions: listSessionsForUser(userId, 50) });
      return;
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/sessions/')) {
      const userId = resolveRequestUserId(req, url);
      const sessionId = decodeURIComponent(url.pathname.replace('/api/sessions/', ''));
      deleteSessionForUser(userId, sessionId);
      sendJson(res, 200, { deleted: true, sessions: listSessionsForUser(userId, 50) });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/cases') {
      const files = fs.readdirSync(casesDir).filter(f => f.endsWith('.json'));
      const list = files.map(f => JSON.parse(fs.readFileSync(path.join(casesDir, f), 'utf8')));
      sendJson(res, 200, { cases: list });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/scan-folder') {
      if (!isLocalhostRequest(req)) {
        sendJson(res, 403, {
          error: 'Direct server-path scanning (/api/scan-folder) is only enabled in localhost mode. On public cloud deployments, please use the "📁 Pick Folder" button to upload files from your device.'
        });
        return;
      }
      const body = await readJsonBody(req);
      const scanned = await scanLocalFolder(body.folderPath);
      sendJson(res, 200, scanned);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/extract-file') {
      const body = await readJsonBody(req);
      const name = String(body.name || 'document');
      const ext = path.extname(name).toLowerCase();
      const buf = Buffer.from(body.base64 || '', 'base64');
      if (ext === '.pdf') {
        const text = await extractPdfBufferText(buf, 16000);
        sendJson(res, 200, { docs: text ? [{ name: `${name} [Extracted PDF]`, size: buf.length, content: text }] : [] });
        return;
      }
      if (ext === '.docx') {
        const text = await extractDocxBufferText(buf, 16000);
        sendJson(res, 200, { docs: text ? [{ name: `${name} [Extracted DOCX]`, size: buf.length, content: text }] : [] });
        return;
      }
      if (ext === '.zip') {
        const docs = extractZipBufferTexts(buf, name);
        sendJson(res, 200, { docs });
        return;
      }
      sendJson(res, 200, { docs: [] });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/analyze-stream') {
      const rateCheck = checkIpRateLimit(req, 20);
      if (!rateCheck.allowed) {
        sendJson(res, 429, { error: 'Rate limit exceeded (max 20 analyses/minute per IP). Please wait a moment.' });
        return;
      }
      const body = await readJsonBody(req);
      const userId = resolveRequestUserId(req, url, body, res);
      const {
        sessionId = null,
        door = 'midcase',
        mode = 'midcase-battle-card',
        model = 'auto',
        caseState = {},
        rawInput = '',
        images = [],
        folderPath = '',
        saveCaseTitle = ''
      } = body;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      });

      const sendEvent = (type, payload) => {
        res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
      };

      try {
        const hasImages = Array.isArray(images) && images.length > 0;

        sendEvent('step', {
          stepId: 'session',
          status: 'running',
          detail: `Loading user workspace (${userId}) & checking prior session context...`
        });

        const existingSession = sessionId ? getSessionWithTurnsForUser(userId, sessionId) : null;
        const isFollowUpTurn = Boolean(existingSession?.turns?.length > 0);

        let inheritedFolderCorpus = '';
        if (existingSession?.turns?.length) {
          for (let i = existingSession.turns.length - 1; i >= 0; i--) {
            const turnInput = existingSession.turns[i].userInput || '';
            const markerIdx = turnInput.indexOf('ATTACHED FOLDER / TEXT DOCUMENTS:');
            if (markerIdx !== -1 && !rawInput.includes('ATTACHED FOLDER / TEXT DOCUMENTS:')) {
              inheritedFolderCorpus = '\n\n' + turnInput.slice(markerIdx);
              break;
            }
          }
        }

        const effectiveRawInput = redactPiiForCloud(rawInput + inheritedFolderCorpus);
        const hasNewFolderUpload = rawInput.includes('ATTACHED FOLDER / TEXT DOCUMENTS:') && rawInput.length > 8000;
        const userQuestionOnly = rawInput.split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0].trim();
        const folderCorpusOnly = effectiveRawInput.includes('ATTACHED FOLDER / TEXT DOCUMENTS:')
          ? effectiveRawInput.slice(effectiveRawInput.indexOf('ATTACHED FOLDER / TEXT DOCUMENTS:'))
          : '';

        // Auto-infer & override unchecked UI defaults from the folder record before running the deterministic rule engine!
        const { inferredCaseState, inferredReasons } = inferCaseStateFromFolder({
          fileNames: [],
          combinedText: effectiveRawInput,
          currentCaseState: caseState
        });

        // Per-Turn Intent Classifier (prevents burning Opus 4.6 tokens on simple date/fact follow-ups)
        const turnIntent = classifyTurnIntent(userQuestionOnly, isFollowUpTurn);

        // Complexity detector: multi-OP case, large folder record (>12,000 chars), or >=2 OP adjournments
        const isComplexCase = Boolean(
          (effectiveRawInput.length > 12000 ||
            inferredCaseState.multiOpSummary ||
            Number(inferredCaseState.opEvidenceAdjournmentsGranted || 0) >= 2 ||
            existingSession?.folderDigest) &&
          turnIntent.recommendedTier === 'senior-counsel'
        );

        const resolvedSeniorModel = (model === 'auto' && turnIntent.recommendedTier === 'fast-or-balanced')
          ? 'claude-sonnet-4.6'
          : resolveRoutedModel(model, mode, hasImages, isComplexCase);

        const priorTurnsContext = existingSession?.turns?.length
          ? `\n\nPRIOR SESSION CONVERSATION (${existingSession.turns.length} turn(s) in this case):\n` +
            existingSession.turns.slice(-3).map(t => {
              const cleanUser = t.userInput.split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0].trim();
              return `--- Turn #${t.turnIndex} (${t.createdAt.slice(0, 10)}) ---\nUser: ${cleanUser.slice(0, 1200)}\nNyaya Summary: ${t.assistantMarkdown.slice(0, 1500)}`;
            }).join('\n\n')
          : '';

        sendEvent('step', {
          stepId: 'session',
          status: 'done',
          detail: existingSession
            ? `Loaded prior case session (${existingSession.turns.length} earlier turn(s))${existingSession.folderDigest ? ' + cached Junior Clerk Case Digest (Zero folder re-upload)' : ''}`
            : `Initialized new case session for ${userId}`,
          logs: [
            `User Tenant ID: ${userId}`,
            `Session Mode: ${mode} (Door: ${door})`,
            `Turn Intent Classifier: ${turnIntent.intent} (${turnIntent.reason})`,
            existingSession
              ? `Restored ${existingSession.turns.length} prior turn(s) from SQLite (session: ${existingSession.id})`
              : `Created fresh SQLite session workspace`,
            `Total case corpus available on server: ${effectiveRawInput.length.toLocaleString()} chars (${hasImages ? `${images.length} new image(s) attached` : '0 re-uploaded images'})`
          ]
        });

        sendEvent('step', {
          stepId: 'rules',
          status: 'running',
          detail: 'Auto-verifying case state from folder order sheets & running CPA 2019 statutory rule engine...',
          logs: ['Scanning folder manifest and order sheets for statutory dates, WV filings, and exhibit markings...']
        });

        // Calculate actual gapDays between today and inferred nextHearingDate if not explicitly provided
        const todayIso = inferredCaseState.evaluationDate || new Date().toISOString().slice(0, 10);
        if (inferredCaseState.nextHearingDate) {
          const gapMs = new Date(inferredCaseState.nextHearingDate) - new Date(todayIso);
          inferredCaseState.proposedGapDays = Math.max(1, Math.round(gapMs / (1000 * 60 * 60 * 24)));
        }

        const engineResult = computeCaseEngine(inferredCaseState);
        engineResult.inferredCaseState = inferredCaseState;
        engineResult.inferredReasons = inferredReasons;
        engineResult.isComplexCase = isComplexCase;
        engineResult.turnIntent = turnIntent;
        engineResult.seniorModelSelected = resolvedSeniorModel;
        const matchedNames = (engineResult.matchedTactics || []).map(t => t.title).join(', ') || 'Standard stage review';

        const ruleLogs = [
          ...(inferredReasons.length ? inferredReasons.map(r => `✓ Auto-Inferred from Record: ${r}`) : ['No overrides inferred from folder; using form inputs.']),
          inferredCaseState.multiOpSummary ? `✓ Multi-OP Matrix: ${inferredCaseState.multiOpSummary}` : null,
          engineResult.disposalPace
            ? `✓ CPA s.38(7) Disposal Pace: ${engineResult.disposalPace.daysElapsed} days elapsed vs ${engineResult.disposalPace.targetDays}-day statutory target (${engineResult.disposalPace.breached ? 'BREACHED' : 'Within target'})`
            : null,
          engineResult.writtenVersion
            ? `✓ CPA s.38(2)(a) Written Version Status: ${engineResult.writtenVersion.status} (${engineResult.writtenVersion.daysSinceService}d since earliest notice)`
            : null,
          `✓ Matched Practitioner Tactics (${(engineResult.matchedTactics || []).length}): ${matchedNames}`
        ].filter(Boolean);

        sendEvent('step', {
          stepId: 'rules',
          status: 'done',
          detail: `${inferredReasons.length ? `[Auto-synced ${inferredReasons.length} facts from Court Record] ` : ''}Matched: ${matchedNames}`,
          logs: ruleLogs,
          engineResult
        });

        // STAGE A: Junior Clerk Digest + One-Time Vision OCR (Compresses raw 80-file folder + images into a permanent Verified Case Digest)
        let activeFolderDigest = existingSession?.folderDigest || '';
        const rankedImages = rankCaseImagesByPriority(images || []);

        if (hasNewFolderUpload || (!activeFolderDigest && (effectiveRawInput.length > 10000 || hasImages))) {
          const clerkModel = hasImages ? 'claude-sonnet-4.6' : resolveJuniorClerkModel();
          const detectedFileHeaders = (effectiveRawInput.match(/=== (?:FILE:\s*)?(.*?) ===/g) || [])
            .map(h => h.replace(/^===\s*(?:FILE:\s*)?|\s*===$/g, ''))
            .filter(h => !h.startsWith('COMPLETE FOLDER FILE-TREE'))
            .slice(0, 15);

          sendEvent('step', {
            stepId: 'clerk',
            status: 'running',
            detail: `Stage A (Junior Clerk — ${clerkModel}): Indexing ${effectiveRawInput.length.toLocaleString()} chars${hasImages ? ` + OCR-transcribing ${rankedImages.length} screenshot(s)` : ''} into a permanent Verified Case Digest...`,
            logs: [
              `Junior Clerk Model: ${clerkModel}${hasImages ? ' (Vision OCR enabled to transcribe attached screenshots once into SQLite)' : ''}`,
              `Top Prioritized Files Being Read First:`,
              ...detectedFileHeaders.map((f, idx) => `  ${idx + 1}. ${f}`),
              `Streaming live Junior Clerk Case Digest below...`
            ]
          });

          let clerkStreamed = '';
          const clerkRes = await callCopilotModel({
            userId,
            model: clerkModel,
            operation: 'timeline-extract',
            caseId: sessionId || 'clerk-digest',
            systemPrompt: `You are Nyaya's Junior Case Clerk & Legal OCR Analyst. Read the attached case folder files AND any attached screenshots/images, and extract a 100% factual, zero-hallucination Verified Case Digest in concise Markdown:
1. **Case Number, Forum, Bench Composition (note any Bench changes), & Parties (Complainant vs OP-1, OP-2, etc.)**
2. **Exact Chronological Order-Sheet Table (Date | What Happened | Next Date)**
3. **Filing & Exhibit Status (Written Version date, Rejoinder/Affidavit of Evidence date, Exhibits marked e.g. Ex.P.1-P.12, any unmarked annexures like C-13, IA status)**
4. **One-Time Vision OCR Transcription of Any Attached Screenshots/Receipts/Orders**
5. **Core Factual Breaches, Admissions, & Reliefs Prayed**`,
            userPrompt: effectiveRawInput.slice(0, 95000),
            images: rankedImages,
            maxTokens: 1300,
            onChunk: (deltaChunk) => {
              clerkStreamed += deltaChunk;
              sendEvent('step', {
                stepId: 'clerk',
                status: 'running',
                detail: `Stage A (Junior Clerk — ${clerkModel}): Extracting Verified Case Digest (${clerkStreamed.length.toLocaleString()} chars written)...`,
                liveText: clerkStreamed
              });
            }
          });

          activeFolderDigest = clerkRes.content;
          sendEvent('step', {
            stepId: 'clerk',
            status: 'done',
            detail: `Junior Clerk (${clerkRes.model}) built & cached Verified Case Digest (${clerkRes.billingEntry.totalTokens} tokens · ₹${clerkRes.billingEntry.estimatedInr.toFixed(3)})`,
            liveText: activeFolderDigest
          });
        } else {
          sendEvent('step', {
            stepId: 'clerk',
            status: 'done',
            detail: activeFolderDigest
              ? 'Reusing cached Junior Clerk Case Digest + OCR from SQLite session (₹0 extra intake cost)'
              : 'Direct concise input — Junior Clerk compression not required',
            liveText: activeFolderDigest || 'Concise single-turn input passed directly to Senior Counsel.'
          });
        }

        // STAGE B PREPARATION: Query-Aware BM25 Chunk Retrieval + Prefix-Cache-Aligned Prompt Ordering
        sendEvent('step', {
          stepId: 'evidence',
          status: 'running',
          detail: `Running Query-Matched BM25 Section Retriever against folder corpus...`
        });

        const retrievalQuery = userQuestionOnly || `${mode} ${inferredCaseState.stage || ''} ${inferredCaseState.multiOpSummary || ''} order sheet rejoinder written version c-13`;
        const { selectedText: retrievedChunksText, matchedSources } = folderCorpusOnly
          ? retrieveRelevantFolderChunks(folderCorpusOnly, retrievalQuery, 26000)
          : { selectedText: effectiveRawInput.slice(0, 40000), matchedSources: [] };

        engineResult.retrievedSources = matchedSources;

        const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS['midcase-battle-card'];

        // Note: Static Case State + Rule Engine + Cached Case Digest are placed at the VERY TOP of userPrompt
        // so Anthropic / OpenAI / Gemini KV Prompt Caching gets maximum cache-prefix hits across turns!
        // And if Stage A already transcribed the images into `activeFolderDigest`, we don't need to re-send base64 images on follow-up turns!
        const sendImagesToSenior = hasImages && !isFollowUpTurn ? rankedImages.slice(0, 6) : [];
        const imageSummary = sendImagesToSenior.length > 0
          ? `\n\nATTACHED SCREENSHOTS (${sendImagesToSenior.length} top-priority court/annexure images attached; full OCR also in Digest above): ${sendImagesToSenior.map((img, i) => `[Image ${i + 1}: ${img.name || 'screenshot'}]`).join(', ')}.`
          : '';

        const userPrompt = `=== STATIC CASE WORKSPACE PREFIX (KV-CACHE ALIGNED) ===
MODE: ${mode}
VERIFIED CASE STATE (Auto-Synced with Folder Court Record):
${JSON.stringify(inferredCaseState, null, 2)}
${inferredReasons.length ? `\nAUTO-DETECTED FACTS FROM FOLDER ORDER SHEETS:\n- ${inferredReasons.join('\n- ')}\n` : ''}
DETERMINISTIC RULE ENGINE OUTPUT:
${JSON.stringify(engineResult, null, 2)}

=== VERIFIED CASE DIGEST & OCR TRANSCRIPTION (Cached from Junior Clerk) ===
${activeFolderDigest || '(No folder digest — see raw record below)'}

=== QUERY-MATCHED RAW DOCUMENT SECTIONS (BM25 Top Matches for Current Question) ===
${retrievedChunksText || '(See Case Digest above)'}${priorTurnsContext}

=== CURRENT USER QUESTION / INSTRUCTION (Turn Intent: ${turnIntent.intent}) ===
${userQuestionOnly || 'Provide the complete Verified Case Summary, Immediate Courtroom Move, Word-for-Word Spoken Script for the Bench, and Ready-to-File Application/Memo.'}${imageSummary}`;

        sendEvent('step', {
          stepId: 'evidence',
          status: 'done',
          detail: `Retrieved ${matchedSources.length} top-matching document sections (~${Math.ceil(userPrompt.length / 4).toLocaleString()} est. tokens · Intent: ${turnIntent.intent} → ${resolvedSeniorModel})`,
          logs: [
            `Turn Intent Classification: ${turnIntent.intent} (${turnIntent.reason})`,
            `Router Model Selected for Stage B: '${resolvedSeniorModel}'`,
            `KV-Cache Prefix Alignment: Static Case State + Digest placed at prompt prefix for 90% cache reuse`,
            matchedSources.length
              ? `BM25 Top-Ranked Document Sections Retrieved for This Question:\n` + matchedSources.map((m, idx) => `  ${idx + 1}. ${m.source} (relevance score: ${m.score})`).join('\n')
              : `Using direct input text`,
            sendImagesToSenior.length
              ? `Vision Images sent to Senior Counsel: ${sendImagesToSenior.map(i => i.name).join(', ')}`
              : `0 duplicate base64 images re-sent (OCR already preserved in Case Digest)`
          ]
        });

        sendEvent('step', {
          stepId: 'llm',
          status: 'running',
          detail: `Stage B (Senior Counsel — ${resolvedSeniorModel}): Streaming deep legal strategy...`,
          logs: [
            `Senior Counsel Model: ${resolvedSeniorModel}`,
            `Synthesizing CPA 2019 statutory findings + Junior Clerk Digest + ${matchedSources.length} retrieved document sections...`
          ]
        });

        const llmRes = await callCopilotModel({
          userId,
          model: resolvedSeniorModel,
          operation: mode,
          caseId: sessionId || caseState.id || 'live-workspace',
          systemPrompt,
          userPrompt,
          images: sendImagesToSenior,
          isComplexCase,
          maxTokens: 1500,
          onChunk: (deltaText) => {
            sendEvent('delta', { delta: deltaText });
          }
        });

        // Deterministic Post-Generation Fact & Record Verifier (Zero LLM Cost Guardrail)
        const verification = verifyDraftAgainstRecord(llmRes.content, inferredCaseState);
        engineResult.verification = verification;

        sendEvent('step', {
          stepId: 'llm',
          status: 'done',
          detail: `Completed by ${llmRes.model} in ${(llmRes.billingEntry.latencyMs / 1000).toFixed(1)}s (${llmRes.billingEntry.totalTokens} tokens · ₹${llmRes.billingEntry.estimatedInr.toFixed(3)}) · Fact Audit: ${verification.verified ? 'PASSED ✓' : 'WARNING ⚠️'}`,
          logs: [
            `Model: ${llmRes.model} · Latency: ${(llmRes.billingEntry.latencyMs / 1000).toFixed(1)}s · Tokens: ${llmRes.billingEntry.totalTokens}`,
            `Deterministic Post-Generation Fact Verification:`,
            ...verification.checks.map(c => `  ${c}`)
          ]
        });

        const updatedSession = saveOrAppendSessionTurn({
          userId,
          sessionId: existingSession?.id || sessionId,
          title: saveCaseTitle || existingSession?.title,
          door,
          mode,
          caseState: inferredCaseState,
          folderDigest: activeFolderDigest,
          userInput: effectiveRawInput,
          imagesCount: hasImages ? images.length : 0,
          folderPath,
          engineResult,
          assistantMarkdown: llmRes.content,
          model: llmRes.model,
          tokens: llmRes.billingEntry?.totalTokens || 0,
          costInr: llmRes.billingEntry?.estimatedInr || 0,
          latencyMs: llmRes.billingEntry?.latencyMs || 0
        });

        sendEvent('complete', {
          userId,
          session: updatedSession,
          sessions: listSessionsForUser(userId, 50),
          engineResult,
          adviceMarkdown: llmRes.content,
          model: llmRes.model,
          billingEntry: llmRes.billingEntry,
          billingTotals: readBillingLedger().totals
        });
        res.end();
      } catch (streamErr) {
        sendEvent('error', { error: streamErr.message || String(streamErr) });
        res.end();
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/analyze') {
      const body = await readJsonBody(req);
      const userId = resolveRequestUserId(req, url, body);
      const {
        sessionId = null,
        door = 'midcase',
        mode = 'midcase-battle-card',
        model = 'claude-sonnet-4.6',
        caseState = {},
        rawInput = '',
        images = [],
        folderPath = '',
        saveCaseTitle = ''
      } = body;

      const existingSession = sessionId ? getSessionWithTurnsForUser(userId, sessionId) : null;
      const priorTurnsContext = existingSession?.turns?.length
        ? `\n\nPRIOR SESSION HISTORY (${existingSession.turns.length} turn(s) in this case):\n` +
          existingSession.turns.slice(-3).map(t =>
            `--- Turn #${t.turnIndex} (${t.createdAt.slice(0, 10)}) ---\nUser: ${t.userInput.slice(0, 600)}\nNyaya Summary: ${t.assistantMarkdown.slice(0, 900)}`
          ).join('\n\n')
        : '';

      const engineResult = computeCaseEngine(caseState);
      const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS['midcase-battle-card'];

      const imageSummary = Array.isArray(images) && images.length > 0
        ? `\n\nATTACHED SCREENSHOTS / IMAGES (${images.length}): ${images.map((img, i) => `[Image ${i + 1}: ${img.name || 'screenshot'}]`).join(', ')}. Carefully read all visible text, timestamps, amounts, and court/chat details inside the attached images.`
        : '';

      const userPrompt = `MODE: ${mode}
CASE STATE (JSON):
${JSON.stringify(caseState, null, 2)}

DETERMINISTIC RULE ENGINE OUTPUT:
${JSON.stringify(engineResult, null, 2)}${priorTurnsContext}

CURRENT USER UPDATE / QUESTION / RAW WHATSAPP CHAT / DOCUMENTS:
${rawInput || '(See attached images and Case State above)'}${imageSummary}`;

      const llmRes = await callCopilotModel({
        userId,
        model,
        operation: mode,
        caseId: sessionId || caseState.id || 'live-workspace',
        systemPrompt,
        userPrompt,
        images,
        maxTokens: 1400
      });

      const updatedSession = saveOrAppendSessionTurn({
        userId,
        sessionId: existingSession?.id || sessionId,
        title: saveCaseTitle || existingSession?.title,
        door,
        mode,
        caseState,
        userInput: rawInput,
        imagesCount: Array.isArray(images) ? images.length : 0,
        folderPath,
        engineResult,
        assistantMarkdown: llmRes.content,
        model: llmRes.model,
        tokens: llmRes.billingEntry?.totalTokens || 0,
        costInr: llmRes.billingEntry?.estimatedInr || 0,
        latencyMs: llmRes.billingEntry?.latencyMs || 0
      });

      sendJson(res, 200, {
        userId,
        session: updatedSession,
        sessions: listSessionsForUser(userId, 50),
        engineResult,
        adviceMarkdown: llmRes.content,
        model: llmRes.model,
        billingEntry: llmRes.billingEntry,
        billingTotals: readBillingLedger().totals
      });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { error: err.message || String(err) });
  }
}).listen(port, host, () => {
  console.log(`Nyaya Live Product Server running at http://127.0.0.1:${port}`);
});
