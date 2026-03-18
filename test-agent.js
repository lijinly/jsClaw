#!/usr/bin/env node

import 'dotenv/config';
import { initLLM } from './src/llm.js';
import { runAgentWithThink } from './src/agent.js';
import './src/skills/builtins.js';

console.log('\n🧪 jsClaw Agent 测试\n');

// 初始化 LLM
const config = initLLM();
console.log(`✅ LLM 已初始化\n`);

// 测试一个简单的问题
try {
  console.log('📝 测试问题：现在是什么时间？\n');
  const { thinking, actions, result } = await runAgentWithThink(
    '现在是什么时间？',
    { verbose: true }
  );
  
  console.log('\n✅ 测试成功！');
  console.log(`\n最终答案：${result}`);
  
} catch (err) {
  console.error('\n❌ 测试失败：');
  console.error(err.message);
  if (err.response?.data) {
    console.error('API 错误详情：', err.response.data);
  }
}
