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
  detectLegalDomain,
  extractPaidAmountInr,
  evaluateConsumerPecuniaryAndFee,
  evaluateNiAct138Deadlines,
  evaluateCriminalCodeAndBail,
  evaluateCivilWrittenStatementWindow
} from '../src/engine/civil-criminal-rules.mjs';
import {
  CURATED_MODELS,
  readBillingLedger,
  resolveJuniorClerkModel,
  resolveRoutedModel,
  callCopilotModel
} from '../src/engine/copilot-llm.mjs';
import {
  ADVICE_MAX_TOKENS,
  buildAnalysisSystemPrompt,
  buildDigestSystemPrompt
} from '../src/engine/response-guidance.mjs';
import {
  buildGroundedLegalContext
} from '../src/engine/legal-web-search.mjs';
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
const voiceAssets = new Map([
  ['/voice-input.mjs', path.join(__dirname, 'voice-input.mjs')],
  ['/voice-romanization.mjs', path.join(__dirname, 'voice-romanization.mjs')],
  ['/vendor/sanscript.js', path.join(rootDir, 'node_modules/@indic-transliteration/sanscript/sanscript.js')]
]);
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
  const remote = String(req.socket?.remoteAddress || '127.0.0.1');
  const isLoopbackSocket = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  const cfIp = String(req.headers['cf-connecting-ip'] || '').trim();
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();

  // Only exempt direct local loopback requests that have no proxy forwarding headers
  if (isLoopbackSocket && !cfIp && !forwarded && process.env.PUBLIC_CLOUD_MODE !== 'true') {
    return { allowed: true, ip: '127.0.0.1' };
  }

  // Never allow a client to bypass rate limiting by spoofing X-Forwarded-For: 127.0.0.1
  const candidateIp = cfIp || forwarded || remote;
  const ip = (candidateIp === '127.0.0.1' || candidateIp === '::1' || candidateIp === '::ffff:127.0.0.1')
    ? `proxied-client-${req.headers['user-agent']?.slice(0, 24) || 'unknown'}`
    : candidateIp;

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
  const hasProxyHeaders = Boolean(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']);
  return (
    !hasProxyHeaders &&
    (hostHeader.startsWith('127.0.0.1') || hostHeader.startsWith('localhost')) &&
    (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1') &&
    process.env.PUBLIC_CLOUD_MODE !== 'true'
  );
}

function scopeBillingForUser(ledger, userId) {
  if (!ledger) return ledger;
  const cleanUser = String(userId || 'founder-local').trim();
  const userStats = ledger.byUsers?.[cleanUser] || { plan: 'case-pass-499', calls: 0, totalTokens: 0, spendInr: 0 };
  const userRecentCalls = (ledger.recentCalls || []).filter(c => c.userId === cleanUser);
  const estimatedUsd = Number(((userStats.spendInr || 0) / (ledger.currencyRateUsdToInr || 84)).toFixed(6));
  return {
    currencyRateUsdToInr: ledger.currencyRateUsdToInr,
    activeProvider: ledger.activeProvider,
    totals: {
      calls: userStats.calls || 0,
      cacheHits: userRecentCalls.filter(c => c.cached).length,
      promptTokens: userRecentCalls.reduce((s, c) => s + (c.promptTokens || 0), 0),
      completionTokens: userRecentCalls.reduce((s, c) => s + (c.completionTokens || 0), 0),
      totalTokens: userStats.totalTokens || 0,
      totalNanoAiu: userRecentCalls.reduce((s, c) => s + (c.nanoAiu || 0), 0),
      estimatedUsd,
      estimatedInr: Number((userStats.spendInr || 0).toFixed(4))
    },
    byUserTier: ledger.byUserTier,
    byUsers: { [cleanUser]: userStats },
    byModel: ledger.byModel,
    byOperation: ledger.byOperation,
    recentCalls: userRecentCalls
  };
}

function buildPriorTurnsContext(turns = [], maxUserChars = 1200, maxAssistantChars = 1500) {
  if (!Array.isArray(turns) || turns.length === 0) return '';
  // Always pin Turn #1 (foundational case facts) plus the latest 3 turns so Turn 5+ never forgets the case story!
  const selected = turns.length <= 3
    ? turns
    : [turns[0], ...turns.slice(-3).filter(t => t.turnIndex !== turns[0].turnIndex)];

  return `\n\nPRIOR SESSION CONVERSATION (${turns.length} turn(s) in this case):\n` +
    selected.map(t => {
      const cleanUser = String(t.userInput || '').split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0].trim();
      return `--- Turn #${t.turnIndex} (${String(t.createdAt || '').slice(0, 10)}) ---\nUser: ${cleanUser.slice(0, maxUserChars)}\nNyaya Summary: ${String(t.assistantMarkdown || '').slice(0, maxAssistantChars)}`;
    }).join('\n\n');
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
 * Redacts sensitive PII (Aadhaar 12-digit numbers, PAN numbers, bank account numbers, mobile numbers, emails)
 * before sending prompts to external cloud LLM APIs (DPDP Act 2023 safeguard).
 */
export function redactPiiForCloud(text = '') {
  return String(text || '')
    // Redact 12-digit Aadhaar-formatted numbers (XXXX XXXX XXXX or XXXX-XXXX-XXXX)
    .replace(/\b(\d{4})[\s-](\d{4})[\s-](\d{4})\b/g, '[AADHAAR-REDACTED-$3]')
    // Redact contiguous 12-digit Aadhaar numbers when preceded by Aadhaar/UIDAI label
    .replace(/\b(aadhaar|aadhar|uidai)[\s:#-]*\d{8}(\d{4})\b/gi, '$1 [AADHAAR-REDACTED-$2]')
    // Redact Indian PAN card numbers (5 letters, 4 digits, 1 letter)
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, '[PAN-REDACTED]')
    // Redact labeled bank account numbers (9 to 18 digits)
    .replace(/\b(a\/c(?:\s*no\.?)?|account\s*(?:no\.?|number)?)[\s:#-]*\d{5,14}(\d{4})\b/gi, '$1 [BANK-AC-REDACTED-$2]')
    // Redact email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL-REDACTED]');
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

function computeCaseEngine(caseState = {}, { door = '', mode = '', rawInput = '' } = {}) {
  const today = caseState.evaluationDate || new Date().toISOString().slice(0, 10);
  const domainInfo = detectLegalDomain({ door, mode, caseState, rawInput });
  const paidAmountInr = extractPaidAmountInr(rawInput, caseState.paidAmountInr);

  // Only run Consumer Protection Act 2019 calculators when the matter is actually in the Consumer Forum!
  const isConsumer = domainInfo.isConsumerForum;

  const limitation = (isConsumer && caseState.causeOfActionDate)
    ? evaluateLimitation(caseState.causeOfActionDate, today)
    : null;
  const writtenVersion = (isConsumer && caseState.serviceDate)
    ? evaluateWrittenVersionWindow(
        caseState.serviceDate,
        today,
        Boolean(caseState.writtenVersionFiled),
        caseState.writtenVersionFiledDate || null
      )
    : null;
  const disposalPace = (isConsumer && caseState.serviceDate)
    ? evaluateDisposalPace(caseState.serviceDate, today, caseState.nextHearingDate, false)
    : null;
  const matchedTactics = isConsumer
    ? matchApplicableTactics({ ...caseState, evaluationDate: today }, tactics)
    : [];

  const consumerPecuniary = (isConsumer || domainInfo.domain === 'property-rera') && paidAmountInr
    ? evaluateConsumerPecuniaryAndFee(paidAmountInr)
    : null;

  const lawyerAudit = (isConsumer && (caseState.lawyerReportedStatus || caseState.orderSheetText))
    ? auditLawyerUpdate({
        lawyerReportedStatus: caseState.lawyerReportedStatus || '',
        orderSheetText: caseState.orderSheetText || rawInput || '',
        writtenVersionForfeitable: Boolean(writtenVersion?.canForfeitRightToReply)
      })
    : null;

  const niAct138 = domainInfo.domain === 'cheque-bounce-138'
    ? evaluateNiAct138Deadlines({
        dishonourDate: caseState.dishonourDate || caseState.causeOfActionDate || caseState.serviceDate,
        noticeSentDate: caseState.noticeSentDate || null,
        noticeReceivedDate: caseState.noticeReceivedDate || null,
        evaluationDate: today
      })
    : null;

  const criminalRules = (domainInfo.domain === 'criminal-bns-bnss' || domainInfo.domain === 'matrimonial-family')
    ? evaluateCriminalCodeAndBail({
        incidentDate: caseState.incidentDate || caseState.causeOfActionDate || null,
        rawInput,
        custodyDays: caseState.custodyDays || null
      })
    : null;

  const civilRules = (domainInfo.domain === 'tenancy-civil' || domainInfo.domain === 'inheritance-partition')
    ? evaluateCivilWrittenStatementWindow({
        serviceDate: caseState.serviceDate || null,
        evaluationDate: today,
        isCommercialSuit: Boolean(caseState.isCommercialSuit),
        writtenStatementFiled: Boolean(caseState.writtenVersionFiled)
      })
    : null;

  return {
    evaluationDate: today,
    domainInfo,
    paidAmountInr,
    consumerPecuniary,
    limitation,
    writtenVersion,
    disposalPace,
    matchedTactics,
    lawyerAudit,
    niAct138,
    criminalRules,
    civilRules
  };
}

const port = process.env.PORT === undefined ? 4173 : Number(process.env.PORT);
const host = process.env.HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath, 'utf8'));
      return;
    }

    if (req.method === 'GET' && voiceAssets.has(url.pathname)) {
      let source = fs.readFileSync(voiceAssets.get(url.pathname), 'utf8');
      if (url.pathname === '/vendor/sanscript.js') {
        const license = fs.readFileSync(path.join(rootDir, 'node_modules/@indic-transliteration/sanscript/LICENSE'), 'utf8');
        source = `/*\n${license}\n*/\n${source}`;
      }
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(source);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const userId = resolveRequestUserId(req, url);
      sendJson(res, 200, {
        userId,
        models: CURATED_MODELS,
        stages: procedure.stages,
        tacticsCount: tactics.length,
        billing: scopeBillingForUser(readBillingLedger(), userId),
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
      const rateCheck = checkIpRateLimit(req, 40);
      if (!rateCheck.allowed) {
        sendJson(res, 429, { error: 'Rate limit exceeded for file extraction. Please wait a moment.' });
        return;
      }
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
          detail: 'Checking this conversation for earlier details...'
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

        const priorTurnsContext = buildPriorTurnsContext(existingSession?.turns || [], 1200, 1500);

        sendEvent('step', {
          stepId: 'session',
          status: 'done',
          detail: existingSession
            ? `Loaded ${existingSession.turns.length} earlier message(s)${existingSession.folderDigest ? ' and the saved document summary' : ''}.`
            : 'Starting a new conversation.',
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
          detail: mode === 'company-advisor'
            ? 'Company dates and fees need current-rule verification; consumer-case rules do not determine company compliance.'
            : 'Checking supplied dates and applicable statutory rules...',
          logs: ['Scanning record for domain forum, statutory dates, filings, and procedural rules...']
        });

        // Calculate actual gapDays between today and inferred nextHearingDate if not explicitly provided
        const todayIso = inferredCaseState.evaluationDate || new Date().toISOString().slice(0, 10);
        if (inferredCaseState.nextHearingDate) {
          const gapMs = new Date(inferredCaseState.nextHearingDate) - new Date(todayIso);
          inferredCaseState.proposedGapDays = Math.max(1, Math.round(gapMs / (1000 * 60 * 60 * 24)));
        }

        const engineResult = computeCaseEngine(inferredCaseState, { door, mode, rawInput: effectiveRawInput });
        engineResult.inferredCaseState = inferredCaseState;
        engineResult.inferredReasons = inferredReasons;
        engineResult.isComplexCase = isComplexCase;
        engineResult.turnIntent = turnIntent;
        engineResult.seniorModelSelected = resolvedSeniorModel;
        const matchedNames = (engineResult.matchedTactics || []).map(t => t.title).join(', ') || 'Standard stage review';

        const ruleLogs = [
          `✓ Detected Legal Domain & Forum: ${engineResult.domainInfo?.label || mode}`,
          ...(inferredReasons.length ? inferredReasons.map(r => `✓ Auto-Inferred from Record: ${r}`) : ['No overrides inferred from folder; using form inputs.']),
          inferredCaseState.multiOpSummary ? `✓ Party Status Matrix: ${inferredCaseState.multiOpSummary}` : null,
          engineResult.consumerPecuniary
            ? `✓ Consumer Pecuniary & Fee Rule: ${engineResult.consumerPecuniary.competentForum} · Official Rule 7 Fee: ₹${engineResult.consumerPecuniary.filingFeeInr}`
            : null,
          engineResult.niAct138
            ? `✓ NI Act s.138 Clock: ${engineResult.niAct138.daysRemainingForNotice} day(s) remaining for 30-day demand notice (Deadline: ${engineResult.niAct138.noticeDeadlineDate})`
            : null,
          engineResult.criminalRules?.matchedOffences?.length
            ? `✓ Criminal Code & Bail Check: ${engineResult.criminalRules.matchedOffences.map(o => `${o.bnsSection} (${o.ipcSection}) — ${o.bailable ? 'Bailable' : 'NON-BAILABLE'}, Arnesh Kumar / BNSS s.35(3) notice: ${o.arneshKumarNoticeApplies ? 'APPLIES' : 'No'}`).join('; ')}`
            : null,
          engineResult.disposalPace
            ? `✓ CPA s.38(7) Disposal Pace: ${engineResult.disposalPace.daysSinceNotice} days elapsed vs ${engineResult.disposalPace.targetDays}-day statutory target (${engineResult.disposalPace.exceededStatutoryTarget ? 'BREACHED' : 'Within target'})`
            : null,
          engineResult.writtenVersion
            ? `✓ CPA s.38(2)(a) Written Version Status: ${engineResult.writtenVersion.status} (${engineResult.writtenVersion.daysSinceService}d since earliest notice)`
            : null,
          engineResult.lawyerAudit?.discrepancyDetected
            ? `⚠️ Lawyer Audit Flag(s): ${engineResult.lawyerAudit.flags.join(', ')}`
            : null,
          engineResult.domainInfo?.isConsumerForum
            ? `✓ Matched Practitioner Tactics (${(engineResult.matchedTactics || []).length}): ${matchedNames}`
            : null
        ].filter(Boolean);

        sendEvent('step', {
          stepId: 'rules',
          status: 'done',
          detail: mode === 'company-advisor'
            ? 'No company compliance calculator is available. Exact dates and fees need verification.'
            : engineResult.domainInfo?.isConsumerForum
            ? `Found ${(engineResult.matchedTactics || []).length} possible procedural step(s). These depend on the forum and the accuracy of the supplied facts.`
            : `Checked statutory rules for ${engineResult.domainInfo?.label || 'this domain'}.`,
          logs: ruleLogs,
          engineResult
        });

        // STAGE A: Junior Clerk Digest + Vision OCR (Runs on initial OR follow-up uploads when new images/folders arrive!)
        let activeFolderDigest = existingSession?.folderDigest || '';
        const rankedImages = rankCaseImagesByPriority(images || []);

        if (hasNewFolderUpload || hasImages || (!activeFolderDigest && effectiveRawInput.length > 10000)) {
          const clerkModel = hasImages ? 'claude-sonnet-4.6' : resolveJuniorClerkModel();
          const detectedFileHeaders = (effectiveRawInput.match(/=== (?:FILE:\s*)?(.*?) ===/g) || [])
            .map(h => h.replace(/^===\s*(?:FILE:\s*)?|\s*===$/g, ''))
            .filter(h => !h.startsWith('COMPLETE FOLDER FILE-TREE'))
            .slice(0, 15);

          sendEvent('step', {
            stepId: 'clerk',
            status: 'running',
            detail: `Reading the supplied documents${hasImages ? ` and ${rankedImages.length} image(s)` : ''} to prepare a factual summary...`,
            logs: [
              `Junior Clerk Model: ${clerkModel}${hasImages ? ' (Vision OCR enabled to transcribe attached screenshots into SQLite)' : ''}`,
              `Top Prioritized Files Being Read First:`,
              ...detectedFileHeaders.map((f, idx) => `  ${idx + 1}. ${f}`),
              `Preparing an AI-extracted document summary, not independent fact verification.`
            ]
          });

          let clerkStreamed = '';
          const clerkRes = await callCopilotModel({
            userId,
            model: clerkModel,
            operation: 'timeline-extract',
            caseId: sessionId || 'clerk-digest',
            systemPrompt: buildDigestSystemPrompt(),
            userPrompt: effectiveRawInput.slice(0, 95000),
            images: rankedImages,
            maxTokens: ADVICE_MAX_TOKENS,
            onChunk: (deltaChunk) => {
              clerkStreamed += deltaChunk;
              sendEvent('step', {
                stepId: 'clerk',
                status: 'running',
                detail: 'Summarizing the documents. Names, dates and extracted text should be checked against the originals.',
                liveText: clerkStreamed
              });
            }
          });

          if (clerkRes.completion.incomplete) {
            throw new Error('The document summary was cut short. It has not been saved as a complete record. Try fewer documents or a smaller selection before continuing.');
          }
          activeFolderDigest = activeFolderDigest
            ? `${activeFolderDigest}\n\n--- NEWLY ATTACHED RECORD SUMMARY ---\n${clerkRes.content}`
            : clerkRes.content;
          sendEvent('step', {
            stepId: 'clerk',
            status: 'done',
            detail: 'Document summary prepared. Check it against the originals before relying on it.',
            liveText: activeFolderDigest
          });
        } else {
          sendEvent('step', {
            stepId: 'clerk',
            status: 'done',
            detail: activeFolderDigest
              ? 'Using the document summary already saved in this conversation.'
              : 'Your input is short enough to read directly.',
            liveText: activeFolderDigest || ''
          });
        }

        // STAGE B PREPARATION: Query-Aware BM25 Chunk Retrieval + Live Web & Verified Statutory Reference Grounding
        sendEvent('step', {
          stepId: 'evidence',
          status: 'running',
          detail: 'Checking verified Indian statutory references, official .gov.in portals & your documents...'
        });

        const retrievalQuery = userQuestionOnly || `${mode} ${inferredCaseState.stage || ''} ${inferredCaseState.multiOpSummary || ''} order sheet rejoinder written version`;
        const { selectedText: retrievedChunksText, matchedSources } = folderCorpusOnly
          ? retrieveRelevantFolderChunks(folderCorpusOnly, retrievalQuery, 26000)
          : { selectedText: '(No external case folder uploaded — use the user question and the Verified Reference Pack / Live Web Lookup below)', matchedSources: [] };

        const groundedLegal = await buildGroundedLegalContext(
          `${userQuestionOnly || effectiveRawInput} ${inferredCaseState.subTrack || ''} ${engineResult.domainInfo?.domain || ''} ${priorTurnsContext.slice(0, 600)}`,
          mode
        );
        engineResult.retrievedSources = matchedSources;
        engineResult.verifiedReferences = groundedLegal.verifiedRefs.map(r => r.title);
        engineResult.liveWebResults = groundedLegal.webResults;

        const systemPrompt = buildAnalysisSystemPrompt({ mode, isFollowUpTurn });

        // Pass any newly uploaded images (`images` is already filtered to unsyncedImages by the client) on both initial and follow-up turns!
        const sendImagesToSenior = hasImages ? rankedImages.slice(0, 6) : [];
        const imageSummary = sendImagesToSenior.length > 0
          ? `\n\nATTACHED SCREENSHOTS (${sendImagesToSenior.length} top-priority court/annexure images attached; full OCR also in Digest above): ${sendImagesToSenior.map((img, i) => `[Image ${i + 1}: ${img.name || 'screenshot'}]`).join(', ')}.`
          : '';

        const userPrompt = `=== STATIC CASE WORKSPACE PREFIX (KV-CACHE ALIGNED) ===
MODE: ${mode}
CASE STATE (form inputs and any record-based inferences; not independently verified):
${JSON.stringify(inferredCaseState, null, 2)}
${inferredReasons.length ? `\nAUTO-DETECTED FACTS FROM FOLDER ORDER SHEETS:\n- ${inferredReasons.join('\n- ')}\n` : ''}
DETERMINISTIC RULE ENGINE OUTPUT:
${JSON.stringify(engineResult, null, 2)}

=== VERIFIED INDIAN STATUTORY & OFFICIAL PORTAL REFERENCE PACK + LIVE WEB LOOKUP ===
${groundedLegal.contextBlock}

=== CASE DOCUMENT DIGEST & IMAGE TRANSCRIPTION (AI-extracted; check against source) ===
${activeFolderDigest || '(No folder digest — see raw record below)'}

=== QUERY-MATCHED RAW DOCUMENT SECTIONS (BM25 Top Matches for Current Question) ===
${retrievedChunksText || '(See Case Digest above)'}${priorTurnsContext}

=== CURRENT USER QUESTION / INSTRUCTION (Turn Intent: ${turnIntent.intent}) ===
${userQuestionOnly || 'Explain the supplied situation and the most useful next step for this mode, identifying missing facts before recommending action.'}${imageSummary}`;

        sendEvent('step', {
          stepId: 'evidence',
          status: 'done',
          detail: `Loaded ${groundedLegal.verifiedRefs.length} statutory reference pack(s)${groundedLegal.webResults.length ? ` + ${groundedLegal.webResults.length} live web result(s)` : ''}${matchedSources.length ? ` + ${matchedSources.length} document section(s)` : ''}.`,
          logs: [
            `Turn Intent Classification: ${turnIntent.intent} (${turnIntent.reason})`,
            `Router Model Selected for Stage B: '${resolvedSeniorModel}'`,
            `Verified Statutory Packs Matched: ${groundedLegal.verifiedRefs.map(r => r.title).join(' | ') || 'None'}`,
            groundedLegal.webResults.length
              ? `Live Official/Web Results Retrieved:\n` + groundedLegal.webResults.map((w, i) => `  ${i + 1}. ${w.title} (${w.url})`).join('\n')
              : `Live Web Search: Relying on verified statutory reference pack`,
            `Static case context placed first for providers that support prompt caching.`,
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
          detail: 'Explaining your situation, options and most useful next steps...',
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
          maxTokens: ADVICE_MAX_TOKENS,
          onChunk: (deltaText) => {
            sendEvent('delta', { delta: deltaText });
          }
        });

        // Deterministic Post-Generation Fact & Record Verifier (Zero LLM Cost Guardrail)
        const verification = verifyDraftAgainstRecord(llmRes.content, inferredCaseState, {
          domain: engineResult.domainInfo?.domain || 'consumer',
          paidAmountInr: engineResult.paidAmountInr
        });
        engineResult.verification = verification;
        engineResult.responseCompletion = llmRes.completion;

        sendEvent('step', {
          stepId: 'llm',
          status: 'done',
          detail: `${llmRes.completion.incomplete ? 'Incomplete answer' : 'Answer finished'} by ${llmRes.model} in ${(llmRes.billingEntry.latencyMs / 1000).toFixed(1)}s (${llmRes.billingEntry.totalTokens} tokens · ₹${llmRes.billingEntry.estimatedInr.toFixed(3)}) · Limited record checks: ${verification.verified ? 'no conflicts detected' : 'review needed'}`,
          logs: [
            `Model: ${llmRes.model} · Latency: ${(llmRes.billingEntry.latencyMs / 1000).toFixed(1)}s · Tokens: ${llmRes.billingEntry.totalTokens}`,
            `Limited automated record checks (not legal verification):`,
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
          billingTotals: scopeBillingForUser(readBillingLedger(), userId).totals
        });
        res.end();
      } catch (streamErr) {
        sendEvent('error', { error: streamErr.message || String(streamErr) });
        res.end();
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/analyze') {
      const rateCheck = checkIpRateLimit(req, 20);
      if (!rateCheck.allowed) {
        sendJson(res, 429, { error: 'Rate limit exceeded (max 20 analyses/minute per IP). Please wait a moment.' });
        return;
      }
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
      const priorTurnsContext = buildPriorTurnsContext(existingSession?.turns || [], 600, 900);
      const effectiveRawInput = redactPiiForCloud(rawInput);

      const { inferredCaseState } = inferCaseStateFromFolder({
        fileNames: [],
        combinedText: effectiveRawInput,
        currentCaseState: caseState
      });

      const engineResult = computeCaseEngine(inferredCaseState, { door, mode, rawInput: effectiveRawInput });
      const groundedLegal = await buildGroundedLegalContext(effectiveRawInput, mode);
      engineResult.verifiedReferences = groundedLegal.verifiedRefs.map(r => r.title);
      engineResult.liveWebResults = groundedLegal.webResults;
      const systemPrompt = buildAnalysisSystemPrompt({
        mode,
        isFollowUpTurn: Boolean(existingSession?.turns?.length)
      });

      const imageSummary = Array.isArray(images) && images.length > 0
        ? `\n\nATTACHED SCREENSHOTS / IMAGES (${images.length}): ${images.map((img, i) => `[Image ${i + 1}: ${img.name || 'screenshot'}]`).join(', ')}. Carefully read all visible text, timestamps, amounts, and court/chat details inside the attached images.`
        : '';

      const userPrompt = `MODE: ${mode}
CASE STATE (JSON):
${JSON.stringify(inferredCaseState, null, 2)}

DETERMINISTIC RULE ENGINE OUTPUT:
${JSON.stringify(engineResult, null, 2)}

=== VERIFIED INDIAN STATUTORY & OFFICIAL PORTAL REFERENCE PACK + LIVE WEB LOOKUP ===
${groundedLegal.contextBlock}${priorTurnsContext}

CURRENT USER UPDATE / QUESTION / RAW WHATSAPP CHAT / DOCUMENTS:
${effectiveRawInput || '(See attached images and Case State above)'}${imageSummary}`;

      const llmRes = await callCopilotModel({
        userId,
        model,
        operation: mode,
        caseId: sessionId || caseState.id || 'live-workspace',
        systemPrompt,
        userPrompt,
        images,
        maxTokens: ADVICE_MAX_TOKENS
      });
      const verification = verifyDraftAgainstRecord(llmRes.content, inferredCaseState, {
        domain: engineResult.domainInfo?.domain || 'consumer',
        paidAmountInr: engineResult.paidAmountInr
      });
      engineResult.verification = verification;
      engineResult.responseCompletion = llmRes.completion;

      const updatedSession = saveOrAppendSessionTurn({
        userId,
        sessionId: existingSession?.id || sessionId,
        title: saveCaseTitle || existingSession?.title,
        door,
        mode,
        caseState: inferredCaseState,
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
        billingTotals: scopeBillingForUser(readBillingLedger(), userId).totals
      });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { error: err.message || String(err) });
  }
}).listen(port, host, () => {
  console.log(`Nyaya Live Product Server running at http://127.0.0.1:${server.address().port}`);
});
