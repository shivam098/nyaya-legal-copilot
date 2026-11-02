/**
 * Local Multilingual Audio & Voice-Note Transcriber (English, Hindi & Hinglish)
 * Uses a persistent faster-whisper `large-v3-turbo` (int8) worker process and automatically
 * provides a Roman-script (Hinglish) transliteration alongside any Devanagari Hindi transcript.
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { romanizeVoiceText } from '../../ui/voice-romanization.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');
const workerScriptPath = path.join(__dirname, 'whisper-worker.py');

const require = createRequire(import.meta.url);
let sanscriptInstance = null;
try {
  sanscriptInstance = require(path.join(rootDir, 'node_modules/@indic-transliteration/sanscript/sanscript.js'));
} catch {
  sanscriptInstance = null;
}

export const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.m4a', '.ogg', '.opus', '.webm', '.aac', '.flac', '.mp4', '.mpeg', '.mpga'
]);

export function isSupportedAudioFile(fileName = '') {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

let workerProc = null;
let workerRl = null;
const pendingRequests = new Map();

function ensureWhisperWorker() {
  if (workerProc && workerProc.exitCode === null && !workerProc.killed) {
    return workerProc;
  }

  workerProc = spawn('python', ['-u', workerScriptPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      NYAYA_WHISPER_MODEL: process.env.NYAYA_WHISPER_MODEL || 'large-v3-turbo'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  workerProc.unref();

  workerRl = readline.createInterface({
    input: workerProc.stdout,
    crlfDelay: Infinity
  });

  workerRl.on('line', (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const pending = pendingRequests.get(msg.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRequests.delete(msg.id);
    if (msg.ok) {
      pending.resolve(msg);
    } else {
      pending.reject(new Error(msg.error || 'Audio transcription failed'));
    }
  });

  workerProc.on('exit', () => {
    for (const [, pending] of pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Whisper worker exited unexpectedly'));
    }
    pendingRequests.clear();
    workerProc = null;
  });

  return workerProc;
}

export function maybeRomanizeDevanagari(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return { rawText: '', romanText: '', hasDevanagari: false };
  const hasDevanagari = /[\u0900-\u097F]/.test(raw);
  if (!hasDevanagari || !sanscriptInstance) {
    return { rawText: raw, romanText: raw, hasDevanagari: false };
  }
  try {
    const roman = romanizeVoiceText(raw, sanscriptInstance);
    return { rawText: raw, romanText: roman || raw, hasDevanagari: true };
  } catch {
    return { rawText: raw, romanText: raw, hasDevanagari: true };
  }
}

/**
 * Transcribes an audio Buffer (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.opus`, `.webm`, `.aac`, `.flac`)
 * using local faster-whisper `large-v3-turbo` (or synthetic mock in fast unit tests).
 */
export async function transcribeAudioBuffer(buffer, fileName = 'voice-recording.wav', { language = null, timeoutMs = 120000 } = {}) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty audio recording');
  }

  // Fast synthetic test path when running inside mocked test suite
  if (process.env.OPENAI_API_KEY === 'synthetic-test-only' && process.env.NYAYA_TEST_REAL_WHISPER !== '1') {
    const mockRaw = buffer.toString('utf8').includes('HINDI_TEST')
      ? 'मुझे दुकानदार ने रिफंड नहीं दिया'
      : 'Synthetic transcribed voice recording from audio file.';
    const { rawText, romanText, hasDevanagari } = maybeRomanizeDevanagari(mockRaw);
    const formattedContent = hasDevanagari
      ? `[Voice Recording Transcript — Roman / Hinglish]:\n${romanText}\n\n[Original Hindi Script]:\n${rawText}`
      : `[Voice Recording Transcript]:\n${rawText}`;
    return {
      ok: true,
      model: 'large-v3-turbo',
      detectedLanguage: hasDevanagari ? 'hi' : 'en',
      durationSec: 4.2,
      latencyMs: 12,
      rawText,
      romanText,
      formattedContent
    };
  }

  const ext = path.extname(fileName || '').toLowerCase() || '.wav';
  const tempFile = path.join(os.tmpdir(), `nyaya-audio-${crypto.randomUUID()}${ext}`);
  fs.writeFileSync(tempFile, buffer);

  const reqId = crypto.randomUUID();
  try {
    const proc = ensureWhisperWorker();
    const res = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(reqId);
        reject(new Error('Audio transcription timed out'));
      }, timeoutMs);
      pendingRequests.set(reqId, { resolve, reject, timer });
      proc.stdin.write(JSON.stringify({ id: reqId, audioPath: tempFile, language }) + '\n');
    });

    const { rawText, romanText, hasDevanagari } = maybeRomanizeDevanagari(res.text || '');
    const headerMeta = `(Language: ${res.detectedLanguage || 'auto'}, Duration: ${res.durationSec || 0}s, Model: Whisper ${res.model || 'large-v3-turbo'})`;
    const formattedContent = hasDevanagari && romanText !== rawText
      ? `[Voice Recording Transcript — Roman / Hinglish ${headerMeta}]:\n${romanText}\n\n[Original Script]:\n${rawText}`
      : `[Voice Recording Transcript ${headerMeta}]:\n${rawText || '(No speech detected in recording)'}`;

    return {
      ok: true,
      model: res.model || 'large-v3-turbo',
      detectedLanguage: res.detectedLanguage || 'en',
      durationSec: res.durationSec || 0,
      latencyMs: res.latencyMs || 0,
      rawText,
      romanText,
      formattedContent
    };
  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // ignore
    }
  }
}
