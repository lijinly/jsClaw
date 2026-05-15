# WorkSpace —— 统一工作空间

> 管理多个 Member，统一任务路由，自动加载工作记忆

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                      WorkSpace 架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                      WorkSpace                          │  │
│   │                    工作空间主入口                        │  │
│   │  ┌─────────────────────────────────────────────────┐   │  │
│   │  │                    Member                        │   │  │
│   │  │              Agent (with Persona)               │   │  │
│   │  │  • identity (身份描述)                          │   │  │
│   │  │  • soul (性格描述)                               │   │  │
│   │  │  • skills (技能列表)                            │   │  │
│   │  └─────────────────────────────────────────────────┘   │  │
│   │  ┌─────────────────────────────────────────────────┐   │  │
│   │  │                   Memory                         │   │  │
│   │  │                  工作空间记忆                    │   │  │
│   │  └─────────────────────────────────────────────────┘   │  │
│   │  ┌─────────────────────────────────────────────────┐   │  │
│   │  │                  Manager                         │   │  │
│   │  │                    协调器                       │   │  │
│   │  └─────────────────────────────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## WorkSpace 类

### 构造函数

```javascript
import { WorkSpace } from './WorkSpace.js';

const workspace = new WorkSpace({
  id: 'default',                    // WorkSpace ID
  name: '默认工作空间',               // 名称
  description: '主要工作区域',        // 描述
  configPath: './config/default.json', // 配置文件路径
  systemConfig: systemConfig,         // 系统配置实例
});
```

### 初始化

```javascript
await workspace.initialize();
// 自动加载：
// 1. Config 配置
// 2. Members 成员
// 3. WorkspaceMemory 记忆
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

// 获取所有 Members
const allMembers = workspace.getAllMembers();

// 获取默认 Member
const defaultMember = workspace.getDefaultMember();

// 移除 Member（不能移除 default）
workspace.removeMember('coder');

// 列出所有 Members
workspace.listMembers();

// 获取 Member 概要
const summaries = workspace.getMemberSummaries();
// [{ id, name, identity, skills }]
```

### 任务执行

```javascript
// 默认 Member 执行
const result = await workspace.submitTask('帮我搜索新闻');

// 指定 Member 执行
const result = await workspace.submitTask({
  description: '分析代码',
  memberId: 'coder',
});

// 多 Member 协作
const result = await workspace.submitTask({
  description: '完成项目',
  memberIds: ['coder', 'tester'],
});
```

### 返回结果格式

```javascript
// 单 Member 执行
{
  success: true,
  executor: 'Member',
  executorName: '开发者',
  memberId: 'coder',
  result: {
    thinking: '...',
    actions: [...],
    result: '...',
  },
}

// 多 Member 协作
{
  success: true,
  executor: 'Members',
  membersUsed: ['coder', 'tester'],
  result: '综合结果...',
  detailedResults: [
    { memberId: 'coder', result: {...} },
    { memberId: 'tester', result: {...} },
  ],
}

// Member 不存在
{
  success: false,
  error: 'Member "xxx" 不存在',
  availableMembers: [...],
}
```

### 工作空间记忆

```javascript
// 获取记忆实例
const memory = workspace.getMemory();

// 获取用于 system prompt 的记忆
const promptContent = workspace.getMemoryForPrompt();

// 保存内容为记忆
workspace.saveMemory('项目配置信息', {
  filename: 'project-config',
  category: 'config',
});

// 执行任务时自动注入记忆
const result = await member.execute('分析项目', {
  workspaceMemory: workspace.getMemoryForPrompt(),
});
```

### 信息查询

```javascript
// 获取 WorkSpace 信息
const info = workspace.getInfo();
// {
//   id: 'default',
//   name: '默认工作空间',
//   description: '...',
//   memberCount: 3,
//   members: [...],
//   defaultMember: {...},
//   memory: { count: 5, dir: '...' },
// }
```

## Member 类

Member 继承自 Agent，拥有 Think-Act 能力，同时具备人格配置。

### 构造函数

```javascript
import { Member } from './Member.js';

const member = new Member('coder', {
  name: '开发者',                // 显示名称
  identity: '专业软件开发者...',  // 身份描述
  soul: '逻辑严谨，注重效率...',  // 性格描述
  skills: ['read', 'write', 'exec'], // 技能列表
  maxRounds: 10,                 // 最大执行轮次
  verbose: false,                // 详细日志
});
```

### 构建 System Prompt

```javascript
// 完整 prompt（含人格 + 记忆）
const prompt = member.buildSystemPrompt(workspaceMemory);
// 输出格式：
// # 身份定义
// <identity>
//
// # 性格特征
// <soul>
//
// # 角色定位
// 你是 <name>。
//
// # 可用技能
// 你拥有以下技能：<skills>
//
// # 工作空间记忆
// <memory content>
```

### 执行任务

```javascript
// 基础执行
const result = await member.execute('分析代码', {
  verbose: true,               // 打印详细日志
  history: [],                  // 对话历史
  usePersona: true,            // 使用人格配置
  workspaceMemory: '...',       // 工作空间记忆
});

// 带 guidance 执行
const result = await member.execute('审查代码', {
  guidance: {
    keyRequirements: '发现潜在bug',
    suggestedTools: ['read', 'exec'],
    executionSteps: '1. 读取代码 2. 分析逻辑',
  },
});
```

