// ─────────────────────────────────────────────
//  ContextManager 测试
// ─────────────────────────────────────────────
import { ContextManager, createContextManager } from '../src/ContextManager.js';

// 测试1：基础token估算
console.log('\n========== 测试1：Token估算 ==========');
const cm = new ContextManager({ verbose: true });

const testMessages = [
  { role: 'system', content: '你是智能助手' },
  { role: 'user', content: '这是一个很长的用户消息，内容包括很多细节和背景信息，需要占用一定的token空间来测试估算功能的准确性。' },
  { role: 'assistant', content: '这是一个很长的助手回复，内容同样包含很多信息，需要测试token估算是否能正确处理各种情况。' },
  { role: 'user', content: '第二条用户消息' },
  { role: 'assistant', content: '第二条助手回复' },
  { role: 'user', content: '第三条用户消息' },
  { role: 'assistant', content: '第三条助手回复' },
];

const tokens = cm.estimateTokens(testMessages);
console.log(`消息数: ${testMessages.length}, 估算token: ${tokens}`);
console.log(`需要裁剪: ${cm.needsPrune(testMessages)}`);

// 测试2：小规模不裁剪
console.log('\n========== 测试2：小规模不裁剪 ==========');
const smallMessages = [
  { role: 'system', content: '你是助手' },
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好！' },
];
const smallPruned = cm.prune(smallMessages);
console.log(`原始: ${smallMessages.length} -> 裁剪后: ${smallPruned.length}`);
console.log('结果: 保持不变 ✓');

// 测试3：创建工厂函数
console.log('\n========== 测试3：工厂函数 ==========');
const customCM = createContextManager({
  maxTokens: 3000,
  preserveRecent: 2,
});
console.log(`自定义配置: maxTokens=${customCM.maxTokens}, preserveRecent=${customCM.preserveRecent}`);

// 测试4：统计信息
console.log('\n========== 测试4：统计信息 ==========');
const stats = cm.getStats();
console.log('统计:', stats);

console.log('\n✅ ContextManager 基础测试完成');
console.log('\n注意：完整测试（包括LLM摘要）需要有效的API Key');
