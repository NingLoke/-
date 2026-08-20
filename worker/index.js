const DEFAULT_ALLOWED_ORIGIN = 'https://ningloke.github.io';
const MAX_BODY_BYTES = 18 * 1024 * 1024;

function corsHeaders(request, env) {
  const requestedOrigin = request.headers.get('origin');
  const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': requestedOrigin === allowedOrigin ? requestedOrigin : allowedOrigin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request, env), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function trimText(value, maxLength) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

export function extractOutputText(response) {
  return (response?.output ?? [])
    .filter((item) => item?.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((part) => part?.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

export function extractSources(response) {
  const found = [];
  for (const item of response?.output ?? []) {
    for (const source of item?.action?.sources ?? []) {
      if (source?.url) found.push({ url: source.url, title: source.title || source.url });
    }
    for (const part of item?.content ?? []) {
      for (const annotation of part?.annotations ?? []) {
        if (annotation?.type === 'url_citation' && annotation.url) {
          found.push({ url: annotation.url, title: annotation.title || annotation.url });
        }
      }
    }
  }
  return [...new Map(found.map((source) => [source.url, source])).values()].slice(0, 6);
}

export function buildOpenAiRequest(payload, env) {
  const { webSearch = true, persona, messages, samples = [] } = payload;
  const styleExamples = samples.slice(-80)
    .map((item) => trimText(item?.text, 500))
    .filter(Boolean)
    .join('\n')
    .slice(-12000);
  const input = messages.slice(-20).map((message) => {
    const content = [];
    const text = trimText(message?.text, 8000);
    if (text) content.push({ type: 'input_text', text });
    if (typeof message?.image === 'string' && /^(data:image\/|https:\/\/)/.test(message.image)) {
      content.push({ type: 'input_image', image_url: message.image, detail: 'auto' });
    }
    if (!content.length) content.push({ type: 'input_text', text: '[空消息]' });
    return { role: message?.role === 'assistant' ? 'assistant' : 'user', content };
  });

  return {
    model: env.OPENAI_MODEL || 'gpt-5.6-luna',
    store: false,
    max_output_tokens: 1200,
    reasoning: { effort: 'low' },
    instructions: `你是一个明确标示为 AI 的风格模拟助手，当前隔离角色为“${trimText(persona.name, 120)}”（角色 ID：${trimText(persona.id, 200)}）。只根据本次请求内属于该角色的样本和消息回答，不推测、引用或混入任何其他角色的数据。学习措辞、节奏、语气和情绪表达，但绝不能声称自己就是此人，也不能虚构此人的真实经历、记忆或意愿。遇到身份问题要说明你是 AI 模拟。自然、直接、完整地回应用户当前内容；不要机械复述固定句式。需要最新信息时使用联网搜索并列出来源。如果有图片，先理解图片再结合上下文作答。用户的 18+ 确认不取消法律、安全和服务规则。\n\n当前角色语言样本：\n${styleExamples || '暂无样本，请自然、简洁地回复。'}`,
    input,
    tools: webSearch ? [{ type: 'web_search' }] : [],
    include: webSearch ? ['web_search_call.action.sources'] : [],
  };
}

export async function handleRequest(request, env, openAiFetch = fetch) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

  const url = new URL(request.url);
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/api/health')) {
    return json(request, env, {
      ok: true,
      aiConfigured: Boolean(env.OPENAI_API_KEY && env.AI_ACCESS_TOKEN),
      authRequired: true,
    });
  }
  if (request.method !== 'POST' || url.pathname !== '/api/chat') {
    return json(request, env, { error: '未找到请求的接口。' }, 404);
  }

  if (!env.OPENAI_API_KEY || !env.AI_ACCESS_TOKEN) {
    return json(request, env, { error: 'AI 后端尚未完成密钥配置。' }, 503);
  }
  if (bearerToken(request) !== env.AI_ACCESS_TOKEN) {
    return json(request, env, { error: 'AI 连接码不正确，请在“AI 与隐私”中重新填写。' }, 401);
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json(request, env, { error: '本次消息或图片过大。' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(request, env, { error: '请求内容不是有效的 JSON。' }, 400);
  }
  const { consent, ageConfirmed, persona, messages } = payload ?? {};
  if (!consent) return json(request, env, { error: '必须明确授权后才能发送内容到 AI 服务。' }, 403);
  if (!ageConfirmed) return json(request, env, { error: '使用真实 AI 前必须确认已满 18 岁。' }, 403);
  if (!persona?.id || !persona?.name || !Array.isArray(messages)) {
    return json(request, env, { error: '请求缺少独立角色标识或消息。' }, 400);
  }

  try {
    const response = await openAiFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildOpenAiRequest(payload, env)),
    });
    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || `OpenAI 请求失败（HTTP ${response.status}）。`;
      return json(request, env, { error: message }, response.status >= 500 ? 502 : response.status);
    }
    const text = extractOutputText(data);
    if (!text) return json(request, env, { error: 'AI 没有返回文字内容。' }, 502);
    return json(request, env, {
      text,
      model: data.model,
      searchedWeb: data.output?.some((item) => item.type === 'web_search_call') ?? false,
      sources: extractSources(data),
    });
  } catch (error) {
    return json(request, env, { error: error?.message || 'AI 服务暂时不可用。' }, 502);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
