import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const moduleUrl = new URL('./copilot-llm.mjs', import.meta.url).href;

function callWith(env) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya-copilot-account-'));
  const script = `
    globalThis.fetch = async () => { throw new Error('NETWORK_CALLED'); };
    const { callCopilotModel } = await import(${JSON.stringify(moduleUrl)});
    try {
      await callCopilotModel({ model: 'claude-sonnet-4.6', systemPrompt: 's', userPrompt: 'account test ' + Date.now() });
      console.log('RESULT:ok');
    } catch (err) { console.log('RESULT:' + err.message); }
  `;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    env: { ...process.env, GH_TOKEN: '', GITHUB_TOKEN: '', GH_HOST: '', LLM_PROVIDER: 'copilot-local', NYAYA_DATA_DIR: dataDir, ...env },
    encoding: 'utf8'
  });
  fs.rmSync(dataDir, { recursive: true, force: true });
  return (run.stdout.match(/RESULT:(.*)/) || [])[1] || run.stderr;
}

test('model calls refuse a repository-only account and never fall back to the active gh login', () => {
  assert.match(callWith({ NYAYA_COPILOT_GH_USER: '' }), /Copilot account not set/);
  assert.match(callWith({ NYAYA_COPILOT_GH_USER: 'shivam098' }), /not allowed to run model calls/);
  assert.match(callWith({ NYAYA_COPILOT_GH_USER: 'SHIVAM098' }), /not allowed to run model calls/);
});
