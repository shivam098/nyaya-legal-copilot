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
      choices: [{ delta: { content: reply.content }, finish_reason: reply.reason }],
      usage: { prompt_tokens: 100, completion_tokens: 50 }
    })}\n\ndata: [DONE]\n\n`);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{ message: { content: reply.content }, finish_reason: reply.reason }],
      usage: { prompt_tokens: 100, completion_tokens: 50 }
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
  assert.match(html, /function sanitizeHtml/);
  assert.match(html, /data-door="civil-criminal"/);
  assert.match(html, /Property, Family, Matrimony & Criminal Law/);
});

test('civil-criminal door, Turn 5+ context pinning, follow-up image forwarding, and user-scoped /api/config billing work end-to-end', async () => {
  const userId = 'synthetic-civil-criminal-user';
  const { result: chqRes } = await analyze('analyze-stream', {
    userId,
    door: 'civil-criminal',
    mode: 'civil-criminal-advisor',
    caseState: {
      subTrack: 'cheque-bounce-138',
      role: 'complainant',
      dishonourDate: '2026-10-06',
      evaluationDate: '2026-11-02'
    },
    rawInput: 'Foundational Turn 1 Story: Buyer cheque for Rs 6,40,000 bounced on 2026-10-06.'
  });
  assert.ok(chqRes.engineResult.niAct138);
  assert.equal(chqRes.engineResult.niAct138.daysRemainingForNotice, 3);
  assert.equal(chqRes.engineResult.disposalPace, null);

  const sessionId = chqRes.session.id;
  // Run Turns 2, 3, 4, and 5 and verify Turn 1 foundational story is still pinned in Turn 5 prompt!
  for (let turn = 2; turn <= 5; turn++) {
    await analyze('analyze-stream', {
      userId,
      sessionId,
      door: 'civil-criminal',
      mode: 'civil-criminal-advisor',
      caseState: { subTrack: 'cheque-bounce-138' },
      rawInput: `Follow-up question #${turn}`,
      images: turn === 5 ? [{ name: 'bank-return-memo.png', dataUrl: 'data:image/png;base64,c3ludGhldGlj' }] : []
    });
  }
  const turn5Sent = requests.at(-1);
  const turn5Content = turn5Sent.messages[1].content;
  const turn5Text = Array.isArray(turn5Content) ? turn5Content[0].text : turn5Content;
  assert.match(turn5Text, /Foundational Turn 1 Story/);
  assert.match(turn5Text, /bank-return-memo\.png/);
  assert.ok(Array.isArray(turn5Content) && turn5Content.some(part => part.type === 'image_url'));

  // Verify another guest user calling /api/config does NOT see synthetic-civil-criminal-user's billing calls
  const otherCfg = await (await fetch(`${baseUrl}/api/config`, {
    headers: { 'x-nyaya-user-id': 'isolated-guest-user-2' }
  })).json();
  assert.equal(otherCfg.userId, 'isolated-guest-user-2');
  assert.equal(otherCfg.billing.totals.calls, 0);
  assert.deepEqual(otherCfg.billing.recentCalls, []);
  assert.ok(!('synthetic-civil-criminal-user' in otherCfg.billing.byUsers));
});

