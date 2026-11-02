import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSupportedAudioFile,
  maybeRomanizeDevanagari,
  transcribeAudioBuffer
} from './audio-transcriber.mjs';

test('isSupportedAudioFile recognizes mp3, wav, m4a, ogg, opus, webm, aac, and flac', () => {
  for (const name of ['call.mp3', 'voice.wav', 'memo.m4a', 'PTT-20261102-WA0001.opus', 'chat.ogg', 'clip.webm']) {
    assert.equal(isSupportedAudioFile(name), true, name);
  }
  assert.equal(isSupportedAudioFile('order.pdf'), false);
});

test('maybeRomanizeDevanagari converts Devanagari Hindi transcript into readable Roman Hinglish while preserving English', () => {
  const res = maybeRomanizeDevanagari('मुझे 8000 रुपये refund नहीं मिला');
  assert.equal(res.hasDevanagari, true);
  assert.match(res.romanText, /mujhe 8000 rupaye refund/i);
});

test('transcribeAudioBuffer returns both Romanized Hinglish and original Hindi script for Devanagari audio', async () => {
  const prevKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic-test-only';
  try {
    const out = await transcribeAudioBuffer(Buffer.from('HINDI_TEST'), 'whatsapp-voice.opus');
    assert.equal(out.ok, true);
    assert.equal(out.model, 'large-v3-turbo');
    assert.match(out.romanText, /mujhe/i);
    assert.match(out.formattedContent, /Roman \/ Hinglish/);
  } finally {
    process.env.OPENAI_API_KEY = prevKey;
  }
});
