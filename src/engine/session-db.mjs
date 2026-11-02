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

// Safe migration if sessions, users, or turns tables existed before new columns were added
try {
  const cols = db.prepare(`PRAGMA table_info(sessions)`).all();
  if (!cols.some(c => c.name === 'user_id')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT 'founder-local'`);
  }
  if (!cols.some(c => c.name === 'folder_digest')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN folder_digest TEXT DEFAULT ''`);
  }

  const userCols = db.prepare(`PRAGMA table_info(users)`).all();
  if (!userCols.some(c => c.name === 'password_hash')) {
    db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''`);
  }
  if (!userCols.some(c => c.name === 'role')) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`);
  }
  if (!userCols.some(c => c.name === 'auth_provider')) {
    db.exec(`ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'password'`);
  }

  const turnCols = db.prepare(`PRAGMA table_info(turns)`).all();
  if (!turnCols.some(c => c.name === 'user_rating')) {
    db.exec(`ALTER TABLE turns ADD COLUMN user_rating INTEGER DEFAULT 0`);
  }
  if (!turnCols.some(c => c.name === 'user_feedback_note')) {
    db.exec(`ALTER TABLE turns ADD COLUMN user_feedback_note TEXT DEFAULT ''`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
  `);
} catch {
  // ignore
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const derived = crypto.scryptSync(String(password || ''), salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

export const SUPERADMIN_DEFAULT_EMAIL = (process.env.NYAYA_ADMIN_EMAIL || 'admin@nyaya.ai').toLowerCase().trim();
export const SUPERADMIN_DEFAULT_PASSWORD = process.env.NYAYA_ADMIN_PASSWORD || 'nyaya-admin-2026';
export const DEFAULT_MONTHLY_TRIAL_LIMIT_INR = Number(process.env.NYAYA_MONTHLY_TRIAL_LIMIT_INR || 500);

try {
  const uCols = db.prepare(`PRAGMA table_info(users)`).all();
  if (!uCols.some(c => c.name === 'monthly_limit_inr')) {
    db.exec(`ALTER TABLE users ADD COLUMN monthly_limit_inr REAL DEFAULT 500`);
  }
  if (!uCols.some(c => c.name === 'device_id')) {
    db.exec(`ALTER TABLE users ADD COLUMN device_id TEXT DEFAULT ''`);
  }
  if (!uCols.some(c => c.name === 'hw_fingerprint')) {
    db.exec(`ALTER TABLE users ADD COLUMN hw_fingerprint TEXT DEFAULT ''`);
  }
  if (!uCols.some(c => c.name === 'ip_hash')) {
    db.exec(`ALTER TABLE users ADD COLUMN ip_hash TEXT DEFAULT ''`);
  }

  const tCols = db.prepare(`PRAGMA table_info(turns)`).all();
  if (!tCols.some(c => c.name === 'device_id')) {
    db.exec(`ALTER TABLE turns ADD COLUMN device_id TEXT DEFAULT ''`);
  }
  if (!tCols.some(c => c.name === 'hw_fingerprint')) {
    db.exec(`ALTER TABLE turns ADD COLUMN hw_fingerprint TEXT DEFAULT ''`);
  }
  if (!tCols.some(c => c.name === 'ip_hash')) {
    db.exec(`ALTER TABLE turns ADD COLUMN ip_hash TEXT DEFAULT ''`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_turns_device_id ON turns(device_id);
    CREATE INDEX IF NOT EXISTS idx_turns_hw_fp ON turns(hw_fingerprint);
    CREATE INDEX IF NOT EXISTS idx_turns_ip_hash ON turns(ip_hash);
  `);
} catch {
  // ignore
}

function seedSuperAdminAccount() {
  const now = new Date().toISOString();
  const existingFounder = db.prepare('SELECT * FROM users WHERE id = ?').get('founder-local');
  const pwHash = hashPassword(SUPERADMIN_DEFAULT_PASSWORD);
  if (!existingFounder) {
    db.prepare(`
      INSERT INTO users (id, display_name, email, password_hash, role, auth_provider, plan, created_at, last_seen_at)
      VALUES ('founder-local', 'Founder Super-Admin', ?, ?, 'superadmin', 'password', 'founder-unlimited', ?, ?)
    `).run(SUPERADMIN_DEFAULT_EMAIL, pwHash, now, now);
  } else {
    const nextEmail = existingFounder.email || SUPERADMIN_DEFAULT_EMAIL;
    const nextHash = existingFounder.password_hash || pwHash;
    db.prepare(`
      UPDATE users
      SET email = ?, password_hash = ?, role = 'superadmin', display_name = COALESCE(NULLIF(display_name, 'founder-local'), 'Founder Super-Admin')
      WHERE id = 'founder-local'
    `).run(nextEmail, nextHash);
  }
}

