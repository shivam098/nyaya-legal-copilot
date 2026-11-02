import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectLegalDomain,
  extractPaidAmountInr,
  evaluateConsumerPecuniaryAndFee,
  evaluateNiAct138Deadlines,
  evaluateCriminalCodeAndBail,
  evaluateCivilWrittenStatementWindow,
  verifyDomainLegalAccuracy
} from './civil-criminal-rules.mjs';

test('detectLegalDomain accurately separates Consumer, Property/RERA, Matrimony, Partition, Cheque Bounce, Criminal, and Corporate', () => {
  assert.equal(
    detectLegalDomain({ door: 'start', rawInput: 'Builder delayed flat possession in Pune after I paid Rs 72 lakhs, MahaRERA vs Consumer Court' }).domain,
    'property-rera'
  );
  assert.equal(
    detectLegalDomain({ door: 'start', rawInput: 'My husband and mother-in-law locked me out and kept my streedhan gold jewellery' }).domain,
    'matrimonial-family'
  );
  assert.equal(
    detectLegalDomain({ door: 'start', rawInput: 'Got a CAW Cell call and threat of 498A FIR arrest at the police station' }).domain,
    'criminal-bns-bnss'
  );
  assert.equal(
    detectLegalDomain({ door: 'start', rawInput: 'Father died intestate without a will, brother selling ancestral house' }).domain,
    'inheritance-partition'
  );
  assert.equal(
    detectLegalDomain({ door: 'start', rawInput: 'Buyer cheque for Rs 6,40,000 returned dishonoured with memo Funds Insufficient' }).domain,
    'cheque-bounce-138'
  );
  assert.equal(
    detectLegalDomain({ door: 'midcase', rawInput: 'O.S. No. 412/2026 before Principal Senior Civil Judge for Order 39 CPC injunction' }).isConsumerForum,
    false
  );
  assert.equal(
    detectLegalDomain({ door: 'start', rawInput: 'Apple Watch speaker stopped working under warranty' }).isConsumerForum,
    true
  );
});

test('evaluateConsumerPecuniaryAndFee computes exact 2021 pecuniary forum and Rule 7 fee slabs', () => {
  const repair8k = evaluateConsumerPecuniaryAndFee(extractPaidAmountInr('paid 8000 rupaye for phone repair'));
  assert.equal(repair8k.filingFeeInr, 0);
  assert.match(repair8k.competentForum, /District Consumer/);

  const flat72L = evaluateConsumerPecuniaryAndFee(extractPaidAmountInr('paid Rs 72 lakhs to builder'));
  assert.equal(flat72L.filingFeeInr, 2000);
  assert.match(flat72L.competentForum, /State Consumer/);

  const med185Cr = evaluateConsumerPecuniaryAndFee(extractPaidAmountInr('Rs 1.85 Crore hospital billing matter'));
  assert.equal(med185Cr.filingFeeInr, 2500);
  assert.match(med185Cr.competentForum, /State Consumer/);
});

test('evaluateNiAct138Deadlines computes 30-day demand notice window and s.142(2)(a) jurisdiction', () => {
  const urgent = evaluateNiAct138Deadlines({
    dishonourDate: '2026-10-06',
    evaluationDate: '2026-11-02'
  });
  assert.equal(urgent.daysSinceDishonour, 27);
  assert.equal(urgent.daysRemainingForNotice, 3);
  assert.equal(urgent.noticeDeadlineDate, '2026-11-05');
  assert.equal(urgent.noticeWindowExpired, false);
  assert.match(urgent.jurisdictionRule, /142\(2\)\(a\)/);
});

test('evaluateCriminalCodeAndBail maps 498A to BNS 85 as non-bailable with Arnesh Kumar / BNSS 35(3) notice protection', () => {
  const res = evaluateCriminalCodeAndBail({
    incidentDate: '2026-09-15',
    rawInput: 'Threatening 498A FIR and extortion at CAW Cell police station',
    custodyDays: 65
  });
  assert.match(res.substantiveCode, /Bharatiya Nyaya Sanhita/);
  const cruelty = res.matchedOffences.find(o => o.id === 'cruelty-498a-bns85');
  assert.ok(cruelty);
  assert.equal(cruelty.bailable, false);
  assert.equal(cruelty.arneshKumarNoticeApplies, true);
  assert.equal(res.defaultBailStatus.sixtyDayThresholdReached, true);
});

test('evaluateCivilWrittenStatementWindow computes Order VIII Rule 1 CPC 30/90/120 day limits', () => {
  const civil = evaluateCivilWrittenStatementWindow({
    serviceDate: '2026-09-01',
    evaluationDate: '2026-11-02',
    isCommercialSuit: false,
    writtenStatementFiled: false
  });
  assert.equal(civil.daysSinceService, 62);
  assert.equal(civil.exceededOuterWindow, false);
});

test('verifyDomainLegalAccuracy catches 498A bailable, PO Protection Order, RCR streedhan, and Sub-Registrar caveat errors', () => {
  const bad498a = verifyDomainLegalAccuracy('File a bail application (the 498A charge is bailable).', { domain: 'criminal-bns-bnss' });
  assert.equal(bad498a.verified, false);

  const badMatrimony = verifyDomainLegalAccuracy(
    'A Protection Officer can issue a Protection Order. File for Restitution of Conjugal Rights to recover your streedhan jewellery and passport.',
    { domain: 'matrimonial-family' }
  );
  assert.equal(badMatrimony.verified, false);
  assert.equal(badMatrimony.warnings.length, 2);

  const badPartition = verifyDomainLegalAccuracy(
    'Register a caveat at the sub-registrar office for Rs 500.',
    { domain: 'inheritance-partition' }
  );
  assert.equal(badPartition.verified, false);
});
