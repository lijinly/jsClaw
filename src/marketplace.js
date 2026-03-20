#!/usr/bin/env node
// ─────────────────────────────────────────────────────
//  jsClaw Skill 市场
//  官方源：ClaWHub (https://clawhub.ai)
//
//  用法：
//    node src/marketplace.js list [query]     # 浏览/搜索 Skill
//    node src/marketplace.js info <slug>      # 查看 Skill 详情
//    node src/marketplace.js install <slug>   # 安装 Skill
//    node src/marketplace.js remove  <slug>   # 卸载 Skill
//    node src/marketplace.js installed        # 查看已安装
// ─────────────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, 'skills', 'plugins');   // 插件目录
const INDEX_FILE = path.join(SKILLS_DIR, 'index.json');         // 已安装清单

// ── ClaWHub 官方 API ───────────────────────────────────
const CLAWHUB_SITE    = 'https://clawhub.ai';
const CLAWHUB_API     = 'https://clawhub.ai/api';
const CLAWHUB_DOWNLOAD = 'https://wry-manatee-359.convex.site/api/v1/download';

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

// ── 核心命令 ─────────────────────────────────────────

/** 搜索/列出 Skill */
async function cmdList(query = '') {
  console.log(`\n🔍 正在搜索 Skill：${query || '(全部)'}\n`);

  let data;
  try {
    const url = `${CLAWHUB_API}/search?q=${encodeURIComponent(query)}`;
    data = await fetchJSON(url);
  } catch (e) {
    console.error('❌ 搜索失败：', e.message);
    process.exit(1);
  }

  const results   = data.results || [];
  const installed = loadIndex();

  if (results.length === 0) {
    console.log('📭 没有找到匹配的 Skill');
    console.log('\n💡 尝试其他关键词，或直接访问 https://clawhub.ai\n');
    return;
  }

  console.log(`📦 找到 ${results.length} 个 Skill：\n`);
  console.log('  Slug'.padEnd(30) + '名称'.padEnd(20) + '描述');
  console.log('  ' + '─'.repeat(80));

  for (const skill of results.slice(0, 20)) {
    const tag = installed[skill.slug] ? ' ✅' : '';
    const slug = (skill.slug + tag).padEnd(30);
    const name = (skill.displayName || '').padEnd(20);
    const desc = skill.summary || '';
    console.log(`  ${slug}${name}${desc}`);
  }

  if (results.length > 20) {
    console.log(`\n... 还有 ${results.length - 20} 个结果，请用更具体的关键词搜索`);
  }

  console.log(`\n💡 安装命令：npm run skill:install -- <slug>`);
  console.log(`   详情命令：node src/marketplace.js info <slug>\n`);
}

/** 查看 Skill 详情 */
async function cmdInfo(slug) {
  if (!slug) { console.error('用法: marketplace.js info <slug>'); process.exit(1); }

  let data;
  try {
    data = await fetchJSON(`${CLAWHUB_API}/v1/skills/${slug}`);
  } catch (e) {
    console.error('❌ 获取失败：', e.message);
    process.exit(1);
  }

  const skill   = data.skill || {};
  const version = data.latestVersion || {};
  const owner   = data.owner || {};

  console.log(`\n📋 ${skill.displayName || skill.slug}`);
  console.log('  ' + '─'.repeat(50));
  console.log(`  Slug:     ${skill.slug}`);
  console.log(`  描述:     ${skill.summary || '-'}`);
  console.log(`  版本:     ${version.version || '-'}`);
  console.log(`  作者:     ${owner.displayName || owner.handle || '-'}`);
  console.log(`  下载量:   ${skill.stats?.downloads ?? '-'}`);
  console.log(`  安装量:   ${skill.stats?.installsAllTime ?? '-'}`);
  console.log(`  ⭐ Stars: ${skill.stats?.stars ?? '-'}`);
  console.log(`  页面:     ${CLAWHUB_SITE}/${owner.handle}/${skill.slug}\n`);
}

