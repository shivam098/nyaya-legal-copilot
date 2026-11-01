import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateLimitation,
  evaluateWrittenVersionWindow,
  evaluateDisposalPace,
  auditLawyerUpdate,
  matchApplicableTactics
} from './consumer-rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tactics = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../packs/consumer/tactics.json'), 'utf8')
);

test('CPA s.69 limitation — within 2 years vs expired', () => {
  const ok = evaluateLimitation('2025-05-01', '2026-10-24');
  assert.equal(ok.withinLimitation, true);
  assert.equal(ok.requiresCondonationUnderS69_2, false);

  const late = evaluateLimitation('2023-01-01', '2026-10-24');
  assert.equal(late.withinLimitation, false);
  assert.equal(late.requiresCondonationUnderS69_2, true);
});

test('CPA s.38(2)(a) Hilli Multipurpose 45-day Written Version hard cap', () => {
  const within30 = evaluateWrittenVersionWindow('2026-10-01', '2026-10-20', false);
  assert.equal(within30.canForfeitRightToReply, false);

  const inExt = evaluateWrittenVersionWindow('2026-09-15', '2026-10-24', false);
  assert.equal(inExt.inDiscretionaryExtensionWindow, true);
  assert.equal(inExt.canForfeitRightToReply, false);

  const expired = evaluateWrittenVersionWindow('2026-08-01', '2026-10-24', false);
  assert.equal(expired.canForfeitRightToReply, true);
});

test('CPA s.38(7) hearing-date compression trigger on 6-month case with 30-day gap', () => {
  const pace = evaluateDisposalPace('2026-04-01', '2026-10-24', '2026-11-25', false);
  assert.equal(pace.exceededStatutoryTarget, true);
  assert.equal(pace.shouldCompressDate, true);
});

test('FR-13.2 Lawyer Audit catches silent adjournment and missed 45-day forfeiture', () => {
  const res = auditLawyerUpdate({
    lawyerReportedStatus: 'Judge was busy, date got extended to next month',
    orderSheetText: 'Complainant seeks time to file rejoinder. Adjourned at request of complainant.',
    writtenVersionForfeitable: true
  });
  assert.equal(res.discrepancyDetected, true);
  assert.ok(res.flags.includes('SILENT_ADJOURNMENT_BY_OWN_LAWYER'));
  assert.ok(res.flags.includes('MISSED_45_DAY_WRITTEN_VERSION_FORFEITURE_MOVE'));
});

test('Tactic matcher selects OP-evidence closure, date-compression, and advance-copy tactics for founder mid-case scenario', () => {
  const matched = matchApplicableTactics(
    {
      stage: 'op-evidence',
      serviceDate: '2026-04-01',
      evaluationDate: '2026-10-24',
      nextHearingDate: '2026-11-24',
      writtenVersionFiled: true,
      complainantEvidenceFiled: true,
      opEvidenceFiled: false,
      opponentAdjournments: 2
    },
    tactics
  );
  const ids = matched.map(t => t.id);
  assert.ok(ids.includes('tactic-hearing-date-compression'));
  assert.ok(ids.includes('tactic-advance-copy-preempt-adjournment'));
  assert.ok(ids.includes('tactic-close-op-evidence-on-default'));
});
