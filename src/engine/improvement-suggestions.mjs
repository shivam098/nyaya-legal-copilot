/**
 * Expert improvement suggestions: anyone using Nyaya (especially advocates) can propose how Nyaya should
 * behave for a kind of question. A reviewer (Super-Admin or a user granted the "expert" role) approves,
 * edits, asks for changes, or rejects it. Approval turns the suggestion into a practitioner lesson in the
 * semantic index, which the engine retrieves for similar questions — so the app's behaviour changes
 * without a code release. Retiring an approved suggestion removes its lesson again.
 */
import crypto from 'node:crypto';
import { getSessionDatabase } from './session-db.mjs';
import { addOrUpdatePractitionerLesson, deletePractitionerLesson } from './semantic-statutory-index.mjs';

const db = getSessionDatabase();

db.exec(`
  CREATE TABLE IF NOT EXISTS improvement_suggestions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    submitter_user_id TEXT NOT NULL,
    submitter_auth TEXT NOT NULL DEFAULT 'guest',
    submitter_email TEXT DEFAULT '',
    submitter_name TEXT DEFAULT '',
    submitter_expertise TEXT DEFAULT 'user',
    domain TEXT DEFAULT 'general',
    situation TEXT NOT NULL,
    expected_behaviour TEXT NOT NULL,
    example_question TEXT DEFAULT '',
    linked_session_id TEXT DEFAULT '',
    linked_turn_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewer_user_id TEXT DEFAULT '',
    reviewer_name TEXT DEFAULT '',
    reviewer_note TEXT DEFAULT '',
    reviewed_at TEXT DEFAULT '',
    lesson_id TEXT DEFAULT '',
    lesson_topic TEXT DEFAULT '',
    lesson_text TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_suggestions_status ON improvement_suggestions(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_suggestions_submitter ON improvement_suggestions(submitter_user_id, created_at DESC);
`);

export const SUGGESTION_STATUSES = ['pending', 'needs-changes', 'approved', 'rejected', 'retired'];
export const SUGGESTION_EXPERTISE = ['advocate', 'law-student', 'legal-professional', 'user'];
export const SUGGESTION_DOMAINS = [
  'general', 'consumer', 'property-rera', 'tenancy-civil', 'matrimonial-family', 'inheritance-partition',
  'criminal-bns-bnss', 'cheque-bounce-138', 'corporate-roc', 'employment-labour', 'banking-sarfaesi',
  'motor-accident', 'tax-rti-writ', 'msme-arbitration'
];

const clean = (v, n) => String(v ?? '').trim().slice(0, n);

function rowToSuggestion(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    submitterUserId: r.submitter_user_id,
    submitterAuth: r.submitter_auth,
    submitterEmail: r.submitter_email,
    submitterName: r.submitter_name,
    submitterExpertise: r.submitter_expertise,
    domain: r.domain,
    situation: r.situation,
    expectedBehaviour: r.expected_behaviour,
    exampleQuestion: r.example_question,
    linkedSessionId: r.linked_session_id,
    linkedTurnId: r.linked_turn_id,
    status: r.status,
    reviewerName: r.reviewer_name,
    reviewerNote: r.reviewer_note,
    reviewedAt: r.reviewed_at,
    lessonId: r.lesson_id,
    lessonTopic: r.lesson_topic,
    lessonText: r.lesson_text
  };
}

export function isSuggestionReviewer(auth) {
  return Boolean(auth?.authenticated && (auth.isSuperAdmin || auth.user?.role === 'expert'));
}

