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

// ③ 网络搜索 —— 使用 open-websearch
// 多搜索引擎支持：Bing、DuckDuckGo、Baidu、CSDN、Brave、Exa、Juejin 等
import { searchBing } from 'open-websearch/build/engines/bing/bing.js';
import { searchDuckDuckGo } from 'open-websearch/build/engines/duckduckgo/index.js';
import { searchBaidu } from 'open-websearch/build/engines/baidu/baidu.js';
import { searchCsdn } from 'open-websearch/build/engines/csdn/csdn.js';

registerSkill({
  name: 'web_search',
  description: '搜索互联网上的实时信息和数据。支持多引擎搜索（Bing、DuckDuckGo、百度、CSDN 等）。当 LLM 需要获取最新信息（如新闻、实时数据、当前事件等）时调用此工具。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索查询关键词，例如 "今天的天气" 或 "最新的技术新闻"' },
      engine: { type: 'string', enum: ['bing', 'duckduckgo', 'baidu', 'csdn'], description: '搜索引擎（默认：bing）' },
      limit: { type: 'number', description: '返回结果数量（默认：5，范围：1-20）' },
    },
    required: ['query'],
  },
  async execute({ query, engine = 'bing', limit = 5 }) {
    try {
      // 验证参数
      if (!query || query.trim().length === 0) {
        throw new Error('搜索关键词不能为空');
      }
      
      const searchLimit = Math.min(Math.max(limit || 5, 1), 20);
      const searchEngine = engine?.toLowerCase() || 'bing';
      
      // 选择搜索引擎
      let searchFn;
      switch (searchEngine) {
        case 'duckduckgo':
          searchFn = searchDuckDuckGo;
          break;
        case 'baidu':
          searchFn = searchBaidu;
          break;
        case 'csdn':
          searchFn = searchCsdn;
          break;
        case 'bing':
        default:
          searchFn = searchBing;
      }
      
      // 执行搜索
      console.log(`[web_search] 使用 ${searchEngine} 引擎搜索: "${query}"`);
      const results = await searchFn(query.trim(), searchLimit);
      
      if (!results || results.length === 0) {
        return `未找到关于 "${query}" 的搜索结果`;
      }
      
      // 格式化结果
      const formattedResults = results
        .slice(0, searchLimit)
        .map((r, idx) => {
          const title = r.title || '无标题';
          const url = r.url || '';
          const desc = r.description || '';
          return `${idx + 1}. ${title}\n   链接: ${url}\n   描述: ${desc}`;
        })
        .join('\n\n');
      
      return `[搜索结果] 使用 ${searchEngine} 搜索 "${query}" 的前 ${Math.min(results.length, searchLimit)} 条结果：\n\n${formattedResults}`;
    } catch (err) {
      // 提供更详细的错误信息
      const errorMsg = err instanceof Error ? err.message : String(err);
      return `搜索失败: ${errorMsg}。建议检查网络连接或尝试其他搜索引擎。`;
    }
  },
});
