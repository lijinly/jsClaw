#!/usr/bin/env node

import 'dotenv/config';
import { initLLM } from './src/llm.js';

console.log('\n🧪 API Key 配置测试\n');
console.log('════════════════════════════════════════\n');

try {
  // 测试从系统环境变量读取
  console.log('测试 1️⃣  优先读取系统环境变量...\n');
  
  const config = initLLM();
  
  console.log('\n✅ 成功！配置信息：');
  console.log(`   Provider: ${config.provider}`);
  console.log(`   Model: ${config.model}`);
  console.log(`   BaseURL: ${config.baseURL}`);
  
  console.log('\n════════════════════════════════════════\n');
  console.log('✨ 环境变量配置验证通过！\n');
  
  process.exit(0);
} catch (err) {
  console.error('\n❌ 配置失败：');
  console.error(err.message);
  console.error('\n════════════════════════════════════════\n');
  process.exit(1);
}
