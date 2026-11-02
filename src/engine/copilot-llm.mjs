import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');
const defaultDataDir = (process.env.WEBSITE_SITE_NAME && fs.existsSync('/home'))
  ? '/home/data'
  : path.join(rootDir, 'data');
const dataDir = process.env.NYAYA_DATA_DIR || defaultDataDir;
const ledgerPath = path.join(dataDir, 'billing-ledger.json');
const cachePath = path.join(dataDir, 'response-cache.json');

const USD_TO_INR = 84.0;

/**
 * Standard commercial API pricing per 1 Million tokens (USD)
 * Includes Local Ollama (M1 Max 64GB = $0.00), Azure AI Foundry ($150/mo Employee Credit),
 * Google Gemini Free Tier ($0.00), and Copilot / OpenRouter Frontier models.
 */
export const COMMERCIAL_PRICING_PER_1M = {
  'auto':              { inputUsd: 1.50, outputUsd: 7.50, tier: 'smart-router', label: '⚡ Auto Smart-Router (Haiku/Flash Intake → Sonnet/GPT Strategy)' },
  'claude-opus-5.5':   { inputUsd: 15.00, outputUsd: 75.00, tier: 'senior-counsel', label: '☁️ Claude Opus 5.5 (Frontier Senior Counsel + Vision)' },
  'claude-sonnet-5.5': { inputUsd: 3.00, outputUsd: 15.00, tier: 'strategist', label: '☁️ Claude Sonnet 5.5 (Latest Practitioner Core + Vision)' },
  'gemini-4-argon':    { inputUsd: 1.25, outputUsd: 5.00, tier: 'strategist', label: '☁️ Gemini 4 Argon (Fast Frontier Reasoning)' },
  'claude-opus-4.6':   { inputUsd: 15.00, outputUsd: 75.00, tier: 'senior-counsel', label: '☁️ Claude Opus 4.6 (Senior Counsel Deep Review)' },
  'claude-sonnet-4.6': { inputUsd: 3.00, outputUsd: 15.00, tier: 'strategist', label: '☁️ Claude Sonnet 4.6 (Practitioner Core + Vision)' },
  'claude-haiku-5.5':  { inputUsd: 0.80, outputUsd: 4.00, tier: 'fast-intake', label: '☁️ Claude Haiku 5.5 (Fast Extraction & Triage)' },
  'claude-haiku-4.5':  { inputUsd: 0.80, outputUsd: 4.00, tier: 'fast-intake', label: '☁️ Claude Haiku 4.5 (Fast Extraction & Triage)' },
  'gpt-4.1':           { inputUsd: 2.00, outputUsd: 8.00, tier: 'strategist', label: '☁️ GPT-4.1 (Balanced Reasoning)' },
  'gpt-5.6-sol':       { inputUsd: 2.50, outputUsd: 10.00, tier: 'strategist', label: '☁️ GPT-5.6 Sol (High-Reasoning)' },
  'azure:gpt-4.1':     { inputUsd: 2.00, outputUsd: 8.00, tier: 'azure-foundry', label: '🔷 Azure AI Foundry: GPT-4.1 ($150/mo Employee Credit)' },
  'azure:o3-mini':     { inputUsd: 1.10, outputUsd: 4.40, tier: 'azure-foundry', label: '🔷 Azure AI Foundry: o3-mini Reasoning ($150/mo Credit)' },
  'azure:DeepSeek-R1': { inputUsd: 0.55, outputUsd: 2.19, tier: 'azure-foundry', label: '🔷 Azure AI Foundry: DeepSeek-R1 ($150/mo Credit)' },
  'gemini:gemini-2.5-flash': { inputUsd: 0.00, outputUsd: 0.00, tier: 'free-cloud', label: '🟢 Google AI Studio: Gemini 2.5 Flash (₹0 Free Tier + Vision)' },
  'ollama:deepseek-r1:32b':  { inputUsd: 0.00, outputUsd: 0.00, tier: 'local-m1-max', label: '🍎 Local M1 Max (Ollama): DeepSeek-R1 32B (₹0 Offline)' },
  'ollama:qwen2.5:72b':      { inputUsd: 0.00, outputUsd: 0.00, tier: 'local-m1-max', label: '🍎 Local M1 Max (Ollama): Qwen 2.5 72B (₹0 Offline)' },
  'ollama:llama3.2-vision':  { inputUsd: 0.00, outputUsd: 0.00, tier: 'local-m1-max', label: '🍎 Local M1 Max (Ollama): Llama 3.2 Vision (₹0 Offline)' }
};

