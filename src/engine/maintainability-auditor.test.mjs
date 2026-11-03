import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CIVIL_COURT_OUSTER_MATRIX,
  detectIndianState,
  evaluateMaintainabilityAndOusters,
  evaluatePaperTrailAndSelfGoals,
  evaluateForumElectionAndEconomics,
  evaluateFlankRisks,
  buildCrossExaminationInstruction
} from './maintainability-auditor.mjs';

test('Section 9 CPC ouster matrix covers all five statutory families', () => {
  const families = new Set(CIVIL_COURT_OUSTER_MATRIX.map(r => r.family));
  for (const f of ['Banking & Insolvency', 'Real Estate, Land & Tenancy', 'Corporate, Markets & Competition', 'Family, Senior Citizens, Service & Labour', 'Utilities, MACT, Tax & Environment']) {
    assert.ok(families.has(f), `missing family ${f}`);
  }
  assert.ok(CIVIL_COURT_OUSTER_MATRIX.length >= 21);
});

test('SARFAESI auction routes to DRT, flags Section 34 bar, fraud exception and the 45-day Section 17 clock', () => {
  const audit = evaluateMaintainabilityAndOusters({
    rawInput: 'Bank issued a SARFAESI possession notice under 13(4) and wants to auction my house. I think the loan papers were forged.',
    domainInfo: { domain: 'banking-sarfaesi' },
    caseState: { possessionNoticeDate: '2026-10-01' },
    evaluationDate: '2026-11-03'
  });
  const sarfaesi = audit.ousters.find(o => o.id === 'sarfaesi-s34');
  assert.ok(sarfaesi);
  assert.match(sarfaesi.exclusiveForum, /Section 17 within 45 days/);
  assert.equal(sarfaesi.fraudExceptionMayApply, true);
  const clock = audit.limitationChecks.find(l => l.id === 'sarfaesi-s17');
  assert.equal(clock.daysElapsed, 33);
  assert.equal(clock.daysRemaining, 12);
  assert.equal(clock.status, 'within-time');
});

test('Hilli Multipurpose 45-day cap is a hard bar after Day 45, and missing dates are requested not guessed', () => {
  const late = evaluateMaintainabilityAndOusters({
    rawInput: 'Opposite party has not filed the written version in the consumer commission',
    domainInfo: { domain: 'consumer' },
    caseState: { serviceDate: '2026-09-01' },
    evaluationDate: '2026-10-20'
  });
  const wv = late.limitationChecks.find(l => l.id === 'consumer-written-version');
  assert.equal(wv.status, 'barred-hard-ceiling');
  assert.equal(late.summary.hardBarDetected, true);

  const noDate = evaluateMaintainabilityAndOusters({
    rawInput: 'My father died in a road accident caused by a truck',
    domainInfo: { domain: 'motor-accident-mact' },
    caseState: {}
  });
  const mact = noDate.limitationChecks.find(l => l.id === 'mact-s166-3');
  assert.equal(mact.status, 'date-needed');
  assert.ok(mact.verifyNote);
  assert.ok(noDate.ousters.some(o => o.id === 'motor-vehicles-s175'));
});

test('Arbitration clause: Consumer/RERA override (Emaar MGF) and one-sided arbitrator appointment flagged (Perkins Eastman)', () => {
  const audit = evaluateMaintainabilityAndOusters({
    rawInput: 'The builder agreement has an arbitration clause and says the builder shall appoint the sole arbitrator.',
    domainInfo: { domain: 'property-rera' }
  });
  assert.ok(audit.arbitration.clauseDetected);
  assert.match(audit.arbitration.statutoryOverride, /Emaar MGF/);
  assert.equal(audit.arbitration.unilateralAppointmentDetected, true);
  assert.match(audit.arbitration.unilateralAppointmentRule, /Perkins Eastman/);
});

test('Paper-trail audit detects oral-only facts, discharge vouchers and forced resignation', () => {
  const oral = evaluatePaperTrailAndSelfGoals({ rawInput: 'The service centre refused orally and did not give any job sheet.' });
  assert.equal(oral.oralOnlyDeficit, true);
  assert.match(oral.stepZeroAdvice, /dated written record/);

  const vouchers = evaluatePaperTrailAndSelfGoals({ rawInput: 'HR forced me to resign and made me sign a full and final settlement voucher' });
  assert.ok(vouchers.selfGoals.some(s => s.id === 'discharge-voucher' && /Boghara Polyfab/.test(s.counterMove)));
  assert.ok(vouchers.selfGoals.some(s => s.id === 'forced-resignation'));
});

test('Doctrine of election distinguishes mutually exclusive (RERA vs Consumer) from cumulative (s.138 + Order 37) remedies', () => {
  const rera = evaluateForumElectionAndEconomics({ domainInfo: { domain: 'property-rera' } });
  assert.equal(rera.relationship, 'mutually-exclusive');
  assert.match(rera.electionRule, /Imperia Structures/);
  const cheque = evaluateForumElectionAndEconomics({ domainInfo: { domain: 'cheque-bounce-138' } });
  assert.equal(cheque.relationship, 'cumulative');
  assert.ok(cheque.options.some(o => /Order 37/.test(o.forum)));
  assert.equal(evaluateForumElectionAndEconomics({ domainInfo: { domain: 'unknown' } }), null);
});

test('State detection, flank risks and the cross-examination instruction', () => {
  assert.equal(detectIndianState('chain snatched near Ranchi railway station').state, 'Jharkhand');
  assert.equal(detectIndianState('nothing about a place'), null);

  const flanks = evaluateFlankRisks({ rawInput: 'I want to terminate the contractor and my salary is pending', domainInfo: { domain: 'employment-labour' } });
  assert.ok(flanks.some(f => f.id === 'caveat-s148a'));
  assert.ok(flanks.some(f => f.id === 'hr-counter-allegation'));

  const xexam = buildCrossExaminationInstruction({ domain: 'criminal-bns-bnss' });
  assert.match(xexam, /Section 146 BSA/);
  assert.match(xexam, /do not invent their statements/);
});
