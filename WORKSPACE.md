# WorkSpace —— 工作空间

## 🏠 什么是 WorkSpace？

WorkSpace 是统一的工作空间入口，负责：
1. 创建和管理 Team 的生命周期
2. 根据任务是否带有 `teamId`，智能路由到指定 Team 或 Agent
3. 返回 Team 或 Agent 完成的结果给用户

### WorkSpace 的核心职责

```javascript
WorkSpace {
  // 1. Team 生命周期管理
  createTeam(config)     // 创建 Team
  destroyTeam(teamId)    // 销毁 Team
  initialize()           // 初始化系统

  // 2. 任务路由
  submitTask(task)       // 提交任务（带 teamId → Team，不带 → Agent）

  // 3. Team 访问控制
  enterTeam(teamId)      // 进入 Team
  exitTeam()             // 退出 Team
  listTeams()            // 列出所有 Teams
}
```

### 任务路由逻辑

```
用户提交任务
    │
    ├─→ 有 teamId？
    │   ├─ 是 → 交给指定 Team 执行
    │   │         ↓
    │   │      Team Leader 组织 TeamMembers 协作
    │   │         ↓
    │   │      返回结果
    │   │
    │   └─ 否 → 交给 Agent 执行
    │             ↓
    │          Agent 使用 Think-Act 模式完成
    │             ↓
    │          返回结果
```

## 📝 使用示例

### 基础用法

```javascript
import 'dotenv/config';
import { initLLM } from './llm.js';
import { WorkSpace } from './WorkSpace.js';

// 初始化 LLM
initLLM();

// 创建 WorkSpace
const workspace = new WorkSpace();
await workspace.initialize();

// 场景 1: 不带 teamId 的任务（交给 Agent）
const result1 = await workspace.submitTask('现在几点了？');
console.log(result1.executor); // 'Agent'
console.log(result1.result);   // 执行结果

// 场景 2: 带 teamId 的任务（交给指定 Team）
const result2 = await workspace.submitTask({
  description: '帮我列出当前目录的文件',
  teamId: 'dev-team',
});
console.log(result2.executor); // 'Team'
console.log(result2.executorName); // 'dev-team'
console.log(result2.result);   // 执行结果
```

### Team 生命周期管理

```javascript
import { WorkSpace } from './WorkSpace.js';

const workspace = new WorkSpace();
await workspace.initialize();

// 1. 创建新的 Team
const newTeam = await workspace.createTeam({
  id: 'my-team',
  name: '我的团队',
  description: '用于特定任务',
  teamMembers: [
    {
      id: 'member-1',
      role: 'developer',
      skills: ['code-analysis', 'file-editing'],
    },
  ],
});

// 2. 使用 Team
await workspace.enterTeam('my-team');
const result = await workspace.submitTask('分析代码结构');

// 3. 销毁 Team
await workspace.destroyTeam('my-team');
```

### Team 访问控制

```javascript
import { WorkSpace } from './WorkSpace.js';

const workspace = new WorkSpace();
await workspace.initialize();

// 列出所有 Teams
workspace.listTeams();

// 进入 Team
await workspace.enterTeam('dev-team');

// 在 Team 内提交任务
const result = await workspace.submitTask({
  description: '读取 package.json',
  // 不需要 teamId，会自动使用当前 Team
});

// 退出 Team
await workspace.exitTeam();
```

## 🏗️ 架构设计

### 核心组件

```
WorkSpace（统一入口）
  │
  ├─ Agent（单一执行者）
  │   ├─ Think-Act 模式
  │   ├─ 基础工具（read, write, list, exec 等）
  │   └─ 执行简单任务
  │
  ├─ TeamRegistry（Team 管理）
  │   ├─ 管理所有 Teams
  │   ├─ 处理 Team 进入/退出
  │   └─ 查找和匹配 Team
  │
  └─ Team（协作团队）
      ├─ TeamLeader（编排者）
      │   └─ 组织 TeamMembers 协作
      │
      └─ TeamMembers（执行者）
           ├─ TeamMember-1（角色：developer）
           ├─ TeamMember-2（角色：researcher）
           └─ ...
```

### 与旧架构的对比

**旧架构（TeamLab）：**
```
用户 → TeamLab → (当前在 Team?)
                     ├─ 是 → Team Leader 执行
                     └─ 否 → Agent 决策
                              ├─ 简单 → 自己完成
                              └─ 复杂 → 建议进入 Team
```

**新架构（WorkSpace）：**
```
用户 → WorkSpace → (任务有 teamId?)
                        ├─ 是 → 指定 Team 执行
                        └─ 否 → Agent 执行
```

**改进点：**
- ✅ 更清晰的路由逻辑：显式指定 `teamId` 或默认使用 Agent
- ✅ 更简单的接口：统一 `submitTask()` 方法
- ✅ 更可控的执行：用户明确知道任务会交给谁执行
- ✅ 保持灵活性：支持进入/退出 Team 的传统模式

## 🔄 任务处理流程

### 场景 1：不带 teamId 的任务

```
用户: workspace.submitTask('现在几点了？')
   ↓
[WorkSpace 检测：没有 teamId]
   ↓
[WorkSpace 路由：交给 Agent]
   ↓
[Agent 执行：Think-Act 模式]
   ├─ Think: 分析任务需求
   ├─ Act: 调用工具获取时间
   └─ 返回结果
   ↓
返回给用户
{
  success: true,
  executor: 'Agent',
  executorName: 'WorkSpace Agent',
  result: '现在是 2026-03-21 21:06'
}
```

### 场景 2：带 teamId 的任务

