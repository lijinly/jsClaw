// 调试 LLM 调用（放在项目根目录，方便直接运行）
import 'dotenv/config';
import { initLLM, chat } from './src/Llm.js';

console.log('=== LLM 配置诊断 ===');
console.log('Provider:', process.env.LLM_PROVIDER || '(未设置，使用默认 openai)');
console.log('Model:', process.env.MODEL_NAME || '(未设置，使用 provider 默认)');
console.log('API Key:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0,8)+'...' : '❌ 未设置');

console.log('\n=== 初始化 LLM ===');
let cfg;
try {
  cfg = initLLM();
  console.log('✅ 初始化成功:', cfg);
} catch (err) {
  console.error('❌ 初始化失败:', err.message);
  process.exit(1);
}

console.log('\n=== 发送测试消息 ===');
const messages = [
  { role: 'user', content: '你好，请回复"LLM调通"四个字。' }
];

try {
  const response = await chat(messages, { model: cfg.model });
  console.log('✅ LLM 返回:', response.content);
} catch (err) {
  console.error('❌ LLM 调用失败:', err.message);
  if (err.status) console.error('   HTTP Status:', err.status);
  if (err.code)   console.error('   Error Code:', err.code);
  process.exit(1);
}
