import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  evaluateWrittenVersionWindow,
  evaluateDisposalPace,
  matchApplicableTactics
} from '../src/engine/consumer-rules.mjs';
import { buildAnalysisSystemPrompt, CONTEXT_FIRST_GUIDANCE } from '../src/engine/response-guidance.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// 1. Validate procedure pack and tactics structure
const procedure = JSON.parse(fs.readFileSync(path.join(root, 'packs/consumer/procedure.json'), 'utf8'));
const tactics = JSON.parse(fs.readFileSync(path.join(root, 'packs/consumer/tactics.json'), 'utf8'));
const tacticSchema = JSON.parse(fs.readFileSync(path.join(root, 'schemas/tactic.schema.json'), 'utf8'));

const stageIds = new Set(procedure.stages.map(s => s.id));
for (const t of tactics) {
  for (const reqField of tacticSchema.required) {
    assert.ok(t[reqField] !== undefined, `Tactic ${t.id} missing required field: ${reqField}`);
  }
  for (const st of t.triggerStages) {
    assert.ok(stageIds.has(st), `Tactic ${t.id} references unknown stage: ${st}`);
  }
}
console.log(`[eval] Validated ${procedure.stages.length} stages and ${tactics.length} tactics in packs/consumer/`);

// 2. Run practitioner benchmark eval cases
const casesDir = path.join(__dirname, 'cases');
const caseFiles = fs.readdirSync(casesDir).filter(f => f.endsWith('.json')).sort();

let passed = 0;
for (const cf of caseFiles) {
  const c = JSON.parse(fs.readFileSync(path.join(casesDir, cf), 'utf8'));
  const s = c.caseState;

  const wv = evaluateWrittenVersionWindow(s.serviceDate, s.evaluationDate, s.writtenVersionFiled);
  const pace = evaluateDisposalPace(s.serviceDate, s.evaluationDate, s.nextHearingDate, false);
  const matched = matchApplicableTactics(s, tactics).map(t => t.id);

  assert.equal(
    pace.exceededStatutoryTarget,
    c.expectedEngine.exceededStatutoryTarget,
    `${c.id}: exceededStatutoryTarget mismatch`
  );
  assert.equal(
    pace.shouldCompressDate,
    c.expectedEngine.shouldCompressDate,
    `${c.id}: shouldCompressDate mismatch`
  );
  assert.equal(
    wv.canForfeitRightToReply,
    c.expectedEngine.canForfeitRightToReply,
    `${c.id}: canForfeitRightToReply mismatch`
  );
  assert.deepEqual(matched, c.expectedTacticIds, `${c.id}: tactic IDs mismatch`);

  passed++;
  console.log(`[eval] PASS ${c.id} -> matched tactics: [${matched.join(', ')}]`);
}

console.log(`[eval] All ${passed}/${caseFiles.length} practitioner eval cases passed.`);

// These are prompt-contract checks; the rubrics require review of actual model outputs.
const responseCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'response-cases.json'), 'utf8'));
const responseModes = new Set(['company-advisor', 'messy-dump-intake', 'midcase-battle-card']);
const responseIds = new Set();
for (const scenario of responseCases) {
  assert.ok(!responseIds.has(scenario.id), `Duplicate response case: ${scenario.id}`);
  responseIds.add(scenario.id);
  assert.ok(responseModes.has(scenario.mode), `${scenario.id}: unknown mode`);
  assert.ok(scenario.rawInput?.trim(), `${scenario.id}: missing synthetic input`);
  assert.ok(scenario.rubric?.length >= 3, `${scenario.id}: missing output-review rubric`);
  const prompt = buildAnalysisSystemPrompt(scenario);
  assert.ok(prompt.includes(CONTEXT_FIRST_GUIDANCE), `${scenario.id}: missing shared guidance`);
  assert.ok(prompt.includes(scenario.isFollowUpTurn ? 'THIS IS A FOLLOW-UP' : 'THIS IS AN INITIAL ANALYSIS'));
}
assert.equal(new Set(responseCases.map(c => c.mode)).size, responseModes.size);
console.log(`[eval] ${responseCases.length} response scenarios passed prompt-contract checks (not a model-output or legal-accuracy score).`);
