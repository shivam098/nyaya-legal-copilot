import test from 'node:test';
import assert from 'node:assert/strict';
import {
  translateLaymanToLegalIngredients,
  evaluateConversationalFactProbing,
  evaluateCaseFactReadiness,
  evaluateDownstreamTrapsAndAuditPrayer,
  matchPractitionerCaseTrajectories,
  runPractitionerIntelligence
} from './practitioner-intelligence.mjs';
import {
  EMBEDDING_DIM,
  computeSemanticEmbedding384,
  searchStatutoryProvisionsSemantic,
  addOrUpdatePractitionerLesson,
  searchPractitionerLessonsSemantic,
  deletePractitionerLesson
} from './semantic-statutory-index.mjs';

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

test('Two-Speed Clarify-First Gate triggers on 1-line Ranchi chain snatching prompt and switches to full-roadmap on follow-up or override', () => {
  const oneLiner = 'I am seeking protection, relief or filing, Suggestions, guidance for a chain snatching case in ranchi';
  const intel = runPractitionerIntelligence({
    rawInput: oneLiner,
    domainInfo: { domain: 'criminal-bns-bnss' },
    isFollowUpTurn: false,
    hasAttachments: false,
    forceFullRoadmap: false
  });

  assert.equal(intel.factReadiness.intakeStage, 'clarify-first');
  assert.equal(intel.factReadiness.shouldClarifyFirst, true);
  assert.ok(
    intel.factProbing.clarifyingQuestions.some(q => q.id === 'probe-snatching-injury-304-vs-309'),
    'Should include s.304 Snatching vs s.309 Robbery neck-injury probing question'
  );

  // Follow-up turn or forceFullRoadmap switches to full-roadmap
  const followUpCheck = evaluateCaseFactReadiness({
    rawInput: 'It happened today, there was a neck scratch, and we have nearby CCTV.',
    isFollowUpTurn: true,
    domainInfo: { domain: 'criminal-bns-bnss' }
  });
  assert.equal(followUpCheck.intakeStage, 'full-roadmap');

  const forcedCheck = evaluateCaseFactReadiness({
    rawInput: oneLiner,
    isFollowUpTurn: false,
    forceFullRoadmap: true,
    domainInfo: { domain: 'criminal-bns-bnss' }
  });
  assert.equal(forcedCheck.intakeStage, 'full-roadmap');
});

test('SQLite 384-Dim Semantic Vector Search + Adjacent Chapter-Cluster Expansion retrieves s.304 Snatching, s.309 Robbery, s.303 Theft, and s.497/503 BNSS Jimmanama', () => {
  const vec = computeSemanticEmbedding384('chain snatching in Ranchi');
  assert.equal(vec.length, EMBEDDING_DIM);

  const cluster = searchStatutoryProvisionsSemantic(
    'I am seeking protection, relief or filing, Suggestions, guidance for a chain snatching case in ranchi',
    { topK: 3, expandCluster: true }
  );
  const ids = cluster.map(c => c.id);
  assert.ok(ids.includes('bns-304-snatching'), 'Should retrieve Section 304 BNS Snatching');
  assert.ok(ids.includes('bns-309-robbery'), 'Should automatically pull adjacent Section 309 BNS Robbery via chapter_cluster');
  assert.ok(ids.includes('bnss-497-503-jimmanama-tip'), 'Should pull Section 497/503 BNSS Jimmanama & Section 54 TIP');

  // Hindi Devanagari semantic query test
  const hindiMatches = searchStatutoryProvisionsSemantic(
    'मैंने अपने दोस्त को अमानत के तौर पर गहने रखने के लिए दिया था, अब वह वापस नहीं कर रहा है',
    { topK: 2, expandCluster: false }
  );
  assert.equal(hindiMatches[0].id, 'bns-314-316-cbt-misappropriation');
});

test('Super-Admin Teach Nyaya embeds 384-dim practitioner lessons in SQLite and retrieves them semantically', () => {
  const saved = addOrUpdatePractitionerLesson({
    id: 'test-lesson-ranchi-sanha',
    domain: 'criminal-bns-bnss',
    topic: 'Ranchi Thana Sanha Downgrade Counter-Move',
    lessonText: 'Never accept a Sanha (station diary lost report) when force or snatching occurred; demand a cognizable FIR under Section 304 or 309 BNS and file online on jhpolice.gov.in if refused.',
    author: 'Test-Admin'
  });
  assert.equal(saved.embeddingDim, 384);

  const matched = searchPractitionerLessonsSemantic(
    'Ranchi police station asked me to write a Sanha lost report for my snatched gold chain',
    'criminal-bns-bnss',
    3
  );
  assert.ok(matched.some(m => m.id === 'test-lesson-ranchi-sanha'));

  deletePractitionerLesson('test-lesson-ranchi-sanha');
});
