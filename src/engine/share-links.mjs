/**
 * Share links: lets a user give a lawyer (or anyone they choose) a read-only copy of a conversation.
 *
 * - A link is a snapshot: it shows turns up to the moment it was created, never later messages.
 * - Only a SHA-256 hash of the token is stored, so a database leak does not expose working links.
 * - Links expire and can be revoked by the owner at any time.
 * - Text extracted from uploaded documents is left out unless the owner explicitly includes it.
 */
import crypto from 'node:crypto';
import { getSessionDatabase } from './session-db.mjs';

const db = getSessionDatabase();

db.exec(`
  CREATE TABLE IF NOT EXISTS session_shares (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    upto_turn_index INTEGER NOT NULL,
    include_documents INTEGER DEFAULT 0,
    recipient_label TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT DEFAULT '',
    view_count INTEGER DEFAULT 0,
    last_viewed_at TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_shares_session ON session_shares(session_id, owner_user_id);
`);

export const SHARE_EXPIRY_CHOICES_DAYS = [1, 7, 30];
const DOC_MARKER = 'ATTACHED FOLDER / TEXT DOCUMENTS:';

const hashToken = token => crypto.createHash('sha256').update(`nyaya-share:${String(token || '')}`).digest('hex');

function shareRowToPublic(r) {
  const now = Date.now();
  const expired = Date.parse(r.expires_at) <= now;
  return {
    id: r.id,
    sessionId: r.session_id,
    uptoTurnIndex: r.upto_turn_index,
    includeDocuments: Boolean(r.include_documents),
    recipientLabel: r.recipient_label || '',
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at || '',
    active: !r.revoked_at && !expired,
    viewCount: Number(r.view_count || 0),
    lastViewedAt: r.last_viewed_at || ''
  };
}

/**
 * Creates a share link for a session the user owns. Returns { share, token } or throws.
 * The raw token is returned only here; it cannot be recovered later.
 */
export function createSessionShare({ ownerUserId, sessionId, expiresInDays = 7, includeDocuments = false, recipientLabel = '' } = {}) {
  const owner = String(ownerUserId || '').trim();
  const session = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?').get(String(sessionId || ''), owner);
  if (!owner || !session) throw new Error('Conversation not found');
  const maxTurn = Number(db.prepare('SELECT COALESCE(MAX(turn_index), 0) AS n FROM turns WHERE session_id = ?').get(session.id).n || 0);
  if (maxTurn < 1) throw new Error('There is nothing to share yet');
  const days = SHARE_EXPIRY_CHOICES_DAYS.includes(Number(expiresInDays)) ? Number(expiresInDays) : 7;
  const token = crypto.randomBytes(24).toString('base64url');
  const now = new Date();
  const row = {
    id: `share-${crypto.randomUUID().slice(0, 12)}`,
    session_id: session.id,
    owner_user_id: owner,
    token_hash: hashToken(token),
    upto_turn_index: maxTurn,
    include_documents: includeDocuments ? 1 : 0,
    recipient_label: String(recipientLabel || '').trim().slice(0, 120),
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + days * 86_400_000).toISOString()
  };
  db.prepare(`
    INSERT INTO session_shares (id, session_id, owner_user_id, token_hash, upto_turn_index, include_documents, recipient_label, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.session_id, row.owner_user_id, row.token_hash, row.upto_turn_index, row.include_documents, row.recipient_label, row.created_at, row.expires_at);
  return { share: shareRowToPublic({ ...row, revoked_at: '', view_count: 0, last_viewed_at: '' }), token };
}

export function listSessionShares({ ownerUserId, sessionId } = {}) {
  return db.prepare('SELECT * FROM session_shares WHERE session_id = ? AND owner_user_id = ? ORDER BY created_at DESC')
    .all(String(sessionId || ''), String(ownerUserId || ''))
    .map(shareRowToPublic);
}

export function revokeSessionShare({ ownerUserId, shareId } = {}) {
  const r = db.prepare('SELECT * FROM session_shares WHERE id = ? AND owner_user_id = ?').get(String(shareId || ''), String(ownerUserId || ''));
  if (!r) return null;
  if (!r.revoked_at) {
    db.prepare('UPDATE session_shares SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), r.id);
  }
  return shareRowToPublic(db.prepare('SELECT * FROM session_shares WHERE id = ?').get(r.id));
}

/**
 * Resolves a share token to the read-only conversation snapshot, or null if it is unknown, expired or revoked.
 * Each successful read is counted so the owner can see whether the lawyer opened it.
 */
export function readSharedConversation(token) {
  if (!token || String(token).length < 20) return null;
  const r = db.prepare('SELECT * FROM session_shares WHERE token_hash = ?').get(hashToken(token));
  if (!r || r.revoked_at || Date.parse(r.expires_at) <= Date.now()) return null;
  const s = db.prepare('SELECT id, title, created_at, updated_at FROM sessions WHERE id = ?').get(r.session_id);
  if (!s) return null;
  const turns = db.prepare(`
    SELECT turn_index, user_input, assistant_markdown, images_count, engine_result_json, created_at
    FROM turns WHERE session_id = ? AND turn_index <= ? ORDER BY turn_index ASC
  `).all(r.session_id, r.upto_turn_index);
  db.prepare('UPDATE session_shares SET view_count = view_count + 1, last_viewed_at = ? WHERE id = ?').run(new Date().toISOString(), r.id);

  let areaOfLaw = '';
  const mapped = turns.map(t => {
    const raw = String(t.user_input || '');
    const markerIdx = raw.indexOf(DOC_MARKER);
    const question = (markerIdx === -1 ? raw : raw.slice(0, markerIdx)).trim();
    const documentText = markerIdx === -1 ? '' : raw.slice(markerIdx + DOC_MARKER.length).trim();
    try {
      const eng = JSON.parse(t.engine_result_json || 'null');
      if (eng?.domainInfo?.label) areaOfLaw = eng.domainInfo.label;
    } catch {
      // ignore
    }
    return {
      turnIndex: t.turn_index,
      createdAt: t.created_at,
      question,
      hadDocuments: Boolean(documentText),
      documentText: r.include_documents ? documentText : '',
      imagesCount: Number(t.images_count || 0),
      answer: t.assistant_markdown || ''
    };
  });

  return {
    title: s.title,
    areaOfLaw,
    conversationStartedAt: s.created_at,
    sharedAt: r.created_at,
    expiresAt: r.expires_at,
    includeDocuments: Boolean(r.include_documents),
    recipientLabel: r.recipient_label || '',
    turns: mapped
  };
}
