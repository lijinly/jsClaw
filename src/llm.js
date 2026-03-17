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
 * @param {object} options
 * @param {string} [options.provider]  - 预设 provider 名称（qwen / openai / deepseek / moonshot / ollama）
 * @param {string} [options.apiKey]    - API Key（覆盖 .env）
 * @param {string} [options.baseURL]   - 自定义 BaseURL（覆盖 provider 预设）
 * @param {string} [options.model]     - 模型名称（覆盖默认值）
 */
export function initLLM({ provider, apiKey, baseURL, model } = {}) {
  // 读取 provider 预设
  const providerName = provider || process.env.LLM_PROVIDER || 'openai';
  const preset = PROVIDERS[providerName] ?? PROVIDERS.openai;

  const resolvedBaseURL = baseURL || process.env.OPENAI_BASE_URL || preset.baseURL;
  const resolvedModel   = model   || process.env.MODEL_NAME      || preset.defaultModel;
  const resolvedApiKey  = apiKey  || process.env.OPENAI_API_KEY  || 'sk-no-key';

  client = new OpenAI({
    apiKey:  resolvedApiKey,
    baseURL: resolvedBaseURL,
  });

  currentModel = resolvedModel;

  console.log(`[LLM] Provider: ${providerName} | BaseURL: ${resolvedBaseURL} | Model: ${resolvedModel}`);
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
