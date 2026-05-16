// ─────────────────────────────────────────────
//  CLI 入口 —— 命令行 REPL
//
//  职责：纯 I/O 界面层
//    - 初始化服务层（Service → Zone → WorkSpace）
//    - Workspace 选择 / Session 管理
//    - readline 交互循环
//
//  设计原则：CLI 始终使用 Session 管理会话，
//  无 REPL 直通模式。
//
//  业务逻辑（WorkSpace / Session / LLM）均在
//  Service.js / Zone.js / Workspace.js 中处理。
// ─────────────────────────────────────────────
import readline from 'readline';
import {
  startService,
  getWorkspace,
  getZoneInstance,
  chat,
  createSession,
  getSession,
  listSessions,
  getMembers,
} from './Service.js';

// ── 全局状态 ─────────────────────────────────
let _currentSession = null;   // 当前 Session（强制使用，REPL 启动时必创建）
let _history = [];             // CLI REPL 历史（仅用于日志展示）
let _shutdownDone = false;    // 防止重复关闭

// ── 优雅退出 ────────────────────────────────

/**
 * 保存所有 Session 并退出
 * @param {number} code - 退出码
 * @param {string} reason - 退出原因（用于日志）
 */
async function gracefulShutdown(code = 0, reason = '正常退出') {
  if (_shutdownDone) return;
  _shutdownDone = true;

  console.log(`\n\n📦 正在保存会话...`);

  try {
    const ws = getWorkspace();
    await ws.save();
    console.log(`✅ 会话已保存，退出`);
  } catch (err) {
    console.error(`⚠️ 保存失败: ${err.message}`);
  }

  console.log(`👋 再见！\n`);
  process.exit(code);
}

// 注册信号处理器
process.on('SIGINT',  () => gracefulShutdown(0, 'Ctrl+C'));
process.on('SIGTERM', () => gracefulShutdown(0, 'SIGTERM'));

// ── 启动 ─────────────────────────────────────
console.log('\n🚀 jsClaw Agent 启动！\n');

async function main() {
  try {
    await startService();
    await runInteractive();
  } catch (err) {
    console.error('❌ 初始化失败:', err.message);
    process.exit(1);
  }
}

