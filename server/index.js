import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSources } from './response-utils.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

app.use(cors());
app.use(express.json({ limit: '18mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(process.env.OPENAI_API_KEY) });
});

app.post('/api/chat', async (req, res) => {
  const { consent, ageConfirmed, webSearch = true, persona, messages, samples = [] } = req.body ?? {};
  if (!consent) return res.status(403).json({ error: '必须明确授权后才能发送内容到 AI 服务。' });
  if (!ageConfirmed) return res.status(403).json({ error: '使用真实 AI 前必须确认已满 18 岁。' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: '服务器尚未配置 OPENAI_API_KEY。' });
  if (!persona?.id || !persona?.name || !Array.isArray(messages)) return res.status(400).json({ error: '请求缺少独立角色标识或消息。' });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const styleExamples = samples.slice(-80).map((item) => item.text).filter(Boolean).join('\n');
    const input = messages.slice(-20).map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: [
        ...(message.text ? [{ type: 'input_text', text: message.text }] : []),
        ...(message.image ? [{ type: 'input_image', image_url: message.image, detail: 'auto' }] : []),
      ],
    }));

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      store: false,
      instructions: `你是一个明确标示为 AI 的风格模拟助手，当前隔离角色为“${persona.name}”（角色 ID：${persona.id}）。只根据本次请求内属于该角色的样本和消息回答，不推测、引用或混入任何其他角色的数据。学习措辞、节奏、语气和情绪表达，但绝不能声称自己就是此人，也不能虚构此人的真实经历、记忆或意愿。遇到身份问题要说明你是 AI 模拟。尽可能直接、完整地回答广泛问题，包括成熟、敏感或有争议的话题；用户的 18+ 确认不取消法律、安全和服务规则。需要最新信息时使用联网搜索，并清楚区分事实与推测。自然地回应用户当前内容；如果有图片，先理解图片再结合上下文作答。\n\n当前角色语言样本：\n${styleExamples || '暂无样本，请自然、简洁地回复。'}`,
      input,
      tools: webSearch ? [{ type: 'web_search' }] : [],
      include: webSearch ? ['web_search_call.action.sources'] : [],
    });
    res.json({ text: response.output_text, model: response.model, searchedWeb: response.output?.some((item) => item.type === 'web_search_call') ?? false, sources: extractSources(response) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || 'AI 服务暂时不可用。' });
  }
});

app.use(express.static(path.join(root, 'dist')));
app.get(/.*/, (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));

app.listen(port, () => console.log(`Echo API listening on http://localhost:${port}`));