```
用户: workspace.submitTask({
  description: '分析代码结构',
  teamId: 'dev-team'
})
   ↓
[WorkSpace 检测：有 teamId = 'dev-team']
   ↓
[WorkSpace 路由：交给 dev-team]
   ↓
[Team Leader 接收任务]
   ├─ 分析任务需求
   ├─ 选择合适的 TeamMember
   └─ 组织 TeamMembers 协作执行
   ↓
返回给用户
{
  success: true,
  executor: 'Team',
  executorName: '开发团队',
  teamId: 'dev-team',
  result: '代码结构分析结果...'
}
```

### 场景 3：Team 不存在

```
用户: workspace.submitTask({
  description: '执行任务',
  teamId: 'non-existent-team'
})
   ↓
[WorkSpace 检测：有 teamId = 'non-existent-team']
   ↓
[WorkSpace 查找：Team 不存在]
   ↓
返回错误信息
{
  success: false,
  error: '❌ Team "non-existent-team" 不存在',
  availableTeams: [
    { id: 'dev-team', name: '开发团队' },
    { id: 'research-team', name: '研究团队' }
  ]
}
```

## 📦 API 文档

### WorkSpace 类

#### 构造函数

```javascript
new WorkSpace(configPath = './src/TeamConfig.json')
```

- `configPath` - Team 配置文件路径（可选）

#### 方法

##### `async initialize()`

初始化 WorkSpace，加载配置并创建 Teams。

```javascript
await workspace.initialize();
```

##### `async submitTask(task)`

提交任务（统一接口）。

**参数：**
- `task` - 任务对象或任务描述字符串
  - `description` - 任务描述（如果 `task` 是字符串，则直接使用）
  - `teamId` - 指定 Team ID（可选）

**返回值：**
```javascript
{
  success: boolean,
  executor: 'Agent' | 'Team',
  executorName: string,
  teamId?: string,
  result?: any,
  error?: string,
  availableTeams?: Array<{ id, name }>
}
```

**示例：**
```javascript
// 字符串形式
await workspace.submitTask('现在几点了？');

// 对象形式（不带 teamId）
await workspace.submitTask({ description: '分析代码' });

// 对象形式（带 teamId）
await workspace.submitTask({
  description: '分析代码',
  teamId: 'dev-team'
});
```

##### `async createTeam(teamConfig)`

创建新的 Team。

**参数：**
```javascript
{
  id: string,
  name: string,
  description: string,
  teamMembers: Array<{
    id: string,
    role: string,
    skills: string[]
  }>
}
```

**返回值：** `Team` 实例

##### `destroyTeam(teamId)`

销毁 Team。

**参数：**
- `teamId` - Team ID

**返回值：** `boolean` - 是否成功

##### `async enterTeam(teamId)`

进入 Team。

**参数：**
- `teamId` - Team ID

##### `async exitTeam()`

退出当前 Team。

##### `listTeams()`

列出所有 Teams。

##### `getAllTeams()`

获取所有 Teams。

**返回值：** `Array<Team>` - 所有 Team 实例

##### `getTeam(teamId)`

获取指定 Team。

**参数：**
- `teamId` - Team ID

**返回值：** `Team | null` - Team 实例

##### `getCurrentTeam()`

获取当前活跃 Team。

**返回值：** `Team | null` - 当前活跃 Team 实例

## 📦 相关文件

- `src/WorkSpace.js` - WorkSpace 核心实现
- `src/Agent.js` - Agent 核心实现
- `src/Team.js` - Team 核心实现
- `src/TeamMember.js` - TeamMember 核心实现
- `src/TeamLeader.js` - Team 内的 Leader
- `src/TeamRegistry.js` - Team 注册和管理
- `src/TeamConfig.json` - Team 配置文件
- `src/demo-team.js` - 演示示例

## 🚀 运行演示

```bash
# 运行 Team 系统演示
npm run demo:team
```

演示包含多个场景：
1. 不带 teamId 的任务（交给 Agent）
2. 带 teamId 的任务（交给指定 Team）
3. 进入 Team 后提交任务

## 📋 迁移指南

### 从 TeamLab 迁移到 WorkSpace

**旧代码（TeamLab）：**
```javascript
import { TeamLab } from './TeamLab.js';

const teamSystem = new TeamLab();
await teamSystem.initialize();

// Team 外任务
const result1 = await teamSystem.submitTask('简单任务');

// 进入 Team
await teamSystem.enterTeam('dev-team');

// Team 内任务
const result2 = await teamSystem.submitTask('复杂任务');
```

**新代码（WorkSpace）：**
```javascript
import { WorkSpace } from './WorkSpace.js';

const workspace = new WorkSpace();
await workspace.initialize();

// 交给 Agent
const result1 = await workspace.submitTask('简单任务');

// 交给指定 Team
const result2 = await workspace.submitTask({
  description: '复杂任务',
  teamId: 'dev-team'
});

// 或者进入 Team 后提交
await workspace.enterTeam('dev-team');
const result3 = await workspace.submitTask('复杂任务');
```

**主要变化：**
1. `TeamLab` → `WorkSpace`
2. 显式指定 `teamId` 或默认使用 Agent
3. 返回结果格式统一，包含 `executor` 和 `executorName`

## 🎯 设计原则

1. **显式路由**：通过 `teamId` 显式指定执行者，避免模糊决策
2. **简化接口**：统一 `submitTask()` 方法，支持字符串和对象两种格式
3. **清晰反馈**：返回结果包含执行者信息，用户明确知道谁执行了任务
4. **保持兼容**：支持传统的进入/退出 Team 模式
