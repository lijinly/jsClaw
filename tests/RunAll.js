// ─────────────────────────────────────────────
//  jsClaw 测试套件入口
// ─────────────────────────────────────────────
// 运行: node tests/RunAll.js

import { runTests } from './TestRunner.js';

// 测试文件列表
const testFiles = [
  { name: 'ContextManager 基础测试', file: './TestContextManager.js' },
  { name: 'ContextManager 大规模测试', file: './TestContextLarge.js' },
  { name: 'ContextManager + Agent 集成', file: './TestContextIntegration.js' },
  { name: 'GoalTracker 基础测试', file: './TestGoalTracker.js' },
  { name: 'GoalTracker + Agent 集成', file: './TestGoalAgentIntegration.js' },
];

console.log('╔════════════════════════════════════════════╗');
console.log('║         jsClaw 测试套件                      ║');
console.log('╚════════════════════════════════════════════╝\n');

runTests(testFiles);
