# WorkSpace —— 统一工作空间

> 管理多个 Member，统一任务路由，自动加载工作记忆，Session 持久化

## 架构设计

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Zone (单例)                                │
│                    持有 Workspace 实例池 + 注册表                       │
│                                                                      │
│   workspaces: Map<id, Workspace>   ← Workspace 实例（懒加载）          │
│   registry: system.json            ← 持久化注册表                     │
│                                                                      │
│   ┌────────────────────────────────────────────────────────────────┐ │
│   │                      Workspace                                  │ │
│   │  path: 物理路径（用户指定）                                      │ │
│   │  manager: 自建 Manager                                         │ │
│   │  sessions: Map<sessionId, Session>   ← 带文件持久化              │ │
│   │                                                                  │ │
│   │  ├── Manager                                                   │ │
│   │  │   └── Member[]                                             │ │
│   │  │       └── Agent (Think-Act)                                │ │
│   │  │           • identity / soul / skills                        │ │
│   │  │                                                            │ │
│   │  └── Memory (WorkspaceMemory)                                  │ │
│   └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Session 持久化结构

```
<workspace-path>/
└── .workspace/
    └── sessions/
        └── ws-{workspaceId}-s-{sessionId}.json   ← Session 数据
```

### 配置结构

```
config/
├── system.json                ← Zone 注册表（workspace id → path）
└── workspaces/
    └── <id>.json            ← Workspace 专属配置（members 等）

data/                         ← 仅作默认数据目录，不存放 workspace
```

## Zone —— Workspace 实例管理器

Zone 是全局单例，负责 Workspace 的注册、加载和实例化。

### Zone API

```javascript
import { getZone } from './Zone.js';

// 初始化 Zone（扫描 system.json）
await zone.initialize();

// 列出所有 Workspace（仅配置，不实例化）
zone.listWorkspaces();
// [{ id, name, path, createdAt }]

// 创建 Workspace（必须指定物理路径）
await zone.createWorkspace({
  id: 'proj-a',
  name: '项目A',
  path: 'D:/projects/proj-a',   // 用户指定路径
});

// 加载 Workspace（懒加载，返回实例）
const ws = await zone.loadWorkspace('proj-a');

// 获取已加载的 Workspace 实例
const ws = zone.getWorkspace('proj-a');

// 关闭 Workspace（从内存卸载）
await zone.closeWorkspace('proj-a');

// 删除 Workspace（从注册表移除）
await zone.deleteWorkspace('proj-a');

// 获取 Zone 信息
zone.getInfo();
// { zoneId, workspaceCount, loadedCount }
```

## Workspace —— 工作空间

每个 Workspace 关联一个物理路径，拥有自己的 Manager 和 Session 列表。

### 构造函数

```javascript
const ws = new WorkSpace({
  id: 'proj-a',
  name: '项目A',
  path: 'D:/projects/proj-a',    // 物理路径（必填）
  config: { ... },               // Workspace 专属配置
  systemConfig: configInstance,   // 系统配置实例
});
```

### 初始化

```javascript
await workspace.initialize();
// 自动：
// 1. 确保物理路径存在
// 2. 创建 .workspace/sessions/ 目录
// 3. 自建 Manager（加载 members 配置）
// 4. 从 .workspace/sessions/ 恢复 Session 列表
```

### Session 管理

```javascript
// 开始新会话（关联到指定 Member）
const session = await workspace.startSession({ memberId: 'coder' });
// session.id = 'ws-proj-a-s-0f3a9b'

// 获取 Session
const session = workspace.getSession('ws-proj-a-s-0f3a9b');

// 列出所有 Session
workspace.listSessions();
// [{ id, title, memberId, createdAt, updatedAt }]

// 关闭 Session（从内存移除，不删文件）
await workspace.closeSession('ws-proj-a-s-0f3a9b');

// 通过 Session 发送消息
const result = await session.userMessage('帮我写一个函数');
```

### Member 管理

```javascript
// 添加 Member
const member = await workspace.addMember({
  id: 'coder',
  name: '开发者',
  identity: '专业软件开发者',
  soul: '逻辑严谨，注重代码质量',
  skills: ['read', 'write', 'exec'],
});

// 获取 Member
const member = workspace.getMember('coder');

// 获取默认 Member
const defaultMember = workspace.getDefaultMember();

// 获取所有 Members
const allMembers = workspace.getAllMembers();

// 获取 Member 概要
const summaries = workspace.getMemberSummaries();
```

