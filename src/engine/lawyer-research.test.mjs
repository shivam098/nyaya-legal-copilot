import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchLandmarkJudgmentsAndBareActs,
  buildDirectLegalResearchLinks,
  buildAdvocateResearchContext
} from './lawyer-research.mjs';

test('matchLandmarkJudgmentsAndBareActs matches Tofan Singh (Tufan Singh) with NDPS s.67/s.53 and BSA s.23 Bare Act links', () => {
  const hits = matchLandmarkJudgmentsAndBareActs('Need Tufan Singh judgment on NDPS Section 67 confessional statement and Bare Act sections for bail argument');
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].id, 'tofan-singh-ndps-s67');
  assert.equal(hits[0].citation, '(2021) 4 SCC 1 | 2020 INSC 620');
  assert.match(hits[0].ratioDecidendi.join(' '), /Section 53 of the NDPS Act.*are "police officers"/);
  assert.ok(hits[0].bareActProvisions.some(b => b.sections.includes('Section 67')));
  assert.ok(hits[0].bareActProvisions.some(b => b.sections.includes('Section 23(1) BSA')));
  assert.equal(hits[0].links.indianKanoonDocUrl, 'https://indiankanoon.org/doc/143202244/');
});

test('buildDirectLegalResearchLinks includes direct judgment link, Indian Kanoon search, e-SCR, and IndiaCode Bare Act', () => {
  const matched = matchLandmarkJudgmentsAndBareActs('Tofan Singh NDPS');
  const links = buildDirectLegalResearchLinks('Tofan Singh NDPS', matched);
  assert.ok(links.some(l => l.url === 'https://indiankanoon.org/doc/143202244/'));
  assert.ok(links.some(l => l.url.includes('indiankanoon.org/search/')));
  assert.ok(links.some(l => l.url.includes('digiscr.sci.gov.in')));
  assert.ok(links.some(l => l.url.includes('indiacode.nic.in')));
});

test('buildAdvocateResearchContext parses live Indian Kanoon HTML and formats complete Bare Act & Precedent context', async () => {
  const prevProvider = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = 'copilot-local';
  try {
    const sampleIkHtml = `
      <div class="result_title"><a href="/docfragment/143202244/?formInput=tofan%20singh"><b>Tofan</b> <b>Singh</b> vs The State Of Tamil Nadu on 29 October, 2020</a></div>
    `;
    const ctx = await buildAdvocateResearchContext('Tofan Singh NDPS s.67', {
      fetchImpl: async () => new Response(sampleIkHtml, { status: 200 })
    });
    assert.equal(ctx.matchedJudgments[0].id, 'tofan-singh-ndps-s67');
    assert.equal(ctx.liveJudgments.length, 1);
    assert.equal(ctx.liveJudgments[0].url, 'https://indiankanoon.org/doc/143202244/');
    assert.match(ctx.contextBlock, /Tofan Singh v\. State of Tamil Nadu — \(2021\) 4 SCC 1/);
  } finally {
    process.env.LLM_PROVIDER = prevProvider;
  }
});
