# jsClaw — 极简 LLM + Skill 集成框架

一个轻量、可扩展的 Agent 框架，让 LLM 能够调用自定义技能（Skills）。

## 项目结构

```
jsClaw/
├── src/
│   ├── index.js          # 交互式命令行入口
│   ├── demo.js           # 本地 Skill 演示（无需 API Key）
│   ├── llm.js            # LLM 客户端封装
│   ├── agent.js          # Agent 核心（LLM + Skill 循环）
│   └── skills/
│       └── builtins.js   # 内置技能（计算 / 时间 / 搜索）
├── .env                  # API Key 配置
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

编辑 `.env`，填入你的 LLM API Key：

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1   # 可换成 DeepSeek / Moonshot 等兼容接口
MODEL_NAME=gpt-4o-mini
```

### 3. 运行

```bash
# 启动交互式 Agent（需要 API Key）
npm start

# 本地 Skill 演示（不需要 API Key）
npm run demo
```

## 添加自定义 Skill

```js
import { registerSkill } from './src/skillRegistry.js';

registerSkill({
  name: 'my_skill',
  description: 'LLM 看到这段描述后知道什么时候调用它',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: '输入内容' },
    },
    required: ['input'],
  },
  async execute({ input }) {
    return `处理结果: ${input}`;
  },
});
```

## 兼容的 LLM 服务

| 服务        | BASE_URL                                 | 模型示例         |
|------------|------------------------------------------|-----------------|
| OpenAI     | https://api.openai.com/v1                | gpt-4o-mini     |
| DeepSeek   | https://api.deepseek.com/v1              | deepseek-chat   |
| Moonshot   | https://api.moonshot.cn/v1               | moonshot-v1-8k  |
| Ollama     | http://localhost:11434/v1                | llama3          |
