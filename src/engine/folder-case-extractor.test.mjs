import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferCaseStateFromFolder,
  retrieveRelevantFolderChunks,
  classifyTurnIntent,
  verifyDraftAgainstRecord,
  rankCaseImagesByPriority
} from './folder-case-extractor.mjs';

test('inferCaseStateFromFolder detects OP1 ex-parte, OP2 WV, Complainant Evidence closed, and 03-11-2026 hearing', () => {
  const sampleCorpus = `
    ORDER-SHEETS/2026-04-23 - Order Sheet - OP1 placed EX-PARTE.pdf
    Notice to OP.No.1 was served on 14.03.2026. Hence, OP.No.1 is placed exparte.
    ORDER-SHEETS/2026-07-06 - Order Sheet - OP2 files vakalath and WV.pdf
    ORDER-SHEETS/2026-08-05 - Order Sheet - Rejoinder, evidence, Ex.P.1-P.12, evidence closed.pdf
    ORDER-SHEETS/2026-09-08 - Order Sheet - Extra set filed, OP2 evidence finally 08-10-2026.png
    ORDER-SHEETS/2026-10-08 - Order Sheet - OP2 prays time to lead evidence, call on 03-11-2026.pdf
  `;

  const { inferredCaseState, inferredReasons } = inferCaseStateFromFolder({
    fileNames: [],
    combinedText: sampleCorpus,
    currentCaseState: { writtenVersionFiled: false, complainantEvidenceFiled: false }
  });

  assert.equal(inferredCaseState.writtenVersionFiled, true);
  assert.equal(inferredCaseState.complainantEvidenceFiled, true);
  assert.equal(inferredCaseState.stage, 'op-evidence');
  assert.equal(inferredCaseState.serviceDate, '2026-03-14');
  assert.equal(inferredCaseState.nextHearingDate, '2026-11-03');
  assert.equal(inferredCaseState.opEvidenceAdjournmentsGranted, 2);
  assert.ok(inferredCaseState.multiOpSummary.includes('OP-1: Placed EX-PARTE'));
  assert.ok(inferredReasons.length >= 4);
});

test('retrieveRelevantFolderChunks surfaces OP2 Written Version and C-13 Memo even when placed past char 100,000', () => {
  const filler = '=== FILE: filler-doc.md ===\n' + 'General background text. '.repeat(2500);
  const wvFile = '=== FILE: source-documents/OP2-WRITTEN-VERSION-verbatim.md ===\nParagraph 12: Mahindra claims pure principal-to-principal privity defense with Anant Cars.';
  const c13File = '=== FILE: filings/MEMO-MARKING-C13-draft.md ===\nAnnexure C-13 is the Amazon Pay receipt for Rs. 7,710 dated 13.01.2026 requesting marking as Ex.P.13.';

  const hugeCorpus = [filler, filler, wvFile, c13File].join('\n\n');

  const wvQuery = retrieveRelevantFolderChunks(hugeCorpus, 'What did OP-2 claim in their Written Version about privity?', 12000);
  assert.ok(wvQuery.selectedText.includes('principal-to-principal privity defense'));
  assert.equal(wvQuery.matchedSources[0].source, 'source-documents/OP2-WRITTEN-VERSION-verbatim.md');

  const c13Query = retrieveRelevantFolderChunks(hugeCorpus, 'How do we get Annexure C-13 for Rs 7710 marked as Ex.P.13?', 12000);
  assert.ok(c13Query.selectedText.includes('Amazon Pay receipt for Rs. 7,710'));
  assert.equal(c13Query.matchedSources[0].source, 'filings/MEMO-MARKING-C13-draft.md');
});

test('classifyTurnIntent separates simple factual lookups from deep courtroom strategy', () => {
  const simple = classifyTurnIntent('When was notice served on OP-1?', true);
  assert.equal(simple.intent, 'factual-lookup');
  assert.equal(simple.recommendedTier, 'fast-or-balanced');

  const deep = classifyTurnIntent('Draft a memo opposing OP-2 adjournment and asking to close evidence.', true);
  assert.equal(deep.intent, 'deep-strategy-or-drafting');
  assert.equal(deep.recommendedTier, 'senior-counsel');
});

test('verifyDraftAgainstRecord catches hallucinated "Complainant evidence not filed" claim', () => {
  const state = { complainantEvidenceFiled: true, writtenVersionFiled: true, nextHearingDate: '2026-11-03' };

  const badDraft = 'Key Risk: Your own evidence is not filed. Please file your affidavit first.';
  const resBad = verifyDraftAgainstRecord(badDraft, state);
  assert.equal(resBad.verified, false);

  const goodDraft = 'Complainant evidence was filed and closed on 05.08.2026 (Ex.P.1 to Ex.P.12 marked).';
  const resGood = verifyDraftAgainstRecord(goodDraft, state);
  assert.equal(resGood.verified, true);
});

test('rankCaseImagesByPriority ranks Order Sheets and Annexure C-13 above generic WhatsApp images', () => {
  const imgs = [
    { name: 'WhatsApp Image 2026-08-02 at 1.34.41 AM (1).jpeg' },
    { name: 'ORDER-SHEETS/2026-09-08 - Order Sheet.png' },
    { name: 'Annexure C-13 - Loan Stamp-Documentation Charges Rs 7710.jpeg' }
  ];
  const ranked = rankCaseImagesByPriority(imgs);
  assert.equal(ranked[0].name, 'ORDER-SHEETS/2026-09-08 - Order Sheet.png');
  assert.equal(ranked[1].name, 'Annexure C-13 - Loan Stamp-Documentation Charges Rs 7710.jpeg');
});
