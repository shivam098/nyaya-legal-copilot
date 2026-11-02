import test from 'node:test';
import assert from 'node:assert/strict';
import {
  translateLaymanToLegalIngredients,
  evaluateConversationalFactProbing,
  evaluateDownstreamTrapsAndAuditPrayer,
  matchPractitionerCaseTrajectories,
  runPractitionerIntelligence
} from './practitioner-intelligence.mjs';

test('Layman-to-Legal Translator distinguishes voluntary handover ("chori") as Criminal Breach of Trust / Misappropriation (BNS s.316/314)', () => {
  const res = translateLaymanToLegalIngredients(
    'Mere dost ne chori kiya. Maine usko apna gold chain rakhne ke liye diya tha aur ab woh wapas nahi kar raha hai.'
  );
  const cbtMatch = res.find(r => r.id === 'chori-vs-entrustment-cbt');
  assert.ok(cbtMatch, 'Should detect chori vs entrustment rule');
  assert.equal(cbtMatch.confirmedByFacts, true);
  assert.match(cbtMatch.actualLegalConcept, /Criminal Breach of Trust \/ Misappropriation/i);
});

test('BNSS First Schedule & BNS s.303(2) Proviso flags theft below Rs 5,000 as Non-Cognizable', () => {
  const probing = evaluateConversationalFactProbing({
    rawInput: 'Police refused to register FIR for theft of my cycle worth Rs 3,500 at the market.',
    domainInfo: { domain: 'criminal-bns-bnss' },
    paidAmountInr: 3500
  });
  assert.ok(probing.firCognizabilityAnalysis);
  assert.match(probing.firCognizabilityAnalysis.scheduleStatus, /NON-COGNIZABLE/i);
  assert.match(probing.firCognizabilityAnalysis.whyPoliceRefused, /3,500/);
  assert.match(probing.firCognizabilityAnalysis.whatToTellPoliceOrDo, /Section 174\(1\) BNSS/);
});

test('BNSS Section 173(3) Preliminary Inquiry (14-day cap with DSP permission) is explained for matrimonial/commercial FIR refusal', () => {
  const probing = evaluateConversationalFactProbing({
    rawInput: 'Police station refused to register FIR in our commercial cheating dispute and said they will do inquiry first.',
    domainInfo: { domain: 'criminal-bns-bnss' }
  });
  assert.ok(probing.firCognizabilityAnalysis);
  assert.equal(probing.firCognizabilityAnalysis.preliminaryInquiryApplies, true);
  assert.match(probing.firCognizabilityAnalysis.whyPoliceRefused, /Section 173\(3\)/);
  assert.match(probing.firCognizabilityAnalysis.whyPoliceRefused, /14 days/);
  assert.match(probing.firCognizabilityAnalysis.whyPoliceRefused, /DSP\/ACP/);
});

test('Matrimonial probing asks clarifying question when user says "dowry harassment" without describing violence or lockout', () => {
  const probing = evaluateConversationalFactProbing({
    rawInput: 'Mere pati se chhota nok-jhok hua aur main maike aa gayi, pati bula nahi rahe, dahej utpidan ka mamla hai.',
    domainInfo: { domain: 'matrimonial-family' },
    caseState: { role: 'complainant' }
  });
  const goalQ = probing.clarifyingQuestions.find(q => q.id === 'probe-matrimonial-goal');
  assert.ok(goalQ, 'Should ask matrimonial goal probing question (reconciliation/s.9 HMA vs PWDVA s.12/BNS s.85)');
  assert.ok(goalQ.quickReplies.length >= 3);
});

test('Downstream Trap Foresight & Plaint Prayer Clause Auditor catches parallel Bank Loan trap and missing reliefs in draft plaint', () => {
  const draftPlaint = `
    IN THE COURT OF THE CIVIL JUDGE / RERA AUTHORITY
    Complainant paid Rs 45 lakhs via a Bank Home Loan and EMI is being deducted every month while builder delayed possession.
    PRAYER:
    It is most respectfully prayed that the Opposite Party be directed to refund Rs 45,00,000 to the Complainant.
  `;
  const audit = evaluateDownstreamTrapsAndAuditPrayer({
    rawInput: draftPlaint,
    domainInfo: { domain: 'property-rera' }
  });

  assert.ok(audit.downstreamWarnings.some(w => w.id === 'trap-builder-bank-loan-recovery'));
  assert.ok(audit.prayerClauseAudit);
  assert.equal(audit.prayerClauseAudit.status, 'NEEDS_ADDITIONS');
  assert.ok(audit.prayerClauseAudit.missingPrayers.some(p => /interest/i.test(p)));
  assert.ok(audit.prayerClauseAudit.missingPrayers.some(p => /Bank \/ Tripartite Loan/i.test(p)));
  assert.ok(audit.prayerClauseAudit.missingPrayers.some(p => /Omnibus residual prayer/i.test(p)));
});

test('runPractitionerIntelligence produces Instant Triage, Ingredient Translation, and Case Trajectories', () => {
  const intel = runPractitionerIntelligence({
    rawInput: 'What is Article 12 State definition and can a writ petition be filed against BCCI for fundamental rights?',
    domainInfo: { domain: 'tenancy-civil', label: 'Constitutional & Civil Law' },
    autoDetectedCategoryLabel: 'Constitutional & Writ Jurisdiction'
  });

  assert.ok(intel.instantTriage);
  assert.ok(intel.ingredientTranslations.some(t => t.id === 'article-12-state-vs-private'));
  assert.match(intel.instantTriage.keyIngredientTranslation, /Article 12 "State" Instrumentality Test/);
});