seedSuperAdminAccount();

export function ensureUserRecord(userId, displayName = '') {
  const cleanId = String(userId || 'founder-local').trim();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(cleanId);
  if (!existing) {
    db.prepare(`
      INSERT INTO users (id, display_name, plan, monthly_limit_inr, created_at, last_seen_at)
      VALUES (?, ?, 'trial-500', ?, ?, ?)
    `).run(cleanId, displayName || cleanId.slice(0, 14), DEFAULT_MONTHLY_TRIAL_LIMIT_INR, now, now);
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
      userRating: Number(t.user_rating || 0),
      userFeedbackNote: t.user_feedback_note || '',
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
  latencyMs = 0,
  deviceId = '',
  hwFingerprint = '',
  ipHash = ''
}) {
  const cleanUserId = String(userId || 'founder-local').trim();
  ensureUserRecord(cleanUserId);
  if (deviceId || hwFingerprint || ipHash) {
    db.prepare(`
      UPDATE users
      SET device_id = COALESCE(NULLIF(?, ''), device_id),
          hw_fingerprint = COALESCE(NULLIF(?, ''), hw_fingerprint),
          ip_hash = COALESCE(NULLIF(?, ''), ip_hash)
      WHERE id = ?
    `).run(deviceId || '', hwFingerprint || '', ipHash || '', cleanUserId);
  }

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
      engine_result_json, assistant_markdown, model, tokens, cost_inr, latency_ms,
      device_id, hw_fingerprint, ip_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    deviceId || '',
    hwFingerprint || '',
    ipHash || '',
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

/**
 * Computes monthly Free Trial quota across THREE anti-bypass signals:
 * 1. Account (`user_id`) spend in current `YYYY-MM` month
 * 2. Persistent `HttpOnly` Device Cookie (`device_id` / `nyaya_did`) spend across all accounts on that browser
 * 3. Combined Hardware Fingerprint (`hw_fingerprint` — WebGL/Screen/CPU) + `CF-Connecting-IP` (`ip_hash`) spend
 *    so opening Incognito and signing up with a brand-new email shares the exact same ₹500/month cap!
 */
export function getUserMonthlyUsageQuota(userId, options = {}) {
  const cleanId = String(userId || 'founder-local').trim();
  const userRow = ensureUserRecord(cleanId);
  const referenceDateIso = typeof options === 'string'
    ? options
    : (options?.referenceDateIso || new Date().toISOString());
  const currentMonthPrefix = String(referenceDateIso).slice(0, 7); // YYYY-MM

  const effDeviceId = String(options?.deviceId || userRow?.device_id || '').trim();
  const effHwFp = String(options?.hwFingerprint || userRow?.hw_fingerprint || '').trim();
  const effIpHash = String(options?.ipHash || userRow?.ip_hash || '').trim();

  const userSpendRow = db.prepare(`
    SELECT COALESCE(SUM(t.cost_inr), 0) AS month_spend_inr, COUNT(t.id) AS month_turns
    FROM turns t
    JOIN sessions s ON s.id = t.session_id
    WHERE s.user_id = ? AND substr(t.created_at, 1, 7) = ?
  `).get(cleanId, currentMonthPrefix);

  let deviceSpendInr = 0;
  if (effDeviceId) {
    const devRow = db.prepare(`
      SELECT COALESCE(SUM(cost_inr), 0) AS spend
      FROM turns
      WHERE device_id = ? AND substr(created_at, 1, 7) = ?
    `).get(effDeviceId, currentMonthPrefix);
    deviceSpendInr = Number(devRow?.spend || 0);
  }

  let fpIpSpendInr = 0;
  if (effHwFp && effIpHash) {
    const fpIpRow = db.prepare(`
      SELECT COALESCE(SUM(cost_inr), 0) AS spend
      FROM turns
      WHERE hw_fingerprint = ? AND ip_hash = ? AND substr(created_at, 1, 7) = ?
    `).get(effHwFp, effIpHash, currentMonthPrefix);
    fpIpSpendInr = Number(fpIpRow?.spend || 0);
  } else if (effHwFp) {
    const fpRow = db.prepare(`
      SELECT COALESCE(SUM(cost_inr), 0) AS spend
      FROM turns
      WHERE hw_fingerprint = ? AND substr(created_at, 1, 7) = ?
    `).get(effHwFp, currentMonthPrefix);
    fpIpSpendInr = Number(fpRow?.spend || 0);
  }

  const isSuperAdmin = userRow?.role === 'superadmin';
  const monthlyLimitInr = isSuperAdmin
    ? Number(userRow?.monthly_limit_inr || 1000000)
    : Number(userRow?.monthly_limit_inr ?? DEFAULT_MONTHLY_TRIAL_LIMIT_INR);

  const userOwnSpendInr = Number((userSpendRow?.month_spend_inr || 0).toFixed(4));
  const effectiveSpendInr = isSuperAdmin
    ? userOwnSpendInr
    : Number(Math.max(userOwnSpendInr, deviceSpendInr, fpIpSpendInr).toFixed(4));
  const monthlyRemainingInr = Math.max(0, Number((monthlyLimitInr - effectiveSpendInr).toFixed(4)));
  const quotaExceeded = !isSuperAdmin && effectiveSpendInr >= monthlyLimitInr;
  const sharedFromDeviceOrIp = !isSuperAdmin && effectiveSpendInr > userOwnSpendInr;

  return {
    month: currentMonthPrefix,
    plan: isSuperAdmin ? 'founder-unlimited' : (userRow?.plan || 'trial-500'),
    isTrial: !isSuperAdmin,
    monthlyLimitInr,
    monthlySpendInr: effectiveSpendInr,
    userOwnSpendInr,
    deviceSpendInr: Number(deviceSpendInr.toFixed(4)),
    fpIpSpendInr: Number(fpIpSpendInr.toFixed(4)),
    sharedFromDeviceOrIp,
    monthlyRemainingInr,
    monthTurns: Number(userSpendRow?.month_turns || 0),
    quotaExceeded
  };
}

function formatPublicUser(row) {
  if (!row) return null;
  const quota = getUserMonthlyUsageQuota(row.id);
  return {
    id: row.id,
    email: row.email || '',
    displayName: row.display_name || row.email || row.id,
    role: row.role || 'user',
    plan: quota.plan,
    authProvider: row.auth_provider || 'password',
    monthlyLimitInr: quota.monthlyLimitInr,
    monthlySpendInr: quota.monthlySpendInr,
    monthlyRemainingInr: quota.monthlyRemainingInr,
    quotaExceeded: quota.quotaExceeded,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at
  };
}

export function issueAuthTokenForUser(userId, ttlDays = 30) {
  const rawToken = `nya_${crypto.randomBytes(28).toString('hex')}`;
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  db.prepare(`
    INSERT INTO auth_tokens (token_hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, userId, now.toISOString(), expires.toISOString());
  return rawToken;
}

export function getUserFromAuthToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const tokenHash = hashToken(rawToken.trim());
  const row = db.prepare(`
    SELECT u.*, t.expires_at
    FROM auth_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ?
  `).get(tokenHash);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now, row.id);
  return formatPublicUser(row);
}

export function revokeAuthToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken.trim());
  db.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').run(tokenHash);
}

/**
 * Zero-friction Email/Username + Password Sign-Up & Sign-In (no email verification delay).
 * - If mode === 'signup' or 'auto' and account does not exist: creates new isolated user profile.
 * - If account exists: verifies password and signs in.
 * - Supports logging into the Super-Admin account via SUPERADMIN_DEFAULT_EMAIL or 'shivam098' / 'admin'.
 */
export function registerOrLoginWithPassword({
  emailOrId = '',
  password = '',
  displayName = '',
  mode = 'auto',
  deviceId = '',
  hwFingerprint = '',
  ipHash = ''
} = {}) {
  const rawIdentifier = String(emailOrId || '').trim().toLowerCase();
  const rawPassword = String(password || '');
  if (!rawIdentifier || rawIdentifier.length < 3) {
    throw new Error('Please enter a valid email address or username (at least 3 characters).');
  }
  if (!rawPassword || rawPassword.length < 4) {
    throw new Error('Please enter a password (at least 4 characters).');
  }

  // Map superadmin aliases ('admin', 'shivam098', or SUPERADMIN_DEFAULT_EMAIL) to the seeded Super-Admin record
  const isSuperAdminAlias = (
    rawIdentifier === SUPERADMIN_DEFAULT_EMAIL ||
    rawIdentifier === 'admin' ||
    rawIdentifier === 'shivam098' ||
    rawIdentifier === 'founder-local'
  );
  const lookupEmail = isSuperAdminAlias ? SUPERADMIN_DEFAULT_EMAIL : rawIdentifier;

  let userRow = isSuperAdminAlias
    ? db.prepare(`SELECT * FROM users WHERE id = 'founder-local' OR LOWER(email) = ?`).get(lookupEmail)
    : db.prepare(`SELECT * FROM users WHERE LOWER(email) = ? OR id = ?`).get(lookupEmail, rawIdentifier);

  const now = new Date().toISOString();

  if (userRow) {
    if (!userRow.password_hash) {
      // Legacy record without a password yet — set it if not superadmin
      if (userRow.role === 'superadmin' && rawPassword !== SUPERADMIN_DEFAULT_PASSWORD) {
        throw new Error('Invalid Super-Admin password.');
      }
      const newHash = hashPassword(rawPassword);
      db.prepare('UPDATE users SET password_hash = ?, last_seen_at = ? WHERE id = ?').run(newHash, now, userRow.id);
    } else if (!verifyPassword(rawPassword, userRow.password_hash)) {
      throw new Error('Incorrect password for this account. If you are creating a new account, use a different email/ID.');
    }
    db.prepare(`
      UPDATE users
      SET display_name = COALESCE(NULLIF(?, ''), display_name),
          device_id = COALESCE(NULLIF(?, ''), device_id),
          hw_fingerprint = COALESCE(NULLIF(?, ''), hw_fingerprint),
          ip_hash = COALESCE(NULLIF(?, ''), ip_hash),
          last_seen_at = ?
      WHERE id = ?
    `).run((displayName || '').trim(), deviceId || '', hwFingerprint || '', ipHash || '', now, userRow.id);

    userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userRow.id);
    const token = issueAuthTokenForUser(userRow.id);
    return {
      created: false,
      token,
      user: formatPublicUser(userRow)
    };
  }

  if (mode === 'login') {
    throw new Error('No account found with that email/ID. Switch to "Sign Up" (or use Continue) to create your profile instantly.');
  }

  const newUserId = `usr_${crypto.randomUUID().slice(0, 12)}`;
  const derivedName = (displayName || '').trim() || lookupEmail.split('@')[0] || 'Nyaya User';
  const pwHash = hashPassword(rawPassword);

  db.prepare(`
    INSERT INTO users (id, display_name, email, password_hash, role, auth_provider, plan, monthly_limit_inr, device_id, hw_fingerprint, ip_hash, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, 'user', 'password', 'trial-500', ?, ?, ?, ?, ?, ?)
  `).run(newUserId, derivedName, lookupEmail, pwHash, DEFAULT_MONTHLY_TRIAL_LIMIT_INR, deviceId || '', hwFingerprint || '', ipHash || '', now, now);

  userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);
  const token = issueAuthTokenForUser(userRow.id);
  return {
    created: true,
    token,
    user: formatPublicUser(userRow)
  };
}

/**
 * Gmail / Google Profile Sign-In:
 * Creates or signs into a user profile backed by a Gmail address (never elevates to superadmin without password).
 */
export function loginOrRegisterGmailProfile({
  email = '',
  displayName = '',
  authProvider = 'google',
  deviceId = '',
  hwFingerprint = '',
  ipHash = ''
} = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid Gmail / email address.');
  }
  const now = new Date().toISOString();
  let userRow = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);

  if (userRow && userRow.role === 'superadmin') {
    throw new Error('Super-Admin account requires password authentication.');
  }

  if (!userRow) {
    const newUserId = `usr_${crypto.randomUUID().slice(0, 12)}`;
    const derivedName = (displayName || '').trim() || cleanEmail.split('@')[0];
    db.prepare(`
      INSERT INTO users (id, display_name, email, password_hash, role, auth_provider, plan, monthly_limit_inr, device_id, hw_fingerprint, ip_hash, created_at, last_seen_at)
      VALUES (?, ?, ?, '', 'user', ?, 'trial-500', ?, ?, ?, ?, ?, ?)
    `).run(newUserId, derivedName, cleanEmail, authProvider, DEFAULT_MONTHLY_TRIAL_LIMIT_INR, deviceId || '', hwFingerprint || '', ipHash || '', now, now);
    userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);
  } else {
    const nextName = (displayName || '').trim() || userRow.display_name;
    db.prepare(`
      UPDATE users
      SET display_name = ?,
          device_id = COALESCE(NULLIF(?, ''), device_id),
          hw_fingerprint = COALESCE(NULLIF(?, ''), hw_fingerprint),
          ip_hash = COALESCE(NULLIF(?, ''), ip_hash),
          last_seen_at = ?
      WHERE id = ?
    `).run(nextName, deviceId || '', hwFingerprint || '', ipHash || '', now, userRow.id);
    userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userRow.id);
  }

  const token = issueAuthTokenForUser(userRow.id);
  return {
    token,
    user: formatPublicUser(userRow)
  };
}

export function saveTurnFeedbackForUser({ userId, isSuperAdmin = false, turnId, rating = 0, note = '' } = {}) {
  const t = db.prepare(`
    SELECT t.id, t.session_id, s.user_id
    FROM turns t
    JOIN sessions s ON s.id = t.session_id
    WHERE t.id = ?
  `).get(Number(turnId));
  if (!t) throw new Error('Turn not found');
  if (!isSuperAdmin && t.user_id !== userId) {
    throw new Error('Forbidden: cannot rate another user\'s turn');
  }
  const cleanRating = [-1, 0, 1].includes(Number(rating)) ? Number(rating) : 0;
  const cleanNote = String(note || '').trim().slice(0, 1000);
  db.prepare('UPDATE turns SET user_rating = ?, user_feedback_note = ? WHERE id = ?')
    .run(cleanRating, cleanNote, Number(turnId));
  return { turnId: Number(turnId), userRating: cleanRating, userFeedbackNote: cleanNote };
}

/**
 * Super-Admin Product Lab Overview:
 * Lists all signed-up users, global session/turn counts, and all user sessions with domain & verification telemetry.
 */
export function getSuperAdminOverview(limitSessions = 150) {
  const usersRows = db.prepare(`
    SELECT
      u.id,
      u.email,
      u.display_name,
      u.role,
      u.auth_provider,
      u.created_at,
      u.last_seen_at,
      COUNT(DISTINCT s.id) AS session_count,
      COUNT(t.id) AS turn_count,
      COALESCE(SUM(t.cost_inr), 0) AS total_spend_inr,
      COALESCE(SUM(t.tokens), 0) AS total_tokens
    FROM users u
    LEFT JOIN sessions s ON s.user_id = u.id
    LEFT JOIN turns t ON t.session_id = s.id
    GROUP BY u.id
    ORDER BY u.last_seen_at DESC
  `).all();

  const sessionsRows = db.prepare(`
    SELECT
      s.id,
      s.user_id,
      s.title,
      s.door,
      s.mode,
      s.case_state_json,
      s.created_at,
      s.updated_at,
      u.email AS user_email,
      u.display_name AS user_display_name,
      u.role AS user_role,
      COUNT(t.id) AS turn_count,
      COALESCE(SUM(t.cost_inr), 0) AS total_cost_inr,
      COALESCE(SUM(t.tokens), 0) AS total_tokens
    FROM sessions s
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN turns t ON t.session_id = s.id
    GROUP BY s.id
    ORDER BY s.updated_at DESC
    LIMIT ?
  `).all(limitSessions);

  const latestTurnsStmt = db.prepare(`
    SELECT id, turn_index, user_input, assistant_markdown, engine_result_json, model, user_rating, user_feedback_note, created_at
    FROM turns
    WHERE session_id = ?
    ORDER BY turn_index DESC
    LIMIT 1
  `);

  let flaggedTurnsCount = 0;
  let thumbsDownCount = 0;
  let thumbsUpCount = 0;

  const allRatings = db.prepare(`SELECT user_rating, engine_result_json FROM turns`).all();
  for (const r of allRatings) {
    if (Number(r.user_rating) === -1) thumbsDownCount++;
    if (Number(r.user_rating) === 1) thumbsUpCount++;
    try {
      const eng = JSON.parse(r.engine_result_json || 'null');
      if (eng?.verification?.verified === false || eng?.responseCompletion?.incomplete === true) {
        flaggedTurnsCount++;
      }
    } catch {
      // ignore
    }
  }

  const enrichedSessions = sessionsRows.map(s => {
    const latest = latestTurnsStmt.get(s.id);
    let engineResult = null;
    try {
      engineResult = latest?.engine_result_json ? JSON.parse(latest.engine_result_json) : null;
    } catch {
      engineResult = null;
    }
    const cleanQuestion = String(latest?.user_input || '').split('ATTACHED FOLDER / TEXT DOCUMENTS:')[0].trim();
    return {
      id: s.id,
      userId: s.user_id,
      userEmail: s.user_email || '',
      userDisplayName: s.user_display_name || s.user_id,
      userRole: s.user_role || 'user',
      title: s.title,
      door: s.door,
      mode: s.mode,
      caseState: JSON.parse(s.case_state_json || '{}'),
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      turnCount: Number(s.turn_count || 0),
      totalCostInr: Number((s.total_cost_inr || 0).toFixed(3)),
      totalTokens: Number(s.total_tokens || 0),
      domain: engineResult?.domainInfo?.domain || s.mode,
      domainLabel: engineResult?.domainInfo?.label || s.mode,
      verificationPassed: engineResult?.verification ? Boolean(engineResult.verification.verified) : true,
      incomplete: Boolean(engineResult?.responseCompletion?.incomplete),
      latestModel: latest?.model || '',
      latestRating: Number(latest?.user_rating || 0),
      latestFeedbackNote: latest?.user_feedback_note || '',
      latestQuestionPreview: cleanQuestion.slice(0, 220),
      latestAnswerPreview: String(latest?.assistant_markdown || '').slice(0, 260)
    };
  });

  return {
    summary: {
      totalUsers: usersRows.length,
      totalSessions: enrichedSessions.length,
      totalTurns: allRatings.length,
      flaggedTurnsCount,
      thumbsDownCount,
      thumbsUpCount
    },
    users: usersRows.map(u => {
      const quota = getUserMonthlyUsageQuota(u.id);
      return {
        id: u.id,
        email: u.email || '',
        displayName: u.display_name || u.id,
        role: u.role || 'user',
        plan: quota.plan,
        authProvider: u.auth_provider || 'password',
        monthlyLimitInr: quota.monthlyLimitInr,
        monthlySpendInr: quota.monthlySpendInr,
        monthlyRemainingInr: quota.monthlyRemainingInr,
        quotaExceeded: quota.quotaExceeded,
        createdAt: u.created_at,
        lastSeenAt: u.last_seen_at,
        sessionCount: Number(u.session_count || 0),
        turnCount: Number(u.turn_count || 0),
        totalSpendInr: Number((u.total_spend_inr || 0).toFixed(3)),
        totalTokens: Number(u.total_tokens || 0)
      };
    }),
    sessions: enrichedSessions
  };
}

export function getAnySessionWithTurnsForAdmin(sessionId) {
  const s = db.prepare(`
    SELECT s.*, u.email AS user_email, u.display_name AS user_display_name, u.role AS user_role
    FROM sessions s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(sessionId);
  if (!s) return null;
  const turns = db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY turn_index ASC').all(sessionId);
  return {
    id: s.id,
    userId: s.user_id,
    userEmail: s.user_email || '',
    userDisplayName: s.user_display_name || s.user_id,
    userRole: s.user_role || 'user',
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
      userRating: Number(t.user_rating || 0),
      userFeedbackNote: t.user_feedback_note || '',
      createdAt: t.created_at
    }))
  };
}
