/**
 * Interaction log: one row per question sent to Nyaya (answered or failed), for Super-Admin review.
 *
 * Every analyze request is recorded with who asked (signed-in user or guest), what was asked, what Nyaya
 * answered, how it was routed, and how it performed. Rows also carry a review state so the team can mark
 * answers as good or needing a fix and turn them into improvements.
 *
 * Logging must never break a user's request: every write is wrapped and failures go to stderr only.
 * Inputs are stored after the same PII redaction the model sees; IPs are stored only as hashes.
 */
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { getSessionDatabase } from './session-db.mjs';

const db = getSessionDatabase();

db.exec(`
  CREATE TABLE IF NOT EXISTS interaction_logs (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    status TEXT NOT NULL,
    http_status INTEGER DEFAULT 200,
    user_id TEXT DEFAULT '',
    auth_state TEXT NOT NULL DEFAULT 'guest',
    user_email TEXT DEFAULT '',
    user_role TEXT DEFAULT 'user',
    session_id TEXT DEFAULT '',
    turn_id INTEGER,
    turn_index INTEGER,
    requested_door TEXT DEFAULT '',
    requested_mode TEXT DEFAULT '',
    requested_model TEXT DEFAULT '',
    effective_mode TEXT DEFAULT '',
    domain TEXT DEFAULT '',
    category_label TEXT DEFAULT '',
    intake_kind TEXT DEFAULT '',
    intake_stage TEXT DEFAULT '',
    clarifying_questions_json TEXT DEFAULT '[]',
    request_text TEXT DEFAULT '',
    images_count INTEGER DEFAULT 0,
    has_documents INTEGER DEFAULT 0,
    is_follow_up INTEGER DEFAULT 0,
    response_text TEXT DEFAULT '',
    model_used TEXT DEFAULT '',
    tokens INTEGER DEFAULT 0,
    cost_inr REAL DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    completion_incomplete INTEGER DEFAULT 0,
    verification_passed INTEGER,
    error_message TEXT DEFAULT '',
    app_version TEXT DEFAULT '',
    device_id TEXT DEFAULT '',
    ip_hash TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    user_rating INTEGER DEFAULT 0,
    user_feedback_note TEXT DEFAULT '',
    review_status TEXT NOT NULL DEFAULT 'unreviewed',
    review_tags TEXT DEFAULT '',
    review_note TEXT DEFAULT '',
    reviewed_by TEXT DEFAULT '',
    reviewed_at TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_ilog_created ON interaction_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ilog_user ON interaction_logs(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ilog_status ON interaction_logs(status);
  CREATE INDEX IF NOT EXISTS idx_ilog_review ON interaction_logs(review_status);
  CREATE INDEX IF NOT EXISTS idx_ilog_turn ON interaction_logs(turn_id);
`);

export const LOG_STATUSES = ['ok', 'incomplete', 'error', 'rate_limited', 'quota_exceeded', 'client_aborted'];
export const REVIEW_STATUSES = ['unreviewed', 'good', 'needs-fix', 'fixed'];
export const REVIEW_TAGS = [
  'wrong-law-or-domain',
  'irrelevant-questions',
  'legal-error',
  'missed-facts',
  'too-long',
  'unclear-language',
  'formatting',
  'made-up-citation',
  'slow',
  'ui-problem'
];

const APP_VERSION = (() => {
  if (process.env.NYAYA_APP_VERSION) return process.env.NYAYA_APP_VERSION;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
})();

export function newInteractionId() {
  return `ilog-${crypto.randomUUID()}`;
}

const MAX_TEXT = 200_000;
const clip = (v, n = MAX_TEXT) => String(v ?? '').slice(0, n);
const toInt = v => (v === null || v === undefined || v === '' ? null : Number(v));

/**
 * Records one interaction. Never throws.
 */
