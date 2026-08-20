import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 8787);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

app.use(cors());
app.use(express.json({ limit: '18mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(process.env.OPENAI_API_KEY) });
});

app.post('/api/chat', async (req, res) => {
  const { consent, persona, messages, samples = [] } = req.body ?? {};
  if (!consent) return res.status(403).json({ error: '必须明确授权后才能发送内容到 AI 服务。' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: '服务器尚未配置 OPENAI_API_KEY。' });
  if (!persona?.name || !Array.isArray(messages)) return res.status(400).json({ error: '请求格式不完整。' });

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
      instructions: `你是一个明确标示为 AI 的风格模拟助手。你的回复要参考“${persona.name}”的语言样本，学习措辞、节奏、语气和情绪表达，但绝不能声称自己就是此人，也不能虚构此人的真实经历、记忆或意愿。遇到身份问题要说明你是 AI 模拟。自然地回应用户当前内容；如果有图片，先理解图片再结合上下文作答。\n\n语言样本：\n${styleExamples || '暂无样本，请自然、简洁地回复。'}`,
      input,
    });
    res.json({ text: response.output_text, model: response.model });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || 'AI 服务暂时不可用。' });
  }
});

app.use(express.static(path.join(root, 'dist')));
app.get(/.*/, (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));

app.listen(port, () => console.log(`Echo API listening on http://localhost:${port}`));
