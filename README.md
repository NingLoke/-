# 回声（Echo）

一个本地优先、明确标示为 AI 的说话风格模拟聊天应用。用户可以建立多个对话对象，导入聊天记录作为语言样本，并与 AI 进行文字和图片对话；头像、聊天、图片和本地音乐默认保存在浏览器中。

## 当前最小版本

- 新增、编辑和删除多个对话对象
- 上传头像，导入 TXT 聊天记录并按说话人筛选语言样本
- 现代聊天界面，支持双方图片消息
- 经用户明确授权后，通过无状态后端调用支持图片理解的 OpenAI Responses API
- 未授权或未配置 API 时自动使用本地演示回答
- 导入并播放本地音乐，支持播放、暂停、上一首、下一首和播放列表
- IndexedDB 本地持久化；API 请求使用 `store: false`
- 始终显示“AI 风格模拟”声明，不把 AI 描述为真人

## 架构

```text
浏览器（React + Vite）
├─ IndexedDB：人物、样本、消息、图片、音乐
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
```

然后在应用的“隐私设置”中主动开启联网 AI。密钥只保存在服务端环境变量中，不能写入前端。

## 生产构建

```bash
npm run test
npm run build
npm start
```

默认生产服务地址为 `http://localhost:8787`，可通过 `PORT` 修改。

## 隐私说明

导入者应确保自己有权使用相关聊天记录、头像和图片。本项目只模拟表达风格，不验证或复制真实身份，也不应被用于冒充、欺骗、骚扰或绕过他人同意。上线前建议补充身份验证、删除/导出数据功能、内容审核、速率限制与正式隐私政策。
