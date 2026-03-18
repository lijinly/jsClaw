// ─────────────────────────────────────────────
//  LLM 客户端封装
//  支持 OpenAI / 阿里云千问 / DeepSeek / Moonshot / Ollama 等兼容接口
// ─────────────────────────────────────────────
import OpenAI from 'openai';

// ── 预设 Provider ──────────────────────────────
export const PROVIDERS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  qwen: {
    // 阿里云百炼（通义千问）OpenAI 兼容接口
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  moonshot: {
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
  },
};

let client = null;
let currentModel = null;

/**
 * 初始化 LLM 客户端
 * 优先级顺序：
 *   1. 函数参数
 *   2. 系统环境变量 (process.env)
 *   3. .env 文件配置 (由 dotenv/config 注入)
 *   4. 默认预设值
 * 
 * @param {object} options
 * @param {string} [options.provider]  - 预设 provider 名称（qwen / openai / deepseek / moonshot / ollama）
 * @param {string} [options.apiKey]    - API Key（覆盖 .env 和系统环境变量）
 * @param {string} [options.baseURL]   - 自定义 BaseURL（覆盖 provider 预设）
 * @param {string} [options.model]     - 模型名称（覆盖默认值）
 */
export function initLLM({ provider, apiKey, baseURL, model } = {}) {
  // 读取 provider 预设
  const providerName = provider || process.env.LLM_PROVIDER || 'openai';
  const preset = PROVIDERS[providerName] ?? PROVIDERS.openai;

  // ✅ 优先读取系统环境变量，其次读取 .env 配置
  const resolvedBaseURL = baseURL || process.env.OPENAI_BASE_URL || preset.baseURL;
  const resolvedModel   = model   || process.env.MODEL_NAME      || preset.defaultModel;
  const resolvedApiKey  = apiKey  || process.env.OPENAI_API_KEY;

  // 验证 API Key
  if (!resolvedApiKey || resolvedApiKey === 'sk-no-key') {
    throw new Error(
      '❌ API Key 未配置！\n\n' +
      '请通过以下方式之一配置 OPENAI_API_KEY：\n\n' +
      '1️⃣  系统环境变量（推荐）：\n' +
      '   Windows: setx OPENAI_API_KEY "sk-xxxxx..."\n' +
      '   Linux/Mac: export OPENAI_API_KEY="sk-xxxxx..."\n\n' +
      '2️⃣  .env 文件：\n' +
      '   OPENAI_API_KEY=sk-xxxxx...\n\n' +
      '3️⃣  初始化时传入：\n' +
      '   initLLM({ apiKey: "sk-xxxxx..." })\n'
    );
  }

  client = new OpenAI({
    apiKey:  resolvedApiKey,
    baseURL: resolvedBaseURL,
  });

  currentModel = resolvedModel;

  // 显示配置信息（隐藏 API Key 的大部分字符）
  const maskedKey = resolvedApiKey.substring(0, 8) + '...' + resolvedApiKey.substring(resolvedApiKey.length - 4);
  console.log(`[LLM] Provider: ${providerName} | Model: ${resolvedModel} | API Key: ${maskedKey}`);
  
  return { provider: providerName, baseURL: resolvedBaseURL, model: resolvedModel };
}

/**
 * 发送消息，返回 assistant message 对象
 * @param {Array}  messages
 * @param {object} options
 * @param {string}   [options.model]       - 覆盖当前模型
 * @param {Array}    [options.tools]       - tool 定义列表
 * @param {boolean}  [options.stream]      - 是否流式（返回 stream 对象）
 */
export async function chat(messages, options = {}) {
  if (!client) throw new Error('请先调用 initLLM() 初始化 LLM');
  const { model = currentModel, tools, stream = false } = options;

  const params = { model, messages };
  if (tools?.length) {
    params.tools = tools;
    params.tool_choice = 'auto';
  }

  if (stream) {
    return client.chat.completions.stream(params);
  }
  const res = await client.chat.completions.create(params);
  return res.choices[0].message;
}
