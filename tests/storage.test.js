import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState } from '../src/storage.js';

test('normalizes incomplete legacy state without crashing the UI', () => {
  assert.deepEqual(normalizeState({ people: null, messages: [], tracks: 'bad', selectedId: 'missing' }), {
    people: [], messages: {}, tracks: [], selectedId: null,
  });
});

test('repairs missing collections and invalid selection in saved state', () => {
  const state = normalizeState({
    people: [{ id: 'p1', name: '小雨' }],
    messages: { p1: [null, 'bad', { id: 'm1', text: 'hello' }] },
    tracks: [{ id: 't1', name: 'song' }, null],
    selectedId: 'deleted-person',
  });
  assert.equal(state.selectedId, 'p1');
  assert.deepEqual(state.people[0].samples, []);
  assert.equal(state.messages.p1.length, 1);
  assert.equal(state.tracks.length, 1);
});
