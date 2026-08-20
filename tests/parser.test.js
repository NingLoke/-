import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChatRecord } from '../src/parser.js';

test('parses common dated chat records and filters the target speaker', () => {
  const text = '[2026/08/20 10:30] 小雨: 早呀\n[2026/08/20 10:31] 我: 早\n小雨：今天有空吗？';
  const result = parseChatRecord(text, '小雨');
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.text), ['早呀', '今天有空吗？']);
});

test('keeps multiline message continuations', () => {
  const result = parseChatRecord('Alex: first line\nsecond line');
  assert.equal(result[0].text, 'first line\nsecond line');
});
