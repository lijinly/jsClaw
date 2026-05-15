// ─────────────────────────────────────────────
//  GoalTracker 测试
// ─────────────────────────────────────────────
import { GoalTracker, GoalPriority, GoalStatus } from '../src/GoalTracker.js';

// 测试1：创建目标
console.log('\n========== 测试1：创建目标 ==========');
const tracker = new GoalTracker();

const goal1 = tracker.createGoal('完成量化策略开发', {
  priority: GoalPriority.HIGH,
  tags: ['量化', '策略'],
});
console.log('创建目标:', goal1.id, goal1.description);
console.log('状态:', goal1.status);

// 测试2：获取活跃目标
console.log('\n========== 测试2：活跃目标 ==========');
const activeGoal = tracker.getActiveGoal();
console.log('活跃目标:', activeGoal?.description);

// 测试3：添加检查点
console.log('\n========== 测试3：检查点 ==========');
const cp1 = tracker.addCheckpoint(goal1.id, '完成数据采集模块');
const cp2 = tracker.addCheckpoint(goal1.id, '实现回测引擎');
const cp3 = tracker.addCheckpoint(goal1.id, '参数优化');
console.log('添加检查点:', cp1.description, cp2.description, cp3.description);

// 测试4：完成检查点
console.log('\n========== 测试4：完成检查点 ==========');
tracker.completeCheckpoint(goal1.id, cp1.id, '使用akshare获取股票数据');
tracker.completeCheckpoint(goal1.id, cp2.id);
console.log('完成2个检查点后进度:', tracker.getGoal(goal1.id).progress + '%');

// 测试5：记录成就和阻碍
console.log('\n========== 测试5：成就和阻碍 ==========');
tracker.addAchievement(goal1.id, '成功获取沪深300历史数据');
tracker.addBlocker(goal1.id, '回测速度过慢');
const goal = tracker.getGoal(goal1.id);
console.log('成就:', goal.context.achievements.length);
console.log('阻碍:', goal.context.blockers.length);

// 测试6：生成目标上下文
console.log('\n========== 测试6：目标上下文 ==========');
const context = tracker.getGoalContext();
console.log(context);

// 测试7：多个目标
console.log('\n========== 测试7：多目标 ==========');
const goal2 = tracker.createGoal('优化回测性能', { priority: GoalPriority.NORMAL });
console.log('创建第二个目标');
console.log('活跃目标:', tracker.getGoalSummary());
console.log('所有目标:', tracker.getAllGoals().map(g => g.description));

// 切换活跃目标
tracker.setActiveGoal(goal2.id);
console.log('切换后活跃目标:', tracker.getGoalSummary());

// 测试8：完成目标
console.log('\n========== 测试8：完成目标 ==========');
tracker.completeGoal(goal2.id, '回测速度提升50%');
console.log('目标2状态:', tracker.getGoal(goal2.id).status);
console.log('历史目标数:', tracker.goalHistory.length);

// 测试9：事件监听
console.log('\n========== 测试9：事件监听 ==========');
tracker.on('onGoalCompleted', (goal) => {
  console.log(`🎉 目标完成: ${goal.description}`);
});

tracker.on('onGoalUpdated', (goal, extra) => {
  console.log(`📝 目标更新: ${goal.description}`);
});

const goal3 = tracker.createGoal('测试事件');
tracker.completeGoal(goal3.id);

// 测试10：优先级
console.log('\n========== 测试10：优先级 ==========');
const urgentGoal = tracker.createGoal('紧急修复bug', { priority: GoalPriority.CRITICAL });
console.log('紧急目标:', urgentGoal.description, '- 优先级:', urgentGoal.priority);

console.log('\n✅ GoalTracker 测试完成');
