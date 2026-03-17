// ─────────────────────────────────────────────
//  入口文件 —— 交互式命令行 REPL
// ─────────────────────────────────────────────
import 'dotenv/config';
import readline from 'readline';
import { initLLM } from './llm.js';
import { runAgent } from './agent.js';
import './skills/builtins.js'; // 加载内置技能

initLLM();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const SYSTEM_PROMPT = `你是一个智能助手，可以调用工具来回答用户问题。
遇到数学计算、查时间、搜索信息等需求时，请优先使用对应工具。`;

const history = [];

console.log('\n🚀 jsClaw Agent 启动！（输入 exit 退出）\n');

function prompt() {
  rl.question('你: ', async (input) => {
    input = input.trim();
    if (!input) return prompt();
    if (input.toLowerCase() === 'exit') { rl.close(); return; }

    try {
      const answer = await runAgent(input, { systemPrompt: SYSTEM_PROMPT, history });
      console.log(`\nAgent: ${answer}\n`);
      // 保存对话历史
      history.push({ role: 'user', content: input });
      history.push({ role: 'assistant', content: answer });
    } catch (err) {
      console.error('错误:', err.message);
    }
    prompt();
  });
}

prompt();
