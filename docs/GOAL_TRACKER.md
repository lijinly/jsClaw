# GoalTracker —— 目标保持机制

## 概述

GoalTracker 是 jsClaw 的核心组件，负责追踪和管理长期目标，确保 Agent 在多轮对话中保持目标一致性。

## 核心功能

```
┌─────────────────────────────────────────────────────┐
│                    GoalTracker                       │
├─────────────────────────────────────────────────────┤
│  🎯 目标创建      → 设置描述、优先级、标签            │
│  📊 进度追踪      → 百分比进度、检查点自动更新        │
│  ✅ 成就记录      → 记录关键成果                      │
│  ⚠️ 阻碍管理      → 记录问题，便于后续解决            │
│  🔄 上下文注入    → 自动生成目标摘要到Agent           │
└─────────────────────────────────────────────────────┘
```

## 快速开始

### 方式1：独立使用 GoalTracker

```javascript
import { GoalTracker, GoalPriority } from './src/GoalTracker.js';

const tracker = new GoalTracker();

// 创建目标
const goal = tracker.createGoal('完成量化策略开发', {
  priority: GoalPriority.HIGH,
  tags: ['量化', '策略'],
});

// 添加检查点
tracker.addCheckpoint(goal.id, '完成数据采集模块');
tracker.addCheckpoint(goal.id, '实现回测引擎');
tracker.addCheckpoint(goal.id, '参数优化');

// 完成检查点
tracker.completeCheckpoint(goal.id, checkpointId, '使用akshare');

// 获取目标上下文（注入Agent）
const context = tracker.getGoalContext();
```

### 方式2：集成到 Agent（推荐）

```javascript
import { Agent } from './src/agent.js';

const agent = new Agent({
  name: '量化助手',
  role: '量化投资分析助手',
  goalTracker: { autoSave: true },
});

// 创建目标
const goal = agent.createGoal('分析市场趋势', {
  priority: 3,  // 高优先级
  tags: ['市场'],
});

// 添加检查点
agent.addGoalCheckpoint('获取数据');
agent.addGoalCheckpoint('技术分析');
agent.addGoalCheckpoint('生成报告');

// 更新进度
agent.updateGoalProgress(50);

// 记录成就
agent.addGoalAchievement('成功获取沪深300数据');

// 记录阻碍
agent.addGoalBlocker('API限流');

// 运行Agent（自动注入目标上下文）
const result = await agent.run('生成今日报告');
```

## 目标状态

| 状态 | 说明 |
|------|------|
| `active` | 进行中 |
| `completed` | 已完成 |
| `paused` | 已暂停 |
| `cancelled` | 已取消 |
| `failed` | 失败 |

## 优先级

| 优先级 | 值 | 说明 |
|--------|-----|------|
| `LOW` | 1 | 低 |
| `NORMAL` | 2 | 普通 |
| `HIGH` | 3 | 高 |
| `CRITICAL` | 4 | 紧急 |

## API 列表

### 目标管理

```javascript
// 创建目标
createGoal(description, options)

// 获取目标
getGoal(goalId)           // 获取指定目标
getActiveGoal()           // 获取当前活跃目标
getAllGoals(status)       // 获取所有目标（可选按状态过滤）

// 设置活跃目标
setActiveGoal(goalId)

// 更新进度
updateProgress(goalId, progress)  // 0-100

// 完成目标
completeGoal(goalId, result)

// 暂停/恢复/取消
pauseGoal(goalId, reason)
resumeGoal(goalId)
cancelGoal(goalId, reason)
```

### 检查点管理

```javascript
// 添加检查点
addCheckpoint(goalId, description, options)

// 完成检查点
completeCheckpoint(goalId, checkpointId, result)
```

### 上下文记录

```javascript
// 记录成就
addAchievement(goalId, description)

// 记录阻碍
addBlocker(goalId, description)
```

### 上下文生成

```javascript
// 获取目标上下文（注入Agent）
getGoalContext(goalId)

// 获取简短摘要
getGoalSummary(goalId)
```

### 持久化

```javascript
// 导出数据
export()

// 导入数据
import(data)

// 保存到文件
await save()

// 从文件加载
await load()
```

## 生成的目标上下文格式

```
## 当前目标
- **目标**: 完成量化策略开发
- **优先级**: 高
- **进度**: 67%
- **状态**: 进行中
- **标签**: 量化, 策略

### 检查点
- [✓] 完成数据采集模块
- [✓] 实现回测引擎
- [ ] 参数优化

### 近期成就
- 成功获取沪深300历史数据

### 注意事项
⚠️ 当前阻碍:
- 回测速度过慢
```

## 使用场景

### 场景1：长周期量化任务

```javascript
const agent = new Agent({ goalTracker: { autoSave: true } });

// 创建项目目标
agent.createGoal('开发股票择时策略', { tags: ['量化', '策略'] });
agent.addGoalCheckpoint('需求分析');
agent.addGoalCheckpoint('数据采集');
agent.addGoalCheckpoint('特征工程');
agent.addGoalCheckpoint('模型训练');
agent.addGoalCheckpoint('回测验证');
agent.addGoalCheckpoint('实盘模拟');

// 每次运行更新进度
for (const task of tasks) {
  await agent.run(task);
  agent.updateGoalProgress(calculateProgress());
  agent.addGoalAchievement(`完成: ${task}`);
}
```

### 场景2：多目标并行管理

```javascript
// 多个独立目标
const goal1 = agent.createGoal('优化回测引擎');
const goal2 = agent.createGoal('研究机器学习选股');

// 切换活跃目标
agent.setActiveGoal(goal2.id);

// 专注goal2
await agent.run('分析特征重要性');

// 切换回goal1
agent.setActiveGoal(goal1.id);
```

### 场景3：事件监听

```javascript
tracker.on('onGoalCompleted', (goal) => {
  console.log(`🎉 目标完成: ${goal.description}`);
  sendNotification(goal);
});

tracker.on('onGoalUpdated', (goal) => {
  logProgress(goal);
});
```

## 与 ContextManager 配合

```javascript
const agent = new Agent({
  contextManager: { maxTokens: 6000 },
  goalTracker: { autoSave: true },
});

// ContextManager 控制 token 消耗
// GoalTracker 保持目标一致性
// 两者协同工作，长对话也能保持目标清晰
```

## 注意事项

1. **自动保存**：启用 `autoSave` 后，目标会自动持久化到文件
2. **上下文注入**：默认自动注入目标到 Agent system prompt
3. **检查点进度**：完成检查点会自动更新目标进度
4. **目标历史**：完成/取消的目标会移到 `goalHistory`
