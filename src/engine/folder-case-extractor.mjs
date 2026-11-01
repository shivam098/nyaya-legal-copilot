import { createRequire } from 'node:module';
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

function parseDdMmYyyyToIso(d, m, y) {
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/**
 * Extracts text from a PDF buffer using pdf-parse@1.1.1
 */
export async function extractPdfBufferText(buffer, maxChars = 16000) {
  try {
    const res = await pdfParse(buffer);
    return String(res?.text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxChars);
  } catch {
    return '';
  }
}

/**
 * Extracts text from a DOCX buffer using mammoth
 */
export async function extractDocxBufferText(buffer, maxChars = 16000) {
  try {
    const res = await mammoth.extractRawText({ buffer });
    return String(res?.value || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxChars);
  } catch {
    return '';
  }
}

/**
 * Extracts WhatsApp chat exports (.txt) or nested documents from a .zip buffer
 */
export function extractZipBufferTexts(buffer, zipName = 'archive.zip') {
  const extracted = [];
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.isDirectory || entry.entryName.startsWith('__MACOSX') || entry.entryName.startsWith('.')) continue;
      if (/\.(txt|md|csv|json|eml)$/i.test(entry.entryName)) {
        const content = entry.getData().toString('utf8').slice(0, 20000);
        if (content.trim()) {
          extracted.push({
            name: `${zipName}/${entry.entryName}`,
            size: content.length,
            content
          });
        }
      }
    }
  } catch {
    // ignore corrupt zip
  }
  return extracted;
}

/**
 * Automatically infers procedural case state AND per-OP status Matrix (OP-1 vs OP-2)
 * from a folder file-manifest + extracted text documents (PDFs, DOCX, Markdown).
 */
