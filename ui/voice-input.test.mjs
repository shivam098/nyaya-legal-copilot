import test from 'node:test';
import assert from 'node:assert/strict';
import Sanscript from '@indic-transliteration/sanscript';
import {
  appendTranscript,
  createVoiceInput,
  voiceAvailability,
  VOICE_LANGUAGES
} from './voice-input.mjs';

function harness({ prefixed = false, supported = true, secure = true, startError, stopError, abortError } = {}) {
  const instances = [];
  const timers = new Map();
  const states = [];
  let text = 'Existing typed story.';
  let timerId = 0;
  class Recognition {
    constructor() {
      instances.push(this);
      this.starts = 0;
      this.stops = 0;
      this.aborts = 0;
    }
    start() {
      this.starts += 1;
      if (startError) throw Object.assign(new Error(), { name: startError });
    }
    stop() {
      this.stops += 1;
      if (stopError) throw Object.assign(new Error(), { name: stopError });
    }
    abort() {
      this.aborts += 1;
      if (abortError) throw Object.assign(new Error(), { name: abortError });
    }
  }
  const environment = {
    isSecureContext: secure,
    Sanscript,
    setTimeout(callback, delay) {
      timers.set(++timerId, { callback, delay });
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    }
  };
  if (supported) environment[prefixed ? 'webkitSpeechRecognition' : 'SpeechRecognition'] = Recognition;
  const controller = createVoiceInput({
    environment,
    onText: words => { text = appendTranscript(text, words); },
    onState: state => states.push(state)
  });
  return {
    controller, environment, instances, timers, states,
    get text() { return text; },
    set text(value) { text = value; },
    get state() { return states.at(-1); },
    get recognition() { return instances.at(-1); },
    start(language = 'en-IN') {
      assert.equal(controller.start({ language, consent: true }), true);
      return this.recognition;
    },
    expireTimer(delay) {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `Expected a ${delay}ms timer`);
      timers.delete(entry[0]);
      entry[1].callback();
    }
  };
}

function results(recognition, ...entries) {
  recognition.onresult({
    results: entries.map(([text, isFinal]) => Object.assign([{ transcript: text }], { isFinal }))
  });
}

test('appendTranscript preserves typed content, whitespace and Unicode without adding empty words', () => {
  assert.equal(appendTranscript('', ' hello '), 'hello');
  assert.equal(appendTranscript('typed', 'more'), 'typed more');
  assert.equal(appendTranscript('typed\n', 'more'), 'typed\nmore');
  assert.equal(appendTranscript('typed ', '  '), 'typed ');
  assert.equal(appendTranscript('', '\u092e\u0947\u0930\u093e \u0915\u0947\u0938'), '\u092e\u0947\u0930\u093e \u0915\u0947\u0938');
});

test('unsupported and insecure environments retain typing and never open a microphone', () => {
  for (const options of [{ supported: false }, { secure: false }]) {
    const h = harness(options);
    assert.ok(voiceAvailability(h.environment));
    assert.equal(h.controller.start({ consent: true }), false);
    assert.equal(h.instances.length, 0);
    assert.ok(h.state.error);
    assert.equal(h.text, 'Existing typed story.');
  }
});

test('explicit consent and a configured language are required', () => {
  const h = harness();
  assert.equal(h.controller.start(), false);
  assert.match(h.state.error, /Agree/);
  assert.equal(h.controller.start({ consent: true, language: 'invalid' }), false);
  assert.match(h.state.error, /language/);
  assert.equal(h.instances.length, 0);
});

test('standard and prefixed recognition configure supported language, continuous and interim results', () => {
  for (const prefixed of [true, false]) {
    for (const { code, recognitionLanguage } of VOICE_LANGUAGES) {
      const h = harness({ prefixed });
      const r = h.start(code);
      assert.equal(r.lang, recognitionLanguage);
      assert.equal(r.continuous, true);
      assert.equal(r.interimResults, true);
      assert.equal(r.maxAlternatives, 1);
      assert.equal(h.state.phase, 'starting');
      r.onstart();
      assert.equal(h.state.phase, 'listening');
      assert.equal(h.timers.size, 0);
      h.controller.dispose();
    }
  }
});

