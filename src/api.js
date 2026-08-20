const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE = configuredBase ? configuredBase.replace(/\/$/, '') : (import.meta.env.DEV ? '/api' : '');

async function readJson(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error(`AI 服务返回了无法识别的内容（HTTP ${response.status}）。`);
  return response.json();
}

export async function checkAiConnection() {
  if (!API_BASE) return { status: 'unconfigured', label: '尚未连接 AI 后端' };
  try {
    const response = await fetch(`${API_BASE}/health`, { headers: { Accept: 'application/json' } });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data.aiConfigured
      ? { status: 'connected', label: '真实 AI 已连接' }
      : { status: 'unconfigured', label: '后端在线，但尚未配置 API 密钥' };
  } catch (error) {
    return { status: 'offline', label: 'AI 后端无法连接', detail: error.message };
  }
}

export async function requestAiReply(payload) {
  if (!API_BASE) throw new Error('当前网页尚未连接 AI 后端。');
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.error || `AI 请求失败（HTTP ${response.status}）。`);
  if (!data.text) throw new Error('AI 没有返回文字内容。');
  return data;
}
