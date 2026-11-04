import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLegalScope, buildOutOfScopeReply } from './scope-guard.mjs';
import { detectLegalDomain } from './civil-criminal-rules.mjs';
import { buildAnalysisSystemPrompt, LEGAL_SCOPE_RULE, LEGAL_SCOPE_OVERRIDE_RULE } from './response-guidance.mjs';

const classify = text => classifyLegalScope({ text, domain: detectLegalDomain({ rawInput: text }).domain });

test('clearly non-legal questions are declined', () => {
  for (const [text, category] of [
    ['Mujhe ek ladki se prem ho gaya hai wo pahle interest dikhati thi ab nahi dikhati kya karu', 'relationship'],
    ['How to impress my crush?', 'relationship'],
    ['Give me a recipe for paneer butter masala', 'lifestyle'],
    ['Explain photosynthesis for my homework', 'studies'],
    ['Best diet plan to lose weight', 'health'],
    ['Write a python code for sorting', 'tech']
  ]) {
    const r = classify(text);
    assert.equal(r.outOfScope, true, text);
    assert.equal(r.category, category, text);
  }
});

test('anything with a legal angle is answered, even inside a personal topic', () => {
  for (const text of [
    'Meri girlfriend mujhe blackmail kar rahi hai photos viral karne ki dhamki de rahi hai',
    'Love marriage karna hai par ghar wale nahi maan rahe, kya hum court marriage kar sakte hain?',
    'My boyfriend is threatening to leak my photos',
    'What is mens rea?',
    'I will be late for the hearing, what happens?',
    'In case my employer does not pay salary what can I do',
    'How do I legally change my name in India?',
    'What is the punishment for drunk driving?',
    'Hi'
  ]) {
    assert.equal(classify(text).outOfScope, false, text);
  }
});

test('an ongoing legal conversation or attached documents are never declined', () => {
  assert.equal(classifyLegalScope({ text: 'Mujhe usse pyar tha', priorText: 'My husband filed for divorce', domain: 'general' }).outOfScope, false);
  assert.equal(classifyLegalScope({ text: 'How to impress my crush?', hasAttachments: true }).outOfScope, false);
});

test('the decline is polite, in the person\'s language, and points to a general assistant', () => {
  const hinglish = buildOutOfScopeReply({ text: 'Mujhe ek ladki se prem ho gaya hai wo ab interest nahi dikhati kya karu', category: 'relationship' });
  assert.match(hinglish, /Nyaya/);
  assert.match(hinglish, /ChatGPT/);
  assert.match(hinglish, /legal angle/);
  assert.match(buildOutOfScopeReply({ text: 'How to impress my crush?', category: 'relationship' }), /legal side/);
  assert.match(buildOutOfScopeReply({ text: 'मुझे प्यार हो गया है', category: 'relationship' }), /कानूनी/);
});

test('the system prompt carries the scope rule, switched when the person says it is legal', () => {
  assert.ok(buildAnalysisSystemPrompt({ mode: 'messy-dump-intake' }).includes(LEGAL_SCOPE_RULE));
  const overridden = buildAnalysisSystemPrompt({ mode: 'messy-dump-intake', scopeOverride: true });
  assert.ok(overridden.includes(LEGAL_SCOPE_OVERRIDE_RULE));
  assert.ok(!overridden.includes(LEGAL_SCOPE_RULE));
});