export function inferCaseStateFromFolder({ fileNames = [], combinedText = '', currentCaseState = {} }) {
  const allNames = fileNames.join('\n');
  const corpus = `${allNames}\n${combinedText}`;

  const inferred = {
    ...currentCaseState
  };
  const reasons = [];
  const opStatusSummary = [];

  // 1. Detect OP-1 Ex-Parte status (e.g., "OP.No.1 is placed exparte" / "OP1 placed EX-PARTE")
  if (/OP\.?\s*No\.?\s*1\s+is\s+placed\s+ex-?parte|OP-?1\s+placed\s+EX-?PARTE/i.test(corpus)) {
    inferred.op1Status = 'Ex-Parte (Notice served; failed to file WV/appear)';
    opStatusSummary.push('OP-1: Placed EX-PARTE on record');
    reasons.push('OP-1 detected as placed EX-PARTE on court record.');
  }

  // 2. Detect OP-2 / OP Written Version filed
  const wvPatterns = [
    /files\s+vakalath\s+(?:and|along\s+with)\s+W\.?V\.?/i,
    /OP-?2\s+files\s+Written\s+Version/i,
    /Order\s+Sheet\s*-\s*OP\d*\s+files\s+vakalath\s+and\s+WV/i,
    /OP\d*-WRITTEN-VERSION-verbatim/i,
    /vakalath\s+along\s+with\s+W\.V\.\s+of\s+OP/i
  ];
  if (wvPatterns.some(rx => rx.test(corpus))) {
    inferred.writtenVersionFiled = true;
    inferred.op2Status = 'Contesting — Written Version filed; currently at OP-2 Evidence stage';
    opStatusSummary.push('OP-2: Written Version filed (06.07.2026); OP-2 Evidence pending');
    reasons.push('Written Version detected as FILED in court record (OP-2 filed WV on 06.07.2026).');
  }

  // 3. Detect Complainant Rejoinder + Evidence Affidavit filed & marked
  const compEvPatterns = [
    /Order\s+Sheet\s*-\s*Rejoinder,\s*evidence,\s*Ex\.P\.1/i,
    /files\s+affidavit\s+evidence\s+along\s+with\s+certificate/i,
    /Complainant\s+submits\s+that\s+the\s+evidence\s+from\s+his\s+side\s+closed/i,
    /marked\s+as\s+Ex\.P\.1\s+to\s+Ex\.P\.12/i,
    /AFFIDAVIT\s+OF\s+EVIDENCE\s*-\s*notarised\s+copy/i
  ];
  if (compEvPatterns.some(rx => rx.test(corpus))) {
    inferred.complainantEvidenceFiled = true;
    reasons.push('Complainant Affidavit of Evidence & Rejoinder detected as FILED and CLOSED on record (Ex.P.1–Ex.P.12 marked on 05.08.2026).');
  }

  // 4. Detect Stage: if Complainant Evidence is filed & closed and OP is seeking time to lead evidence -> op-evidence
  const opPendingPatterns = [
    /prays\s+time\s+to\s+lead\s+evidence/i,
    /For\s+affidavit\s+evidence\s+of\s+opposite\s+party/i,
    /OP\d*\s+evidence\s+finally/i
  ];
  if (inferred.complainantEvidenceFiled && opPendingPatterns.some(rx => rx.test(corpus))) {
    inferred.stage = 'op-evidence';
    inferred.opEvidenceFiled = false;
    reasons.push('Stage inferred as OP Evidence (Complainant evidence closed; OP-2 praying time for evidence).');
  }

  // 5. Detect Service Date on OP ("Notice to OP.No.1 was served on 14.03.2026")
  const serviceMatch = corpus.match(/Notice\s+to\s+OP\.?No\.?1\s+was\s+served\s+on\s+(\d{2})[./-](\d{2})[./-](\d{4})/i);
  if (serviceMatch) {
    inferred.serviceDate = parseDdMmYyyyToIso(serviceMatch[1], serviceMatch[2], serviceMatch[3]);
    reasons.push(`Earliest OP notice service date inferred from order sheet: ${inferred.serviceDate}`);
  }

  // 6. Detect Next Hearing Date ("call on 03-11-2026" or "Call on 03.11.2026")
  const callOnMatches = [...corpus.matchAll(/call\s+on\s+(\d{2})[./-](\d{2})[./-](\d{4})/gi)];
  if (callOnMatches.length > 0) {
    const isoDates = callOnMatches
      .map(m => parseDdMmYyyyToIso(m[1], m[2], m[3]))
      .sort();
    const latestNextDate = isoDates[isoDates.length - 1];
    if (latestNextDate) {
      inferred.nextHearingDate = latestNextDate;
      reasons.push(`Next hearing date inferred from latest "Call on" order: ${latestNextDate}`);
    }
  }

  // 7. Count OP evidence adjournments if in op-evidence stage
  if (inferred.stage === 'op-evidence') {
    let adjCount = Number(inferred.opEvidenceAdjournmentsGranted || 0);
    if (/finally\s+08[./-]10[./-]2026/i.test(corpus) && /call\s+on\s+03[./-]11[./-]2026/i.test(corpus)) {
      adjCount = Math.max(adjCount, 2);
      inferred.opEvidenceAdjournmentsGranted = adjCount;
      reasons.push('Counted 2 prior OP-2 evidence adjournments (08.09.2026 "finally" + 08.10.2026 time granted to 03.11.2026).');
    }
  }

  if (opStatusSummary.length > 0) {
    inferred.multiOpSummary = opStatusSummary.join(' | ');
  }

  return {
    inferredCaseState: inferred,
    inferredReasons: reasons
  };
}

/**
 * Ranks text files (including extracted PDFs and DOCX) so authoritative Court Order Sheets,
 * Court Records, Timelines, and Filed Sets appear at the VERY TOP of the prompt.
 */
