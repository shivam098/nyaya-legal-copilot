import test from 'node:test';
import assert from 'node:assert/strict';
import Sanscript from '@indic-transliteration/sanscript';
import { romanizeVoiceText } from './voice-romanization.mjs';

test('Hindi is transliterated to readable English letters, not translated', () => {
  const examples = [
    ['मेरा नाम शिवम है।', 'meraa naam shivam hai.'],
    ['नमस्ते दुनिया', 'namaste duniyaa'],
    ['मैं हूँ', 'main hoon'],
    ['मुझे कंपनी से पैसे चाहिए।', 'mujhe kampanee se paise chaahie.'],
    ['कृपया न्याय दिलाएं।', 'kripayaa nyaay dilaaen.'],
    ['काव्य की कुछ विशेषताएं', 'kaavya kee kuchh visheshataaen'],
    ['डॉक्टर ने कॉपी दी।', 'doktar ne kopee dee.']
  ];
  for (const [source, expected] of examples) {
    assert.equal(romanizeVoiceText(source, Sanscript), expected, source);
  }
});

test('Hinglish keeps English words, capitalization, identifiers and punctuation intact', () => {
  assert.equal(
    romanizeVoiceText('मैंने payment किया लेकिन refund नहीं मिला। Invoice #A-42, UPI 12345.', Sanscript),
    'mainne payment kiyaa lekin refund naheen milaa. Invoice #A-42, UPI 12345.'
  );
  assert.equal(romanizeVoiceText('  English only.\n₹500 on 12/08/2026; ID #A-42.  ', Sanscript), '  English only.\n₹500 on 12/08/2026; ID #A-42.  ');
  assert.equal(romanizeVoiceText('##हिन्दी##', Sanscript), '##hindee##');
});

test('Hindi digits become the same numerals without calculating or reformatting dates and amounts', () => {
  assert.equal(romanizeVoiceText('फ़ीस ₹५००, तारीख १२/०८/२०२६', Sanscript), 'fees ₹500, taareekh 12/08/2026');
});

test('composed and decomposed nukta letters, conjuncts and nasal sounds are supported', () => {
  assert.equal(romanizeVoiceText('क़ानून, ज़मीन, पढ़ाई, लड़ाई', Sanscript), 'qaanoon, zameen, parhaaee, laraaee');
  assert.equal(romanizeVoiceText('फ़ीस', Sanscript), romanizeVoiceText('फ़ीस', Sanscript));
  assert.equal(romanizeVoiceText('कंपनी', Sanscript), 'kampanee');
  assert.equal(romanizeVoiceText('न्\u200dयाय', Sanscript), 'nyaay');
});

test('line breaks and whitespace do not change transliteration or remove existing English text', () => {
  assert.equal(romanizeVoiceText('नाम\nनाम\tनाम  Case details', Sanscript), 'naam\nnaam\tnaam  Case details');
  assert.equal(romanizeVoiceText('', Sanscript), '');
});

test('transliteration failure is explicit rather than pretending untranslated text is Roman script', () => {
  assert.throws(() => romanizeVoiceText('मेरा', null), /could not load/);
  assert.equal(romanizeVoiceText('Typed English', null), 'Typed English');
  assert.throws(() => romanizeVoiceText('\u097b', Sanscript), /could not be transliterated/);
});
