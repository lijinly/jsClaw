// ─────────────────────────────────────────────
//  TestGoalDag.js —— Goal DAG 系统集成测试
// ─────────────────────────────────────────────
import { Goal, GoalStatus } from '../src/Goal.js';
import { SubGoal, SubGoalStatus } from '../src/SubGoal.js';
import { Task, TaskStatus } from '../src/Task.js';

/**
 * 模拟 Member（用于测试）
 */
class MockMember {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  async execute(task) {
    console.log(`  [${this.name}] 执行: ${task.description}`);
    await new Promise(resolve => setTimeout(resolve, 50));

    // 模拟不同结果
    if (task.args.fail) {
      throw new Error('模拟执行失败');
    }

    return { success: true, output: `执行结果: ${task.description}` };
  }
}

/**
 * 模拟 Manager（用于测试）
 */
class MockManager {
  constructor() {
    this.workspace = { getMember: (id) => new MockMember(id, id) };
  }

  async executeGoal(goal, memberId = 'worker1') {
    const member = this.workspace.getMember(memberId);

    while (!goal.isDone()) {
      const task = goal.getNextTask();
      if (!task) {
        await new Promise(r => setTimeout(r, 30));
        continue;
      }

      try {
        const result = await member.execute(task);
        goal.onTaskComplete(task.id, true, result);
      } catch (error) {
        goal.onTaskComplete(task.id, false, null, error.message);
      }
    }

    return goal;
  }
}

// ═══════════════════════════════════════════
//  测试用例
// ═══════════════════════════════════════════

async function testSimpleGoal() {
  console.log('\n📋 测试 1: 简单 Goal（无依赖）');

  const goal = new Goal({ description: '简单任务' });
  goal.parse([{
    id: 'sg1',
    description: '数据采集',
    tasks: [
      { id: 't1', description: '搜索新闻', tool: 'web_search', args: { query: 'AI' } },
      { id: 't2', description: '获取数据', tool: 'web_fetch', args: { url: 'https://example.com' } },
    ],
  }]);

  const manager = new MockManager();
  await manager.executeGoal(goal);

  console.log('  结果:', goal.status === GoalStatus.COMPLETED ? '✅ 通过' : '❌ 失败');
  return goal.status === GoalStatus.COMPLETED;
}

