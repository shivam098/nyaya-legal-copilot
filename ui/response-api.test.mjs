import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { ADVICE_MAX_TOKENS, buildAnalysisSystemPrompt } from '../src/engine/response-guidance.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya-response-api-test-'));
const scenarios = JSON.parse(fs.readFileSync(path.join(root, 'evals', 'response-cases.json'), 'utf8'));
const requests = [];
let reply = { content: 'Synthetic complete answer.', reason: 'stop' };
let child;
let baseUrl;
const provider = http.createServer(async (req, res) => {
  let text = '';
  for await (const chunk of req) text += chunk;
  const body = JSON.parse(text);
  requests.push(body);
  if (body.stream) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(`data: ${JSON.stringify({
      choices: [{ delta: { content: reply.content }, finish_reason: reply.reason }]
    })}\n\ndata: [DONE]\n\n`);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{ message: { content: reply.content }, finish_reason: reply.reason }]
    }));
  }
});

before(async () => {
  provider.listen(0, '127.0.0.1');
  await once(provider, 'listening');
  child = spawn(process.execPath, [path.join(root, 'ui', 'server.mjs')], {
    cwd: root,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      NYAYA_DATA_DIR: dataDir,
      LLM_PROVIDER: 'openai',
      LLM_BASE_URL: `http://127.0.0.1:${provider.address().port}/chat/completions`,
      OPENAI_API_KEY: 'synthetic-test-only'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let diagnostics = '';
  child.stderr.on('data', chunk => { diagnostics += chunk; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Test server startup timed out: ${diagnostics}`)), 15000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Test server exited (${code}): ${diagnostics}`));
    });
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/running at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        baseUrl = match[1];
        clearTimeout(timer);
        resolve();
      }
    });
  });
});

after(async () => {
  if (child && child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
  if (provider.listening) await new Promise(resolve => provider.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function analyze(endpoint, body) {
  const response = await fetch(`${baseUrl}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'test-model', images: [], ...body })
  });
  assert.equal(response.status, 200);
  if (endpoint === 'analyze') return { result: await response.json(), events: [] };
  const events = (await response.text()).split('\n\n')
    .filter(part => part.startsWith('data:'))
    .map(part => JSON.parse(part.slice(5)));
  return { result: events.find(event => event.type === 'complete'), events };
}

for (const endpoint of ['analyze', 'analyze-stream']) {
  test(`${endpoint}: all clarity scenarios reach the provider and retain the response/session contract`, async () => {
    for (const scenario of scenarios) {
      const userId = `synthetic-${endpoint}-${scenario.id}`;
      let sessionId = null;
      if (scenario.isFollowUpTurn) {
        const prior = await analyze(endpoint, { ...scenario, userId, rawInput: scenario.priorInput });
        sessionId = prior.result.session.id;
      }
      const { result, events } = await analyze(endpoint, { ...scenario, userId, sessionId });
      assert.ok(result, `${scenario.id}: no result; ${JSON.stringify(events)}`);
      const sent = requests.at(-1);
      assert.equal(sent.messages[0].content, buildAnalysisSystemPrompt(scenario), scenario.id);
      assert.ok(sent.messages[1].content.includes(scenario.rawInput), scenario.id);
      assert.equal(sent.max_tokens, ADVICE_MAX_TOKENS);
      assert.equal(result.adviceMarkdown, reply.content);
      assert.deepEqual(result.engineResult.responseCompletion, { incomplete: false, reason: 'stop' });
      assert.equal(result.session.door, scenario.door);
      assert.equal(result.session.mode, scenario.mode);
      assert.equal(result.session.turns.length, scenario.isFollowUpTurn ? 2 : 1);
      assert.equal(result.session.turns.at(-1).assistantMarkdown, result.adviceMarkdown);
      assert.ok(Array.isArray(result.sessions));
      assert.ok(result.billingEntry);
      assert.ok(result.billingTotals);
      if (endpoint === 'analyze-stream') assert.ok(events.some(event => event.type === 'delta'));
    }
  });

  test(`${endpoint}: incomplete responses retain warnings through persistence and bypass the cache`, async () => {
    reply = { content: '### An unfinished draft', reason: 'length' };
    try {
      const body = {
        userId: `synthetic-truncation-${endpoint}`,
        mode: 'company-advisor',
        door: 'company',
        rawInput: `A unique synthetic truncation request for ${endpoint}.`
      };
      const beforeCount = requests.length;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { result } = await analyze(endpoint, body);
        assert.ok(result.engineResult.responseCompletion.incomplete);
        assert.match(result.adviceMarkdown, /^> \*\*Incomplete answer/);
        const response = await fetch(`${baseUrl}/api/sessions/${result.session.id}`, {
          headers: { 'x-nyaya-user-id': body.userId }
        });
        const saved = (await response.json()).session.turns.at(-1);
        assert.equal(saved.assistantMarkdown, result.adviceMarkdown);
        assert.deepEqual(saved.engineResult.responseCompletion, result.engineResult.responseCompletion);
      }
      assert.equal(requests.length - beforeCount, 2);
    } finally {
      reply = { content: 'Synthetic complete answer.', reason: 'stop' };
    }
  });
}

test('a truncated extracted digest is not treated as a verified record or saved session', async () => {
  reply = { content: 'Partial document summary', reason: 'length' };
  try {
    const userId = 'synthetic-incomplete-digest';
    const { result, events } = await analyze('analyze-stream', {
      userId,
      mode: 'midcase-battle-card',
      door: 'midcase',
      rawInput: 'Summarize this synthetic order image.',
      images: [{ name: 'synthetic-order.png', dataUrl: 'data:image/png;base64,c3ludGhldGlj' }]
    });
    assert.equal(result, undefined);
    assert.match(events.find(event => event.type === 'error').error, /summary was cut short/);
    const response = await fetch(`${baseUrl}/api/sessions`, { headers: { 'x-nyaya-user-id': userId } });
    assert.deepEqual((await response.json()).sessions, []);
  } finally {
    reply = { content: 'Synthetic complete answer.', reason: 'stop' };
  }
});

test('browser copy explains next steps and keeps technical diagnostics collapsed', async () => {
  const html = await (await fetch(baseUrl)).text();
  assert.match(html, /Help me choose how to set up my business/);
  assert.match(html, /Ask about anything unclear, or tell us what changed/);
  assert.match(html, /expanded: s\.expanded/);
  assert.doesNotMatch(html, /Fact-Check: PASSED|Fact Audit: PASSED|auto-named & saved in SQLite/);
  assert.match(html, /responseCompletion\?\.incomplete/);
  assert.match(html, /if \(!receivedComplete\)/);
  assert.match(html, /Choose model for deeper review/);
  assert.match(html, /claude-opus-5\.5/);
  assert.match(html, /gemini-4-argon/);
  assert.match(html, /id="hamburger-menu"/);
  assert.match(html, /How Nyaya works & Demos/);
  assert.match(html, /DOOR_DEMO_CATALOG/);
});
