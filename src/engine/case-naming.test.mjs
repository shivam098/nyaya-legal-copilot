import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractCaseSubject, generateCaseTitle, isLegacyAutoTitle } from './case-naming.mjs';

process.env.NYAYA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya-case-naming-test-'));
const sessionDb = await import('./session-db.mjs');
const log = await import('./interaction-log.mjs');

test('case names say what kind of matter it is and what was asked, without filler', () => {
  assert.equal(generateCaseTitle({ firstQuestion: 'help me draft a rent agreement' }), 'Draft · Rent agreement');
  assert.equal(
    generateCaseTitle({ firstQuestion: 'What kind of company should I create if I am a solo founder?' }),
    'Company · What kind of company should I create if I am a…'
  );
  assert.equal(generateCaseTitle({ firstQuestion: 'Police is refusing to file FIR what can I do?' }), 'Criminal · Police is refusing to file FIR');
  assert.equal(
    generateCaseTitle({ firstQuestion: 'I bought an Apple Watch. Now the speaker is not working and service centre refuses repair' }),
    'Consumer · I bought an Apple Watch, now the speaker is not…'
  );
  assert.equal(generateCaseTitle({ firstQuestion: 'My landlord is not returning my security deposit' }), 'Tenancy · My landlord is not returning my security deposit');
  assert.equal(generateCaseTitle({ firstQuestion: 'Hi' }), 'Legal question matter');
});

test('form-field lines are dropped but story fields are kept', () => {
  const formInput = 'User Role: Complainant (seeking refund/relief)\nRaw Story / WhatsApp Chat: Cheque of Rs 2 lakh bounced 27 days ago';
  assert.equal(extractCaseSubject(formInput), 'Cheque of Rs 2 lakh bounced 27 days ago');
  assert.equal(generateCaseTitle({ firstQuestion: formInput }), 'Cheque bounce · Cheque of Rs 2 lakh bounced 27 days ago');
  assert.equal(extractCaseSubject('Hi Can you tell me What should be done So today my friend parked his car on a footpath'), 'Today my friend parked his car on a footpath');
});

test('a fresh engine result decides the area, State and ongoing-case wording', () => {
  assert.equal(generateCaseTitle({
    firstQuestion: 'draft rent agreement',
    engineResult: { effectiveMode: 'document-drafting', practitionerIntelligence: { factReadiness: { kind: 'drafting', documentType: 'rent-agreement', detectedState: { state: 'Maharashtra' } } } }
  }), 'Draft · Rent agreement (Maharashtra)');
  assert.equal(generateCaseTitle({
    firstQuestion: 'OP has taken 3 adjournments',
    engineResult: { effectiveDoor: 'midcase', effectiveMode: 'midcase-battle-card', domainInfo: { domain: 'consumer' } }
  }), 'Ongoing consumer case · OP has taken 3 adjournments');
});

test('legacy automatic names are recognised; names people typed are not', () => {
  assert.equal(isLegacyAutoTitle('[Dispute] help me draft a rent agreement'), true);
  assert.equal(isLegacyAutoTitle('Ongoing Case — op-evidence'), true);
  assert.equal(isLegacyAutoTitle('insurance misselling'), false);
  assert.equal(isLegacyAutoTitle('Draft · Rent agreement'), false);
});

test('auto names refresh with the conversation, but a name the user typed is never replaced', () => {
  const save = (extra) => sessionDb.saveOrAppendSessionTurn({
    userId: 'namer-1', door: 'start', mode: 'messy-dump-intake', caseState: {}, engineResult: null,
    assistantMarkdown: 'ok', model: 'm', ...extra
  });
  const first = save({ userInput: 'My landlord is not returning my security deposit' });
  assert.equal(first.title, 'Tenancy · My landlord is not returning my security deposit');
  // The client echoes the current title back on every turn; that must not freeze it as user-chosen.
  const second = save({ sessionId: first.id, title: first.title, userInput: 'It was Rs 60,000 in Pune' });
  assert.equal(second.title, first.title);

  sessionDb.renameSessionForUser('namer-1', first.id, 'Pune flat deposit');
  const third = save({ sessionId: first.id, title: 'Pune flat deposit', userInput: 'Any update?' });
  assert.equal(third.title, 'Pune flat deposit');

  const named = save({ title: 'My own name', userInput: 'Cheque bounced' });
  assert.equal(named.title, 'My own name');
});

test('Super-Admin can list every user\'s cases and audit any past answer', () => {
  sessionDb.saveOrAppendSessionTurn({ userId: 'guest_other', door: 'start', mode: 'messy-dump-intake', caseState: {}, userInput: 'Police refused my FIR in Ranchi', engineResult: null, assistantMarkdown: 'Go to SP', model: 'm' });
  const all = sessionDb.listAllSessionsForAdmin({});
  assert.ok(all.total >= 3);
  assert.ok(all.sessions.some(s => s.userId === 'guest_other' && s.signedIn === false));
  const found = sessionDb.listAllSessionsForAdmin({ q: 'Ranchi' });
  assert.equal(found.total, 1);

  const session = sessionDb.getAnySessionWithTurnsForAdmin(found.sessions[0].id);
  const entry = log.ensureInteractionLogForTurn(session.turns[0].id);
  assert.equal(entry.endpoint, 'history');
  assert.equal(entry.authState, 'guest');
  assert.match(entry.requestText, /Ranchi/);
  assert.equal(log.ensureInteractionLogForTurn(session.turns[0].id).id, entry.id, 'opening the audit again reuses the same entry');
  assert.equal(log.findInteractionLogIdsForTurns([session.turns[0].id])[session.turns[0].id].logId, entry.id);
});
