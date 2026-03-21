// ─────────────────────────────────────────────
//  入口文件 —— 交互式命令行 REPL
// ─────────────────────────────────────────────
import 'dotenv/config';
import readline from 'readline';
import { initLLM } from './llm.js';
import { Agent } from './agent.js';
import './skills/builtins.js';  // 加载内置技能（含 list_skills、read_skill）

initLLM();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const history = [];

// 创建 Agent 实例
const agent = new Agent({
  name: '助手',
  role: '智能助手',
});

console.log('\n🚀 jsClaw Agent 启动！（输入 exit 退出）\n');

function prompt() {
  rl.question('你: ', async (input) => {
    input = input.trim();
    if (!input) return prompt();
    if (input.toLowerCase() === 'exit') { rl.close(); return; }

  try {
    const { result } = await agent.run(input, { history });
    console.log(`\nAgent: ${result}\n`);
      // 保存对话历史
      history.push({ role: 'user', content: input });
      history.push({ role: 'assistant', content: result });
    } catch (err) {
      console.error('错误:', err.message);
    }
    prompt();
  });
}

prompt();
