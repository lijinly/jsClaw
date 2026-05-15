// ─────────────────────────────────────────────
//  入口文件 —— 交互式命令行 REPL
// ─────────────────────────────────────────────
import 'dotenv/config';
import readline from 'readline';
import { initLLM } from './Llm.js';
import { initDefaultWorkspace, executeInDefaultWorkspace, getDefaultWorkspace } from './GlobalWorkspace.js';
import './skills/builtins.js';  // 加载内置技能（含 list_skills、read_skill）

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
