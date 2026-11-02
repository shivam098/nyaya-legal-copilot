import { romanizeVoiceText } from './voice-romanization.mjs';

export const VOICE_LANGUAGES = [
  { code: 'en-IN', recognitionLanguage: 'en-IN', label: 'English' },
  { code: 'hi-IN', recognitionLanguage: 'hi-IN', label: 'Hindi (English letters)' },
  { code: 'hinglish', recognitionLanguage: 'hi-IN', label: 'Hinglish (Hindi + English)' }
];

export const INITIAL_VOICE_STATE = {
  phase: 'idle',
  interim: '',
  message: '',
  error: ''
};

export function voiceAvailability(environment = globalThis) {
  if (!environment.isSecureContext) {
    return 'Voice input needs HTTPS or localhost. Open the HTTPS link, or keep typing.';
  }
  if (!(environment.SpeechRecognition || environment.webkitSpeechRecognition)) {
    return 'Speech-to-text is not available in this browser. Try a supported Chrome or Safari browser, use your keyboard microphone, or keep typing.';
  }
  if (!environment.Sanscript?.t) {
    return 'English-letter transcription could not load. Reload the page, or keep typing.';
  }
  return '';
}

export function appendTranscript(current, transcript) {
  const words = transcript.trim();
  if (!words) return current;
  return current + (current && !/\s$/.test(current) ? ' ' : '') + words;
}

function speechError(code) {
  const messages = {
    'not-allowed': 'Microphone access was denied. Allow microphone access in browser and device settings, then try again.',
    'service-not-allowed': 'The browser speech service is unavailable or blocked. Try another supported browser or keyboard dictation.',
    'audio-capture': 'No usable microphone was found. Check your microphone connection and device permissions.',
    'network': 'The browser speech service could not connect. Check your internet connection and try again.',
    'no-speech': 'No speech was detected. Check your microphone and try speaking again.',
    'language-not-supported': 'The speech service does not support this language on your device. Choose another language or type instead.',
    'aborted': 'Voice input was interrupted. You can start again or keep typing.',
    'NotAllowedError': 'Microphone access was denied. Allow microphone access in browser and device settings, then try again.',
    'SecurityError': 'Browser security settings blocked speech input. Use HTTPS and check site permissions.',
    'NotFoundError': 'No usable microphone was found. Check your microphone connection and device permissions.'
  };
  return messages[code] || `Speech input failed (${code || 'unknown error'}). Try again or keep typing.`;
}

export function createVoiceInput({ onText, onState, environment = globalThis }) {
  let run = null;
  let disposed = false;
  let state = { ...INITIAL_VOICE_STATE };

  const publish = patch => {
    state = { ...state, ...patch };
    if (!disposed) onState({ ...state });
  };

  function detach(current) {
    environment.clearTimeout(current.timer);
    for (const event of ['onstart', 'onresult', 'onerror', 'onend', 'onnomatch']) {
      current.recognition[event] = null;
    }
  }

  function finish(current, { error = '', message = '', abort = false } = {}) {
    if (run !== current) return;
    const pending = state.interim.trim();
    run = null;
    detach(current);
    if (abort) {
      try {
        current.recognition.abort();
      } catch (err) {
        error = `${error ? `${error} ` : ''}The browser could not release speech input (${err.name || 'unknown error'}). Close this tab if its microphone indicator remains on.`;
      }
    }
    if (pending) onText(pending);
    const review = pending
      ? 'Last words were not confirmed by the speech service; they were kept in the text. Review and correct them before submitting.'
      : current.hasText
        ? 'Recognized text is ready to edit. Check names, dates and amounts before submitting.'
        : 'No words were captured. Try again, use keyboard dictation, or keep typing.';
    publish({ phase: 'idle', interim: '', error, message: `${message ? `${message} ` : ''}${review}` });
  }

  return {
    get active() {
      return run !== null;
    },

    start({ language = 'en-IN', consent = false } = {}) {
      if (disposed || run) return false;
      const unavailable = voiceAvailability(environment);
      const selectedLanguage = VOICE_LANGUAGES.find(item => item.code === language);
      if (unavailable || !consent || !selectedLanguage) {
        publish({
          ...INITIAL_VOICE_STATE,
          error: unavailable || (!consent ? 'Agree to browser speech processing before starting.' : 'Choose a supported speech language.')
        });
        return false;
      }

      let recognition;
      try {
        const Recognition = environment.SpeechRecognition || environment.webkitSpeechRecognition;
        recognition = new Recognition();
        recognition.lang = selectedLanguage.recognitionLanguage;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
      } catch (err) {
        publish({ ...INITIAL_VOICE_STATE, error: speechError(err.name) });
        return false;
      }

      const current = { recognition, delivered: new Set(), hasText: false, timer: null };
      run = current;
      publish({ ...INITIAL_VOICE_STATE, phase: 'starting', message: 'Waiting for microphone permission and the browser speech service...' });
      recognition.onstart = () => {
        if (run !== current || state.phase !== 'starting') return;
        environment.clearTimeout(current.timer);
        publish({ phase: 'listening', message: 'Listening. Speak your case, then select Stop voice input.' });
      };
      recognition.onresult = event => {
        if (run !== current) return;
        const pending = [];
        // Results are cumulative within one recognition run; final indices must be appended only once.
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (current.delivered.has(index)) continue;
          let words;
          try {
            words = romanizeVoiceText(result[0]?.transcript?.trim() || '', environment.Sanscript);
          } catch (err) {
            const remaining = Array.from(event.results).slice(index).map(item => item[0]?.transcript || '');
            publish({ interim: [...pending, ...remaining].join(' ') });
            finish(current, { error: `${err.message} Original words were kept; edit them into English letters before submitting.`, abort: true });
            return;
          }
          if (result.isFinal) {
            current.delivered.add(index);
            if (words) {
              current.hasText = true;
              onText(words);
            }
          } else if (words) {
            pending.push(words);
          }
        }
        publish({ interim: pending.join(' ') });
      };
      recognition.onerror = event => {
        finish(current, { error: speechError(event.error), abort: true });
      };
      recognition.onnomatch = () => {
        if (run === current) publish({ message: 'The speech was unclear. Speak again or stop and review the text.' });
      };
      recognition.onend = () => {
        finish(current, { message: 'Voice input ended. Select Start voice input to continue.' });
      };
      current.timer = environment.setTimeout(() => {
        finish(current, { error: 'The microphone or speech service did not start. Check site permissions and try again.', abort: true });
      }, 20000);
      try {
        recognition.start();
        return true;
      } catch (err) {
        finish(current, { error: speechError(err.name), abort: true });
        return false;
      }
    },

    stop() {
      if (!run || state.phase === 'stopping') return;
      const current = run;
      environment.clearTimeout(current.timer);
      publish({ phase: 'stopping', message: 'Stopping microphone and finishing transcription...' });
      current.timer = environment.setTimeout(() => {
        finish(current, { error: 'The speech service did not finish in time. Available text has been kept; some words may be missing.', abort: true });
      }, 8000);
      try {
        current.recognition.stop();
      } catch (err) {
        finish(current, { error: speechError(err.name), abort: true });
      }
    },

    cancel(message = 'Voice input stopped.') {
      if (run) finish(run, { message, abort: true });
    },

    dispose() {
      this.cancel();
      disposed = true;
    }
  };
}