test('profile signup/login, Gmail quick login, Rs 500 monthly trial cap, user isolation, and Super-Admin Lab work end-to-end', async () => {
  // 1. User A signs up with email + password (no email OTP required)
  const signupA = await (await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'tester-a@gmail.com',
      password: 'password123',
      displayName: 'Tester A'
    })
  })).json();
  assert.equal(signupA.authenticated, true);
  assert.equal(signupA.user.email, 'tester-a@gmail.com');
  assert.equal(signupA.user.role, 'user');
  assert.equal(signupA.userQuota.monthlyLimitInr, 500);
  assert.equal(signupA.userQuota.isTrial, true);

  // User A runs an analysis using their Bearer token
  const aAnalyzeRes = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${signupA.token}`
    },
    body: JSON.stringify({
      door: 'start',
      mode: 'messy-dump-intake',
      model: 'test-model',
      caseState: { role: 'complainant' },
      rawInput: 'Tester A private case about a laptop warranty.'
    })
  });
  const aData = await aAnalyzeRes.json();
  const sessionAId = aData.session.id;
  const turnAId = aData.session.turns[0].id;

  // User A submits thumbs-down feedback on their turn
  const fbRes = await fetch(`${baseUrl}/api/turns/${turnAId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${signupA.token}`
    },
    body: JSON.stringify({ rating: -1, note: 'Need clearer brand escalation email' })
  });
  assert.equal(fbRes.status, 200);

  // 2. User B signs in via Gmail quick profile
  const gmailB = await (await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'tester-b@gmail.com',
      displayName: 'Tester B'
    })
  })).json();
  assert.equal(gmailB.authenticated, true);
  assert.equal(gmailB.user.email, 'tester-b@gmail.com');
  assert.equal(gmailB.sessions.length, 0);

  // User B CANNOT read User A's session (404) and CANNOT access Super-Admin Lab (403)
  const bReadA = await fetch(`${baseUrl}/api/sessions/${sessionAId}`, {
    headers: { 'Authorization': `Bearer ${gmailB.token}` }
  });
  assert.equal(bReadA.status, 404);

  const bAdminTry = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { 'Authorization': `Bearer ${gmailB.token}` }
  });
  assert.equal(bAdminTry.status, 403);

  // 3. Super-Admin logs in and inspects all users, sessions, and User A's feedback
  const adminLogin = await (await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@nyaya.ai',
      password: 'nyaya-admin-2026'
    })
  })).json();
  assert.equal(adminLogin.authenticated, true);
  assert.equal(adminLogin.user.role, 'superadmin');

  const adminOverviewRes = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { 'Authorization': `Bearer ${adminLogin.token}` }
  });
  assert.equal(adminOverviewRes.status, 200);
  const overview = await adminOverviewRes.json();
  assert.ok(overview.summary.totalUsers >= 3);
  assert.ok(overview.summary.thumbsDownCount >= 1);
  assert.ok(overview.users.some(u => u.email === 'tester-a@gmail.com'));
  assert.ok(overview.sessions.some(s => s.id === sessionAId && s.latestRating === -1));

  // Super-Admin can inspect User A's full session turns
  const adminInspectRes = await fetch(`${baseUrl}/api/admin/sessions/${sessionAId}`, {
    headers: { 'Authorization': `Bearer ${adminLogin.token}` }
  });
  assert.equal(adminInspectRes.status, 200);
  const inspected = await adminInspectRes.json();
  assert.equal(inspected.session.turns[0].userFeedbackNote, 'Need clearer brand escalation email');

  // 4. Anti-bypass check: if a user on hardware fingerprint + CF-Connecting-IP runs a turn on Account 1,
  // and then opens Incognito and registers a brand-new email on the SAME hardware fingerprint + CF-Connecting-IP,
  // the new account shares the device/IP monthly spend!
  const sharedHeaders = {
    'Content-Type': 'application/json',
    'x-nyaya-hw-fp': 'hw_apple_m1_max_2560x1440',
    'cf-connecting-ip': '203.0.113.42'
  };
  await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: {
      ...sharedHeaders,
      'Authorization': `Bearer ${signupA.token}`
    },
    body: JSON.stringify({
      door: 'start',
      mode: 'messy-dump-intake',
      model: 'claude-opus-4.6',
      caseState: { role: 'complainant' },
      rawInput: 'Spend test on first account with device fingerprint and Cloudflare IP.'
    })
  });

  // Register a brand-new account in "Incognito" (no cookie, new email, same hwFingerprint + CF-Connecting-IP)
  const hopperSignup = await (await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: sharedHeaders,
    body: JSON.stringify({
      email: 'incognito-hopper@gmail.com',
      password: 'password123',
      displayName: 'Hopper'
    })
  })).json();
  assert.equal(hopperSignup.authenticated, true);
  assert.equal(hopperSignup.userQuota.userOwnSpendInr, 0);
  assert.ok(hopperSignup.userQuota.fpIpSpendInr > 0);
  assert.equal(hopperSignup.userQuota.sharedFromDeviceOrIp, true);
  assert.equal(hopperSignup.userQuota.monthlySpendInr, hopperSignup.userQuota.fpIpSpendInr);

  // 5. Advocate Mode (lawyer-workbench): Tofan Singh / Tufan Singh NDPS s.67 + Bare Act dossier & links in one place
  const { result: advRes } = await analyze('analyze-stream', {
    userId: 'synthetic-advocate-tofan-singh',
    door: 'lawyer-workbench',
    mode: 'lawyer-research-bench',
    caseState: {
      researchTask: 'judgment-and-bare-act',
      proceedingStage: 'bail'
    },
    rawInput: 'Advocate Research Mode: judgment-and-bare-act\nProceeding Stage: bail\nQuery / Citation / Issue:\nNeed Tufan Singh judgment on NDPS Section 67 confessional statement, Bare Act provisions, and links for bail argument.'
  });
  assert.ok(advRes.engineResult.advocateResearch);
  assert.equal(advRes.engineResult.advocateResearch.matchedJudgments[0].id, 'tofan-singh-ndps-s67');
  assert.equal(advRes.engineResult.advocateResearch.matchedJudgments[0].links.indianKanoonDocUrl, 'https://indiankanoon.org/doc/143202244/');
  assert.ok(advRes.engineResult.advocateResearch.directLinks.some(l => l.url.includes('indiacode.nic.in')));

  // 6. Voice recording upload (/api/extract-file with .opus / .mp3 / .wav audio)
  const audioExtractRes = await (await fetch(`${baseUrl}/api/extract-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'PTT-20261102-WA0001.opus',
      base64: Buffer.from('HINDI_TEST').toString('base64')
    })
  })).json();
  assert.equal(audioExtractRes.model, 'large-v3-turbo');
  assert.match(audioExtractRes.transcript, /mujhe/i);
  assert.equal(audioExtractRes.docs.length, 1);
  assert.match(audioExtractRes.docs[0].name, /Transcribed Audio · Whisper large-v3-turbo/);
});