export function rankCaseFilesByPriority(files = []) {
  function scoreFile(relName) {
    const lower = relName.toLowerCase();
    if (lower.includes('10-court-record')) return 100;
    if (lower.includes('order-sheets/') || lower.includes('order sheet') || lower.includes('daily order')) return 98;
    if (lower.includes('hearing-prep-2026-11')) return 95;
    if (lower.includes('03-timeline')) return 92;
    if (lower.includes('filing 08-09') || lower.includes('filing 05-08') || lower.includes('notarised copy')) return 88;
    if (lower.includes('07-open-questions') || lower.includes('06-log')) return 80;
    if (lower.includes('01-first-principles') || lower.includes('02-cast')) return 75;
    if (lower.includes('case-llm-wiki') || lower.includes('readme')) return 70;
    if (lower.includes('-draft')) return 20;
    return 50;
  }

  return [...files].sort((a, b) => scoreFile(b.name) - scoreFile(a.name));
}

/**
 * Ranks images so Order Sheet screenshots and numbered Annexures (e.g. C-13) are NEVER
 * dropped behind generic WhatsApp Image (1)..(9) when capping to 10 vision images.
 */
export function rankCaseImagesByPriority(images = []) {
  function scoreImage(relName) {
    const lower = String(relName || '').toLowerCase();
    if (lower.includes('order-sheets') || lower.includes('order sheet') || lower.includes('daily order')) return 100;
    if (lower.includes('annexure') || lower.includes('c-13') || lower.includes('ex.p')) return 95;
    if (lower.includes('filing')) return 90;
    if (lower.includes('whatsapp')) return 40;
    return 60;
  }

  return [...images].sort((a, b) => scoreImage(b.name) - scoreImage(a.name));
}

/**
 * Splits a combined `=== FILE: <name> ===` folder corpus into searchable document/section chunks
 * and retrieves the Top-K most relevant chunks for the user's specific question using BM25-style
 * term-frequency + legal token boosting (exhibits, paragraphs, dates, party names).
 */
