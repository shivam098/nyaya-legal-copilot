import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');
const defaultDataDir = (process.env.WEBSITE_SITE_NAME && fs.existsSync('/home'))
  ? '/home/data'
  : path.join(rootDir, 'data');
const dataDir = process.env.NYAYA_DATA_DIR || defaultDataDir;
const dbPath = path.join(dataDir, 'nyaya.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT DEFAULT 'Anonymous User',
    email TEXT DEFAULT '',
    plan TEXT DEFAULT 'case-pass-499',
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    door TEXT NOT NULL,
    mode TEXT NOT NULL,
    case_state_json TEXT NOT NULL,
    folder_digest TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    user_input TEXT NOT NULL,
    images_count INTEGER DEFAULT 0,
    folder_path TEXT DEFAULT '',
    engine_result_json TEXT,
    assistant_markdown TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens INTEGER DEFAULT 0,
    cost_inr REAL DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
`);

// Safe migration if sessions table existed before user_id or folder_digest columns were added
try {
  const cols = db.prepare(`PRAGMA table_info(sessions)`).all();
  if (!cols.some(c => c.name === 'user_id')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT 'founder-local'`);
  }
  if (!cols.some(c => c.name === 'folder_digest')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN folder_digest TEXT DEFAULT ''`);
  }
} catch {
  // ignore
}

export function ensureUserRecord(userId, displayName = '') {
  const cleanId = String(userId || 'founder-local').trim();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(cleanId);
  if (!existing) {
    db.prepare(`
      INSERT INTO users (id, display_name, plan, created_at, last_seen_at)
      VALUES (?, ?, 'case-pass-499', ?, ?)
    `).run(cleanId, displayName || cleanId.slice(0, 14), now, now);
  } else {
    db.prepare('UPDATE users SET last_seen_at = ?, display_name = COALESCE(NULLIF(?, \'\'), display_name) WHERE id = ?')
      .run(now, displayName, cleanId);
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(cleanId);
}

/**
 * Migrate any legacy JSON files in data/cases/*.json into SQLite under 'founder-local'
 */
function migrateLegacyJsonCases() {
  const casesDir = path.join(dataDir, 'cases');
  if (!fs.existsSync(casesDir)) return;
  const files = fs.readdirSync(casesDir).filter(f => f.endsWith('.json'));
  const checkStmt = db.prepare('SELECT id FROM sessions WHERE id = ?');
  const insertSession = db.prepare(`
    INSERT INTO sessions (id, user_id, title, door, mode, case_state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTurn = db.prepare(`
    INSERT INTO turns (session_id, turn_index, user_input, images_count, folder_path, engine_result_json, assistant_markdown, model, tokens, cost_inr, latency_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  ensureUserRecord('founder-local', 'Founder Workspace');

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(casesDir, file), 'utf8'));
      if (!raw.id || checkStmt.get(raw.id)) continue;
      const door = raw.mode === 'messy-dump-intake' ? 'start' : raw.mode === 'company-advisor' ? 'company' : 'midcase';
      const createdAt = raw.createdAt || new Date().toISOString();
      insertSession.run(
        raw.id,
        'founder-local',
        raw.title || 'Saved Case',
        door,
        raw.mode || 'midcase-battle-card',
        JSON.stringify(raw.caseState || {}),
        createdAt,
        createdAt
      );
      insertTurn.run(
        raw.id,
        1,
        raw.rawInput || '',
        0,
        '',
        JSON.stringify(raw.engineResult || {}),
        raw.adviceMarkdown || '',
        raw.model || 'claude-sonnet-4.6',
        0,
        0,
        0,
        createdAt
      );
    } catch {
      // ignore
    }
  }
}

migrateLegacyJsonCases();

export function deriveSessionTitle({ title, door, caseState, rawInput }) {
  if (title && title.trim()) return title.trim();
  const cleanText = String(rawInput || '').replace(/=== FILE:.*?===/g, '').trim();
  const firstLine = cleanText.split(/[\r\n]+/).find(l => l.trim().length > 4) || '';
  const snippet = firstLine.slice(0, 52).trim();
  if (door === 'midcase') {
    const stg = caseState?.stage || 'midcase';
    return snippet ? `[${stg}] ${snippet}` : `Ongoing Case — ${stg}`;
  }
  if (door === 'company') {
    return snippet ? `[Company] ${snippet}` : `Company / RoC Advisory`;
  }
  const roleLabel = caseState?.role === 'defender' ? 'Defend Claim' : 'Dispute';
  return snippet ? `[${roleLabel}] ${snippet}` : `${roleLabel} Session`;
}

/**
 * Strictly scopes session listing to `userId` so User A never sees User B's cases.
 */
export function listSessionsForUser(userId, limit = 50) {
  const cleanUserId = String(userId || 'founder-local').trim();
  ensureUserRecord(cleanUserId);

  const rows = db.prepare(`
    SELECT
      s.id,
      s.user_id,
      s.title,
      s.door,
      s.mode,
      s.case_state_json,
      s.created_at,
      s.updated_at,
      COUNT(t.id) AS turn_count,
      COALESCE(SUM(t.cost_inr), 0) AS total_cost_inr
    FROM sessions s
    LEFT JOIN turns t ON t.session_id = s.id
    WHERE s.user_id = ?
    GROUP BY s.id
    ORDER BY s.updated_at DESC
    LIMIT ?
  `).all(cleanUserId, limit);

  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    door: r.door,
    mode: r.mode,
    caseState: JSON.parse(r.case_state_json || '{}'),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    turnCount: Number(r.turn_count || 0),
    totalCostInr: Number((r.total_cost_inr || 0).toFixed(3))
  }));
}

/**
 * Fetches a single session and its turns ONLY if it belongs to `userId`.
 */
export function getSessionWithTurnsForUser(userId, sessionId) {
  const cleanUserId = String(userId || 'founder-local').trim();
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, cleanUserId);
  if (!s) return null;
  const turns = db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY turn_index ASC').all(sessionId);
  return {
    id: s.id,
    userId: s.user_id,
    title: s.title,
    door: s.door,
    mode: s.mode,
    caseState: JSON.parse(s.case_state_json || '{}'),
    folderDigest: s.folder_digest || '',
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    turns: turns.map(t => ({
      id: t.id,
      turnIndex: t.turn_index,
      userInput: t.user_input,
      imagesCount: t.images_count,
      folderPath: t.folder_path,
      engineResult: JSON.parse(t.engine_result_json || 'null'),
      assistantMarkdown: t.assistant_markdown,
      model: t.model,
      tokens: t.tokens,
      costInr: t.cost_inr,
      latencyMs: t.latency_ms,
      createdAt: t.created_at
    }))
  };
}

export function saveOrAppendSessionTurn({
  userId = 'founder-local',
  sessionId,
  title,
  door,
  mode,
  caseState,
  folderDigest = '',
  userInput,
  imagesCount = 0,
  folderPath = '',
  engineResult,
  assistantMarkdown,
  model,
  tokens = 0,
  costInr = 0,
  latencyMs = 0
}) {
  const cleanUserId = String(userId || 'founder-local').trim();
  ensureUserRecord(cleanUserId);

  const now = new Date().toISOString();
  let existing = sessionId
    ? db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, cleanUserId)
    : null;
  const finalSessionId = existing ? existing.id : `session-${crypto.randomUUID().slice(0, 12)}`;
  const finalTitle = deriveSessionTitle({
    title: title || existing?.title,
    door,
    caseState,
    rawInput: userInput
  });
  const finalDigest = folderDigest || existing?.folder_digest || '';

  if (!existing) {
    db.prepare(`
      INSERT INTO sessions (id, user_id, title, door, mode, case_state_json, folder_digest, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finalSessionId,
      cleanUserId,
      finalTitle,
      door || 'midcase',
      mode,
      JSON.stringify(caseState || {}),
      finalDigest,
      now,
      now
    );
  } else {
    db.prepare(`
      UPDATE sessions
      SET title = ?, door = ?, mode = ?, case_state_json = ?, folder_digest = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      finalTitle,
      door || existing.door,
      mode || existing.mode,
      JSON.stringify(caseState || {}),
      finalDigest,
      now,
      finalSessionId,
      cleanUserId
    );
  }

  const maxRow = db.prepare('SELECT COALESCE(MAX(turn_index), 0) AS max_idx FROM turns WHERE session_id = ?').get(finalSessionId);
  const nextTurnIndex = Number(maxRow?.max_idx || 0) + 1;

  db.prepare(`
    INSERT INTO turns (
      session_id, turn_index, user_input, images_count, folder_path,
      engine_result_json, assistant_markdown, model, tokens, cost_inr, latency_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    finalSessionId,
    nextTurnIndex,
    userInput || '',
    imagesCount,
    folderPath || '',
    JSON.stringify(engineResult || null),
    assistantMarkdown || '',
    model || 'claude-sonnet-4.6',
    tokens,
    costInr,
    latencyMs,
    now
  );

  return getSessionWithTurnsForUser(cleanUserId, finalSessionId);
}

export function renameSessionForUser(userId, sessionId, newTitle) {
  const cleanUserId = String(userId || 'founder-local').trim();
  const now = new Date().toISOString();
  db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(newTitle.trim(), now, sessionId, cleanUserId);
  return getSessionWithTurnsForUser(cleanUserId, sessionId);
}

export function deleteSessionForUser(userId, sessionId) {
  const cleanUserId = String(userId || 'founder-local').trim();
  const owned = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, cleanUserId);
  if (!owned) return { deleted: false };
  db.prepare('DELETE FROM turns WHERE session_id = ?').run(sessionId);
  db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(sessionId, cleanUserId);
  return { deleted: true, id: sessionId };
}
