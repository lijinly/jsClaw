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

// ④ 执行 shell 命令
import { execSync } from 'child_process';

registerSkill({
  name: 'exec',
  description: '在工作区目录下执行 shell 命令，返回 stdout + stderr 输出。适合运行 npm、git、node 等命令。注意：会实际执行系统命令，请谨慎使用。',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的命令，例如 "npm install" 或 "git status"' },
      cwd: { type: 'string', description: '工作目录（相对于工作区根目录，默认为工作区根目录）' },
      timeout: { type: 'number', description: '超时时间（毫秒），默认 30000（30秒）' },
    },
    required: ['command'],
  },
  async execute({ command, cwd, timeout = 30000 }) {
    try {
      const workDir = cwd
        ? resolveSafePath(cwd)
        : path.resolve(WORKSPACE_ROOT);

      console.log(`[exec] 执行命令：${command} (cwd: ${workDir})`);

      const output = execSync(command, {
        cwd: workDir,
        timeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return output || '(命令执行成功，无输出)';
    } catch (err) {
      // execSync 失败时 err.stdout / err.stderr 包含输出
      const stdout = err.stdout || '';
      const stderr = err.stderr || '';
      const combined = [stdout, stderr].filter(Boolean).join('\n');
      return `命令执行失败（exit code: ${err.status ?? '?'}）:\n${combined || err.message}`;
    }
  },
});

// ⑤ 抓取网页内容（HTML → Markdown）
import https from 'https';

// 企业网络/代理环境下可能存在 SSL 证书验证问题，提供可配置的绕过选项
// 通过 NODE_FETCH_REJECT_UNAUTHORIZED=false 环境变量可关闭证书验证（仅开发环境）
const REJECT_UNAUTHORIZED = process.env.NODE_FETCH_REJECT_UNAUTHORIZED !== 'false';

registerSkill({
  name: 'web_fetch',
  description: '获取指定 URL 的网页内容，自动提取正文并转换为 Markdown 格式。适合读取文档、博客文章、API 说明等。',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '要抓取的网页 URL，例如 "https://nodejs.org/docs"' },
    },
    required: ['url'],
  },
  async execute({ url }) {
    try {
      console.log(`[web_fetch] 抓取: ${url}`);

      // 构建 fetch 选项，支持自定义 SSL 策略
      const fetchOptions = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; jsClaw/1.0)',
          'Accept': 'text/html,application/xhtml+xml,*/*',
        },
        signal: AbortSignal.timeout(15000),
      };

      // 如果需要绕过 SSL 验证（企业代理环境），使用自定义 agent
      if (!REJECT_UNAUTHORIZED) {
        const agent = new https.Agent({ rejectUnauthorized: false });
        // Node 内置 fetch 通过 dispatcher 支持自定义 agent（Node 18+）
        // 但内置 fetch 不直接支持 agent 参数，改用环境变量
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        return `抓取失败：HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      // 如果是纯文本/JSON/Markdown，直接返回
      if (!contentType.includes('text/html')) {
        return text.slice(0, 20000); // 限制长度
      }

      // HTML → 简单文本提取（去掉标签）
      const markdown = htmlToMarkdown(text);
      return markdown.slice(0, 20000); // 限制 20000 字符防止 token 爆炸
    } catch (err) {
      // 对 SSL 证书错误给出明确提示
      if (err.message?.includes('certificate') || err.cause?.message?.includes('certificate')) {
        return `抓取失败（SSL证书错误）：${err.cause?.message || err.message}\n\n💡 提示：如果你在企业网络/代理环境下，可以在 .env 文件中设置 NODE_FETCH_REJECT_UNAUTHORIZED=false 来绕过证书验证。`;
      }
      return `抓取失败：${err.message}`;
    }
  },
});

/**
 * 简单的 HTML → Markdown 转换
 * 不依赖第三方库，覆盖常见标签
 */
function htmlToMarkdown(html) {
  return html
    // 移除 script/style/head 块
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    // 标题
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n#### $1\n')
    // 链接
    .replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // 强调
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    // 代码
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
    // 列表
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    // 段落和换行
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<\/div>/gi, '\n')
    // 去掉所有剩余 HTML 标签
    .replace(/<[^>]+>/g, '')
    // HTML 实体
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // 清理多余空行
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

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
