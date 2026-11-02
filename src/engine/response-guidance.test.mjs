import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVICE_MAX_TOKENS,
  CONTEXT_FIRST_GUIDANCE,
  buildAnalysisSystemPrompt,
  buildDigestSystemPrompt
} from './response-guidance.mjs';

const modes = ['company-advisor', 'messy-dump-intake', 'midcase-battle-card'];

test('every analysis mode and follow-up receives the same context-first safeguards', () => {
  for (const mode of [...modes, undefined]) {
    for (const isFollowUpTurn of [false, true]) {
      const prompt = buildAnalysisSystemPrompt({ mode, isFollowUpTurn });
      assert.ok(prompt.includes(CONTEXT_FIRST_GUIDANCE));
      assert.match(prompt, /ordinary language/);
      assert.match(prompt, /what is unknown/);
      assert.match(prompt, /at first use/);
      assert.match(prompt, /immediate actions/);
      assert.match(prompt, /Never compute statutory dates/);
      assert.match(prompt, /Adding "verify this" after an unsupported number or rule does not make it safe/);
      assert.match(prompt, /150-250 words/);
      assert.match(prompt, /Do not invent citations/);
      assert.match(prompt, /statutory target from an enforceable deadline/);
      assert.match(prompt, /Hindi\/Hinglish in Roman letters/);
      assert.ok(prompt.includes(isFollowUpTurn ? 'THIS IS A FOLLOW-UP' : 'THIS IS AN INITIAL ANALYSIS'));
    }
  }
});

test('company guidance makes entity choices conditional and removes canned form/fee demands', () => {
  const prompt = buildAnalysisSystemPrompt({ mode: 'company-advisor' });
  assert.match(prompt, /sole proprietorship/);
  assert.match(prompt, /one-person company/);
  assert.match(prompt, /partner requirement/);
  assert.match(prompt, /Do not assume outside investors/);
  assert.match(prompt, /recognition and tax benefits are different/i);
  assert.match(prompt, /Do not quote remembered OPC mandatory-conversion/);
  assert.match(prompt, /preserve any stated deadline/);
  assert.doesNotMatch(prompt, /Decisive Recommendation|SPICe\+|100\/day|4-year vesting/);
});

test('hearing plan preserves structured sections and document hierarchy without certifying missing orders', () => {
  const prompt = buildAnalysisSystemPrompt({ mode: 'midcase-battle-card' });
  for (let section = 1; section <= 5; section++) assert.ok(prompt.includes(`### ${section}.`));
  assert.match(prompt, /DATED COURT ORDERS AND FILED RECORD TAKE PRIORITY/);
  assert.match(prompt, /no orders.*user's account/);
  assert.match(prompt, /headings describe the intended artifacts, NOT a certification/);
});

test('follow-ups retain drafts and depth without forcing the initial template', () => {
  for (const mode of modes) {
    const prompt = buildAnalysisSystemPrompt({ mode, isFollowUpTurn: true });
    assert.match(prompt, /Do not force the full mode sections onto a simple clarification/);
    assert.match(prompt, /draft, checklist, or deeper analysis/);
    assert.match(prompt, /necessary detail/);
  }
  assert.ok(ADVICE_MAX_TOKENS > 1500);
});

test('intake and extraction distinguish allegations from proof and use relevant forums', () => {
  const intake = buildAnalysisSystemPrompt({ mode: 'messy-dump-intake' });
  assert.match(intake, /no-refund label.*does not establish a complete defence/);
  assert.match(intake, /Never suggest filing a Right to Information \(RTI\) request against a private company/);
  assert.match(intake, /LOWEST-HEADACHE PRACTICAL STEP FIRST/);
  assert.match(intake, /National Consumer Helpline \(NCH/);
  assert.match(intake, /RBI Integrated Ombudsman/);
  assert.match(intake, /Insurance Ombudsman/);
  const digest = buildDigestSystemPrompt();
  assert.match(digest, /Extract facts, not advice/);
  assert.match(digest, /not an authoritative|not independent legal verification/);
  assert.match(digest, /exact dates, amounts, quotations, source filenames and exhibit identifiers/);
});
