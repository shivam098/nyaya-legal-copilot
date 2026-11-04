import test from 'node:test';
import assert from 'node:assert/strict';
import { autoSenseIntakeFromText, detectRequestIntent } from './civil-criminal-rules.mjs';
import { runPractitionerIntelligence, mergeDynamicClarifyingQuestions } from './practitioner-intelligence.mjs';

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

test('LLM-proposed questions never duplicate the cards (drafting cards are authoritative)', () => {
  const drafting = analyse('help me draft a rent agreement').pi;
  mergeDynamicClarifyingQuestions(drafting, [{ id: 'q1', question: 'Are you the landlord or the tenant?', quickReplies: [] }]);
  assert.equal(drafting.factProbing.clarifyingQuestions.length, 3);

  const dispute = analyse('chain snatching case in Ranchi').pi;
  const before = dispute.factProbing.clarifyingQuestions.length;
  mergeDynamicClarifyingQuestions(dispute, [
    { id: 'dup', question: `${dispute.factProbing.clarifyingQuestions[0].question.replace(/^\d+\.\s*/, '')} (please confirm)`, quickReplies: [] },
    { id: 'new', question: 'Which police station area did this happen in?', quickReplies: [] }
  ]);
  const ids = dispute.factProbing.clarifyingQuestions.map(q => q.id);
  assert.ok(!ids.includes('dup'));
  assert.equal(ids.includes('new'), before < 4);
});

test('company formation questions route to company advisory, not consumer law, with no dispute questions', () => {
  for (const text of [
    'What kind of company should I create if I am a solo founder aiming to provide AI-based business solutions to customers?',
    'OPC vs Pvt Ltd which is better for me',
    'ROC rejected my INC-20A filing and imposed penalty'
  ]) {
    const { auto, pi } = analyse(text);
    assert.equal(auto.domainInfo.domain, 'corporate-roc', text);
    assert.equal(auto.mode, 'company-advisor', text);
    assert.equal(pi.factReadiness.kind, 'advisory', text);
    assert.equal(pi.factReadiness.slots.length, 0, text);
    assert.equal(pi.factProbing.clarifyingQuestions.length, 0, text);
  }
});

test('a dispute with a private limited company stays a consumer dispute', () => {
  const { auto, pi } = analyse('XYZ Pvt Ltd refused to refund my money for a defective laptop');
  assert.equal(auto.domainInfo.domain, 'consumer');
  assert.notEqual(pi.factReadiness.kind, 'advisory');
});

test('unrecognised questions are not forced into consumer law', () => {
  const info = analyse('How do I legally change my name?');
  assert.equal(info.auto.domainInfo.domain, 'general');
  assert.equal(info.auto.domainInfo.isConsumerForum, false);
  assert.equal(info.pi.factReadiness.kind, 'advisory');
  const dispute = analyse('My neighbour is threatening me and blocking my path');
  assert.equal(dispute.auto.domainInfo.isConsumerForum, false);
  assert.notEqual(dispute.pi.factReadiness.kind, 'advisory');
});

test('cheque bounce is detected even when words sit between cheque and bounced', () => {
  assert.equal(analyse('Cheque of Rs 2 lakh bounced 27 days ago').auto.domainInfo.domain, 'cheque-bounce-138');
});
