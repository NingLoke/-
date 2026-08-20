# 回声（Echo）

一个本地优先、明确标示为 AI 的说话风格模拟聊天应用。用户可以建立多个对话对象，导入聊天记录作为语言样本，并与 AI 进行文字和图片对话；头像、聊天、图片和本地音乐默认保存在浏览器中。

## 当前最小版本

- 新增、编辑和删除多个对话对象
- 角色硬隔离：每个角色使用独立样本、消息和图片上下文，AI 请求只包含当前角色数据
- 上传头像，导入 ZIP、TXT、LOG、JSON 或 CSV 聊天记录，并按说话人筛选语言样本
- 现代聊天界面，支持双方图片消息
- 经用户明确授权后，通过无状态后端调用支持图片理解的 OpenAI Responses API
- 真实 AI 使用前必须自我确认已满 18 岁；成熟话题仍受法律、安全和服务规则约束
- 真实 AI 可按需进行实时网页搜索，并在消息下方显示来源链接
- 未授权或未配置 API 时自动使用本地演示回答
- 导入并播放本地音乐，支持播放、暂停、上一首、下一首和播放列表
- IndexedDB 本地持久化；API 请求使用 `store: false`
- ZIP 在浏览器本地解压，仅读取聊天文本文件；压缩包最大 200 MB，最多 500 个文本文件，解压文字最多 32 MB
- 始终显示“AI 风格模拟”声明，不把 AI 描述为真人
- 明确区分本地演示与真实 AI，自动检测后端连接；未连接时禁止误开启联网模式
- 对旧版或异常本地数据进行兼容修复，并提供可恢复的错误页面，避免只显示空白

## 架构

```text
浏览器（React + Vite）
├─ IndexedDB：按角色 ID 隔离人物、样本、消息和图片；音乐为设备级播放列表
├─ 聊天记录解析器
├─ 本地音乐播放器
└─ 明确授权开关
        │ 仅在授权时
        ▼
Express 无状态网关
└─ OpenAI Responses API（文字 + 图片，store: false）
```

## 本地运行

需要 Node.js 20 或更新版本。

```bash
npm install
cp .env.example .env
npm run dev
```

打开 `http://localhost:5173`。不填写 API 密钥也可体验完整 UI 和本地数据流程。

如需联网 AI，在 `.env` 中配置：

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
VITE_API_BASE_URL=http://localhost:8787/api
```

然后在应用的“AI 与隐私”中确认状态为“真实 AI 已连接”，再主动开启。`VITE_API_BASE_URL` 是后端公开地址；API 密钥只保存在服务端 `OPENAI_API_KEY` 中，绝不能写入前端变量。

## 生产构建

```bash
npm run test
npm run build
npm start
```

默认生产服务地址为 `http://localhost:8787`，可通过 `PORT` 修改。

## Cloudflare Worker AI 后端

仓库包含 `worker/index.js` 与 `wrangler.jsonc`，可将真实 AI 网关部署到 Cloudflare Workers。Worker 会把 `OPENAI_API_KEY` 留在服务端，并要求额外的 `AI_ACCESS_TOKEN` 连接码，避免公开网页被陌生人直接消耗 API 额度。

Cloudflare 中需要配置两个加密 Secret，绝不能写进仓库：

```text
OPENAI_API_KEY   OpenAI 项目密钥
AI_ACCESS_TOKEN  由站点管理员自定的高强度连接码
```

部署完成后，把 Worker 地址加上 `/api` 作为 Pages 构建变量 `VITE_API_BASE_URL`。例如 Worker 地址为 `https://echo-ai-backend.example.workers.dev`，则前端变量应为：

```text
VITE_API_BASE_URL=https://echo-ai-backend.example.workers.dev/api
```

用户在网页的“AI 与隐私”中输入 `AI_ACCESS_TOKEN` 后才能开启真实 AI。连接码只保存在当前浏览器会话；OpenAI 密钥始终不会发送到浏览器。

## 隐私说明

导入者应确保自己有权使用相关聊天记录、头像和图片。本项目只模拟表达风格，不验证或复制真实身份，也不应被用于冒充、欺骗、骚扰或绕过他人同意。上线前建议补充身份验证、删除/导出数据功能、内容审核、速率限制与正式隐私政策。
