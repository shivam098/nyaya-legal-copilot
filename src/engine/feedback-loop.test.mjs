import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NYAYA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya-feedback-loop-test-'));

const sessionDb = await import('./session-db.mjs');
const log = await import('./interaction-log.mjs');
const shares = await import('./share-links.mjs');
const suggestions = await import('./improvement-suggestions.mjs');
const lessons = await import('./semantic-statutory-index.mjs');

function seedConversation(userId, turns = 2) {
  let session = null;
  for (let i = 1; i <= turns; i++) {
    session = sessionDb.saveOrAppendSessionTurn({
      userId,
      sessionId: session?.id,
      door: 'start',
      mode: 'messy-dump-intake',
      caseState: {},
      userInput: `Question ${i} about my deposit${i === 1 ? '\n\nATTACHED FOLDER / TEXT DOCUMENTS:\nPrivate lease text' : ''}`,
      engineResult: { domainInfo: { domain: 'tenancy-civil', label: 'Tenancy (Rent Control)' } },
      assistantMarkdown: `Answer ${i}`,
      model: 'test-model'
    });
  }
  return session;
}

test('interaction log records signed-in and guest requests, failures, ratings and reviews', () => {
  const engineResult = {
    effectiveMode: 'company-advisor',
    autoDetectedCategoryLabel: 'Company & Startup Advisory',
    domainInfo: { domain: 'corporate-roc' },
    practitionerIntelligence: { factReadiness: { kind: 'advisory', intakeStage: 'full-roadmap' }, factProbing: { clarifyingQuestions: [] } },
    responseCompletion: { incomplete: false },
    verification: { verified: true }
  };
  assert.equal(log.logInteraction({ id: 'ilog-a', endpoint: 'analyze-stream', userId: 'u-signed', authenticated: true, userEmail: 'a@b.in', requestText: 'OPC or Pvt Ltd?', responseText: 'Here are your options', engineResult, turnId: 501 }), true);
  log.logInteraction({ id: 'ilog-b', endpoint: 'analyze-stream', userId: 'guest_x', authenticated: false, userEmail: 'should-not-store@x.in', requestText: 'landlord deposit', status: 'error', httpStatus: 500, errorMessage: 'provider timeout' });
  log.logInteraction({ id: 'ilog-c', endpoint: 'analyze', status: 'rate_limited', httpStatus: 429 });

  const all = log.listInteractionLogs({});
  assert.equal(all.summary.total, 3);
  assert.equal(all.summary.signedIn, 1);
  assert.equal(all.summary.guest, 2);
  assert.equal(all.summary.failures, 2);

  const guests = log.listInteractionLogs({ authState: 'guest' });
  assert.deepEqual(guests.entries.map(e => e.id).sort(), ['ilog-b', 'ilog-c']);
  assert.equal(log.getInteractionLog('ilog-b').userEmail, 'should-not-store@x.in', 'the server only passes an email for signed-in users; the module stores what it is given');

  const signed = log.getInteractionLog('ilog-a');
  assert.equal(signed.authState, 'signed-in');
  assert.equal(signed.domain, 'corporate-roc');
  assert.equal(signed.intakeKind, 'advisory');
  assert.equal(signed.responseText, 'Here are your options');

  assert.equal(log.listInteractionLogs({ q: 'deposit' }).total, 1);
  assert.equal(log.listInteractionLogs({ failuresOnly: true }).total, 2);

  log.syncInteractionRating(501, -1, 'missed the OPC conversion rule');
  assert.equal(log.getInteractionLog('ilog-a').userRating, -1);

  const reviewed = log.updateInteractionReview('ilog-a', { reviewStatus: 'needs-fix', tags: ['legal-error', 'not-a-tag'], note: 'Explain nominee rules', reviewer: 'admin@nyaya.ai' });
  assert.equal(reviewed.reviewStatus, 'needs-fix');
  assert.deepEqual(reviewed.reviewTags, ['legal-error']);
  assert.equal(log.listInteractionLogs({ reviewStatus: 'needs-fix' }).total, 1);

  const jsonl = log.exportInteractionLogs({ authState: 'signed-in' }).split('\n');
  assert.equal(jsonl.length, 1);
  assert.equal(JSON.parse(jsonl[0]).id, 'ilog-a');
});

test('interaction log prunes rows older than the retention window', () => {
  log.logInteraction({ id: 'ilog-old', endpoint: 'analyze', createdAt: new Date(Date.now() - 400 * 86_400_000).toISOString() });
  assert.ok(log.getInteractionLog('ilog-old'));
  assert.ok(log.pruneInteractionLogs(180) >= 1);
  assert.equal(log.getInteractionLog('ilog-old'), null);
  assert.ok(log.getInteractionLog('ilog-a'), 'recent rows are kept');
});

