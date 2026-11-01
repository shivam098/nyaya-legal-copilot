/**
 * Deterministic Rule Engine for Consumer Protection Act, 2019 (India)
 * All date and deadline calculations run in pure code — never in an LLM.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysBetween(startIso, endIso) {
  const s = new Date(startIso + 'T00:00:00Z');
  const e = new Date(endIso + 'T00:00:00Z');
  return Math.round((e.getTime() - s.getTime()) / MS_PER_DAY);
}

export function addDays(startIso, days) {
  const d = new Date(startIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * CPA 2019 s.69 — 2-year (730-day) limitation period from cause of action.
 */
export function evaluateLimitation(causeOfActionDate, evaluationDate) {
  const elapsedDays = daysBetween(causeOfActionDate, evaluationDate);
  const deadlineDate = addDays(causeOfActionDate, 730);
  const withinLimitation = elapsedDays <= 730;
  return {
    withinLimitation,
    elapsedDays,
    deadlineDate,
    daysRemaining: 730 - elapsedDays,
    requiresCondonationUnderS69_2: !withinLimitation
  };
}

/**
 * CPA 2019 s.38(2)(a) + Hilli Multipurpose (2020) 5 SCC 757 —
 * 30 days base + 15 days max discretionary extension = 45-day hard cap from service of notice + complaint.
 */
export function evaluateWrittenVersionWindow(serviceDate, evaluationDate, writtenVersionFiled = false) {
  const daysSinceService = daysBetween(serviceDate, evaluationDate);
  const baseDeadline = addDays(serviceDate, 30);
  const hardCapDeadline = addDays(serviceDate, 45);
  const canForfeitRightToReply = !writtenVersionFiled && daysSinceService > 45;

  return {
    daysSinceService,
    baseDeadline,
    hardCapDeadline,
    writtenVersionFiled,
    inDiscretionaryExtensionWindow: !writtenVersionFiled && daysSinceService > 30 && daysSinceService <= 45,
    canForfeitRightToReply
  };
}

/**
 * CPA 2019 s.38(7) — Statutory disposal endeavour (90 days standard, 150 days if laboratory testing required).
 */
export function evaluateDisposalPace(serviceDate, evaluationDate, nextHearingDate, requiresLabTesting = false) {
  const targetDays = requiresLabTesting ? 150 : 90;
  const daysSinceNotice = daysBetween(serviceDate, evaluationDate);
  const gapDaysToNextHearing = nextHearingDate ? daysBetween(evaluationDate, nextHearingDate) : 0;
  const targetDisposalDate = addDays(serviceDate, targetDays);
  const exceededStatutoryTarget = daysSinceNotice >= targetDays;
  const shouldCompressDate = exceededStatutoryTarget && gapDaysToNextHearing >= 21;

  return {
    targetDays,
    targetDisposalDate,
    daysSinceNotice,
    gapDaysToNextHearing,
    exceededStatutoryTarget,
    shouldCompressDate
  };
}

/**
 * FR-13.2 Lawyer Audit Mode — compares what the lawyer told the client vs actual eCourts / e-Jagriti order sheet.
 */
export function auditLawyerUpdate({ lawyerReportedStatus, orderSheetText, writtenVersionForfeitable }) {
  const text = (orderSheetText || '').toLowerCase();
  const flags = [];

  if (
    text.includes('complainant absent') ||
    text.includes('none for complainant') ||
    text.includes('no representation for complainant')
  ) {
    flags.push('LAWYER_ABSENT_ON_CALL');
  }
  if (
    (text.includes('complainant seeks time') || text.includes('adjourned at request of complainant')) &&
    !lawyerReportedStatus.toLowerCase().includes('we sought time')
  ) {
    flags.push('SILENT_ADJOURNMENT_BY_OWN_LAWYER');
  }
  if (writtenVersionForfeitable && !text.includes('right to file written version') && !text.includes('ex-parte')) {
    flags.push('MISSED_45_DAY_WRITTEN_VERSION_FORFEITURE_MOVE');
  }

  return {
    discrepancyDetected: flags.length > 0,
    flags
  };
}

/**
 * Match applicable tactics from packs/consumer/tactics.json against deterministic case metrics.
 */
export function matchApplicableTactics(caseState, tactics) {
  const {
    stage,
    serviceDate,
    evaluationDate,
    nextHearingDate,
    writtenVersionFiled = false,
    opponentAdjournments = 0,
    postalRemark = null,
    finalOrderDate = null,
    orderComplied = false,
    complainantEvidenceFiled = false,
    opEvidenceFiled = false,
    hasDeficiencyOrDefectGround = true
  } = caseState;

  const daysSinceNotice = serviceDate ? daysBetween(serviceDate, evaluationDate) : 0;
  const gapDaysToNextHearing = nextHearingDate ? daysBetween(evaluationDate, nextHearingDate) : 0;
  const daysSinceFinalOrder = finalOrderDate ? daysBetween(finalOrderDate, evaluationDate) : 0;

  return tactics.filter(t => {
    if (!t.triggerStages.includes(stage)) return false;
    const c = t.triggerConditions || {};
    if (c.minDaysSinceNotice !== undefined && daysSinceNotice < c.minDaysSinceNotice) return false;
    if (c.minGapDaysToNextHearing !== undefined && gapDaysToNextHearing < c.minGapDaysToNextHearing) return false;
    if (c.minDaysSinceService !== undefined && daysSinceNotice < c.minDaysSinceService) return false;
    if (c.writtenVersionFiled !== undefined && writtenVersionFiled !== c.writtenVersionFiled) return false;
    if (c.minOpponentAdjournments !== undefined && opponentAdjournments < c.minOpponentAdjournments) return false;
    if (c.postalRemarkIn !== undefined && !c.postalRemarkIn.includes(postalRemark)) return false;
    if (c.daysSinceFinalOrder !== undefined && daysSinceFinalOrder < c.daysSinceFinalOrder) return false;
    if (c.orderComplied !== undefined && orderComplied !== c.orderComplied) return false;
    if (c.complainantEvidenceFiled !== undefined && complainantEvidenceFiled !== c.complainantEvidenceFiled) return false;
    if (c.opEvidenceFiled !== undefined && opEvidenceFiled !== c.opEvidenceFiled) return false;
    if (c.hasDeficiencyOrDefectGround !== undefined && hasDeficiencyOrDefectGround !== c.hasDeficiencyOrDefectGround) return false;
    return true;
  });
}
