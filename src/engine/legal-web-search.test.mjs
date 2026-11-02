import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchVerifiedLegalReferences,
  searchOfficialLegalWeb,
  buildGroundedLegalContext
} from './legal-web-search.mjs';

test('matchVerifiedLegalReferences matches traffic challans, consumer fees, OPC rules, and property/matrimony', () => {
  const traffic = matchVerifiedLegalReferences('What is the fine for riding without a helmet in Karnataka?', 'messy-dump-intake');
  assert.equal(traffic[0].id, 'mv-act-traffic-challans');
  assert.match(traffic[0].summary, /Section 194D/);
  assert.match(traffic[0].summary, /echallan\.parivahan\.gov\.in/);

  const company = matchVerifiedLegalReferences('Solo founder OPC vs Pvt Ltd', 'company-advisor');
  assert.equal(company[0].id, 'companies-act-opc-llp-pvt-ltd');
  assert.match(company[0].summary, /mandatory conversion thresholds.*were REMOVED/i);

  const consumer = matchVerifiedLegalReferences('Apple watch speaker warranty repair refused', 'messy-dump-intake');
  assert.equal(consumer[0].id, 'cpa-2019-consumer-fees-and-portals');
  assert.match(consumer[0].summary, /up to ₹5 lakh: ₹0/i);

  const property = matchVerifiedLegalReferences('Builder delayed flat possession and marriage dispute', 'messy-dump-intake');
  assert.equal(property[0].id, 'property-rera-matrimony-labour');
});

test('searchOfficialLegalWeb parses HTML results and degrades gracefully on failure', async () => {
  const prevProvider = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = 'copilot-local';
  try {
    const sampleHtml = `
      <div>
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fechallan.parivahan.gov.in%2F">Parivahan <b>e-Challan</b> Portal</a>
        <a class="result__snippet">Check traffic challan status and MV Act Section 194D helmet fine ₹1,000 online.</a>
      </div>
    `;
    const results = await searchOfficialLegalWeb('Karnataka helmet traffic fine', {
      fetchImpl: async () => new Response(sampleHtml, { status: 200 })
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].url, 'https://echallan.parivahan.gov.in/');
    assert.match(results[0].title, /Parivahan e-Challan Portal/);
    assert.match(results[0].snippet, /Section 194D/);

    const failed = await searchOfficialLegalWeb('Karnataka helmet traffic fine', {
      fetchImpl: async () => { throw new Error('network down'); }
    });
    assert.deepEqual(failed, []);
  } finally {
    process.env.LLM_PROVIDER = prevProvider;
  }
});

test('buildGroundedLegalContext combines verified statutory references and live web snippets', async () => {
  const grounded = await buildGroundedLegalContext('What is the helmet challan fine in Bengaluru?', 'messy-dump-intake', {
    fetchImpl: async () => new Response('', { status: 500 })
  });
  assert.ok(grounded.verifiedRefs.length >= 1);
  assert.match(grounded.contextBlock, /Motor Vehicles Act, 1988/);
});