/** 安装指定 Skill */
async function cmdInstall(slug) {
  if (!slug) { console.error('用法: marketplace.js install <slug>'); process.exit(1); }
  ensureDir();

  console.log(`\n📥 正在安装 ${slug}...\n`);

  // 1. 获取 skill 详情（确认存在 + 拿版本号）
  let data;
  try {
    data = await fetchJSON(`${CLAWHUB_API}/v1/skills/${slug}`);
  } catch (e) {
    console.error(`❌ Skill 不存在或网络错误：${e.message}`);
    process.exit(1);
  }

  const skill   = data.skill || {};
  const version = data.latestVersion?.version || 'latest';

  // 2. 下载 zip
  const zipUrl = `${CLAWHUB_DOWNLOAD}?slug=${encodeURIComponent(slug)}`;
  console.log(`   下载：${zipUrl}`);

  let zipBuffer;
  try {
    const res = await fetch(zipUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    zipBuffer = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.error(`❌ 下载失败：${e.message}`);
    process.exit(1);
  }

  // 3. 解压
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const skillEntry = entries.find(e => e.entryName.endsWith('/SKILL.md')
    || e.entryName === 'SKILL.md');

  if (!skillEntry) {
    console.error('❌ zip 包中未找到 SKILL.md 文件');
    process.exit(1);
  }

  const skillContent = skillEntry.getData().toString('utf-8');

  // 4. 保存到目录
  const skillDir = path.join(SKILLS_DIR, slug);
  if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });

  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf-8');

  // 同时保存其他辅助文件（如 _meta.json）
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const fileName = path.basename(entry.entryName);
    if (fileName === 'SKILL.md') continue;
    fs.writeFileSync(path.join(skillDir, fileName), entry.getData(), 'utf-8');
  }

  // 5. 更新已安装清单
  const idx = loadIndex();
  idx[slug] = { version, installedAt: new Date().toISOString() };
  saveIndex(idx);

  console.log(`✅ ${slug}@${version} 安装成功！`);
  console.log(`   位置：${skillDir}`);
  console.log('\n重启 Agent（npm start）后即可使用该 Skill。\n');
}

/** 卸载指定 Skill */
async function cmdRemove(slug) {
  if (!slug) { console.error('用法: marketplace.js remove <slug>'); process.exit(1); }

  const idx = loadIndex();
  if (!idx[slug]) { console.log(`⚠️  ${slug} 未安装`); return; }

  const skillDir = path.join(SKILLS_DIR, slug);
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }

  delete idx[slug];
  saveIndex(idx);

  console.log(`🗑️  ${slug} 已卸载\n`);
}

/** 查看已安装 */
function cmdInstalled() {
  const idx = loadIndex();
  const entries = Object.entries(idx);
  if (entries.length === 0) { console.log('\n📭 暂无已安装 Skill\n'); return; }

  console.log(`\n📦 已安装 ${entries.length} 个 Skill：\n`);
  console.log('  Slug'.padEnd(30) + '版本'.padEnd(10) + '安装时间');
  console.log('  ' + '─'.repeat(55));

  for (const [slug, meta] of entries) {
    const date = meta.installedAt ? meta.installedAt.slice(0, 10) : '-';
    console.log(`  ${slug.padEnd(30)}${(meta.version || '-').padEnd(10)}${date}`);
  }
  console.log('');
}

// ── 读取 SKILL.md（供 index.js 注入 system prompt）──

/**
 * 读取所有已安装 Skill 的 SKILL.md 内容
 * 返回字符串数组，每个元素是一个 Skill 的说明
 */
export function loadSkillDescriptions() {
  const idx = loadIndex();
  const descriptions = [];

  for (const [slug] of Object.entries(idx)) {
    const skillDir = path.join(SKILLS_DIR, slug);
    const skillFile = path.join(skillDir, 'SKILL.md');

    if (!fs.existsSync(skillFile)) {
      console.warn(`[Marketplace] ⚠️  SKILL.md 缺失，跳过：${slug}`);
      continue;
    }

    const content = fs.readFileSync(skillFile, 'utf-8');
    descriptions.push(`\n## Skill: ${slug}\n${content}`);
  }

  return descriptions;
}

// ── CLI 入口 ──────────────────────────────────────────

const [,, cmd, arg] = process.argv;
if (cmd) {
  const actions = {
    list:      () => cmdList(arg || ''),
    info:      () => cmdInfo(arg),
    install:   () => cmdInstall(arg),
    remove:    () => cmdRemove(arg),
    installed: cmdInstalled,
  };
  if (!actions[cmd]) {
    console.log('\n用法：node src/marketplace.js <命令> [参数]');
    console.log('\n命令：');
    console.log('  list [query]        浏览/搜索 Skill');
    console.log('  info <slug>         查看 Skill 详情');
    console.log('  install <slug>      安装 Skill');
    console.log('  remove  <slug>      卸载 Skill');
    console.log('  installed           查看已安装\n');
  } else {
    await actions[cmd]();
  }
}