### 技能管理

```javascript
// 获取技能列表
const skills = member.getSkillNames();
// ['read', 'write', 'exec', 'web_search', ...]

// 检查是否有某技能
const hasIt = member.hasSkill('web_search');

// 获取基础技能（系统内置）
const baseSkills = member.baseSkills;

// 获取所有技能（基础 + 角色）
const allSkills = member.allSkills;
```

### 信息查询

```javascript
// 获取详细信息
const info = member.getInfo();
// {
//   id: 'coder',
//   name: '开发者',
//   role: '专业软件开发者',
//   skillCount: 5,
//   skills: [...],
//   taskCount: 10,
//   isActive: false,
// }

// 获取概要
const summary = member.getSummary();
// { id, name, role, skillCount }
```

## Config 系统配置

### 配置文件结构

```
config/
├── system.json           ← 系统配置
└── workspaces/
    └── default.json      ← workspace 配置（含 members）
```

### system.json

```json
{
  "version": "1.0.0",
  "paths": {
    "workspaces": "config/workspaces/",
    "data": "data/",
    "logs": "logs/"
  },
  "workspaces": {
    "default": {
      "id": "default",
      "name": "默认工作空间",
      "description": "系统启动时自动创建",
      "configPath": "config/workspaces/default.json"
    }
  },
  "system": {
    "defaultWorkspaceId": "default",
    "maxRounds": 10,
    "verbose": false
  }
}
```

### workspace 配置 (default.json)

```json
{
  "path": "data/workspaces/default",
  "members": [
    {
      "id": "default",
      "name": "管理者",
      "identity": "工作空间管理者和执行者",
      "soul": "高效、专业、可靠",
      "skills": []
    },
    {
      "id": "coder",
      "name": "开发者",
      "identity": "专业软件开发者，擅长代码编写和调试",
      "soul": "逻辑严谨，注重代码质量",
      "skills": ["read", "write", "edit", "exec"]
    },
    {
      "id": "researcher",
      "name": "研究员",
      "identity": "专业研究员，擅长信息收集和分析",
      "soul": "求知欲强，注重事实",
      "skills": ["web_search", "web_fetch"]
    }
  ]
}
```

### Config API

```javascript
import { Config, getConfig } from './Config.js';

// 获取单例
const config = getConfig();

// 获取 workspace 配置
const workspace = config.getWorkspace('default');

// 获取 workspace 的 members
const members = config.getWorkspaceMembers('default');

// 获取 workspace 的记忆目录
const memoryPath = config.getWorkspaceMemoryPath('default');

// 获取 workspace 的数据目录
const dataPath = config.getWorkspaceDataPath('default');

// 列出所有 workspaces
const list = config.listWorkspaces();

// 获取系统配置
const sysConfig = config.getConfig();
```

## Zone —— Workspace 生命周期管理

Zone 负责 Workspace 的创建、加载、保存和销毁。

### 目录结构

```
data/zones/<zoneId>/
├── meta.json          ← Zone 元信息
├── workspaces/
│   ├── <workspaceId>/
│   │   ├── state.json  ← Workspace 运行时状态
│   │   ├── config.json ← Workspace 配置
│   │   └── .memory/   ← Workspace 记忆
│   └── ...
└── cache/             ← Zone 缓存
```

### Zone API

```javascript
import { Zone, ZoneManager, getZoneManager } from './Zone.js';

// 使用 ZoneManager
const zm = getZoneManager();

// 创建 Zone
const zone = await zm.createZone({ zoneId: 'dev', name: '开发Zone' });

// 获取 Zone
const zone = await zm.getZone('dev');

// 获取默认 Zone
const defaultZone = await zm.getDefaultZone();

// 创建 Workspace
await zone.createWorkspace({
  workspaceId: 'project1',
  name: '项目1',
  description: '新项目',
  members: [...],
});

// 加载 Workspace
const ws = await zone.loadWorkspace('project1');

// 保存 Workspace
await zone.saveWorkspace('project1');

// 卸载 Workspace
await zone.unloadWorkspace('project1');

// 删除 Workspace
await zone.deleteWorkspace('project1', { force: true });

// 保存所有
await zone.saveAll();

// 列出所有 Zone
const zones = zm.listZones();

// 删除 Zone
await zm.deleteZone('dev');
```

## 任务路由

```
用户输入
    │
    ▼
WorkSpace.submitTask(task)
    │
    ├─── 有 memberId ───→ executeWithMember(memberId)
    │                            │
    │                            ▼
    │                      member.execute(task)
    │
    ├─── 有 memberIds ──→ executeWithMembers(memberIds)
    │                            │
    │                            ▼
    │                      并行/顺序执行
    │
    └─── 无指定 ────────→ executeWithMember('default')
                                 │
                                 ▼
                          defaultMember.execute(task)
```

## 测试

```bash
node tests/DemoWorkspace.js
```
