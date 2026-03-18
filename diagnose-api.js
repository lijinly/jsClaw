#!/usr/bin/env node

import 'dotenv/config';

console.log('═══════════════════════════════════════════');
console.log('API Key 诊断报告');
console.log('═══════════════════════════════════════════\n');

// 检查环境变量
const apiKey = process.env.OPENAI_API_KEY;
const provider = process.env.LLM_PROVIDER;
const modelName = process.env.MODEL_NAME;
const baseURL = process.env.OPENAI_BASE_URL;

console.log('📋 环境变量检查：');
console.log(`  LLM_PROVIDER: ${provider || '(未设置，默认: openai)'}`);
console.log(`  MODEL_NAME: ${modelName || '(未设置)'}`);
console.log(`  OPENAI_BASE_URL: ${baseURL || '(未设置，使用 Provider 预设)'}`);
console.log(`  OPENAI_API_KEY: ${apiKey ? `已设置 (${apiKey.substring(0, 8)}...)` : '❌ 未设置'}\n`);

if (!apiKey) {
  console.log('⚠️  问题：OPENAI_API_KEY 环境变量未设置！\n');
  console.log('📌 解决方案：\n');
  console.log('1️⃣  方式一：直接在 .env 文件中设置（临时）');
  console.log('   编辑 .env，取消注释并填入：');
  console.log('   OPENAI_API_KEY=sk-45d478ddd7b94b0d838d9fce6f1e3762\n');
  
  console.log('2️⃣  方式二：设置系统环境变量（永久）');
  console.log('   Windows PowerShell：');
  console.log('   $env:OPENAI_API_KEY = "sk-45d478ddd7b94b0d838d9fce6f1e3762"\n');
  
  console.log('3️⃣  方式三：重新设置（如果之前设置过）');
  console.log('   setx OPENAI_API_KEY sk-45d478ddd7b94b0d838d9fce6f1e3762\n');
  
  process.exit(1);
}

console.log('✅ API Key 已找到！\n');

// 验证 API Key 格式
if (!apiKey.startsWith('sk-')) {
  console.log('⚠️  警告：API Key 格式可能不正确');
  console.log(`   期望格式：sk-xxxxx...`);
  console.log(`   实际格式：${apiKey.substring(0, 20)}...\n`);
}

console.log('🔍 API Key 详情：');
console.log(`  长度：${apiKey.length} 字符`);
console.log(`  前缀：${apiKey.substring(0, 5)}`);
console.log(`  后缀：${apiKey.substring(apiKey.length - 5)}`);
console.log(`  格式：${apiKey.startsWith('sk-') ? '✅ 正确' : '❌ 异常'}\n`);

console.log('═══════════════════════════════════════════');
