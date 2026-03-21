// ─────────────────────────────────────────────
//  Team 系统演示
// ─────────────────────────────────────────────
import 'dotenv/config';
import { initLLM } from './llm.js';
import { TeamLab } from './TeamLab.js';

// 初始化 LLM
initLLM();

async function main() {
  console.log('\n═════════════════════════════════════');
  console.log('      Team System 演示');
  console.log('═════════════════════════════════════\n');

  // 1. 初始化 Team 系统
  const teamSystem = new TeamLab();
  await teamSystem.initialize();

  // 2. 演示 Team 外提交简单任务
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('场景 1: Team 外提交简单任务');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const result1 = await teamSystem.submitTask('现在几点了？');
  console.log('\n结果:', result1);

  // 3. 演示 Team 外提交复杂任务（建议进入 Team）
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('场景 2: Team 外提交复杂任务（需要 Team）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const result2 = await teamSystem.submitTask('帮我读取项目文件并分析代码结构');
  console.log('\n建议进入 Team:', result2.suggestedTeam?.name);

  // 4. 进入 Team
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('场景 3: 进入开发团队');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (result2.suggestedTeam) {
    await teamSystem.enterTeam(result2.suggestedTeam.id);
  }

  // 5. Team 内提交任务
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('场景 4: Team 内提交任务');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const result3 = await teamSystem.submitTask('帮我列出当前目录的文件');
  console.log('\n结果:', result3.result);

  // 6. 退出 Team
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('场景 5: 退出 Team');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await teamSystem.exitTeam();

  console.log('\n═════════════════════════════════════');
  console.log('      演示完成');
  console.log('═════════════════════════════════════\n');
}

// 运行演示
main().catch(console.error);
