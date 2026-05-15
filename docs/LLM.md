# LLM 客户端配置

> 支持 OpenAI / 阿里云千问 / DeepSeek / Moonshot / Ollama 等主流 LLM API

## 快速配置

```javascript
import { initLLM, chat } from './Llm.js';

// 初始化（自动读取 .env）
initLLM();

// 发送消息
const response = await chat([
  { role: 'system', content: '你是助手' },
  { role: 'user', content: '你好' },
]);
console.log(response.content);
```

## 配置方式（优先级从高到低）

| 优先级 | 方式 | 示例 |
|--------|------|------|
| 1 | 函数参数 | `initLLM({ apiKey: 'sk-xxx' })` |
| 2 | 环境变量 | `process.env.OPENAI_API_KEY` |
| 3 | .env 文件 | `OPENAI_API_KEY=sk-xxx` |
| 4 | 预设默认值 | 详见下表 |

## Provider 预设

### 阿里云千问（推荐）

```javascript
// .env
LLM_PROVIDER=qwen
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen-plus

// 或代码中
initLLM({ provider: 'qwen' });
```

### OpenAI

```javascript
// .env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
MODEL_NAME=gpt-4o-mini

// 或代码中
initLLM({ provider: 'openai' });
```

### DeepSeek

```javascript
// .env
LLM_PROVIDER=deepseek
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.deepseek.com/v1
MODEL_NAME=deepseek-chat
```

### Moonshot

```javascript
// .env
LLM_PROVIDER=moonshot
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.moonshot.cn/v1
MODEL_NAME=moonshot-v1-8k
```

### Ollama（本地）

```javascript
// .env
LLM_PROVIDER=ollama
OPENAI_API_KEY=sk-no-key
OPENAI_BASE_URL=http://localhost:11434/v1
MODEL_NAME=llama3
```

## API 详解

### initLLM(options)

初始化 LLM 客户端

```javascript
initLLM({
  provider: 'qwen',       // 预设名称
  apiKey: 'sk-xxx',       // API Key（覆盖其他来源）
  baseURL: 'https://...', // 自定义 BaseURL（覆盖预设）
  model: 'qwen-plus',     // 模型名称（覆盖预设）
});
```

**返回值：**

```javascript
{
  provider: 'qwen',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen-plus',
}
```

### chat(messages, options)

发送消息，返回 assistant message

```javascript
const response = await chat(messages, {
  model: 'qwen-plus',     // 覆盖当前模型
  tools: [...],           // 工具定义
  stream: false,          // 流式输出
});
```

**参数：**

```javascript
// messages 格式
[
  { role: 'system', content: '你是助手' },
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好，有什么可以帮你的？' },
  { role: 'user', content: '解释一下什么是 AI' },
]

// 返回
{
  role: 'assistant',
  content: 'AI 是...',
  tool_calls?: [...],     // 如果 LLM 调用了工具
}
```

### 流式输出

```javascript
const stream = await chat(messages, { stream: true, tools: [...] });

for await (const chunk of stream) {
  console.log(chunk.choices[0]?.delta?.content);
}
```

## Provider 预设表

| Provider | BaseURL | 默认模型 |
|----------|---------|----------|
| `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| `qwen` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| `deepseek` | `https://api.deepseek.com/v1` | `deepseek-chat` |
| `moonshot` | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| `ollama` | `http://localhost:11434/v1` | `llama3` |

## .env 配置示例

```bash
# LLM 配置
LLM_PROVIDER=qwen
OPENAI_API_KEY=sk-45d478ddd7b94b0d838d9fce6f1e3762
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen-plus

# 可选配置
NODE_FETCH_REJECT_UNAUTHORIZED=false
PORT=3000
```

## 错误处理

```javascript
import { initLLM, chat } from './Llm.js';

try {
  initLLM();
  
  const response = await chat([
    { role: 'user', content: '你好' },
  ]);
  
  console.log(response.content);
} catch (error) {
  if (error.message.includes('API Key')) {
    console.error('请配置 OPENAI_API_KEY');
  } else if (error.message.includes('rate limit')) {
    console.error('请求过于频繁，请稍后重试');
  } else {
    console.error('其他错误:', error.message);
  }
}
```

## 调试

```bash
# 运行时查看配置
node -e "
import('./src/Llm.js').then(m => {
  m.initLLM();
  console.log('LLM 客户端已初始化');
});
"
```

## 测试

```bash
node tests/TestLlm.js
```
