// ─────────────────────────────────────────────
//  Think-Act 模式演示
// ─────────────────────────────────────────────
import 'dotenv/config';
import { initLLM } from './llm.js';
import { runAgentWithThink } from './agent.js';
import './skills/builtins.js';

initLLM();

console.log('═══════════════════════════════════════════════════════════');
console.log('🧠 jsClaw Think-Act 模式演示');
console.log('═══════════════════════════════════════════════════════════\n');

const systemPrompt = `你是一个数据分析助手。
- 当用户要求计算时，先分解问题，然后使用 calculate 工具
- 需要时查询当前时间，使用 get_current_time 工具
- 如果需要信息，使用 web_search 工具
- 最后综合所有信息给出完整答案`;

const testQueries = [
  '帮我算一下 (25 + 15) * 3 - 20，然后告诉我现在是几点',
  '用 (100 + 50) / 2 计算平均值，并查一下数据',
];

(async () => {
  for (const query of testQueries) {
    console.log(`\n📝 用户问题: "${query}"\n`);

    try {
      const { thinking, actions, result } = await runAgentWithThink(query, {
        systemPrompt,
        verbose: true,
      });

      console.log('\n📋 [最终结果]\n', result);
      console.log('\n' + '─'.repeat(60) + '\n');
    } catch (err) {
      console.error('❌ 出错:', err.message);
    }
  }

  console.log('✅ 演示完成！');
})();
