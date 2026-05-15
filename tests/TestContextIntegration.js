// ─────────────────────────────────────────────
//  ContextManager + Agent 集成测试
// ─────────────────────────────────────────────
import { Agent } from '../src/Agent.js';
import { ContextManager } from '../src/ContextManager.js';

// 创建大量模拟消息
function createLargeHistory(count = 20) {
  const messages = [{ role: 'system', content: '你是量化投资分析助手' }];

  for (let i = 1; i <= count; i++) {
    messages.push({
      role: 'user',
      content: `用户第 ${i} 条消息：帮我分析股票走势，包括K线形态、技术指标、资金流向、市场情绪等多个维度的综合研判，需要详细的买入卖出建议和风险提示。`
    });
    messages.push({
      role: 'assistant',
      content: `助手第 ${i} 条回复：根据您的要求，我进行了多维度分析。从K线形态来看，当前处于上升趋势中的整理阶段；技术指标显示RSI为65，处于偏强区域；资金流向显示主力净流入约2.3亿元；综合建议在回调至支撑位时适当建仓，止损位设在支撑位下方2%。`
    });
  }

  return messages;
}

// 测试1：Token估算准确性
console.log('\n========== 测试1：大量消息Token估算 ==========');
const cm = new ContextManager({ maxTokens: 2000 });
const largeHistory = createLargeHistory(20);
const tokens = cm.estimateTokens(largeHistory);
console.log(`消息数: ${largeHistory.length}, 估算token: ${tokens}`);
console.log(`需要裁剪: ${cm.needsPrune(largeHistory)} ✓`);

// 测试2：自动裁剪
console.log('\n========== 测试2：自动裁剪 ==========');
const pruned = cm.prune(largeHistory);
console.log(`裁剪前: ${largeHistory.length} 条, 裁剪后: ${pruned.length} 条`);
console.log(`节省token: ${cm.getStats().savedTokens}`);

// 验证：检查裁剪后的消息结构
console.log('\n裁剪后消息结构检查:');
pruned.forEach((m, i) => {
  console.log(`  [${i}] ${m.role}: ${m.content?.substring(0, 50)}...`);
});

// 测试3：Agent集成
console.log('\n========== 测试3：Agent集成 ==========');
const agent = new Agent({
  name: '测试助手',
  role: '量化分析助手',
  verbose: false,
  contextManager: {
    maxTokens: 1500,
    preserveRecent: 2,
  },
});

console.log(`Agent上下文管理配置:`, agent.getContextStats().config);

// 测试4：估算工具方法
console.log('\n========== 测试4：Agent估算方法 ==========');
const estimated = agent.estimateContextTokens(largeHistory);
console.log(`Agent.estimateContextTokens(): ${estimated} tokens`);

console.log('\n✅ 集成测试完成');
