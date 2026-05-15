# Goal DAG 系统 —— DAG 驱动的目标管理

> 通过 Goal → SubGoal → Task 三层结构，实现复杂任务的分解、执行和验收

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Goal DAG 层级结构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                       Goal                               │  │
│   │                     顶层目标                              │  │
│   │  ┌─────────────────────────────────────────────────┐   │  │
│   │  │                    SubGoal                      │   │  │
│   │  │               DAG 节点 (可嵌套)                 │   │  │
│   │  │  ┌─────────────────────────────────────────┐  │   │  │
│   │  │  │                 Task                     │  │   │  │
│   │  │  │              叶子节点                    │  │   │  │
│   │  │  │  • tool + args                          │  │   │  │
│   │  │  │  • subGoalId (所属 SubGoal)             │  │   │  │
│   │  │  │  • acceptanceCriteria (验收标准)         │  │   │  │
│   │  │  └─────────────────────────────────────────┘  │   │  │
│   │  └─────────────────────────────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 核心组件

| 组件 | 文件 | 说明 |
|------|------|------|
| **Goal** | `src/Goal.js` | 顶层目标，管理多个 SubGoal |
| **SubGoal** | `src/SubGoal.js` | 子目标，DAG 节点 |
| **Task** | `src/Task.js` | 最小执行单元 |
| **Manager** | `src/Manager.js` | 协调器，分派任务给执行者 |

## DAG 示例

```
                    Goal: 完成市场分析报告
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │ SubGoal │       │ SubGoal │       │ SubGoal │
   │ 数据采集 │       │ 数据分析 │       │ 报告生成 │
   │  sg1    │       │  sg2    │       │  sg3    │
   └────┬────┘       └────┬────┘       └────┬────┘
        │                 │                 │
        │ dependsOn       │ dependsOn       │ dependsOn
        │ []              │ [sg1]          │ [sg2]
        ▼                 ▼                 ▼
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │  Task   │       │  Task   │       │  Task   │
   │ 搜索新闻│       │ 分析数据│       │ 生成报告│
   │  t1     │       │  t2     │       │  t3     │
   └─────────┘       └─────────┘       └─────────┘
```

## Goal 类

### 构造函数

```javascript
import { Goal } from './Goal.js';

const goal = new Goal({
  goalId: 'goal-123',           // Goal ID
  description: '完成市场分析',  // 目标描述
  config: {
    maxRetries: 3,             // 最大重试次数
    parallelTasks: 1,          // 最大并行任务数
  },
});
```

### DAG 解析

```javascript
// 定义 DAG 规格
const dagSpec = [
  {
    id: 'sg1',                    // SubGoal ID
    description: '数据采集',
    dependsOn: [],                // 无依赖
    sequential: ['t1', 't2'],   // Task 执行顺序
    tasks: [
      {
        id: 't1',
        description: '搜索新闻',
        tool: 'web_search',
        args: { query: 'AI 最新动态' },
      },
      {
        id: 't2',
        description: '获取数据',
        tool: 'web_fetch',
        args: { url: 'https://...' },
      },
    ],
  },
  {
    id: 'sg2',
    description: '数据分析',
    dependsOn: ['sg1'],           // 依赖 sg1
    tasks: [
      {
        id: 't3',
        description: '分析数据',
        tool: 'exec',
        args: { command: 'python analyze.py' },
      },
    ],
  },
];

// 解析为 DAG 结构
goal.parse(dagSpec);

// 或手动添加 SubGoal
const subGoal = new SubGoal({ subGoalId: 'sg1', description: '...' });
goal.addSubGoal(subGoal);
```

### 执行方法

```javascript
// 开始执行
goal.start();

// 获取可执行的 Tasks
const tasks = goal.getExecutableTasks();

// 获取下一个可执行的 Task（按 DAG 顺序）
const nextTask = goal.getNextTask();

// 获取可并行的 Tasks
const parallelTasks = goal.getParallelTasks(3);

// 获取可执行的 SubGoals
const readySubGoals = goal.getReadySubGoals();

// Task 完成回调
goal.onTaskComplete(taskId, success, result, error);

// 事件注册
goal.onTaskAssigned(callback);         // Task 分派
goal.onSubGoalCompleted(callback);     // SubGoal 完成
goal.onGoalCompleted(callback);       // Goal 完成
goal.onGoalFailed(callback);          // Goal 失败
```

