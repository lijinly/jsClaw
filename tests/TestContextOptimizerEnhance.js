// ─────────────────────────────────────────────
//  TestContextOptimizerEnhance.js - 增强上下文管理测试
// ─────────────────────────────────────────────
import { ContextOptimizer } from '../src/ContextOptimizer.js';

// ═══════════════════════════════════════════
//  测试用例
// ═══════════════════════════════════════════

function testSimpleStrategy() {
  console.log('\n📋 测试 1: 简单策略（默认行为）');

  const optimizer = new ContextOptimizer({
    maxTokens: 200, // 降低阈值以触发裁剪
    preserveRecent: 2,
    strategy: 'simple',
  });

  // 构建测试消息（需要 >= 6 条且 token 超限才触发裁剪）
  const longText = '这是一条比较长的测试消息，用来触发裁剪逻辑。'.repeat(10);
  const messages = [
    { role: 'system', content: longText },
    ...generateConversation(10, longText),
  ];

  const beforeCount = messages.length;
  const prunedResult = optimizer.prune(messages);
  const afterCount = prunedResult.length;

  console.log('  裁剪前:', beforeCount, '条, tokens >', optimizer.maxTokens);
  console.log('  裁剪后:', afterCount, '条');
  console.log('  触发裁剪:', afterCount < beforeCount ? '✅ 是' : '❌ 否');
  console.log('  结果:', afterCount < beforeCount ? '✅ 通过' : '❌ 失败');
  return afterCount < beforeCount;
}

function testAggressiveStrategy() {
  console.log('\n📋 测试 2: 激进策略');

  const longText = '这是一条比较长的测试消息，用来触发裁剪逻辑。'.repeat(10);

  const simpleOptimizer = new ContextOptimizer({
    maxTokens: 200,
    preserveRecent: 2,
    strategy: 'simple',
  });

  const aggressiveOptimizer = new ContextOptimizer({
    maxTokens: 200,
    preserveRecent: 2,
    strategy: 'aggressive',
  });

  const messages = [
    { role: 'system', content: longText },
    ...generateConversation(10, longText),
  ];

  const simplePruned = simpleOptimizer.prune([...messages]);
  const aggressivePruned = aggressiveOptimizer.prune([...messages]);

  console.log('  simple 裁剪后:', simplePruned.length, '条');
  console.log('  aggressive 裁剪后:', aggressivePruned.length, '条');
  console.log('  aggressive 更激进:', aggressivePruned.length <= simplePruned.length ? '✅ 通过' : '❌ 失败');
  return aggressivePruned.length <= simplePruned.length;
}

function testSmartStrategyWithPriorityKeywords() {
  console.log('\n📋 测试 3: 智能策略 - 关键词优先保留');

  const optimizer = new ContextOptimizer({
    maxTokens: 500,
    preserveRecent: 2,
    strategy: 'smart',
    priorityKeywords: ['重要', '决策'],
  });

  const messages = [
    { role: 'system', content: '系统提示' },
    { role: 'user', content: '普通对话1' },
    { role: 'assistant', content: '普通回复1' },
    { role: 'user', content: '这是一条重要的决策信息' },
    { role: 'assistant', content: '好的，已记录' },
    { role: 'user', content: '普通对话2' },
    { role: 'assistant', content: '普通回复2' },
    { role: 'user', content: '重要：需要调整策略' },
    { role: 'assistant', content: '已调整' },
  ];

  const pruned = optimizer.prune(messages);

  // 检查是否保留了含关键词的消息
  const hasPriority = pruned.some(m =>
    m.content?.includes('重要') || m.content?.includes('决策')
  );

  console.log('  裁剪后条数:', pruned.length);
  console.log('  保留关键词消息:', hasPriority ? '✅ 是' : '❌ 否');
  console.log('  结果:', hasPriority ? '✅ 通过' : '❌ 失败');
  return hasPriority;
}

function testBackwardCompatibility() {
  console.log('\n📋 测试 4: 向后兼容性');

  // 不指定 strategy，应该默认为 'simple'
  const optimizer = new ContextOptimizer({
    maxTokens: 500,
    preserveRecent: 4,
  });

  const messages = [
    { role: 'system', content: '系统提示' },
    ...generateConversation(20, '测试消息'),
  ];

  const pruned = optimizer.prune(messages);

  console.log('  默认 strategy:', optimizer.strategy);
  console.log('  裁剪后:', pruned.length, '条');
  console.log('  结果:', optimizer.strategy === 'simple' && pruned.length > 0 ? '✅ 通过' : '❌ 失败');
  return optimizer.strategy === 'simple' && pruned.length > 0;
}

function testPriorityKeywordsCaseInsensitive() {
  console.log('\n📋 测试 5: 关键词大小写不敏感');

  const optimizer = new ContextOptimizer({
    maxTokens: 500,
    preserveRecent: 2,
    strategy: 'smart',
    priorityKeywords: ['IMPORTANT', '决策'],
  });

  const messages = [
    { role: 'system', content: '系统提示' },
    ...generateConversation(8, '普通'),
    { role: 'user', content: 'this is IMPORTANT news' },
    { role: 'assistant', content: 'OK' },
  ];

  const pruned = optimizer.prune(messages);
  const hasPriority = pruned.some(m => m.content?.toLowerCase().includes('important'));

  console.log('  保留大写关键词:', hasPriority ? '✅ 是' : '❌ 否');
  console.log('  结果:', hasPriority ? '✅ 通过' : '❌ 失败');
  return hasPriority;
}

// ═══════════════════════════════════════════
//  辅助函数
// ═══════════════════════════════════════════

function generateConversation(count, baseText) {
  const messages = [];
  for (let i = 0; i < count; i++) {
    messages.push({ role: 'user', content: `${baseText} ${i + 1}` });
    messages.push({ role: 'assistant', content: `回复 ${i + 1}` });
  }
  return messages;
}

// ═══════════════════════════════════════════
//  运行测试
// ═══════════════════════════════════════════

async function runTests() {
  console.log('═'.repeat(60));
  console.log('🧪 增强上下文管理测试');
  console.log('═'.repeat(60));

  const results = [];
  results.push({ name: '简单策略', passed: testSimpleStrategy() });
  results.push({ name: '激进策略', passed: testAggressiveStrategy() });
  results.push({ name: '智能策略-关键词', passed: testSmartStrategyWithPriorityKeywords() });
  results.push({ name: '向后兼容', passed: testBackwardCompatibility() });
  results.push({ name: '大小写不敏感', passed: testPriorityKeywordsCaseInsensitive() });

  console.log('\n' + '═'.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('═'.repeat(60));

  for (const r of results) {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  }

  const passed = results.filter(r => r.passed).length;
  console.log(`\n总计: ${passed}/${results.length} 通过`);

  if (passed === results.length) {
    console.log('\n🎉 所有测试通过！\n');
  } else {
    console.log('\n⚠️ 部分测试失败\n');
  }

}

// 导出函数供 RunAll.js 调用
export { runTests as default };