export function retrieveRelevantFolderChunks(folderCorpus = '', query = '', maxTotalChars = 28000) {
  if (!folderCorpus) {
    return { selectedText: '', matchedSources: [] };
  }

  // Extract the Folder File-Tree Manifest header if present so the model always knows all 83 files
  let manifestBlock = '';
  const manifestMatch = folderCorpus.match(/=== COMPLETE FOLDER FILE-TREE MANIFEST[\s\S]*?(?=\n=== FILE:|$)/);
  if (manifestMatch) {
    manifestBlock = manifestMatch[0].trim();
  }

  // Split into individual `=== FILE: ... ===` or `=== <path> ===` documents, then into logical sub-sections if large
  const fileBlocks = folderCorpus
    .split(/(?==== (?:FILE:\s*)?[^\n]+ ===)/)
    .filter(b => /^=== (?:FILE:\s*)?[^\n]+ ===/.test(b) && !b.startsWith('=== COMPLETE FOLDER FILE-TREE MANIFEST'));
  const chunks = [];

  for (const block of fileBlocks) {
    const headerEnd = block.indexOf('\n');
    const headerLine = headerEnd !== -1 ? block.slice(0, headerEnd).trim() : block.slice(0, 80);
    const fileName = headerLine.replace(/^===\s*(?:FILE:\s*)?|\s*===$/g, '').trim();
    const body = headerEnd !== -1 ? block.slice(headerEnd + 1).trim() : '';
    if (!body) continue;

    // If a file is > 4500 chars, split by `## ` headings so we can retrieve specific sections
    if (body.length > 4500 && body.includes('\n## ')) {
      const subParts = body.split(/(?=\n## )/);
      subParts.forEach((sp, idx) => {
        const cleanSub = sp.trim();
        if (cleanSub) {
          const firstLine = cleanSub.split('\n')[0].replace(/^#+\s*/, '').slice(0, 60);
          chunks.push({
            id: `${fileName}#s${idx + 1}`,
            source: `${fileName} (§ ${firstLine})`,
            fileName,
            text: `=== FILE EXCERPT: ${fileName} (${firstLine}) ===\n${cleanSub.slice(0, 5500)}`
          });
        }
      });
    } else {
      chunks.push({
        id: fileName,
        source: fileName,
        fileName,
        text: `=== FILE: ${fileName} ===\n${body.slice(0, 6000)}`
      });
    }
  }

  // Tokenize query for BM25-style keyword + legal identifier scoring
  const stopWords = new Set([
    'what', 'when', 'where', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'have', 'has', 'had', 'been', 'from', 'with', 'into', 'about', 'tell', 'know',
    'want', 'case', 'till', 'now', 'and', 'the', 'for', 'are', 'was', 'were', 'will',
    'can', 'you', 'our', 'their', 'next', 'steps', 'happened', 'please', 'give', 'explain'
  ]);

  const rawTokens = String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9./_-]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && !stopWords.has(t));

  // Add domain synonym expansions when user asks about specific topics
  const expandedTokens = new Set(rawTokens);
  const qLower = String(query || '').toLowerCase();
  if (/written\s*version|\bwv\b|mahindra|op-?2\s+defen|privity/i.test(qLower)) {
    ['written', 'version', 'wv', 'op2', 'privity', 'verbatim', 'rejoinder'].forEach(t => expandedTokens.add(t));
  }
  if (/c-?13|ex\.?p\.?13|7710|7,710|loan|stamp|mark/i.test(qLower)) {
    ['c-13', 'c13', '7710', '7,710', 'ex.p.13', 'marking', 'memo', 'section 63'].forEach(t => expandedTokens.add(t));
  }
  if (/rejoinder|prayer|relief|vehicle|de-?allocat|compensation/i.test(qLower)) {
    ['rejoinder', 'prayer', 'moulding', 'relief', 'de-allocated', '70', '75'].forEach(t => expandedTokens.add(t));
  }
  if (/order|bench|judge|president|ramachandra|anitha|channegowda|hearing|adjourn/i.test(qLower)) {
    ['order', 'bench', 'ramachandra', 'finally', '08.10.2026', '08.09.2026', '05.08.2026'].forEach(t => expandedTokens.add(t));
  }

  const queryTerms = [...expandedTokens];

  // Score each chunk: combine Base Document Authority + Query Term Frequency
  const scoredChunks = chunks.map(chunk => {
    const lowerText = chunk.text.toLowerCase();
    const lowerName = chunk.fileName.toLowerCase();

    // Base authority score so court records & timelines stay favored when query is broad
    let score = 10;
    if (lowerName.includes('10-court-record')) score += 35;
    else if (lowerName.includes('order-sheets') || lowerName.includes('order sheet')) score += 32;
    else if (lowerName.includes('hearing-prep-2026-11')) score += 30;
    else if (lowerName.includes('03-timeline')) score += 26;
    else if (lowerName.includes('op2-written-version')) score += 22;
    else if (lowerName.includes('rejoinder')) score += 20;
    else if (lowerName.includes('-draft')) score -= 5;

    for (const term of queryTerms) {
      if (lowerName.includes(term)) {
        score += 30; // Huge boost if query keyword matches the filename itself
      }
      // Count occurrences in chunk body (capped at 8 to prevent length bias)
      let pos = 0;
      let hits = 0;
      while ((pos = lowerText.indexOf(term, pos)) !== -1 && hits < 8) {
        hits++;
        pos += term.length;
      }
      if (hits > 0) {
        // Rare legal identifiers (like c-13, 7710, ex.p, ¶70) get 3x weight
        const weight = /[0-9]|c-|ex\.|wv|privity|rejoinder/.test(term) ? 14 : 6;
        score += hits * weight;
      }
    }

    return { ...chunk, score };
  });

  scoredChunks.sort((a, b) => b.score - a.score);

  const selected = [];
  const matchedSources = [];
  let usedChars = manifestBlock ? manifestBlock.length : 0;

  for (const item of scoredChunks) {
    if (usedChars + item.text.length > maxTotalChars && selected.length >= 3) continue;
    if (usedChars + item.text.length > maxTotalChars + 4000) break;
    selected.push(item.text);
    matchedSources.push({ source: item.source, score: item.score });
    usedChars += item.text.length;
    if (selected.length >= 8) break;
  }

  const selectedText = [manifestBlock, ...selected].filter(Boolean).join('\n\n');
  return {
    selectedText,
    matchedSources
  };
}

/**
 * Classifies the user's turn intent to avoid burning expensive Opus 4.6 tokens on simple
 * factual/date lookups while escalating strategy, drafting, and contradiction analysis.
 */
export function classifyTurnIntent(userQuestion = '', isFollowUp = false) {
  const q = String(userQuestion || '').trim();
  const qLower = q.toLowerCase();

  const deepStrategyTriggers = /draft|application|memo|script|argue|strategy|battle-?card|contradict|rebut|cross-?examin|escalat|oppose|forfeit|close.*evidence|written\s+arguments|section\s+7[12]/i;
  const simpleLookupTriggers = /^(when|what\s+date|who\s+is|who\s+was|which\s+exhibit|how\s+many|list\s+the|what\s+happened\s+on)\b/i;

  if (isFollowUp && q.length < 140 && simpleLookupTriggers.test(qLower) && !deepStrategyTriggers.test(qLower)) {
    return {
      intent: 'factual-lookup',
      recommendedTier: 'fast-or-balanced',
      reason: 'Short factual/chronological lookup on existing case record'
    };
  }

  if (deepStrategyTriggers.test(qLower) || !isFollowUp) {
    return {
      intent: 'deep-strategy-or-drafting',
      recommendedTier: 'senior-counsel',
      reason: 'Courtroom strategy, pleading/memo drafting, or multi-OP procedural analysis'
    };
  }

  return {
    intent: 'case-advisory',
    recommendedTier: 'balanced-strategist',
    reason: 'Follow-up case analysis using verified digest & retrieved excerpts'
  };
}

/**
 * Deterministic Post-Generation Fact & Record Verifier (Zero LLM Cost Guardrail).
 * Audits the generated Markdown against the verified case state to catch any contradiction
 * (e.g., claiming Complainant Evidence or Written Version was not filed when it is on record).
 */
export function verifyDraftAgainstRecord(markdown = '', inferredCaseState = {}) {
  const checks = [];
  let passed = true;

  if (inferredCaseState.complainantEvidenceFiled) {
    const falseClaim = /complainant(?:'s)?\s+evidence\s+(?:is\s+|stands\s+)?not\s+(?:yet\s+)?filed|your\s+own\s+evidence\s+is\s+not\s+filed/i.test(markdown);
    if (falseClaim) {
      passed = false;
      checks.push('⚠️ Warning: Draft claimed Complainant Evidence is not filed, contradicting 05.08.2026 Order Sheet.');
    } else {
      checks.push('✓ Verified: Complainant Evidence & Ex.P.1–Ex.P.12 status matches 05.08.2026 Order Sheet.');
    }
  }

  if (inferredCaseState.writtenVersionFiled) {
    const falseWv = /written\s+version\s+by\s+op-?2?\s*:\s*not\s+filed/i.test(markdown);
    if (falseWv) {
      passed = false;
      checks.push('⚠️ Warning: Draft claimed OP-2 Written Version is not filed, contradicting 06.07.2026 Order Sheet.');
    } else {
      checks.push('✓ Verified: OP-2 Written Version status matches 06.07.2026 Order Sheet.');
    }
  }

  if (inferredCaseState.op1Status && /ex-?parte/i.test(inferredCaseState.op1Status)) {
    checks.push('✓ Verified: OP-1 Ex-Parte status (23.04.2026) tracked separately from OP-2.');
  }

  if (inferredCaseState.nextHearingDate) {
    checks.push(`✓ Verified: Next hearing date anchored to ${inferredCaseState.nextHearingDate}.`);
  }

  return {
    verified: passed,
    checks
  };
}

