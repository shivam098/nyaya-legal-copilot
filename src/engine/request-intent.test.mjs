import test from 'node:test';
import assert from 'node:assert/strict';
import { autoSenseIntakeFromText, detectRequestIntent } from './civil-criminal-rules.mjs';
import { runPractitionerIntelligence } from './practitioner-intelligence.mjs';

function analyse(rawInput, { priorTurns = [], mode } = {}) {
  const auto = autoSenseIntakeFromText({ door: 'unified', mode: mode || 'auto', caseState: {}, rawInput });
  const pi = runPractitionerIntelligence({
    rawInput,
    priorTurns,
    domainInfo: auto.domainInfo,
    caseState: auto.caseState,
    isFollowUpTurn: priorTurns.length > 0,
    mode: auto.mode
  });
  return { auto, pi };
}

test('"help me draft a rent agreement" is a drafting request, not a dispute', () => {
  const { auto, pi } = analyse('help me draft a rent agreement');
  assert.equal(auto.mode, 'document-drafting');
  assert.match(auto.autoDetectedCategoryLabel, /^Document Drafting/);
  assert.equal(pi.requestIntent, 'document-drafting');
  assert.equal(pi.factReadiness.kind, 'drafting');
  assert.equal(pi.factReadiness.intakeStage, 'clarify-first');

  const ids = pi.factProbing.clarifyingQuestions.map(q => q.id);
  assert.deepEqual(ids, ['draft-draftRole', 'draft-draftState', 'draft-draftTermAndUse']);
  const allText = JSON.stringify(pi.factProbing.clarifyingQuestions);
  assert.doesNotMatch(allText, /police|court case|complaint|hearing/i, 'drafting questions must not be dispute questions');

  assert.equal(pi.semanticStatutoryCluster[0].id, 'tenancy-rent-agreement-registration');
  assert.equal(pi.maintainabilityAudit, null);
  assert.equal(pi.crossExaminationInstruction, null);
  assert.match(pi.draftingGuide.legalChecklist[0], /Section 107/);
});

test('answering the drafting chips moves to the full draft and the question card disappears', () => {
  const first = 'help me draft a rent agreement';
  const { pi } = analyse('I am the landlord / owner · Maharashtra (Mumbai / Pune) · 11 months, residential (renewable)', {
    priorTurns: [{ userInput: first }],
    mode: 'document-drafting'
  });
  assert.equal(pi.factReadiness.intakeStage, 'full-roadmap');
  assert.equal(pi.factReadiness.detectedState.state, 'Maharashtra');
  assert.equal(pi.factProbing.clarifyingQuestions.length, 0);
});

test('a rent dispute stays on the dispute route, and a dispute-route full answer shows no question card', () => {
  assert.equal(detectRequestIntent('My landlord is not returning my security deposit under the rent agreement').intent, 'dispute');
  assert.equal(detectRequestIntent('Please draft a legal notice to my landlord').intent, 'dispute');
  assert.equal(detectRequestIntent('I want to make a will for my house').intent, 'document-drafting');

  const { pi } = analyse('I am the victim. Yesterday on 02.11.2026 in Ranchi two men snatched my chain worth Rs 95,000 and scratched my neck. Thana took a Sanha. We have CCTV and the bill.');
  assert.equal(pi.factReadiness.intakeStage, 'full-roadmap');
  assert.equal(pi.factProbing.clarifyingQuestions.length, 0);
});

test('a defaulted role is not counted as a confirmed fact', () => {
  const { pi } = analyse('chain snatching');
  const role = pi.factReadiness.slots.find(s => s.id === 'roleAndParties');
  assert.equal(role.confirmed, false);
});
