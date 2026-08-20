import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSources } from '../server/response-utils.js';

test('extracts and deduplicates web-search sources', () => {
  const sources = extractSources({ output: [
    { type: 'web_search_call', action: { sources: [{ url: 'https://example.com/a', title: 'A' }] } },
    { type: 'message', content: [{ annotations: [
      { type: 'url_citation', url: 'https://example.com/a', title: 'A duplicate' },
      { type: 'url_citation', url: 'https://example.com/b', title: 'B' },
    ] }] },
  ] });
  assert.deepEqual(sources, [
    { url: 'https://example.com/a', title: 'A' },
    { url: 'https://example.com/b', title: 'B' },
  ]);
});
