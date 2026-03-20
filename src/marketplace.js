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

/** 列出市场上的所有可用 Skill */
async function cmdList() {
  console.log('\n🔍 正在从腾讯云镜像获取 Skill 列表...\n');
  let catalog;
  try {
    catalog = await fetchJSON(REGISTRY_URL);
  } catch (e) {
    console.error('❌ 无法连接镜像源：', e.message);
    console.log('\n💡 提示：你也可以直接放入 src/skills/plugins/<name>.js 来手动安装插件\n');
    process.exit(1);
  }

  const installed = loadIndex();
  const skills = Array.isArray(catalog) ? catalog : catalog.skills ?? [];

  console.log(`📦 共 ${skills.length} 个 Skill 可用：\n`);
  console.log('  名称'.padEnd(22) + '版本'.padEnd(10) + '描述');
  console.log('  ' + '─'.repeat(60));
  for (const s of skills) {
    const tag = installed[s.name] ? ' ✅' : '';
    console.log(`  ${(s.name + tag).padEnd(22)}${(s.version ?? '-').padEnd(10)}${s.description ?? ''}`);
  }
  console.log('');
}

/** 安装指定 Skill */
async function cmdInstall(name) {
  if (!name) { console.error('用法: marketplace.js install <name>'); process.exit(1); }
  ensureDir();

  console.log(`\n📥 正在安装 ${name}...\n`);

  // 1. 从镜像拉取 registry
  let catalog;
  try {
    catalog = await fetchJSON(REGISTRY_URL);
  } catch (e) {
    console.error('❌ 无法连接镜像源：', e.message);
    process.exit(1);
  }

  const skills = Array.isArray(catalog) ? catalog : catalog.skills ?? [];
  const meta   = skills.find(s => s.name === name);
  if (!meta) {
    console.error(`❌ 未找到 Skill：${name}`);
    console.log(`\n可用 Skill：${skills.map(s => s.name).join(', ')}`);
    process.exit(1);
  }

  // 2. 下载插件文件（单文件 .js）
  const fileUrl  = meta.url;          // 每个 skill 的 .js 文件 URL
  const destFile = path.join(SKILLS_DIR, `${name}.js`);

  let code;
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    code = await res.text();
  } catch (e) {
    console.error(`❌ 下载失败：${e.message}`);
    process.exit(1);
  }

  fs.writeFileSync(destFile, code, 'utf-8');

  // 3. 更新已安装清单
  const idx = loadIndex();
  idx[name] = { version: meta.version ?? '0.0.0', file: `${name}.js`, installedAt: new Date().toISOString() };
  saveIndex(idx);

  console.log(`✅ ${name}@${meta.version ?? '0.0.0'} 安装成功！`);
  console.log(`   文件：${destFile}`);
  console.log('\n重启 Agent 后即可使用该 Skill。\n');
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
