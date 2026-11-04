import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const htmlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.html');

test('index.html declares each React state hook only once per component (in-browser Babel rejects duplicates and the page goes blank)', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  // Split the babel script at top-level component/function declarations so each scope is checked on its own.
  const scopes = html.split(/\n {4}function [A-Za-z_$][\w$]*\s*\(/);
  const duplicates = [];
  for (const scope of scopes) {
    const names = [...scope.matchAll(/const\s+\[\s*([A-Za-z_$][\w$]*)\s*,\s*set[A-Za-z_$][\w$]*\s*\]\s*=\s*useState/g)].map(m => m[1]);
    const seen = new Set();
    duplicates.push(...names.filter(n => (seen.has(n) ? true : (seen.add(n), false))));
  }
  assert.deepEqual(duplicates, [], `Duplicate useState declarations in one component: ${duplicates.join(', ')}`);
  assert.ok(scopes.length > 3, 'expected several top-level components to be split out');
});

test('result card exposes the Senior-Counsel threshold panel and the cross-examination action', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /Senior-Counsel Threshold Check/);
  assert.match(html, /crossExaminationInstruction/);
  assert.match(html, /Cross-Examination & Contradictions/);
});
