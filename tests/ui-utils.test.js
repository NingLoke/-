import assert from 'node:assert/strict';
import test from 'node:test';

import { scrollConversationToBottom } from '../src/ui-utils.js';

test('never returns a browser scroll result that React could treat as an effect cleanup', () => {
  const browserResult = Promise.resolve();
  const calls = [];
  const element = {
    scrollIntoView(options) {
      calls.push(options);
      return browserResult;
    },
  };

  assert.equal(scrollConversationToBottom(element), undefined);
  assert.deepEqual(calls, [{ behavior: 'smooth', block: 'end' }]);
});

test('is safe before the conversation anchor is mounted', () => {
  assert.doesNotThrow(() => scrollConversationToBottom(null));
});