export function logInteraction(entry = {}) {
  try {
    const pi = entry.engineResult?.practitionerIntelligence || null;
    const questions = (pi?.factProbing?.clarifyingQuestions || []).map(q => q.question).filter(Boolean);
    const status = LOG_STATUSES.includes(entry.status) ? entry.status : 'ok';
    db.prepare(`
      INSERT OR REPLACE INTO interaction_logs (
        id, created_at, endpoint, status, http_status, user_id, auth_state, user_email, user_role,
        session_id, turn_id, turn_index, requested_door, requested_mode, requested_model, effective_mode,
        domain, category_label, intake_kind, intake_stage, clarifying_questions_json, request_text,
        images_count, has_documents, is_follow_up, response_text, model_used, tokens, cost_inr, latency_ms,
        completion_incomplete, verification_passed, error_message, app_version, device_id, ip_hash, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id || newInteractionId(),
      entry.createdAt || new Date().toISOString(),
      clip(entry.endpoint, 80),
      status,
      Number(entry.httpStatus || 200),
      clip(entry.userId, 200),
      entry.authenticated ? 'signed-in' : 'guest',
      clip(entry.userEmail, 320),
      clip(entry.userRole || 'user', 40),
      clip(entry.sessionId, 120),
      toInt(entry.turnId),
      toInt(entry.turnIndex),
      clip(entry.requestedDoor, 60),
      clip(entry.requestedMode, 60),
      clip(entry.requestedModel, 80),
      clip(entry.effectiveMode || entry.engineResult?.effectiveMode, 60),
      clip(entry.engineResult?.domainInfo?.domain, 60),
      clip(entry.engineResult?.autoDetectedCategoryLabel, 200),
      clip(pi?.factReadiness?.kind || (pi ? 'dispute' : ''), 30),
      clip(pi?.factReadiness?.intakeStage, 30),
      JSON.stringify(questions.slice(0, 10)),
      clip(entry.requestText),
      Number(entry.imagesCount || 0),
      entry.hasDocuments ? 1 : 0,
      entry.isFollowUp ? 1 : 0,
      clip(entry.responseText),
      clip(entry.modelUsed, 80),
      Number(entry.tokens || 0),
      Number(entry.costInr || 0),
      Number(entry.latencyMs || 0),
      entry.engineResult?.responseCompletion?.incomplete ? 1 : 0,
      entry.engineResult?.verification ? (entry.engineResult.verification.verified ? 1 : 0) : null,
      clip(entry.errorMessage, 2000),
      APP_VERSION,
      clip(entry.deviceId, 120),
      clip(entry.ipHash, 120),
      clip(entry.userAgent, 300)
    );
    return true;
  } catch (err) {
    console.error(`[interaction-log] write failed: ${err.message}`);
    return false;
  }
}

function buildWhere(filters = {}) {
  const where = [];
  const params = [];
  if (filters.authState && ['signed-in', 'guest'].includes(filters.authState)) {
    where.push('auth_state = ?');
    params.push(filters.authState);
  }
  if (filters.status && LOG_STATUSES.includes(filters.status)) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.failuresOnly) {
    where.push(`status <> 'ok'`);
  }
  if (filters.reviewStatus && REVIEW_STATUSES.includes(filters.reviewStatus)) {
    where.push('review_status = ?');
    params.push(filters.reviewStatus);
  }
  if (filters.domain) {
    where.push('domain = ?');
    params.push(String(filters.domain));
  }
  if (filters.rating !== undefined && filters.rating !== null && filters.rating !== '' && [-1, 0, 1].includes(Number(filters.rating))) {
    where.push('user_rating = ?');
    params.push(Number(filters.rating));
  }
  if (filters.userId) {
    where.push('user_id = ?');
    params.push(String(filters.userId));
  }
  if (filters.sessionId) {
    where.push('session_id = ?');
    params.push(String(filters.sessionId));
  }
  if (filters.from) {
    where.push('created_at >= ?');
    params.push(String(filters.from));
  }
  if (filters.to) {
    where.push('created_at <= ?');
    params.push(String(filters.to));
  }
  if (filters.q) {
    const like = `%${String(filters.q).replace(/[%_]/g, m => `\\${m}`)}%`;
    where.push(`(request_text LIKE ? ESCAPE '\\' OR response_text LIKE ? ESCAPE '\\' OR user_email LIKE ? ESCAPE '\\' OR review_note LIKE ? ESCAPE '\\' OR category_label LIKE ? ESCAPE '\\')`);
    params.push(like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function rowToEntry(r, { full = false } = {}) {
  const question = String(r.request_text || '').split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0].trim();
  const base = {
    id: r.id,
    createdAt: r.created_at,
    endpoint: r.endpoint,
    status: r.status,
    httpStatus: r.http_status,
    userId: r.user_id,
    authState: r.auth_state,
    userEmail: r.user_email,
    userRole: r.user_role,
    sessionId: r.session_id,
    turnId: r.turn_id,
    turnIndex: r.turn_index,
    effectiveMode: r.effective_mode,
    domain: r.domain,
    categoryLabel: r.category_label,
    intakeKind: r.intake_kind,
    intakeStage: r.intake_stage,
    imagesCount: r.images_count,
    hasDocuments: Boolean(r.has_documents),
    isFollowUp: Boolean(r.is_follow_up),
    modelUsed: r.model_used,
    tokens: r.tokens,
    costInr: r.cost_inr,
    latencyMs: r.latency_ms,
    completionIncomplete: Boolean(r.completion_incomplete),
    verificationPassed: r.verification_passed === null ? null : Boolean(r.verification_passed),
    errorMessage: r.error_message,
    appVersion: r.app_version,
    userRating: r.user_rating,
    userFeedbackNote: r.user_feedback_note,
    reviewStatus: r.review_status,
    reviewTags: String(r.review_tags || '').split(',').filter(Boolean),
    reviewNote: r.review_note,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    questionPreview: question.slice(0, 240),
    answerPreview: String(r.response_text || '').slice(0, 240)
  };
  if (!full) return base;
  let clarifyingQuestions = [];
  try {
    clarifyingQuestions = JSON.parse(r.clarifying_questions_json || '[]');
  } catch {
    clarifyingQuestions = [];
  }
  return {
    ...base,
    requestedDoor: r.requested_door,
    requestedMode: r.requested_mode,
    requestedModel: r.requested_model,
    clarifyingQuestions,
    requestText: r.request_text,
    responseText: r.response_text,
    deviceId: r.device_id,
    ipHash: r.ip_hash,
    userAgent: r.user_agent
  };
}

export function listInteractionLogs(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 500);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const { sql, params } = buildWhere(filters);
  const rows = db.prepare(`SELECT * FROM interaction_logs ${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM interaction_logs ${sql}`).get(...params).n;
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(auth_state = 'signed-in') AS signed_in,
      SUM(auth_state = 'guest') AS guest,
      SUM(status <> 'ok') AS failures,
      SUM(review_status = 'unreviewed') AS unreviewed,
      SUM(review_status = 'needs-fix') AS needs_fix,
      SUM(user_rating = -1) AS thumbs_down,
      COUNT(DISTINCT user_id) AS distinct_users
    FROM interaction_logs
  `).get();
  const domains = db.prepare(`SELECT domain, COUNT(*) AS n FROM interaction_logs WHERE domain <> '' GROUP BY domain ORDER BY n DESC`).all();
  return {
    total: Number(total || 0),
    limit,
    offset,
    entries: rows.map(r => rowToEntry(r)),
    summary: {
      total: Number(summary.total || 0),
      signedIn: Number(summary.signed_in || 0),
      guest: Number(summary.guest || 0),
      failures: Number(summary.failures || 0),
      unreviewed: Number(summary.unreviewed || 0),
      needsFix: Number(summary.needs_fix || 0),
      thumbsDown: Number(summary.thumbs_down || 0),
      distinctUsers: Number(summary.distinct_users || 0)
    },
    domains: domains.map(d => ({ domain: d.domain, count: Number(d.n) })),
    reviewTags: REVIEW_TAGS
  };
}

export function getInteractionLog(id) {
  const r = db.prepare('SELECT * FROM interaction_logs WHERE id = ?').get(String(id || ''));
  return r ? rowToEntry(r, { full: true }) : null;
}

export function updateInteractionReview(id, { reviewStatus, tags, note, reviewer } = {}) {
  const existing = db.prepare('SELECT id FROM interaction_logs WHERE id = ?').get(String(id || ''));
  if (!existing) return null;
  const status = REVIEW_STATUSES.includes(reviewStatus) ? reviewStatus : 'unreviewed';
  const cleanTags = (Array.isArray(tags) ? tags : String(tags || '').split(','))
    .map(t => String(t).trim())
    .filter(t => REVIEW_TAGS.includes(t));
  db.prepare(`
    UPDATE interaction_logs
    SET review_status = ?, review_tags = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?
    WHERE id = ?
  `).run(status, [...new Set(cleanTags)].join(','), String(note || '').slice(0, 4000), String(reviewer || '').slice(0, 200), new Date().toISOString(), String(id));
  return getInteractionLog(id);
}

/** Keeps the log's copy of a user's 👍/👎 in step with the turn it belongs to. */
export function syncInteractionRating(turnId, rating, note = '') {
  try {
    db.prepare('UPDATE interaction_logs SET user_rating = ?, user_feedback_note = ? WHERE turn_id = ?')
      .run(Number(rating) || 0, String(note || '').slice(0, 1000), Number(turnId));
  } catch (err) {
    console.error(`[interaction-log] rating sync failed: ${err.message}`);
  }
}

export function exportInteractionLogs(filters = {}) {
  const { sql, params } = buildWhere(filters);
  const rows = db.prepare(`SELECT * FROM interaction_logs ${sql} ORDER BY created_at DESC LIMIT 5000`).all(...params);
  return rows.map(r => JSON.stringify(rowToEntry(r, { full: true }))).join('\n');
}

/** Deletes rows older than the retention window. Returns the number removed. */
export function pruneInteractionLogs(retentionDays = Number(process.env.NYAYA_LOG_RETENTION_DAYS || 180)) {
  const days = Number(retentionDays);
  if (!Number.isFinite(days) || days <= 0) return 0;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  try {
    return Number(db.prepare('DELETE FROM interaction_logs WHERE created_at < ?').run(cutoff).changes || 0);
  } catch (err) {
    console.error(`[interaction-log] prune failed: ${err.message}`);
    return 0;
  }
}
