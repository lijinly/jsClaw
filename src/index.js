// ─────────────────────────────────────────────
//  入口文件 —— 交互式命令行 REPL
// ─────────────────────────────────────────────
import 'dotenv/config';
import readline from 'readline';
import { initLLM } from './Llm.js';
import { WorkSpace } from './WorkSpace.js';
import { Zone } from './Zone.js';
import { getConfig } from './Config.js';
import './skills/builtins.js';  // 加载内置技能（含 list_skills、read_skill）

// 全局状态
let _zone = null;
let _workspace = null;

/**
 * 初始化默认工作区（使用 Zone 管理）
 */
async function initDefaultWorkspace() {
  const config = getConfig();

  // 使用 Zone 管理 Workspace
  _zone = new Zone({
    zoneId: 'default',
    name: '默认Zone',
  });
  await _zone.initialize();

  // 创建/加载默认 Workspace
  const workspaceId = 'default';
  let ws = _zone.getWorkspace(workspaceId);

  if (!ws) {
    // 从配置创建
    const members = config.getWorkspaceMembers(workspaceId);
    if (members.length > 0) {
      await _zone.createWorkspace({
        workspaceId,
        name: '默认工作空间',
        description: '系统启动时自动创建',
        members,
      });
    } else {
      // 无配置时创建空 Workspace
      await _zone.createWorkspace({
        workspaceId,
        name: '默认工作空间',
      });
    }
  }

  // 加载到内存
  _workspace = await _zone.loadWorkspace(workspaceId);

  // 包装为 WorkSpace 实例
  const workSpace = new WorkSpace({
    id: _workspace.id,
    name: _workspace.name,
    config,
  });

  // 添加 members
  for (const memberConfig of _workspace.members || []) {
    await workSpace.addMember(memberConfig);
  }

  return workSpace;
}

/**
 * 在默认工作空间执行任务
 */
async function executeInDefaultWorkspace(task, options = {}) {
  if (!_workspace) {
    throw new Error('工作空间未初始化');
  }
  return await _workspace.submitTask(task, options);
}

/**
 * 获取默认工作空间
 */
function getDefaultWorkspace() {
  return _workspace;
}

// 导出给外部使用
export { getDefaultWorkspace, initDefaultWorkspace, executeInDefaultWorkspace };

initLLM();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const history = [];

console.log('\n🚀 jsClaw Agent 启动！（输入 exit 退出）\n');

// 初始化全局默认工作空间
initDefaultWorkspace().then(workspace => {
  _workspace = workspace;
  console.log(`✅ 全局工作空间已就绪 (${workspace.members.size} Members)\n`);
  prompt();
}).catch(err => {
  console.error('❌ 工作空间初始化失败:', err.message);
  prompt();
});

function prompt() {
  rl.question('你: ', async (input) => {
    input = input.trim();
    if (!input) return prompt();
    if (input.toLowerCase() === 'exit') { rl.close(); return; }

    try {
      // 使用全局工作空间执行任务
      const result = await executeInDefaultWorkspace(input, { history });
      console.log(`\nAgent: ${result.result || result.error}\n`);
      // 保存对话历史
      history.push({ role: 'user', content: input });
      history.push({ role: 'assistant', content: result.result });
    } catch (err) {
      console.error('错误:', err.message);
    }
    prompt();
  });
}
