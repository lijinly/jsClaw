// ─────────────────────────────────────────────
//  GoalTracker + Agent 集成测试
// ─────────────────────────────────────────────
import { Agent } from '../src/Agent.js';

// 测试1：Agent 创建目标
console.log('\n========== 测试1：Agent + GoalTracker ==========');
const agent = new Agent({
  name: '测试助手',
  role: '量化分析助手',
  verbose: false,
});

// 创建目标
const goal = agent.createGoal('分析今日市场走势', {
  priority: 3,  // 高优先级
  tags: ['市场', '日频'],
});

// 添加检查点
agent.addGoalCheckpoint('获取指数数据');
agent.addGoalCheckpoint('分析技术指标');
agent.addGoalCheckpoint('生成报告');

// 获取目标上下文
const context = agent.getGoalContext();
console.log('目标上下文:');
console.log(context);

// 测试2：进度更新
console.log('\n========== 测试2：进度更新 ==========');
agent.updateGoalProgress(33);
console.log('更新进度到 33%:', agent.goalTracker.getGoalSummary());

// 测试3：记录成就和阻碍
console.log('\n========== 测试3：成就与阻碍 ==========');
agent.addGoalAchievement('成功获取上证指数数据');
agent.addGoalBlocker('API限流，数据获取延迟');
console.log('记录成就和阻碍完成');

// 测试4：Agent 显示目标信息
console.log('\n========== 测试4：Agent 目标状态 ==========');
const activeGoal = agent.goalTracker.getActiveGoal();
console.log('活跃目标:', activeGoal?.description);
console.log('检查点:', activeGoal?.checkpoints.map(cp => cp.description).join(', '));
console.log('进度:', activeGoal?.progress + '%');

console.log('\n✅ Agent + GoalTracker 集成测试完成');
console.log('\n注意：完整Agent运行测试需要有效的API Key');