export function submitImprovementSuggestion({ auth, domain, situation, expectedBehaviour, exampleQuestion, expertise, sessionId, turnId } = {}) {
  const s = clean(situation, 600);
  const e = clean(expectedBehaviour, 4000);
  if (s.length < 10) throw new Error('Describe the kind of question or situation (at least 10 characters).');
  if (e.length < 20) throw new Error('Describe how Nyaya should respond (at least 20 characters).');
  const linkedTurn = Number(turnId);
  const now = new Date().toISOString();
  const id = `sug-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO improvement_suggestions (
      id, created_at, updated_at, submitter_user_id, submitter_auth, submitter_email, submitter_name, submitter_expertise,
      domain, situation, expected_behaviour, example_question, linked_session_id, linked_turn_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    id, now, now,
    clean(auth?.userId, 200),
    auth?.authenticated ? 'signed-in' : 'guest',
    auth?.authenticated ? clean(auth.user?.email, 320) : '',
    clean(auth?.user?.displayName, 200),
    SUGGESTION_EXPERTISE.includes(expertise) ? expertise : 'user',
    SUGGESTION_DOMAINS.includes(domain) ? domain : 'general',
    s,
    e,
    clean(exampleQuestion, 2000),
    clean(sessionId, 120),
    Number.isFinite(linkedTurn) && linkedTurn > 0 ? linkedTurn : null
  );
  return getImprovementSuggestion(id);
}

export function getImprovementSuggestion(id) {
  const r = db.prepare('SELECT * FROM improvement_suggestions WHERE id = ?').get(String(id || ''));
  return r ? rowToSuggestion(r) : null;
}

export function listMySuggestions(userId, limit = 50) {
  return db.prepare('SELECT * FROM improvement_suggestions WHERE submitter_user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(String(userId || ''), Math.min(Number(limit) || 50, 200))
    .map(rowToSuggestion);
}

export function listSuggestionsForReview({ status = '', limit = 100 } = {}) {
  const rows = SUGGESTION_STATUSES.includes(status)
    ? db.prepare('SELECT * FROM improvement_suggestions WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, Math.min(Number(limit) || 100, 500))
    : db.prepare('SELECT * FROM improvement_suggestions ORDER BY created_at DESC LIMIT ?').all(Math.min(Number(limit) || 100, 500));
  const counts = Object.fromEntries(SUGGESTION_STATUSES.map(s => [s, 0]));
  for (const c of db.prepare('SELECT status, COUNT(*) AS n FROM improvement_suggestions GROUP BY status').all()) {
    counts[c.status] = Number(c.n);
  }
  return { suggestions: rows.map(rowToSuggestion), counts };
}

/**
 * Applies a reviewer decision.
 * - approve: (re)writes the practitioner lesson from the reviewer-edited text and marks it approved.
 * - needs-changes / reject: records the note; removes any lesson if one existed.
 * - retire: removes the lesson of an approved suggestion so it no longer affects answers.
 */
export function reviewImprovementSuggestion({ id, action, reviewerAuth, note = '', lessonTopic = '', lessonText = '', domain = '' } = {}) {
  const existing = db.prepare('SELECT * FROM improvement_suggestions WHERE id = ?').get(String(id || ''));
  if (!existing) return null;
  const now = new Date().toISOString();
  const reviewerName = clean(reviewerAuth?.user?.email || reviewerAuth?.user?.displayName || reviewerAuth?.userId, 200);
  const finalDomain = SUGGESTION_DOMAINS.includes(domain) ? domain : existing.domain;
  let status;
  let lessonId = existing.lesson_id || '';
  let topic = existing.lesson_topic || '';
  let text = existing.lesson_text || '';

  if (action === 'approve') {
    topic = clean(lessonTopic || existing.situation, 300);
    text = clean(lessonText || existing.expected_behaviour, 4000);
    const lesson = addOrUpdatePractitionerLesson({
      id: lessonId || `lesson-sug-${existing.id.replace(/^sug-/, '')}`,
      domain: finalDomain,
      topic,
      lessonText: text,
      author: `Expert suggestion (${existing.submitter_expertise}) · approved by ${reviewerName}`
    });
    lessonId = lesson.id;
    status = 'approved';
  } else if (['needs-changes', 'reject', 'retire'].includes(action)) {
    if (lessonId) deletePractitionerLesson(lessonId);
    lessonId = '';
    status = action === 'reject' ? 'rejected' : action === 'retire' ? 'retired' : 'needs-changes';
  } else {
    throw new Error('Unknown review action');
  }

  db.prepare(`
    UPDATE improvement_suggestions
    SET status = ?, domain = ?, reviewer_user_id = ?, reviewer_name = ?, reviewer_note = ?, reviewed_at = ?,
        lesson_id = ?, lesson_topic = ?, lesson_text = ?, updated_at = ?
    WHERE id = ?
  `).run(status, finalDomain, clean(reviewerAuth?.userId, 200), reviewerName, clean(note, 2000), now, lessonId, topic, text, now, existing.id);
  return getImprovementSuggestion(existing.id);
}

/** Lets a submitter revise a suggestion the reviewer sent back; it returns to the review queue. */
export function reviseMySuggestion({ id, userId, situation, expectedBehaviour, exampleQuestion, domain } = {}) {
  const existing = db.prepare('SELECT * FROM improvement_suggestions WHERE id = ? AND submitter_user_id = ?').get(String(id || ''), String(userId || ''));
  if (!existing) return null;
  if (!['needs-changes', 'pending'].includes(existing.status)) throw new Error('Only pending or sent-back suggestions can be edited.');
  const s = clean(situation ?? existing.situation, 600);
  const e = clean(expectedBehaviour ?? existing.expected_behaviour, 4000);
  if (s.length < 10 || e.length < 20) throw new Error('Please describe the situation and the expected response in more detail.');
  db.prepare(`
    UPDATE improvement_suggestions
    SET situation = ?, expected_behaviour = ?, example_question = ?, domain = ?, status = 'pending', updated_at = ?
    WHERE id = ?
  `).run(s, e, clean(exampleQuestion ?? existing.example_question, 2000), SUGGESTION_DOMAINS.includes(domain) ? domain : existing.domain, new Date().toISOString(), existing.id);
  return getImprovementSuggestion(existing.id);
}
