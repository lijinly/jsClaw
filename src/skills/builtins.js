// ─────────────────────────────────────────────
//  内置 Skills —— 开箱即用的示例技能
// ─────────────────────────────────────────────
import { registerSkill } from '../skillRegistry.js';

// ── 基础工具（OpenClaw 风格）────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 工作区根目录（从环境变量或当前目录推断）
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || path.join(__dirname, '..');

// 安全路径解析，防止路径穿越攻击
function resolveSafePath(userPath) {
  const resolved = path.resolve(userPath);
  const root = path.resolve(WORKSPACE_ROOT);
  if (!resolved.startsWith(root)) {
    throw new Error(`路径超出工作区范围：${userPath}`);
  }
  return resolved;
}

// ① 读取文件
registerSkill({
  name: 'read',
  description: '读取指定文件的内容。支持读取项目中的代码、配置文件、文档等。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径，相对于工作区根目录，例如 "src/index.js" 或 "README.md"' },
    },
    required: ['path'],
  },
  async execute({ path: userPath }) {
    try {
      const safePath = resolveSafePath(userPath);
      console.log(`[read] 读取文件：${safePath}`);
      const content = fs.readFileSync(safePath, 'utf-8');
      return content;
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error(`文件不存在：${userPath}`);
      if (err.code === 'EISDIR') throw new Error(`路径是目录而非文件：${userPath}`);
      throw new Error(`读取失败：${err.message}`);
    }
  },
});

// ② 写入文件
registerSkill({
  name: 'write',
  description: '创建或覆盖文件内容。支持写入代码、配置、文档等。如果父目录不存在会自动创建。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径，相对于工作区根目录，例如 "src/utils.js" 或 "config.json"' },
      content: { type: 'string', description: '要写入的文件内容' },
    },
    required: ['path', 'content'],
  },
  async execute({ path: userPath, content }) {
    try {
      const safePath = resolveSafePath(userPath);
      console.log(`[write] 写入文件：${safePath} (${content.length} 字符)`);

      // 确保目录存在
      const dir = path.dirname(safePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(safePath, content, 'utf-8');
      return `✅ 已写入：${userPath}`;
    } catch (err) {
      throw new Error(`写入失败：${err.message}`);
    }
  },
});

// ── 内置工具 ─────────────────────────────

// ③ 数学计算
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

// ④ 获取当前时间
registerSkill({
  name: 'get_current_time',
  description: '获取当前本地日期和时间',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
  },
});

// ⑤ 网络搜索 —— 使用 open-websearch
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

// ── ClaWHub Skill 懒加载工具 ─────────────────────

const PLUGINS_DIR = path.join(__dirname, '..', 'skills', 'plugins');
const INDEX_FILE = path.join(PLUGINS_DIR, 'index.json');

function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function getSkillDir(slug) {
  return path.join(PLUGINS_DIR, slug);
}

// ⑥ 列出已安装的 Skill（懒加载入口）
registerSkill({
  name: 'list_skills',
  description: '列出所有已安装的 ClaWHub Skill（仅返回名称和描述）。当你不知道有哪些 Skill 可用时，先调用此工具。',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const idx = loadIndex();
    const entries = Object.entries(idx);

    if (entries.length === 0) {
      return '当前没有安装任何 ClaWHub Skill。可以使用 `npm run skill:list` 搜索并安装。';
    }

    const lines = [`已安装 ${entries.length} 个 ClaWHub Skill：\n`];
    for (const [slug, meta] of entries) {
      lines.push(`  • ${slug} - (版本: ${meta.version || '?'})`);
    }

    return lines.join('\n') + '\n\n提示：使用 `read_skill` 工具可以读取指定 Skill 的完整说明（SKILL.md）。';
  },
});

// ⑦ 读取指定 Skill 的 SKILL.md（按需加载）
registerSkill({
  name: 'read_skill',
  description: '读取已安装 Skill 的完整说明文档（SKILL.md）。当你需要了解某个 Skill 的具体使用方法时，先调用 list_skills 查看有哪些 Skill，然后调用此工具读取具体的 SKILL.md。',
  parameters: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Skill 的名称（slug），必须先通过 list_skills 获取' },
    },
    required: ['slug'],
  },
  async execute({ slug }) {
    if (!slug) throw new Error('slug 参数不能为空');

    const idx = loadIndex();
    if (!idx[slug]) {
      const available = Object.keys(idx).join(', ') || '(无)';
      return `错误：未找到 Skill "${slug}"\n可用的 Skill：${available}\n请先用 list_skills 查看已安装的 Skill。`;
    }

    const skillDir = getSkillDir(slug);
    const skillFile = path.join(skillDir, 'SKILL.md');

    if (!fs.existsSync(skillFile)) {
      return `错误：Skill "${slug}" 的 SKILL.md 文件缺失。\n路径：${skillFile}\n建议重新安装该 Skill。`;
    }

    const content = fs.readFileSync(skillFile, 'utf-8');
    return `## Skill: ${slug}\n\n${content}`;
  },
});