async function testSequentialGoal() {
  console.log('\n📋 测试 2: 顺序执行 Goal');

  const goal = new Goal({ description: '顺序任务' });
  goal.parse([{
    id: 'sg1',
    description: '数据处理流水线',
    sequential: ['t1', 't2', 't3'],
    tasks: [
      { id: 't1', description: '步骤1', tool: 'exec', args: { cmd: 'load' } },
      { id: 't2', description: '步骤2', tool: 'exec', args: { cmd: 'clean' } },
      { id: 't3', description: '步骤3', tool: 'exec', args: { cmd: 'analyze' } },
    ],
  }]);

  const manager = new MockManager();
  await manager.executeGoal(goal);

  const passed = goal.status === GoalStatus.COMPLETED;
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testDagGoal() {
  console.log('\n📋 测试 3: DAG 依赖 Goal');

  const goal = new Goal({ description: 'DAG 任务' });
  goal.parse([
    { id: 'sg1', tasks: [{ id: 't1' }, { id: 't2' }] },
    { id: 'sg2', dependsOn: ['sg1'], tasks: [{ id: 't3' }, { id: 't4' }] },
    { id: 'sg3', dependsOn: ['sg2'], tasks: [{ id: 't5' }] },
  ]);

  goal.start();
  const manager = new MockManager();

  while (!goal.isDone()) {
    const executable = goal.getExecutableTasks();
    if (executable.length > 0) {
      for (const task of executable) {
        try {
          await manager.workspace.getMember('worker1').execute(task);
          goal.onTaskComplete(task.id, true, { success: true });
        } catch (error) {
          goal.onTaskComplete(task.id, false, null, error.message);
        }
      }
    } else {
      await new Promise(r => setTimeout(r, 30));
    }
  }

  console.log('  结果:', goal.status === GoalStatus.COMPLETED ? '✅ 通过' : '❌ 失败');
  return goal.status === GoalStatus.COMPLETED;
}

async function testFailedTask() {
  console.log('\n📋 测试 4: 失败 Task 与重试');

  const goal = new Goal({
    description: '带失败的测试',
    config: { maxRetries: 2 },
  });

  goal.parse([{
    id: 'sg1',
    tasks: [
      { id: 't1', description: '成功任务', tool: 'exec', args: {} },
      { id: 't2', description: '失败任务', tool: 'exec', args: { fail: true } },
    ],
  }]);

  goal.start();

  const t1 = goal._tasksMap.get('t1');
  const t2 = goal._tasksMap.get('t2');

  t1.succeed({ success: true });
  t2.fail('模拟失败');

  goal.onTaskComplete('t1', true, { success: true });
  goal.onTaskComplete('t2', false, null, '模拟失败');

  const passed = t1.status === TaskStatus.SUCCESS &&
                 t2.status === TaskStatus.RETRY &&
                 t2.canRetry();

  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testProgressTracking() {
  console.log('\n📋 测试 5: 进度跟踪');

  const goal = new Goal({ description: '进度测试' });
  goal.parse([{
    id: 'sg1',
    tasks: [
      { id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' },
    ],
  }]);

  goal.start();

  for (let i = 1; i <= 4; i++) {
    const task = goal._tasksMap.get(`t${i}`);
    task.succeed({});
    goal.onTaskComplete(`t${i}`, true, {});
  }

  const passed = goal.getProgress() === 100 && goal.isDone();
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testExportImport() {
  console.log('\n📋 测试 6: 持久化（导出/导入）');

  const goal = new Goal({ description: '持久化测试' });
  goal.parse([{
    id: 'sg1',
    tasks: [
      { id: 't1' }, { id: 't2' },
    ],
  }]);

  goal.start();
  goal._tasksMap.get('t1').succeed({});
  goal.onTaskComplete('t1', true, {});

  const exported = goal.export();
  const restored = Goal.fromExport(exported);

  const passed = restored.id === goal.id &&
                 restored.getAllTasks().length === 2 &&
                 restored._tasksMap.get('t1').status === TaskStatus.SUCCESS;

  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

// ═══════════════════════════════════════════
//  测试用例：验收标准
// ═══════════════════════════════════════════

async function testAcceptanceCriteria() {
  console.log('\n📋 测试 7: 验收标准');

  // 创建带验收标准的 Task
  const task = new Task({
    taskId: 't1',
    description: '获取数据',
    tool: 'web_search',
    args: { query: 'AI' },
    subGoalId: 'sg1',
    acceptanceCriteria: {
      type: 'rules',
      checks: [
        { field: 'success', operator: 'equals', value: true },
        { field: 'output', operator: 'isNotEmpty', value: null },
      ],
    },
  });

  // 验收通过的结果
  const validResult = { success: true, output: 'AI 最新动态' };
  const v1 = task.validate(validResult);
  console.log('  有效结果验收:', v1.passed ? '✅ 通过' : '❌ 失败');

  // 验收失败的结果
  const invalidResult = { success: false, output: '' };
  const v2 = task.validate(invalidResult);
  console.log('  无效结果验收:', !v2.passed ? '✅ 通过' : '❌ 失败');

  // 执行并验收
  task.start('member1');
  task.succeed(validResult);

  console.log('  执行状态:', task.status);
  console.log('  验收结果:', task.accepted ? '✅ 通过' : '❌ 失败');
  console.log('  是否达标:', task.isAccepted() ? '✅ 通过' : '❌ 失败');

  const passed = v1.passed && !v2.passed && task.accepted && task.isAccepted();
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testAcceptanceCriteriaFunction() {
  console.log('\n📋 测试 8: 函数式验收标准');

  const task = new Task({
    taskId: 't1',
    description: '计算任务',
    tool: 'exec',
    acceptanceCriteria: {
      type: 'function',
      fn: (result) => result.code === 0 && result.data.length > 0,
    },
  });

  // 通过验收
  const r1 = task.validate({ code: 0, data: [1, 2, 3] });
  console.log('  正确结果:', r1.passed ? '✅ 通过' : '❌ 失败');

  // 未通过验收
  const r2 = task.validate({ code: 1, data: [] });
  console.log('  错误结果:', !r2.passed ? '✅ 通过' : '❌ 失败');

  const passed = r1.passed && !r2.passed;
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testManualAcceptance() {
  console.log('\n📋 测试 9: 人工验收');

  const task = new Task({
    taskId: 't1',
    description: '生成报告',
    tool: 'exec',
    acceptanceCriteria: {
      type: 'description',
      description: '报告包含关键结论和数据来源',
    },
  });

  console.log('  是否需要人工验收:', task.requiresManualReview() ? '✅ 是' : '❌ 否');

  // 执行
  task.start('member1');
  task.succeed({ report: '报告内容...' });

  console.log('  验收结果:', task.acceptanceResult.details);

  // 人工确认
  task.confirmAcceptance(true, '内容完整，符合要求');
  console.log('  人工确认:', task.accepted ? '✅ 通过' : '❌ 失败');

  const passed = task.requiresManualReview() && task.accepted;
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

async function testNestedFieldValidation() {
  console.log('\n📋 测试 10: 嵌套字段验收');

  const task = new Task({
    taskId: 't1',
    description: 'API 调用',
    tool: 'http',
    acceptanceCriteria: {
      type: 'rules',
      checks: [
        { field: 'response.status', operator: 'equals', value: 200 },
        { field: 'response.data.items.length', operator: 'greaterThan', value: 0 },
        { field: 'response.headers.content-type', operator: 'contains', value: 'application/json' },
      ],
    },
  });

  const validResult = {
    response: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { items: [1, 2, 3] },
    },
  };

  const validation = task.validate(validResult);
  console.log('  验收详情:');
  console.log(validation.details);

  const passed = validation.passed;
  console.log('  结果:', passed ? '✅ 通过' : '❌ 失败');
  return passed;
}

// ═══════════════════════════════════════════
//  运行所有测试
// ═══════════════════════════════════════════

async function runTests() {
  console.log('═'.repeat(60));
  console.log('🧪 Goal DAG 系统测试');
  console.log('═'.repeat(60));

  const results = [];

  results.push({ name: '简单 Goal', passed: await testSimpleGoal() });
  results.push({ name: '顺序执行', passed: await testSequentialGoal() });
  results.push({ name: 'DAG 依赖', passed: await testDagGoal() });
  results.push({ name: '失败与重试', passed: await testFailedTask() });
  results.push({ name: '进度跟踪', passed: await testProgressTracking() });
  results.push({ name: '持久化', passed: await testExportImport() });
  results.push({ name: '验收标准（规则）', passed: await testAcceptanceCriteria() });
  results.push({ name: '验收标准（函数）', passed: await testAcceptanceCriteriaFunction() });
  results.push({ name: '人工验收', passed: await testManualAcceptance() });
  results.push({ name: '嵌套字段验收', passed: await testNestedFieldValidation() });

  console.log('\n' + '═'.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('═'.repeat(60));

  for (const r of results) {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  }

  const passed = results.filter(r => r.passed).length;
  console.log(`\n总计: ${passed}/${results.length} 通过`);

  if (passed === results.length) {
    console.log('\n🎉 所有测试通过！\n');
  } else {
    console.log('\n⚠️ 部分测试失败\n');
  }

  process.exit(passed === results.length ? 0 : 1);
}

runTests().catch(console.error);