### 状态查询

```javascript
// 获取进度
const progress = goal.getProgress();  // 0-100

// 获取统计
const stats = goal.getStats();
// {
//   totalTasks: 5,
//   pending: 2,
//   running: 1,
//   success: 2,
//   failed: 0,
//   progress: 40,
// }

// 获取概要
const summary = goal.getSummary();
// {
//   id: 'goal-123',
//   description: '...',
//   status: 'in_progress',
//   progress: 40,
//   stats: {...},
// }

// 获取完整状态树
const tree = goal.getTree();

// 是否完成
const done = goal.isDone();

// 重试失败的 Tasks
goal.retryFailedTasks();

// 取消 Goal
goal.cancel();
```

### 持久化

```javascript
// 导出状态
const data = goal.export();

// 从导出数据恢复
import { Goal } from './Goal.js';
const restoredGoal = Goal.fromExport(data);
```

## SubGoal 类

### 构造函数

```javascript
import { SubGoal } from './SubGoal.js';

const subGoal = new SubGoal({
  subGoalId: 'sg1',
  description: '数据采集',
  parentId: 'goal-123',          // 父节点 ID
  dependsOn: [],                 // DAG 依赖
  sequential: ['t1', 't2'],     // 执行顺序
});
```

### 状态

```javascript
import { SubGoalStatus } from './SubGoal.js';

SubGoalStatus.PENDING;      // 待执行（等待依赖）
SubGoalStatus.READY;       // 可执行（依赖已满足）
SubGoalStatus.IN_PROGRESS; // 执行中
SubGoalStatus.COMPLETED;   // 已完成
SubGoalStatus.FAILED;      // 失败
```

### 状态转换

```
                         ┌──────────────┐
                         │   PENDING    │ ← 初始状态
                         └──────┬───────┘
                                │ markReady()
                                ▼
                         ┌──────────────┐
                         │    READY     │
                         └──────┬───────┘
                                │ 有 Task 开始执行
                                ▼
                         ┌──────────────┐
                         │ IN_PROGRESS  │
                         └──────┬───────┘
                                │ 所有 Task 完成
                    ┌───────────┴───────────┐
                    ▼                       ▼
             ┌──────────────┐         ┌──────────────┐
             │  COMPLETED   │         │    FAILED    │
             └──────────────┘         └──────────────┘
```

## Task 类

### 构造函数

```javascript
import { Task } from './Task.js';

const task = new Task({
  taskId: 't1',
  description: '搜索新闻',
  tool: 'web_search',
  args: { query: 'AI 最新动态' },
  subGoalId: 'sg1',              // 所属 SubGoal
  maxAttempts: 3,                // 最大尝试次数
  acceptanceCriteria: {          // 验收标准
    type: 'rules',
    checks: [
      { field: 'success', operator: 'equals', value: true },
      { field: 'response.data.length', operator: 'greaterThan', value: 0 },
    ],
  },
});
```

### 状态

```javascript
import { TaskStatus } from './Task.js';

TaskStatus.PENDING;   // 待执行
TaskStatus.RUNNING;   // 执行中
TaskStatus.SUCCESS;   // 成功
TaskStatus.FAILED;    // 失败
TaskStatus.RETRY;     // 重试中
```

### 验收标准

Task 支持三种验收方式：

#### 1. 函数式验收

```javascript
const task = new Task({
  // ...
  acceptanceCriteria: {
    type: 'function',
    fn: (result) => {
      return result.success && result.data.length > 0;
    },
  },
});
```

#### 2. 规则式验收