test('cumulative finals append exactly once, interim revisions do not enter text prematurely', () => {
  const h = harness();
  const r = h.start();
  r.onstart();
  results(r, ['I paid', false]);
  assert.equal(h.text, 'Existing typed story.');
  assert.equal(h.state.interim, 'I paid');
  results(r, ['I paid ten rupees.', true], ['On Monday', false]);
  assert.equal(h.text, 'Existing typed story. I paid ten rupees.');
  h.text += '\nTyped correction while speaking.';
  results(r, ['I paid ten rupees.', true], ['On Tuesday.', true]);
  results(r, ['I paid ten rupees.', true], ['On Tuesday.', true]);
  assert.equal(h.text, 'Existing typed story. I paid ten rupees.\nTyped correction while speaking. On Tuesday.');
  assert.equal(h.state.interim, '');
  r.onend();
  assert.equal(h.controller.active, false);
  assert.equal(h.recognition.starts, 1);
  assert.match(h.state.message, /edit/);
});

test('interim retractions replace the preview without appending stale hypotheses', () => {
  const h = harness();
  const r = h.start();
  results(r, ['wrong guess', false]);
  results(r);
  assert.equal(h.state.interim, '');
  r.onend();
  assert.equal(h.text, 'Existing typed story.');
  assert.match(h.state.message, /No words/);
});

test('stop waits for final transcription, blocks repeated starts and stops, then releases the session', () => {
  const h = harness();
  const r = h.start();
  r.onstart();
  results(r, ['unfinished', false]);
  h.controller.stop();
  h.controller.stop();
  assert.equal(h.state.phase, 'stopping');
  assert.equal(r.stops, 1);
  assert.equal(h.controller.start({ consent: true }), false);
  results(r, ['Completed sentence.', true]);
  r.onend();
  assert.equal(h.text, 'Existing typed story. Completed sentence.');
  assert.equal(h.state.phase, 'idle');
  assert.equal(h.timers.size, 0);
});

test('ending with interim words keeps them and explicitly asks for review', () => {
  const h = harness();
  const r = h.start();
  results(r, ['Confirmed.', true], ['uncertain amount', false]);
  r.onend();
  assert.equal(h.text, 'Existing typed story. Confirmed. uncertain amount');
  assert.match(h.state.message, /not confirmed/);
  assert.equal(h.state.interim, '');
});

test('stop during startup cannot be undone by a late start event', () => {
  const h = harness();
  const r = h.start();
  h.controller.stop();
  r.onstart();
  assert.equal(h.state.phase, 'stopping');
  r.onend();
  assert.equal(h.state.phase, 'idle');
  assert.equal(h.timers.size, 0);
});

