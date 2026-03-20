#!/usr/bin/env node
// ─────────────────────────────────────────────────────
//  jsClaw Skill 市场
//  镜像源：腾讯云 (clawhub 国内镜像)
//
//  用法：
//    node src/marketplace.js list            # 浏览可用 Skill
//    node src/marketplace.js install <name>  # 安装 Skill
//    node src/marketplace.js remove  <name>  # 卸载 Skill
//    node src/marketplace.js installed       # 查看已安装
// ─────────────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, 'skills', 'plugins');   // 插件目录
const INDEX_FILE = path.join(SKILLS_DIR, 'index.json');         // 已安装清单

// ── 腾讯云 ClaWHub 镜像 ───────────────────────────────
const REGISTRY_URL = 'https://clawhub-1258344699.cos.ap-guangzhou.myqcloud.com/registry.json';

// ── 内置 Fallback 注册表（镜像不可用时使用）─────────────
const BUILTIN_REGISTRY = {
  skills: [
    {
      name: 'joke',
      version: '1.0.0',
      description: '讲一个随机笑话',
      url: 'https://clawhub-1258344699.cos.ap-guangzhou.myqcloud.com/skills/joke.js',
      code: `import { registerSkill } from '../../skillRegistry.js';
registerSkill({
  name: 'joke',
  description: '讲一个随机笑话',
  parameters: { type: 'object', properties: {}, required: [] },
  async execute() {
    const jokes = [
      '程序员为什么不喜欢户外活动？因为 Bug 太多，而且没有 Stack Overflow。',
      '为什么程序员分不清万圣节和圣诞节？因为 Oct 31 == Dec 25。',
      '一个 SQL 查询走进酒吧，走向两张桌子问道："我可以 JOIN 你们吗？"',
      '程序员最讨厌的事是什么？1. 写注释。2. 别人不写注释。',
      '如何让程序员心情变好？给他一个没有 Bug 的周五下午。',
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  },
});`,
    },
    {
      name: 'weather',
      version: '1.0.0',
      description: '查询指定城市的天气（模拟数据）',
      url: 'https://clawhub-1258344699.cos.ap-guangzhou.myqcloud.com/skills/weather.js',
      code: `import { registerSkill } from '../../skillRegistry.js';
registerSkill({
  name: 'weather',
  description: '查询指定城市的天气预报',
  parameters: {
    type: 'object',
    properties: { city: { type: 'string', description: '城市名称，例如 "北京"' } },
    required: ['city'],
  },
  async execute({ city }) {
    // 实际使用时可接入真实天气 API
    const conditions = ['晴', '多云', '小雨', '阴'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const temp = Math.floor(Math.random() * 20) + 10;
    return \`\${city} 今天\${condition}，气温 \${temp}°C，空气质量良好。\`;
  },
});`,
    },
    {
      name: 'translate',
      version: '1.0.0',
      description: '中英文互译（调用 LLM 实现）',
      url: 'https://clawhub-1258344699.cos.ap-guangzhou.myqcloud.com/skills/translate.js',
      code: `import { registerSkill } from '../../skillRegistry.js';
import { chat } from '../../llm.js';
registerSkill({
  name: 'translate',
  description: '中英文互译，自动检测语言方向',
  parameters: {
    type: 'object',
    properties: { text: { type: 'string', description: '要翻译的文本' } },
    required: ['text'],
  },
  async execute({ text }) {
    const result = await chat([
      { role: 'system', content: '你是专业翻译，自动检测语言：中文↔英文互译，只返回译文，不加任何解释。' },
      { role: 'user', content: text },
    ]);
    return result;
  },
});`,
    },
  ],
};

// ── 工具函数 ─────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

function loadIndex() {
  ensureDir();
  if (!fs.existsSync(INDEX_FILE)) return {};
  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
}

function saveIndex(idx) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf-8');
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

/** 获取注册表：优先远程，失败降级到内置 fallback */
async function fetchRegistry() {
  try {
    const catalog = await fetchJSON(REGISTRY_URL);
    const skills = Array.isArray(catalog) ? catalog : catalog.skills ?? [];
    console.log('✅ 已从腾讯云镜像获取注册表');
    return skills;
  } catch (e) {
    console.log(`⚠️  镜像暂不可达（${e.message}），使用内置注册表`);
    return BUILTIN_REGISTRY.skills;
  }
}

// ── 核心命令 ─────────────────────────────────────────

/** 列出市场上的所有可用 Skill */
async function cmdList() {
  console.log('\n🔍 正在获取 Skill 列表...\n');
  const skills = await fetchRegistry();
  const installed = loadIndex();

  console.log(`📦 共 ${skills.length} 个 Skill 可用：\n`);
  console.log('  名称'.padEnd(22) + '版本'.padEnd(10) + '描述');
  console.log('  ' + '─'.repeat(60));
  for (const s of skills) {
    const tag = installed[s.name] ? ' ✅已安装' : '';
    console.log(`  ${(s.name + tag).padEnd(28)}${(s.version ?? '-').padEnd(10)}${s.description ?? ''}`);
  }
  console.log('\n💡 安装命令：npm run skill:install -- <name>\n');
}