// ── 交互主循环 ────────────────────────────────
async function runInteractive() {
  printBanner();

  // 确保有 Session
  if (!_currentSession) {
    switchToDefaultSession();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function prompt() {
    rl.question('你> ', async (input) => {
      input = input.trim();
      if (!input) { prompt(); return; }

      // ── 内置命令 ──────────────────────────
      if (handleBuiltin(input)) { prompt(); return; }

      // ── 安全兜底：确保有 Session（防止空指针）────
      if (!_currentSession) {
        const ws = getWorkspace();
        _currentSession = ws.startSession({
          sessionId: `cli-${Date.now()}`,
          title: 'CLI 会话',
          mode: 'member',
        });
      }

      // ── 转发给 Service.chat ──────────────
      try {
        const result = await chat(input, {
          sessionId: _currentSession.id,
          verbose: false,
        });

        console.log(`\nAgent> ${result.result || result.error || '(无返回)'}\n`);
      } catch (err) {
        console.error(`\n错误: ${err.message}\n`);
      }

      prompt();
    });
  }

  prompt();
}

// ── 内置命令处理 ──────────────────────────────
function handleBuiltin(input) {
  const [cmd, ...args] = input.split(/\s+/);

  switch (cmd.toLowerCase()) {
    case 'exit':
    case 'quit':
      gracefulShutdown(0, '用户退出');

    case '/workspaces':
      cmdWorkspaces(); return true;

    case '/workspace':
      cmdWorkspace(args[0]); return true;

    case '/sessions':
      cmdSessions(); return true;

    case '/session':
      cmdSession(args[0]); return true;

    case '/members':
      cmdMembers(); return true;

    case '/help':
      printHelp(); return true;

    default:
      return false;
  }
}

// ── 命令实现 ─────────────────────────────────

function cmdWorkspaces() {
  const zone = getZoneInstance();
  const list = zone.listWorkspaces();
  console.log('\n📦 Workspaces:');
  if (list.length === 0) { console.log('  (无)'); return; }
  for (const ws of list) {
    const mark = ws.isLoaded ? '✅' : '⬜';
    console.log(`  ${mark} ${ws.id}  —  ${ws.name}  [${ws.path || '未设置路径'}]`);
  }
  console.log('');
}

async function cmdWorkspace(id) {
  if (!id) {
    const ws = getWorkspace();
    console.log(`\n📂 当前 Workspace: ${ws.id} — ${ws.name}`);
    console.log(`   路径: ${ws.path || '(未设置)'}`);
    console.log('');
    return;
  }
  // TODO: 切换 Workspace（需要 Zone 支持）
  console.log(`\n⚠️ 切换 Workspace 功能开发中，当前仅支持 default\n`);
}

function cmdSessions() {
  const ws = getWorkspace();
  const list = ws.listSessions();
  console.log('\n💬 Sessions:');
  if (list.length === 0) { console.log('  (无)'); return; }
  for (const s of list) {
    const mark = s.id === _currentSession?.id ? '▶' : ' ';
    console.log(`  ${mark} [${s.id}] ${s.title}  (${s.memberId})  ${s.preview || ''}`);
  }
  console.log('');
}

function cmdSession(id) {
  if (!id) {
    if (!_currentSession) {
      // 安全兜底：不应发生，但确保永远有 Session
      const ws = getWorkspace();
      _currentSession = ws.startSession({
        sessionId: `cli-${Date.now()}`,
        title: 'CLI 会话',
        mode: 'member',
      });
    }
    const s = _currentSession.getSummary();
    console.log(`\n▶ 当前 Session: [${s.id}] ${s.title}`);
    console.log(`  Member: ${s.memberId} | 消息: ${s.messageCount} | 更新: ${new Date(s.updatedAt).toLocaleString()}`);
    console.log('');
    return;
  }

  const ws = getWorkspace();
  const session = ws.getSession(id);
  if (!session) {
    console.log(`\n⚠️ Session 不存在: ${id}，已自动创建`);
    _currentSession = ws.startSession({ sessionId: id });
  } else {
    _currentSession = session;
  }
  console.log(`\n✅ 已切换到 Session [${_currentSession.id}]\n`);
}

function cmdMembers() {
  const members = getMembers();
  console.log('\n👥 Members:');
  for (const m of members) {
    console.log(`  ${m.name} (${m.id})  —  ${m.identity}  [${m.type}]`);
    if (m.skills.length > 0) console.log(`    技能: ${m.skills.join(', ')}`);
  }
  console.log('');
}

function switchToDefaultSession() {
  const ws = getWorkspace();
  _currentSession = ws.startSession({
    sessionId: `cli-${Date.now()}`,
    title: 'CLI 会话',
    mode: 'member',
  });
}

// ── 辅助输出 ─────────────────────────────────

function printBanner() {
  const ws = getWorkspace();
  console.log('━'.repeat(56));
  console.log(`  jsClaw Agent  |  Zone: default  |  Workspace: ${ws.id}`);
  console.log('━'.repeat(56));
  console.log('  内置命令:');
  console.log('    /workspaces        列出所有 Workspace');
  console.log('    /workspace [id]    查看或切换 Workspace');
  console.log('    /sessions         列出所有 Session');
  console.log('    /session [id]     切换 Session');
  console.log('    /members          列出所有 Member');
  console.log('    /help             显示此帮助');
  console.log('    exit / quit       退出');
  console.log('━'.repeat(56));
  console.log(`\n▶ Session: [${_currentSession.id}] ${_currentSession.title || ''}`);
  console.log('');
}

function printHelp() {
  printBanner();
}

// ── 启动 ─────────────────────────────────────
main();
