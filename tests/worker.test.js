import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOpenAiRequest, handleRequest } from '../worker/index.js';

const env = {
  ALLOWED_ORIGIN: 'https://ningloke.github.io',
  OPENAI_API_KEY: 'server-only-openai-key',
  AI_ACCESS_TOKEN: 'private-connection-code',
  OPENAI_MODEL: 'gpt-5.6-luna',
};

function chatRequest(token = '') {
  return new Request('https://echo.example/api/chat', {
    method: 'POST',
    headers: {
      Origin: 'https://ningloke.github.io',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      consent: true,
      ageConfirmed: true,
      webSearch: true,
      persona: { id: 'person-a', name: '小雨' },
      samples: [{ text: '好呀～' }],
      messages: [{ role: 'user', text: '今天有什么新闻？', image: 'data:image/png;base64,AAAA' }],
    }),
  });
}

test('requires a private connection code before spending API quota', async () => {
  const response = await handleRequest(chatRequest(), env, () => {
    throw new Error('OpenAI must not be called');
  });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /连接码/);
});

test('builds an isolated stateless multimodal request with web search', () => {
  const request = buildOpenAiRequest({
    webSearch: true,
    persona: { id: 'person-a', name: '小雨' },
    samples: [{ text: '好呀～' }],
    messages: [{ role: 'user', text: '看看图片', image: 'data:image/png;base64,AAAA' }],
  }, env);

  assert.equal(request.model, 'gpt-5.6-luna');
  assert.equal(request.store, false);
  assert.deepEqual(request.tools, [{ type: 'web_search' }]);
  assert.equal(request.input[0].content[1].type, 'input_image');
  assert.match(request.instructions, /小雨/);
});

test('returns the model reply and never exposes the OpenAI key to the browser', async () => {
  let sent;
  const response = await handleRequest(chatRequest(env.AI_ACCESS_TOKEN), env, async (url, init) => {
    sent = { url, init };
    return new Response(JSON.stringify({
      model: 'gpt-5.6-luna',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '这是结合上下文的回答。' }] }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  assert.equal(response.status, 200);
  const browserResponse = await response.json();
  assert.equal(browserResponse.text, '这是结合上下文的回答。');
  assert.equal(sent.url, 'https://api.openai.com/v1/responses');
  assert.equal(sent.init.headers.Authorization, `Bearer ${env.OPENAI_API_KEY}`);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://ningloke.github.io');
  assert.doesNotMatch(JSON.stringify(browserResponse), /server-only-openai-key/);
});
