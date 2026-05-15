// ─────────────────────────────────────────────
//  ContextManager 大规模裁剪测试（模拟真实场景）
// ─────────────────────────────────────────────
import { ContextManager } from '../ContextManager.js';

// 创建真实规模的消息（模拟实际使用场景）
function createRealisticHistory(rounds = 30) {
  const messages = [
    { role: 'system', content: `你是专业的量化投资分析助手。
你的职责是：
1. 分析宏观经济数据和政策导向
2. 分析市场结构和资金流向
3. 评估策略表现并给出优化建议
4. 提供仓位管理和风险控制建议
5. 生成专业的量化研究报告

请使用专业术语，保持分析的客观性和准确性。` }
  ];

  const topics = [
    '分析当前A股市场的整体走势，重点关注上证指数和创业板指的分化情况',
    '帮我分析新能源板块的资金流向，包括北向资金和主力资金的动向',
    '请评估我当前的趋势跟踪策略表现，给出优化建议',
    '分析美联储加息对A股市场的潜在影响',
    '帮我扫描技术面出现突破信号的股票',
  ];

  for (let i = 1; i <= rounds; i++) {
    const topic = topics[i % topics.length];
    messages.push({
      role: 'user',
      content: `【问题 ${i}】${topic}

详细说明：需要从多个维度进行分析，包括但不限于技术指标、基本面、资金面、市场情绪等。请给出具体的分析结论和操作建议，附上可能的风险提示。`
    });
    messages.push({
      role: 'assistant',
      content: `【分析 ${i}】

技术面分析：
- K线形态：当前处于上升趋势中的整理阶段
- MACD：快线穿越慢线形成金叉信号
- RSI：读数为58，处于偏强区域但未超买
- 成交量：较前一交易日放大23%

资金面分析：
- 主力净流入：+2.35亿元
- 北向资金：+18.6亿元
- 融资融券：融资余额增加

基本面简评：
- 行业景气度维持高位
- 估值处于历史中枢水平
- 业绩预期稳健

综合建议：维持中性偏多判断，建议在回调至支撑位时适当建仓。
风险提示：注意外围市场波动风险，建议控制仓位在60%以下。`
    });
  }

  return messages;
}

// 测试场景：使用更低的阈值来触发裁剪
console.log('========== 大规模裁剪测试 ==========\n');

const cm = new ContextManager({
  maxTokens: 500,  // 低阈值，强制触发裁剪
  preserveRecent: 2,
  verbose: true,
});

const history = createRealisticHistory(30);
console.log(`\n📊 原始消息:`);
console.log(`  消息数: ${history.length}`);
console.log(`  估算token: ${cm.estimateTokens(history)}`);
console.log(`  阈值: ${cm.maxTokens}`);
console.log(`  需要裁剪: ${cm.needsPrune(history) ? '是 ✓' : '否'}`);

if (cm.needsPrune(history)) {
  console.log('\n📝 开始裁剪...');
  const pruned = cm.prune(history);

  console.log(`\n📊 裁剪后消息:`);
  console.log(`  消息数: ${pruned.length} (减少 ${history.length - pruned.length} 条)`);
  console.log(`  估算token: ${cm.estimateTokens(pruned)}`);

  console.log('\n📋 消息结构:');
  pruned.forEach((m, i) => {
    const preview = m.content?.substring(0, 60).replace(/\n/g, ' ') || '[tool_calls]';
    console.log(`  [${i.toString().padStart(2)}] ${m.role.padEnd(10)} ${preview}...`);
  });

  console.log('\n📈 统计信息:');
  console.log(cm.getStats());
}

console.log('\n✅ 测试完成');
