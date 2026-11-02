import test, { after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya-gateway-test-'));
process.env.NYAYA_DATA_DIR = dataDir;
process.env.LLM_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'synthetic-test-only';
const { callCopilotModel } = await import('./copilot-llm.mjs');
afterEach(() => mock.restoreAll());
after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

function request(userPrompt, extra = {}) {
  return {
    userId: 'synthetic-gateway-test',
    model: 'test-model',
    systemPrompt: 'Use plain language.',
    userPrompt,
    ...extra
  };
}

function jsonResponse(content, finishReason = 'stop') {
  return Response.json({
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage: { prompt_tokens: 10, completion_tokens: 10 }
  });
}

function streamResponse(text) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    }
  }));
}

test('complete answers preserve content and completion metadata on cache hits', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => jsonResponse('A complete answer.'));
  const first = await callCopilotModel(request('cache-complete'));
  const chunks = [];
  const second = await callCopilotModel(request('cache-complete', { onChunk: text => chunks.push(text) }));
  assert.equal(first.content, 'A complete answer.');
  assert.deepEqual(first.completion, { incomplete: false, reason: 'stop' });
  assert.deepEqual(second.completion, first.completion);
  assert.equal(second.cached, true);
  assert.equal(chunks.join(''), first.content);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('length-limited answers carry a persistent warning and are never cached', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => jsonResponse('### Trap', 'length'));
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callCopilotModel(request('truncated-answer'));
    assert.deepEqual(result.completion, { incomplete: true, reason: 'length' });
    assert.match(result.content, /^> \*\*Incomplete answer/);
    assert.match(result.content, /do not use a partial draft for filing or sending/i);
    assert.ok(result.content.endsWith('### Trap'));
    assert.equal(result.cached, false);
  }
  assert.equal(fetchMock.mock.callCount(), 2);
});

test('content-filtered and unconfirmed answers cannot silently become complete', async () => {
  for (const reason of ['content_filter', null]) {
    mock.method(globalThis, 'fetch', async () => jsonResponse('Partial text.', reason));
    const result = await callCopilotModel(request(`incomplete-${reason}`));
    assert.equal(result.completion.incomplete, true);
    assert.equal(result.completion.reason, reason || 'unconfirmed');
    assert.match(result.content, /Incomplete answer/);
    mock.restoreAll();
  }
});

test('stream parsing handles split UTF-8 packets and a final line without a newline', async () => {
  const chunks = [];
  mock.method(globalThis, 'fetch', async () => streamResponse(
    `data: ${JSON.stringify({ choices: [{ delta: { content: 'Meaning: ₹100 is a quoted amount.' } }] })}\r\n\r\n` +
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}`
  ));
  const result = await callCopilotModel(request('split-stream', { onChunk: text => chunks.push(text) }));
  assert.equal(result.content, chunks.join(''));
  assert.equal(result.content, 'Meaning: ₹100 is a quoted amount.');
  assert.equal(result.completion.incomplete, false);
});

test('streamed length limits and missing completion signals retain partial text with a warning', async () => {
  for (const reason of ['length', null]) {
    mock.method(globalThis, 'fetch', async () => streamResponse(
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'Part of a draft' }, finish_reason: reason }] })}\n\n` +
      'data: [DONE]\n\n'
    ));
    const result = await callCopilotModel(request(`stream-${reason}`, { onChunk() {} }));
    assert.equal(result.completion.incomplete, true);
    assert.match(result.content, /Part of a draft/);
    assert.match(result.content, /^> \*\*Incomplete answer/);
    mock.restoreAll();
  }
});

test('unreadable streams, provider error events and empty answers are explicit failures', async () => {
  for (const [body, message] of [
    ['data: {broken}\n\n', /unreadable response/],
    ['data: {"error":{"message":"failed"}}\n\n', /stopped with an error/]
  ]) {
    mock.method(globalThis, 'fetch', async () => streamResponse(body));
    await assert.rejects(callCopilotModel(request(body, { onChunk() {} })), message);
    mock.restoreAll();
  }
  mock.method(globalThis, 'fetch', async () => jsonResponse(''));
  await assert.rejects(callCopilotModel(request('empty-answer')), /no answer/);
});

test('consumer callback errors are not swallowed by stream parsing', async () => {
  mock.method(globalThis, 'fetch', async () => streamResponse(
    'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":"stop"}]}\n\n'
  ));
  await assert.rejects(callCopilotModel(request('callback-error', {
    onChunk() { throw new Error('test consumer disconnected'); }
  })), /test consumer disconnected/);
});

test('cache identity includes output budget, temperature and provider', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => jsonResponse('Complete.'));
  await callCopilotModel(request('cache-settings', { maxTokens: 1400 }));
  await callCopilotModel(request('cache-settings', { maxTokens: 3200 }));
  await callCopilotModel(request('cache-settings', { maxTokens: 3200, temperature: 0.1 }));
  process.env.LLM_PROVIDER = 'ollama';
  try {
    await callCopilotModel(request('cache-settings', { maxTokens: 3200, temperature: 0.1 }));
  } finally {
    process.env.LLM_PROVIDER = 'openai';
  }
  assert.equal(fetchMock.mock.callCount(), 4);
});