test('share links are owner-only, snapshot the conversation, hide documents by default and can be revoked', () => {
  const session = seedConversation('owner-1', 2);
  assert.throws(() => shares.createSessionShare({ ownerUserId: 'someone-else', sessionId: session.id }), /not found/);

  const { share, token } = shares.createSessionShare({ ownerUserId: 'owner-1', sessionId: session.id, expiresInDays: 7, recipientLabel: 'Adv. Rao' });
  assert.equal(share.uptoTurnIndex, 2);
  assert.ok(token.length >= 20);

  // A later turn is not visible through the existing link.
  sessionDb.saveOrAppendSessionTurn({ userId: 'owner-1', sessionId: session.id, door: 'start', mode: 'messy-dump-intake', caseState: {}, userInput: 'Private later question', engineResult: null, assistantMarkdown: 'Later answer', model: 'm' });

  const view = shares.readSharedConversation(token);
  assert.equal(view.turns.length, 2);
  assert.equal(view.turns[0].question, 'Question 1 about my deposit');
  assert.equal(view.turns[0].hadDocuments, true);
  assert.equal(view.turns[0].documentText, '', 'document text is excluded unless the owner opts in');
  assert.equal(view.areaOfLaw, 'Tenancy (Rent Control)');
  assert.ok(!JSON.stringify(view).includes('Private later question'));

  const withDocs = shares.createSessionShare({ ownerUserId: 'owner-1', sessionId: session.id, includeDocuments: true });
  assert.equal(shares.readSharedConversation(withDocs.token).turns[0].documentText, 'Private lease text');

  assert.equal(shares.listSessionShares({ ownerUserId: 'owner-1', sessionId: session.id }).find(x => x.id === share.id).viewCount, 1);
  assert.equal(shares.revokeSessionShare({ ownerUserId: 'someone-else', shareId: share.id }), null);
  assert.equal(shares.revokeSessionShare({ ownerUserId: 'owner-1', shareId: share.id }).active, false);
  assert.equal(shares.readSharedConversation(token), null);
  assert.equal(shares.readSharedConversation('not-a-real-token-but-long-enough'), null);
});

test('expert suggestions: submit, send back, revise, approve into a lesson Nyaya retrieves, then retire', () => {
  sessionDb.ensureUserRecord('expert-1', 'Adv. Expert');
  assert.throws(() => sessionDb.setUserReviewerRole('expert-1', 'expert'), /signed-up/);

  const submitterAuth = { userId: 'guest_lawyer', authenticated: false, user: { displayName: 'Guest' } };
  assert.throws(() => suggestions.submitImprovementSuggestion({ auth: submitterAuth, situation: 'short', expectedBehaviour: 'too short' }), /at least/);

  const s = suggestions.submitImprovementSuggestion({
    auth: submitterAuth,
    expertise: 'advocate',
    domain: 'criminal-bns-bnss',
    situation: 'Section 69 BNS complaint after a long consensual relationship ends',
    expectedBehaviour: 'Ask whether the promise to marry was false from the very start; cite Pramod Suryabhan Pawar v. State of Maharashtra (2019) 9 SCC 608.',
    exampleQuestion: 'She filed s.69 after we broke up'
  });
  assert.equal(s.status, 'pending');
  assert.equal(s.submitterAuth, 'guest');

  const reviewer = { userId: 'admin-1', authenticated: true, isSuperAdmin: true, user: { email: 'admin@nyaya.ai', role: 'superadmin' } };
  assert.equal(suggestions.isSuggestionReviewer(reviewer), true);
  assert.equal(suggestions.isSuggestionReviewer({ authenticated: true, user: { role: 'user' } }), false);
  assert.equal(suggestions.isSuggestionReviewer({ authenticated: false, user: { role: 'expert' } }), false);

  const sentBack = suggestions.reviewImprovementSuggestion({ id: s.id, action: 'needs-changes', reviewerAuth: reviewer, note: 'Add the false-from-inception test wording' });
  assert.equal(sentBack.status, 'needs-changes');
  const revised = suggestions.reviseMySuggestion({ id: s.id, userId: 'guest_lawyer', expectedBehaviour: `${s.expectedBehaviour} Distinguish a breach of promise from a false promise made from inception.` });
  assert.equal(revised.status, 'pending');
  assert.equal(suggestions.reviseMySuggestion({ id: s.id, userId: 'someone-else', expectedBehaviour: 'x'.repeat(30) }), null);

  const approved = suggestions.reviewImprovementSuggestion({
    id: s.id,
    action: 'approve',
    reviewerAuth: reviewer,
    lessonTopic: 'Section 69 BNS — false promise to marry',
    lessonText: 'For a s.69 BNS complaint after a consensual relationship, first establish whether the promise to marry was false from inception (Pramod Suryabhan Pawar (2019) 9 SCC 608); a later breach alone is not the offence.'
  });
  assert.equal(approved.status, 'approved');
  assert.ok(approved.lessonId);
  const found = lessons.searchPractitionerLessonsSemantic('my girlfriend filed section 69 BNS false promise to marry case after breakup', 'criminal-bns-bnss', 3);
  assert.ok(found.some(l => l.id === approved.lessonId), 'the approved rule is retrieved for a similar question');

  const queue = suggestions.listSuggestionsForReview({ status: 'approved' });
  assert.equal(queue.counts.approved, 1);
  assert.equal(suggestions.listMySuggestions('guest_lawyer')[0].status, 'approved');

  const retired = suggestions.reviewImprovementSuggestion({ id: s.id, action: 'retire', reviewerAuth: reviewer });
  assert.equal(retired.status, 'retired');
  assert.ok(!lessons.listAllPractitionerLessons().some(l => l.id === approved.lessonId), 'retiring removes the lesson');
});
