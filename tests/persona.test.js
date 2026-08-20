import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonaPayload } from '../src/persona.js';

test('AI payload contains only the selected persona samples and messages', () => {
  const alice = { id: 'alice', name: 'Alice', samples: [{ text: 'Alice style' }] };
  const payload = buildPersonaPayload(alice, {
    alice: [{ id: 'a1', text: 'Alice history' }],
    bob: [{ id: 'b1', text: 'Bob secret history' }],
  }, { id: 'a2', text: 'new message' }, { ageConfirmed: true });
  assert.deepEqual(payload.persona, { id: 'alice', name: 'Alice' });
  assert.deepEqual(payload.samples, [{ text: 'Alice style' }]);
  assert.deepEqual(payload.messages.map((item) => item.id), ['a1', 'a2']);
  assert.equal(payload.ageConfirmed, true);
  assert.equal(payload.webSearch, true);
  assert.equal(JSON.stringify(payload).includes('Bob secret history'), false);
});

test('rejects payload creation without a selected persona', () => {
  assert.throws(() => buildPersonaPayload(null, {}, {}), /没有选择/);
});
