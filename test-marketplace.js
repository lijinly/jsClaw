#!/usr/bin/env node
// 验证 Skill 市场自动加载功能
import 'dotenv/config';
import './src/skills/builtins.js';
import { loadInstalledSkills } from './src/marketplace.js';
import { getToolDefinitions } from './src/skillRegistry.js';

console.log('\n🧪 Skill 市场 - 插件加载测试\n');
console.log('── 加载内置技能 & 插件 ─────────────────────');

await loadInstalledSkills();

console.log('\n── 当前已注册的所有 Skill ──────────────────');
const tools = getToolDefinitions();
for (const t of tools) {
  console.log(`  ✅ ${t.function.name.padEnd(20)} ${t.function.description.slice(0, 40)}`);
}

console.log(`\n共 ${tools.length} 个 Skill 已就绪\n`);