export const CURATED_MODELS = Object.entries(COMMERCIAL_PRICING_PER_1M).map(([id, info]) => ({
  id,
  name: info.label,
  tier: info.tier,
  inputUsdPer1M: info.inputUsd,
  outputUsdPer1M: info.outputUsd
}));

/**
 * Multi-Provider Gateway Configuration:
 * - Per-model prefix override:
 *   - "ollama:<model>" -> routes directly to local/LAN M1 Max Ollama (`OLLAMA_BASE_URL` or `http://127.0.0.1:11434/v1/chat/completions`)
 *   - "azure:<model>"  -> routes directly to Azure AI Foundry (`AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY`)
 *   - "gemini:<model>" -> routes directly to Google AI Studio OpenAI-compatible endpoint (`GEMINI_API_KEY`)
 * - Global default via `LLM_PROVIDER`:
 *   - "copilot-local" | "ollama" | "azure-foundry" | "gemini" | "openrouter" | "openai"
 */
export function detectActiveProvider(requestedModel = '') {
  const m = String(requestedModel || '');
  if (m.startsWith('ollama:')) return 'ollama';
  if (m.startsWith('azure:')) return 'azure-foundry';
  if (m.startsWith('gemini:')) return 'gemini';
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER;
  if (process.env.AZURE_OPENAI_API_KEY) return 'azure-foundry';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY) return 'openai';
  return 'copilot-local';
}

let cachedGhToken = null;
let cachedGhAt = 0;

function getCopilotToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();
  const now = Date.now();
  if (cachedGhToken && now - cachedGhAt < 10 * 60 * 1000) return cachedGhToken;
  cachedGhToken = execSync('gh auth token', { encoding: 'utf8' }).trim();
  cachedGhAt = now;
  return cachedGhToken;
}

/**
 * Smart Tiered Model Router:
 * When `model === "auto"`, routes high-volume intake/parsing (like messy WhatsApp exports)
 * to a fast 5–10x cheaper model (`claude-haiku-4.5`), and reserves heavy legal
 * strategy/drafting for `claude-sonnet-4.6`.
 */
export function resolveJuniorClerkModel() {
  const defaultProvider = detectActiveProvider();
  if (defaultProvider === 'ollama') return process.env.OLLAMA_FAST_MODEL || 'deepseek-r1:32b';
  if (defaultProvider === 'azure-foundry') return process.env.AZURE_OPENAI_FAST_DEPLOYMENT || 'gpt-4o-mini';
  if (defaultProvider === 'gemini') return 'gemini-2.5-flash';
  return 'claude-haiku-4.5';
}