/** 安装指定 Skill */
async function cmdInstall(name) {
  if (!name) { console.error('用法: marketplace.js install <name>'); process.exit(1); }
  ensureDir();

  console.log(`\n📥 正在安装 ${name}...\n`);

  const skills = await fetchRegistry();
  const meta   = skills.find(s => s.name === name);
  if (!meta) {
    console.error(`❌ 未找到 Skill：${name}`);
    console.log(`\n可用 Skill：${skills.map(s => s.name).join(', ')}`);
    process.exit(1);
  }

  const destFile = path.join(SKILLS_DIR, `${name}.js`);
  let code;

  // 优先从远程下载，fallback 用内置 code 字段
  if (meta.url) {
    try {
      const res = await fetch(meta.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      code = await res.text();
    } catch (e) {
      if (meta.code) {
        console.log(`⚠️  远程下载失败，使用内置版本`);
        code = meta.code;
      } else {
        console.error(`❌ 下载失败：${e.message}`);
        process.exit(1);
      }
    }
  } else if (meta.code) {
    code = meta.code;
  } else {
    console.error('❌ 该 Skill 没有可用的安装来源');
    process.exit(1);
  }

  fs.writeFileSync(destFile, code, 'utf-8');

  const idx = loadIndex();
  idx[name] = { version: meta.version ?? '0.0.0', file: `${name}.js`, installedAt: new Date().toISOString() };
  saveIndex(idx);

  console.log(`✅ ${name}@${meta.version ?? '0.0.0'} 安装成功！`);
  console.log(`   文件：${destFile}`);
  console.log('\n重启 Agent（npm start）后即可使用该 Skill。\n');
}

/** 卸载指定 Skill */
async function cmdRemove(name) {
  if (!name) { console.error('用法: marketplace.js remove <name>'); process.exit(1); }

  const idx = loadIndex();
  if (!idx[name]) { console.log(`⚠️  ${name} 未安装`); return; }

  const file = path.join(SKILLS_DIR, idx[name].file);
  if (fs.existsSync(file)) fs.unlinkSync(file);

  delete idx[name];
  saveIndex(idx);

  console.log(`🗑️  ${name} 已卸载\n`);
}

/** 查看已安装 */
function cmdInstalled() {
  const idx = loadIndex();
  const entries = Object.entries(idx);
  if (entries.length === 0) { console.log('\n📭 暂无已安装 Skill\n'); return; }

  console.log(`\n📦 已安装 ${entries.length} 个 Skill：\n`);
  console.log('  名称'.padEnd(22) + '版本'.padEnd(10) + '安装时间');
  console.log('  ' + '─'.repeat(55));
  for (const [name, meta] of entries) {
    const date = meta.installedAt ? meta.installedAt.slice(0, 10) : '-';
    console.log(`  ${name.padEnd(22)}${(meta.version ?? '-').padEnd(10)}${date}`);
  }
  console.log('');
}

// ── 自动加载器（供 index.js 调用）────────────────────

/**
 * 加载所有已安装的插件 Skill
 * 在 index.js 中调用：await loadInstalledSkills()
 */
export async function loadInstalledSkills() {
  const idx = loadIndex();
  const entries = Object.entries(idx);
  if (entries.length === 0) return;

  for (const [name, meta] of entries) {
    const file = path.join(SKILLS_DIR, meta.file);
    if (!fs.existsSync(file)) {
      console.warn(`[Marketplace] ⚠️  插件文件缺失，跳过：${name}`);
      continue;
    }
    try {
      // Windows 下需要将绝对路径转为 file:// URL
      const fileUrl = new URL(`file:///${file.replace(/\\/g, '/')}`).href;
      await import(fileUrl);  // 每个插件文件自行调用 registerSkill()
      console.log(`[Marketplace] ✅ 已加载插件：${name}`);
    } catch (e) {
      console.warn(`[Marketplace] ❌ 加载失败：${name} — ${e.message}`);
    }
  }
}

// ── CLI 入口 ──────────────────────────────────────────

const [,, cmd, arg] = process.argv;
if (cmd) {
  const actions = { list: cmdList, install: () => cmdInstall(arg), remove: () => cmdRemove(arg), installed: cmdInstalled };
  if (!actions[cmd]) {
    console.log('\n用法：node src/marketplace.js <命令> [参数]');
    console.log('\n命令：');
    console.log('  list                浏览可用 Skill');
    console.log('  install <name>      安装 Skill');
    console.log('  remove  <name>      卸载 Skill');
    console.log('  installed           查看已安装\n');
  } else {
    await actions[cmd]();
  }
}
