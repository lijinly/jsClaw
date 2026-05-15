// ─────────────────────────────────────────────
//  jsClaw 测试套件入口
// ─────────────────────────────────────────────
// 运行: node src/tests/run-all.js

import { runTests } from './test-runner.js';

// 测试文件列表
const testFiles = [
  { name: 'ContextManager 基础测试', file: './test-context-manager.js' },
  { name: 'ContextManager 大规模测试', file: './test-context-large.js' },
  { name: 'ContextManager + Agent 集成', file: './test-context-integration.js' },
  { name: 'GoalTracker 基础测试', file: './test-goal-tracker.js' },
  { name: 'GoalTracker + Agent 集成', file: './test-goal-agent-integration.js' },
];

console.log('╔════════════════════════════════════════════╗');
console.log('║         jsClaw 测试套件                      ║');
console.log('╚════════════════════════════════════════════╝\n');

runTests(testFiles);
