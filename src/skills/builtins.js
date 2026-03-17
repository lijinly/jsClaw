// ─────────────────────────────────────────────
//  内置 Skills —— 开箱即用的示例技能
// ─────────────────────────────────────────────
import { registerSkill } from '../skillRegistry.js';

// ① 数学计算
registerSkill({
  name: 'calculate',
  description: '执行基础数学运算（加减乘除）',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: '数学表达式，例如 "3 * (4 + 2)"' },
    },
    required: ['expression'],
  },
  async execute({ expression }) {
    // 安全地只允许数字和运算符
    if (!/^[\d\s+\-*/().]+$/.test(expression)) throw new Error('非法表达式');
    // eslint-disable-next-line no-eval
    return String(eval(expression));
  },
});

// ② 获取当前时间
registerSkill({
  name: 'get_current_time',
  description: '获取当前本地日期和时间',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
  },
});

// ③ 网络搜索（占位，可替换为真实 API）
registerSkill({
  name: 'web_search',
  description: '根据关键词搜索互联网信息（模拟）',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
    },
    required: ['query'],
  },
  async execute({ query }) {
    // 真实场景可接入 Bing / Tavily / SerpAPI 等
    return `[模拟搜索结果] 关于 "${query}" 的搜索结果：这里是示例数据，请替换为真实搜索 API。`;
  },
});