### 任务执行

```javascript
// 默认 Manager 执行
const result = await workspace.submitTask('帮我搜索新闻');

// 指定 Member 执行
const result = await workspace.submitTask({
  description: '分析代码',
  memberId: 'coder',
});

// 多 Member 协作
const result = await workspace.submitTask({
  description: '完成项目',
  memberIds: ['coder', 'researcher'],
});

// 通过 Session 执行（带上下文）
const result = await workspace.getSession(sessionId).userMessage('继续分析');
```

### 返回结果格式

```javascript
// 单 Member 执行
{
  success: true,
  executor: 'Member',
  executorName: '开发者',
  memberId: 'coder',
  result: { thinking: '...', actions: [...], result: '...' },
}

// 多 Member 协作
{
  success: true,
  executor: 'Members',
  membersUsed: ['coder', 'researcher'],
  result: '综合结果...',
  detailedResults: [...],
}

// Member 不存在
{
  success: false,
  error: 'Member "xxx" 不存在',
  availableMembers: [...],
}
```

## Session —— 会话

Session 归属于 Workspace，负责用户 ↔ Member 的对话管理，带文件持久化。

### Session 生命周期

```
workspace.startSession({ memberId })
    ↓
[内存] sessions Map<id, Session>
    ↓ (自动 + 定期)
持久化到 <path>/.workspace/sessions/<id>.json
    ↓
workspace.closeSession(id)
    ↓
从内存移除（文件保留，下次 loadWorkspace 时重新加载）
```

### Session API

```javascript
// 发送消息（带上下文）
const result = await session.userMessage('你好');

// 获取摘要
const summary = session.getSummary();
// { id, title, memberId, messageCount, createdAt, updatedAt }

// 获取聊天历史
const history = session.getChatHistory();
// [{ role: 'user'|'assistant', content: '...' }]

// 重命名会话
session.setTitle('新标题');

// 获取/设置当前 Member
const member = session.getMember();
session.switchMember('coder');

// 手动保存（通常自动）
await session.save();
```

## system.json —— Zone 注册表

```json
{
  "version": "2.0.0",
  "zone": {
    "id": "default",
    "name": "默认Zone"
  },
  "workspaces": {
    "proj-a": {
      "id": "proj-a",
      "name": "项目A",
      "path": "D:/projects/proj-a",
      "configPath": "config/workspaces/proj-a.json",
      "createdAt": "2026-05-16T00:00:00.000Z"
    }
  }
}
```

## Workspace 专属配置 (config/workspaces/<id>.json)

```json
{
  "id": "proj-a",
  "members": [
    {
      "id": "coder",
      "name": "开发者",
      "identity": "专业软件开发者",
      "soul": "逻辑严谨",
      "skills": ["read", "write", "exec"]
    }
  ]
}
```

## Config 系统配置

```javascript
import { getConfig } from './Config.js';

const config = getConfig();

// 获取 Workspace 配置（不含实例）
const wsConfig = config.getWorkspace('proj-a');
// { id, name, path, configPath }

// 获取 Workspace members
const members = config.getWorkspaceMembers('proj-a');

// 获取 Workspace 数据目录（物理路径）
const dataPath = config.getWorkspaceDataPath('proj-a');
// "D:/projects/proj-a"

// 获取 Workspace 记忆目录
const memoryPath = config.getWorkspaceMemoryPath('proj-a');
// "D:/projects/proj-a/.memory"

// 列出所有 Workspace 概要
const list = config.listWorkspaces();
// [{ id, name, description, memberCount }]
```

## 任务路由

```
用户请求
    │
    ▼
Zone.loadWorkspace(id) / getWorkspace(id)
    │
    ▼
Workspace.submitTask(task, opts)
    │
    ├── opts.memberIds  → executeWithMembers()  ← WorkSpace 全局路由
    │
    └── opts.memberId (single) → executeWithMember()
        └── manager.execute(task) / member.execute(task)
            ├── Member → 直接执行（_think + _act）
            └── Manager → Goal 分解 + _dispatchTasks()
```

## 测试

```bash
node tests/DemoWorkspace.js
```