```javascript
const task = new Task({
  // ...
  acceptanceCriteria: {
    type: 'rules',
    checks: [
      // 基础比较
      { field: 'status', operator: 'equals', value: 'success' },
      { field: 'code', operator: 'notEquals', value: 500 },
      
      // 数值比较
      { field: 'count', operator: 'greaterThan', value: 0 },
      { field: 'count', operator: 'lessThan', value: 100 },
      { field: 'count', operator: 'greaterThanOrEqual', value: 1 },
      
      // 字符串操作
      { field: 'name', operator: 'contains', value: 'test' },
      { field: 'name', operator: 'startsWith', value: 'api' },
      { field: 'name', operator: 'endsWith', value: '.json' },
      { field: 'name', operator: 'matches', value: '^[a-z]+$' },
      
      // 空值检查
      { field: 'error', operator: 'isNull', value: null },
      { field: 'data', operator: 'isNotNull', value: null },
      { field: 'data', operator: 'isEmpty', value: null },
      { field: 'data', operator: 'isNotEmpty', value: null },
      
      // 数组操作
      { field: 'items', operator: 'in', value: ['a', 'b'] },
      { field: 'items', operator: 'notIn', value: ['x', 'y'] },
      { field: 'items', operator: 'hasLength', value: 3 },
      { field: 'items', operator: 'lengthGreaterThan', value: 0 },
      
      // 对象操作
      { field: 'data', operator: 'hasKey', value: 'id' },
      
      // 嵌套字段
      { field: 'response.data.items.length', operator: 'greaterThan', value: 0 },
      { field: 'response.headers.content-type', operator: 'contains', value: 'json' },
    ],
  },
});
```

#### 3. 描述式验收（人工）

```javascript
const task = new Task({
  // ...
  acceptanceCriteria: {
    type: 'description',
    description: '报告包含关键结论和数据来源',
  },
});

// 需要人工确认
if (task.requiresManualReview()) {
  // 显示人工验收提示
  const accepted = await askHumanReview(task.acceptanceCriteria.reviewPrompt);
  task.confirmAcceptance(accepted, '人工确认备注');
}
```

### 验收方法

```javascript
// 执行后自动验收
task.succeed(result);
// 或手动验收
const validation = task.validate(result);

// 检查结果
task.isAccepted();              // 是否达标
task.requiresManualReview();    // 是否需要人工验收
task.confirmAcceptance(true);   // 人工确认

// 失败处理
task.fail('错误信息');
task.canRetry();                // 是否可重试
```

## Manager 类

### 构造函数

```javascript
import { Manager } from './Manager.js';

const manager = new Manager({
  workspace: workSpace,          // 关联的工作空间
  config: {
    maxParallelTasks: 3,        // 最大并行任务数
    autoResolve: false,         // 自动分解任务
    enableRetry: true,           // 启用自动重试
  },
});
```

### 提交任务

```javascript
// 显式 DAG 模式
const goal = await manager.submit('分析市场', {
  dagSpec: [
    { id: 'sg1', tasks: [{ id: 't1', tool: 'web_search', args: {} }] },
    { id: 'sg2', dependsOn: ['sg1'], tasks: [{ id: 't2', tool: 'exec', args: {} }] },
  ],
});

// 同步执行（等待完成）
const result = await manager.execute('搜索新闻并总结', {
  dagSpec: [...],
});

// 返回结果
// {
//   success: true,
//   goalId: 'goal-123',
//   result: { t1: {...}, t2: {...} },
//   stats: { totalTasks: 2, success: 2, failed: 0 },
// }
```

### 事件回调

```javascript
manager.onTaskAssigned((task, memberId) => {
  console.log(`Task ${task.id} 分配给 ${memberId}`);
});

manager.onTaskComplete((task, success, result, error) => {
  console.log(`Task ${task.id} 完成: ${success}`);
});

manager.onGoalComplete((goal) => {
  console.log(`Goal ${goal.id} 完成`);
});

manager.onGoalFailed((goal, stats) => {
  console.log(`Goal 失败: ${stats.failedTasks}/${stats.totalTasks}`);
});
```

## 测试

```bash
node tests/TestGoalDag.js
```

## 测试用例

| 测试 | 说明 |
|------|------|
| 简单 Goal | 无依赖的 SubGoal 和 Task |
| 顺序执行 | sequential 定义的执行顺序 |
| DAG 依赖 | dependsOn 定义的依赖关系 |
| 失败重试 | Task 失败后的重试机制 |
| 进度跟踪 | 实时获取执行进度 |
| 持久化 | 导出/导入 Goal 状态 |
| 验收标准 | 规则式验收 |
| 函数式验收 | 自定义函数验收 |
| 人工验收 | 描述式验收 |
| 嵌套字段 | deep.access.path 支持 |
