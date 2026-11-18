import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDraft, intakeDraftReducer as reduce, composeFollowUp } from './draft-composer.mjs';

const example = { label: 'Sample', text: 'Example timeline' };
const choose = { type: 'choose', example, hasFiles: false };

test('an example fills only an empty intake without attached files', () => {
  assert.equal(reduce(emptyDraft, choose).text, example.text);
  const fileOnly = reduce(emptyDraft, { ...choose, hasFiles: true });
  assert.equal(fileOnly.text, '');
  assert.equal(fileOnly.preview.text, example.text);
  assert.deepEqual(reduce(fileOnly, { type: 'cancel' }), emptyDraft);
});

test('preview, cancel, explicit replacement and undo preserve the exact original question', () => {
  const original = '  My receipt arrived.\n  The dates differ.  ';
  const draft = reduce(emptyDraft, { type: 'edit', update: original });
  const preview = reduce(draft, choose);
  assert.equal(preview.text, original);
  assert.deepEqual(reduce(preview, { type: 'cancel' }), draft);
  const replaced = reduce(preview, { type: 'replace' });
  assert.equal(replaced.text, example.text);
  assert.deepEqual(reduce(replaced, { type: 'undo' }), draft);
});

test('undo after editing the example previews the old text without overwriting newer edits', () => {
  const draft = { ...emptyDraft, text: 'Original' };
  const replaced = reduce(reduce(draft, choose), { type: 'replace' });
  const edited = reduce(replaced, { type: 'edit', update: text => `${text}\nMy correction` });
  const restore = reduce(edited, { type: 'undo' });
  assert.equal(restore.text, 'Example timeline\nMy correction');
  assert.equal(restore.preview.text, 'Original');
  assert.deepEqual(reduce(restore, { type: 'cancel' }), edited);
  const restored = reduce(restore, { type: 'replace' });
  assert.equal(restored.text, 'Original');
  assert.equal(reduce(restored, { type: 'undo' }).text, edited.text);
  assert.deepEqual(reduce(restore, { type: 'clear' }), emptyDraft);
});

test('switching or reselecting examples still undoes to the original draft', () => {
  const draft = { ...emptyDraft, text: 'My own timeline' };
  let state = reduce(reduce(draft, choose), { type: 'replace' });
  for (const text of [example.text, 'A different example']) {
    state = reduce(state, { ...choose, example: { ...example, text } });
    state = reduce(state, { type: 'replace' });
  }
  assert.deepEqual(reduce(state, { type: 'undo' }), draft);
});

test('the send payload combines current selections and the independent note, never stale facts', () => {
  const note = 'I also have a receipt.\nThe date is different.';
  assert.equal(composeFollowUp({ a: 'Paid', b: 'Filed' }, note), `Paid · Filed\n\n${note}`);
  assert.equal(composeFollowUp({ b: 'Not filed' }, note), `Not filed\n\n${note}`);
  assert.equal(composeFollowUp({}, note), note);
  assert.equal(composeFollowUp({ a: 'Paid' }, '  '), 'Paid');
  assert.equal(composeFollowUp({}, '  '), '');
});
