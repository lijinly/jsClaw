// ─────────────────────────────────────────────
//  jsClaw 测试套件入口
// ─────────────────────────────────────────────
// 运行: node tests/RunAll.js

import { runTests } from './TestRunner.js';

// 测试文件列表
const testFiles = [
  { name: 'ContextOptimizer 基础测试', file: './TestContextManager.js' },
  { name: 'ContextOptimizer 大规模测试', file: './TestContextLarge.js' },
  { name: 'ContextOptimizer + Agent 集成', file: './TestContextIntegration.js' },
  { name: 'ContextOptimizer 增强功能测试', file: './TestContextOptimizerEnhance.js' },
  { name: 'SkillRegistry 验证机制测试', file: './TestSkillValidation.js' },
  { name: 'Manager 错误处理测试', file: './TestErrorHandling.js' },
  { name: 'GoalTracker 基础测试', file: './TestGoalTracker.js' },
  { name: 'GoalTracker + Agent 集成', file: './TestGoalAgentIntegration.js' },
  { name: 'Goal DAG 系统测试', file: './TestGoalDag.js' },
];

console.log('╔════════════════════════════════════════════╗');
console.log('║         jsClaw 测试套件                      ║');
console.log('╚════════════════════════════════════════════╝\n');

runTests(testFiles)
  .then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('测试运行异常:', err.message);
    process.exit(1);
  });