export function resolveRoutedModel(requestedModel, operation, hasImages = false, isComplexCase = false) {
  if (requestedModel && requestedModel !== 'auto') {
    return requestedModel.replace(/^(ollama:|azure:|gemini:)/, '');
  }
  const defaultProvider = detectActiveProvider();
  if (defaultProvider === 'ollama') {
    return process.env.OLLAMA_DEFAULT_MODEL || (hasImages ? 'llama3.2-vision' : 'deepseek-r1:32b');
  }
  if (defaultProvider === 'azure-foundry') {
    return isComplexCase
      ? (process.env.AZURE_OPENAI_REASONING_DEPLOYMENT || 'o3-mini')
      : (process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1');
  }
  if (defaultProvider === 'gemini') {
    return 'gemini-2.5-flash';
  }
  // When Auto Smart-Router detects a complex multi-document / multi-OP / contested case -> escalate to Claude Opus 4.6!
  if (isComplexCase) {
    return 'claude-opus-4.6';
  }
  if (hasImages) return 'claude-sonnet-4.6';
  if (operation === 'messy-dump-intake' || operation === 'timeline-extract') {
    return 'claude-haiku-4.5';
  }
  return 'claude-sonnet-4.6';
}

function readCache() {
  if (!fs.existsSync(cachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeCache(cache) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

export function readBillingLedger() {
  if (!fs.existsSync(ledgerPath)) {
    return {
      currencyRateUsdToInr: USD_TO_INR,
      activeProvider: detectActiveProvider(),
      totals: {
        calls: 0,
        cacheHits: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalNanoAiu: 0,
        estimatedUsd: 0,
        estimatedInr: 0
      },
      byUserTier: {
        'founder-unlimited': { limitInr: 1000000, description: 'Founder / Admin Unlimited Workspace' },
        'free-trial': { limitInr: 150, description: 'Free Community Access Tier' },
        'case-pass-499': { priceInr: 499, limitInr: 1500, description: 'Single Case Battle-Pass (6 months of hearings + drafts)' },
        'pro-monthly-999': { priceInr: 999, limitInr: 5000, description: 'Founder / Business / Advocate Monthly Plan' }
      },
      byUsers: {},
      byModel: {},
      byOperation: {},
      recentCalls: []
    };
  }
  const data = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  data.activeProvider = detectActiveProvider();
  data.totals.cacheHits = data.totals.cacheHits || 0;
  data.byUsers = data.byUsers || {};
  return data;
}

function computeCommercialCostUsd(model, promptTokens, completionTokens, nanoAiu) {
  const rate = COMMERCIAL_PRICING_PER_1M[model] || { inputUsd: 3.0, outputUsd: 15.0 };
  return (promptTokens * rate.inputUsd + completionTokens * rate.outputUsd) / 1e6;
}

function recordBillingEvent({
  userId = 'founder-local',
  userPlan = 'case-pass-499',
  provider,
  model,
  operation,
  caseId,
  usage,
  copilotUsage,
  latencyMs,
  cached = false
}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const ledger = readBillingLedger();

  const promptTokens = cached ? 0 : (usage?.prompt_tokens || 0);
  const completionTokens = cached ? 0 : (usage?.completion_tokens || 0);
  const totalTokens = promptTokens + completionTokens;
  const nanoAiu = cached ? 0 : (copilotUsage?.total_nano_aiu || 0);

  const callUsd = cached ? 0 : computeCommercialCostUsd(model, promptTokens, completionTokens, nanoAiu);
  const callInr = callUsd * USD_TO_INR;

  ledger.totals.calls += 1;
  if (cached) ledger.totals.cacheHits = (ledger.totals.cacheHits || 0) + 1;
  ledger.totals.promptTokens += promptTokens;
  ledger.totals.completionTokens += completionTokens;
  ledger.totals.totalTokens += totalTokens;
  ledger.totals.totalNanoAiu += nanoAiu;
  ledger.totals.estimatedUsd = Number((ledger.totals.estimatedUsd + callUsd).toFixed(6));
  ledger.totals.estimatedInr = Number((ledger.totals.estimatedInr + callInr).toFixed(4));

  if (!ledger.byUsers[userId]) {
    ledger.byUsers[userId] = { plan: userPlan, calls: 0, totalTokens: 0, spendInr: 0 };
  }
  ledger.byUsers[userId].calls += 1;
  ledger.byUsers[userId].totalTokens += totalTokens;
  ledger.byUsers[userId].spendInr = Number((ledger.byUsers[userId].spendInr + callInr).toFixed(4));

  if (!ledger.byModel[model]) {
    ledger.byModel[model] = { calls: 0, totalTokens: 0, estimatedUsd: 0, estimatedInr: 0 };
  }
  ledger.byModel[model].calls += 1;
  ledger.byModel[model].totalTokens += totalTokens;
  ledger.byModel[model].estimatedUsd = Number((ledger.byModel[model].estimatedUsd + callUsd).toFixed(6));
  ledger.byModel[model].estimatedInr = Number((ledger.byModel[model].estimatedInr + callInr).toFixed(4));

  if (!ledger.byOperation[operation]) {
    ledger.byOperation[operation] = { calls: 0, totalTokens: 0, estimatedUsd: 0, estimatedInr: 0 };
  }
  ledger.byOperation[operation].calls += 1;
  ledger.byOperation[operation].totalTokens += totalTokens;
  ledger.byOperation[operation].estimatedUsd = Number((ledger.byOperation[operation].estimatedUsd + callUsd).toFixed(6));
  ledger.byOperation[operation].estimatedInr = Number((ledger.byOperation[operation].estimatedInr + callInr).toFixed(4));

  const entry = {
    timestamp: new Date().toISOString(),
    userId,
    provider,
    model,
    operation,
    caseId: caseId || 'ad-hoc',
    cached,
    promptTokens,
    completionTokens,
    totalTokens,
    nanoAiu,
    estimatedUsd: Number(callUsd.toFixed(6)),
    estimatedInr: Number(callInr.toFixed(4)),
    latencyMs
  };

  ledger.recentCalls.unshift(entry);
  ledger.recentCalls = ledger.recentCalls.slice(0, 50);

  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  return entry;
}

export async function callCopilotModel({
  userId = 'founder-local',
  userPlan = 'case-pass-499',
  model = 'auto',
  operation = 'practitioner-analysis',
  caseId = null,
  systemPrompt,
  userPrompt,
  images = [],
  isComplexCase = false,
  maxTokens = 1300,
  temperature = 0.2,
  onChunk = null
}) {
  const provider = detectActiveProvider(model);
  const hasImages = Array.isArray(images) && images.length > 0;
  const resolvedModel = resolveRoutedModel(model, operation, hasImages, isComplexCase);

  // Per-user quota check (protects your API wallet when deployed to public users; founder-local is unlimited)
  if (userId !== 'founder-local') {
    const ledger = readBillingLedger();
    const userStats = ledger.byUsers?.[userId] || { spendInr: 0 };
    const planCeilingInr = ledger.byUserTier?.[userPlan]?.limitInr || 1500;
    if (userStats.spendInr >= planCeilingInr) {
      throw new Error(`User '${userId}' reached AI compute quota (₹${userStats.spendInr.toFixed(2)} / ₹${planCeilingInr} cap for ${userPlan}).`);
    }
  }

  // Exact-match content hash cache (saves 100% of LLM cost when users re-click or test identical facts)
  const imageHashes = hasImages
    ? images.map(img => crypto.createHash('sha256').update(img.dataUrl || '').digest('hex').slice(0, 12))
    : [];
  const cacheKey = crypto
    .createHash('sha256')
    .update(JSON.stringify({ version: 2, provider, resolvedModel, operation, systemPrompt, userPrompt, imageHashes, maxTokens, temperature }))
    .digest('hex')
    .slice(0, 24);

  const cache = readCache();
  if (cache[cacheKey]) {
    const cachedHit = cache[cacheKey];
    if (onChunk) onChunk(cachedHit.content);
    const billingEntry = recordBillingEvent({
      userId,
      userPlan,
      provider,
      model: cachedHit.model,
      operation,
      caseId,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      copilotUsage: { total_nano_aiu: 0 },
      latencyMs: 5,
      cached: true
    });
    return {
      content: cachedHit.content,
      model: cachedHit.model,
      provider,
      cached: true,
      completion: cachedHit.completion,
      billingEntry
    };
  }

  const start = Date.now();
  let endpoint = 'https://api.githubcopilot.com/chat/completions';
  let headers = { 'Content-Type': 'application/json' };

  if (provider === 'copilot-local') {
    headers['Authorization'] = `Bearer ${getCopilotToken()}`;
    headers['Copilot-Integration-Id'] = 'vscode-chat';
    headers['Editor-Version'] = 'vscode/1.96.0';
  } else if (provider === 'ollama') {
    const ollamaBase = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    endpoint = `${ollamaBase}/v1/chat/completions`;
  } else if (provider === 'azure-foundry') {
    const azEndpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '');
    if (!azEndpoint || !process.env.AZURE_OPENAI_API_KEY) {
      throw new Error('Azure AI Foundry selected, but AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY are not set in .env yet.');
    }
    endpoint = azEndpoint.includes('/chat/completions')
      ? azEndpoint
      : `${azEndpoint}/openai/deployments/${resolvedModel}/chat/completions?api-version=2024-10-21`;
    headers['api-key'] = process.env.AZURE_OPENAI_API_KEY;
    headers['Authorization'] = `Bearer ${process.env.AZURE_OPENAI_API_KEY}`;
  } else if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Google Gemini selected, but GEMINI_API_KEY is not set in .env yet (get a free key at aistudio.google.com).');
    }
    endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    headers['Authorization'] = `Bearer ${process.env.GEMINI_API_KEY}`;
  } else if (provider === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
    headers['HTTP-Referer'] = 'https://nyaya.legal';
    headers['X-Title'] = 'Nyaya Legal Co-Pilot';
  } else if (provider === 'openai') {
    endpoint = process.env.LLM_BASE_URL || 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${process.env.OPENAI_API_KEY || process.env.LLM_API_KEY}`;
  }

  const userMessageContent = hasImages
    ? [
        { type: 'text', text: userPrompt },
        ...images.slice(0, 10).map(img => ({
          type: 'image_url',
          image_url: { url: img.dataUrl }
        }))
      ]
    : userPrompt;

  const useStream = typeof onChunk === 'function';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: resolvedModel,
      stream: useStream,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM Gateway error (${provider} / ${res.status}): ${errText}`);
  }

  let content = '';
  let finalModel = resolvedModel;
  let usage = null;
  let copilotUsage = null;
  let finishReason = null;

  if (useStream && res.body) {
    const decoder = new TextDecoder();
    let buffer = '';
    const processLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        throw new Error('The model sent an unreadable response. Please retry; this answer has not been saved as complete.');
      }
      if (parsed.error) {
        throw new Error('The model stopped with an error. Please retry; this answer has not been saved as complete.');
      }
      if (parsed.model) finalModel = parsed.model;
      if (parsed.usage) usage = parsed.usage;
      if (parsed.copilot_usage) copilotUsage = parsed.copilot_usage;
      const choice = parsed.choices?.[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const delta = choice?.delta?.content;
      if (delta) {
        content += delta;
        onChunk(delta);
      }
    };
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) processLine(line);
    }
    processLine(buffer + decoder.decode());
  } else {
    const data = await res.json();
    content = data.choices?.[0]?.message?.content || '';
    finishReason = data.choices?.[0]?.finish_reason || null;
    finalModel = data.model || resolvedModel;
    usage = data.usage;
    copilotUsage = data.copilot_usage;
  }

  if (!content.trim()) {
    throw new Error('The model returned no answer. Please retry; no empty answer has been saved.');
  }

  const latencyMs = Date.now() - start;

  // Estimate tokens if streaming didn't return a final usage block
  if (!usage) {
    const estPrompt = Math.ceil((String(systemPrompt).length + String(userPrompt).length) / 4) + (hasImages ? images.length * 450 : 0);
    const estCompletion = Math.ceil(content.length / 4);
    usage = {
      prompt_tokens: estPrompt,
      completion_tokens: estCompletion,
      total_tokens: estPrompt + estCompletion
    };
  }

  const completion = {
    incomplete: finishReason !== 'stop',
    reason: finishReason || 'unconfirmed'
  };
  if (completion.incomplete) {
    const explanation = finishReason === 'length'
      ? 'The response reached its length limit.'
      : finishReason === 'content_filter'
        ? 'The provider stopped this response with a content filter.'
        : 'The provider did not confirm a complete answer.';
    content = `> **Incomplete answer - do not use a partial draft for filing or sending.** ${explanation} Ask for the missing part or a shorter complete answer before acting.\n\n${content}`;
  } else {
    cache[cacheKey] = {
      content,
      model: finalModel,
      completion,
      savedAt: new Date().toISOString()
    };
    writeCache(cache);
  }

  const billingEntry = recordBillingEvent({
    userId,
    userPlan,
    provider,
    model: finalModel,
    operation,
    caseId,
    usage,
    copilotUsage,
    latencyMs,
    cached: false
  });

  return {
    content,
    model: finalModel,
    provider,
    cached: false,
    completion,
    billingEntry
  };
}