test('permission, device, language, network, interruption and unknown errors are explicit and retryable', () => {
  for (const code of ['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'no-speech', 'language-not-supported', 'aborted', 'vendor-error']) {
    const h = harness();
    const r = h.start();
    results(r, ['kept words', false]);
    r.onerror({ error: code });
    assert.equal(h.controller.active, false);
    assert.equal(h.state.phase, 'idle');
    assert.ok(h.state.error, code);
    assert.equal(h.text, 'Existing typed story. kept words');
    assert.equal(r.aborts, 1);
    assert.equal(r.onresult, null);
    assert.equal(h.timers.size, 0);
    h.start();
    assert.equal(h.instances.length, 2);
    h.controller.dispose();
  }
});

test('synchronous start and stop failures do not leave the UI stuck', () => {
  const failedStart = harness({ startError: 'NotAllowedError' });
  assert.equal(failedStart.controller.start({ consent: true }), false);
  assert.match(failedStart.state.error, /denied/);
  assert.equal(failedStart.controller.active, false);
  assert.equal(failedStart.timers.size, 0);

  const failedStop = harness({ stopError: 'InvalidStateError' });
  failedStop.start();
  failedStop.controller.stop();
  assert.equal(failedStop.controller.active, false);
  assert.match(failedStop.state.error, /InvalidStateError/);
  assert.equal(failedStop.timers.size, 0);
});

test('constructor failures are surfaced without acquiring a session', () => {
  const h = harness();
  h.environment.SpeechRecognition = class {
    constructor() { throw Object.assign(new Error(), { name: 'SecurityError' }); }
  };
  assert.equal(h.controller.start({ consent: true }), false);
  assert.match(h.state.error, /security settings/);
  assert.equal(h.controller.active, false);
});

test('startup and stop timeouts abort recognition and preserve available words', () => {
  const waiting = harness();
  waiting.start();
  waiting.expireTimer(20000);
  assert.equal(waiting.controller.active, false);
  assert.match(waiting.state.error, /did not start/);
  assert.equal(waiting.recognition.aborts, 1);

  const stopping = harness();
  const r = stopping.start();
  r.onstart();
  results(r, ['pending words', false]);
  stopping.controller.stop();
  stopping.expireTimer(8000);
  assert.equal(stopping.controller.active, false);
  assert.match(stopping.state.error, /did not finish/);
  assert.equal(stopping.text, 'Existing typed story. pending words');
  assert.equal(r.aborts, 1);
});

test('navigation and page hiding cancel, keep interim words and ignore stale callbacks after restart', () => {
  const h = harness();
  const old = h.start();
  results(old, ['old case words', false]);
  const lateResult = old.onresult;
  const lateEnd = old.onend;
  h.controller.cancel('Page hidden.');
  assert.equal(h.text, 'Existing typed story. old case words');
  assert.match(h.state.message, /Page hidden/);
  assert.equal(old.aborts, 1);
  h.text = 'Different case.';
  const next = h.start();
  next.onstart();
  lateResult({ results: [Object.assign([{ transcript: 'STALE' }], { isFinal: true })] });
  lateEnd();
  assert.equal(h.text, 'Different case.');
  assert.equal(h.state.phase, 'listening');
  results(next, ['new case words', true]);
  next.onend();
  assert.equal(h.text, 'Different case. new case words');
});

test('dispose releases resources, is idempotent and prevents new capture', () => {
  const h = harness();
  const r = h.start();
  results(r, ['kept on exit', false]);
  const lateResult = r.onresult;
  h.controller.dispose();
  const count = h.states.length;
  h.controller.dispose();
  assert.equal(h.controller.start({ consent: true }), false);
  lateResult({ results: [] });
  assert.equal(h.states.length, count);
  assert.equal(h.timers.size, 0);
  assert.equal(r.onresult, null);
  assert.equal(r.aborts, 1);
  assert.equal(h.text, 'Existing typed story. kept on exit');
});

test('failure to release the microphone is not hidden', () => {
  const h = harness({ abortError: 'InvalidStateError' });
  h.start();
  h.controller.cancel();
  assert.match(h.state.error, /Close this tab/);
});

test('unrecognized speech and silence do not silently succeed', () => {
  const h = harness();
  const r = h.start();
  r.onnomatch();
  assert.match(h.state.message, /unclear/);
  r.onend();
  assert.match(h.state.message, /No words/);
  assert.equal(h.text, 'Existing typed story.');
});

test('Hindi and Hinglish interim and final results use English letters immediately, without a server call', () => {
  for (const language of ['hi-IN', 'hinglish']) {
    const h = harness();
    const r = h.start(language);
    results(r, ['मेरा case', false]);
    assert.equal(h.state.interim, 'meraa case');
    assert.equal(h.text, 'Existing typed story.');
    results(r, ['मेरा case अभी चल रहा है।', true], ['अगली hearing', false]);
    assert.equal(h.text, 'Existing typed story. meraa case abhee chal rahaa hai.');
    assert.equal(h.state.interim, 'agalee hearing');
    r.onend();
    assert.equal(h.text, 'Existing typed story. meraa case abhee chal rahaa hai. agalee hearing');
    assert.match(h.state.message, /not confirmed/);
  }
});

test('transliteration asset failures block speech but leave typed content intact', () => {
  const h = harness();
  delete h.environment.Sanscript;
  assert.match(voiceAvailability(h.environment), /could not load/);
  assert.equal(h.controller.start({ consent: true }), false);
  assert.equal(h.text, 'Existing typed story.');
  assert.equal(h.instances.length, 0);
});

test('transliteration errors stop the microphone and retain the original words for correction', () => {
  const h = harness();
  const r = h.start('hinglish');
  results(r, ['Confirmed English.', true], ['\u097b', true], ['pending', false]);
  assert.equal(h.controller.active, false);
  assert.match(h.state.error, /Original words were kept/);
  assert.equal(h.text, 'Existing typed story. Confirmed English. \u097b pending');
  assert.equal(r.aborts, 1);
});
