# WorkSpace —— 工作空间

## 🎯 什么是 WorkSpace？

**WorkSpace** 是统一的工作空间入口，替代了旧的 Team 概念。

### 核心理念

1. **WorkSpace 代替 Team** —— 简化层级，用 WorkSpace 直接管理 Members
2. **默认 Member** —— 每个 WorkSpace 默认有一个 Member 作为管理者和执行者
3. **多 Member 协作** —— 多个 Member 在管理者协调下并行/协作工作
4. **全局默认工作空间** —— 系统启动时自动创建，全局可访问

### 架构图

```
WorkSpace
├── members: Map<id, Member>
│   ├── defaultMember        ← 默认管理者/执行者（始终存在）
│   ├── researcher          ← 研究员
│   ├── coder              ← 开发者
│   └── writer             ← 作者
└── 方法:
    ├── submitTask()       ← 统一任务提交
    ├── addMember()        ← 添加 Member
    └── removeMember()     ← 移除 Member
```

### 全局默认工作空间

系统启动时自动创建一个全局默认工作空间，全局可访问：

```javascript
import { getDefaultWorkspace, executeInDefaultWorkspace } from './index.js';

// 获取全局工作空间
const workspace = getDefaultWorkspace();
workspace.listMembers();

// 快捷执行
const result = await executeInDefaultWorkspace('你好');
```

## 🟢 使用示例

### 基础用法

```javascript
import { WorkSpace } from './WorkSpace.js';

// 创建 WorkSpace
const workspace = new WorkSpace({
  id: 'my-workspace',
  name: '我的工作空间',
});

// 初始化（加载配置，创建 Members）
await workspace.initialize();

// 场景 1: 使用默认 Member 执行（自动路由）
const result1 = await workspace.submitTask('你好');

// 场景 2: 指定 Member 执行
const result2 = await workspace.submitTask({
  description: '查找最新新闻',
  memberId: 'researcher',  // 指定 Member
});

// 场景 3: 多 Member 协作
const result3 = await workspace.submitTask({
  description: '分析项目可行性',
  memberIds: ['default', 'researcher', 'coder'],  // 多个 Member
});
```

### Member 管理

```javascript
// 列出所有 Members
workspace.listMembers();

// 添加新 Member
await workspace.addMember({
  id: 'analyst',
  name: '分析师',
  role: '专业数据分析员',
  skills: ['read', 'write', 'exec'],
});

// 移除 Member（不能移除 default）
workspace.removeMember('analyst');

// 获取 Member 信息
const member = workspace.getMember('researcher');
console.log(member.getInfo());
```

### 获取 WorkSpace 信息

```javascript
const info = workspace.getInfo();
// {
//   id: 'my-workspace',
//   name: '我的工作空间',
//   memberCount: 4,
//   members: [...],
//   defaultMember: { id: 'default', name: '管理者' }
// }
```

## 🔵 任务路由逻辑

```
用户提交任务
    │
    ├─ 有 memberIds ──────→ 多个 Member 协作执行
    │
    ├─ 有 memberId ───────→ 指定 Member 执行
    │
    └─ 无指定 ────────────→ 默认 Member (default) 执行
```

### 返回结果格式

```javascript
// 单 Member 执行
{
  success: true,
  executor: 'Member',
  executorName: '研究者',
  memberId: 'researcher',
  result: '执行结果...'
}

// 多 Member 协作
{
  success: true,
  executor: 'Members',
  membersUsed: ['default', 'researcher', 'coder'],
  result: '整合后的结果...',
  detailedResults: [...]
}

// 错误情况
{
  success: false,
  error: 'Member "xxx" 不存在',
  availableMembers: [...]  // 提供可用 Member 列表
}
```

## 🟣 Member 类

### Member 基于 Agent

Member 继承自 Agent，拥有：
- **Think-Act 模式** —— 分析 + 执行的智能循环
- **基础工具集** —— read, write, list, exec 等内置工具
- **角色技能** —— 根据配置加载的专业技能
- **人格系统** —— 从 identity.md 和 soul.md 加载身份和性格

### Member 特点

```javascript
class Member extends Agent {
  // 每个 Member 有：
  id: string           // 唯一标识
  name: string         // 显示名称
  role: string         // 角色描述
  skills: string[]     // 技能列表
  identity: string     // 身份描述（来自 identity.md）
  soul: string         // 性格特征（来自 soul.md）

  // 核心方法
  execute(task, options)      // 执行任务
  getSkillNames()             // 获取技能清单
  hasSkill(skillName)         // 检查技能
  buildSystemPrompt()          // 构建完整的 system prompt
  getPersonaPrompt()          // 获取带人格的 prompt
}
```

### 🎭 Member 人格系统

Member 支持从 `identity.md` 和 `soul.md` 文件加载身份和性格，构建更丰富的人格特征。

#### 文件位置

有两种方式指定人格文件路径：

**方式一：约定路径**（推荐）
```
members/<memberId>/
├── identity.md   # 身份定义
└── soul.md       # 性格特征
```

**方式二：显式配置**

在 `WorkSpaceConfig.json` 中指定：
```json
{
  "defaultMember": {
    "id": "default",
    "name": "管理者",
    "identityPath": "members/default/identity.md",
    "soulPath": "members/default/soul.md"
  }
}
```

#### 文件格式

**identity.md** - 身份定义示例：
```markdown
你是 jsClaw 系统的核心管理者。

## 基本身份
- **名称**: 管理者
- **定位**: 工作空间的核心协调者和执行者
- **职责**: 协调任务、管理资源

## 能力边界
- 擅长分析问题本质
- 能够合理调度和分配任务
```

**soul.md** - 性格特征示例：
```markdown
## 核心性格特征

### 工作风格
- **务实高效**: 先做再说
- **简洁直接**: 避免冗余

### 沟通态度
- **专业严谨**: 保持专业水准
- **适度幽默**: 轻松场合可以幽默

### 禁忌
- 不喜欢夸夸其谈没有实质内容
```

#### System Prompt 构建

Member 执行任务时，会自动构建完整的 system prompt：

```javascript
buildSystemPrompt() {
  const parts = [];
  if (this.identity) parts.push(`# 身份定义\n${this.identity}`);
  if (this.soul) parts.push(`# 性格特征\n${this.soul}`);
  if (this.role) parts.push(`# 角色定位\n你是 ${this.name}。${this.role}`);
  if (this.allSkills.length > 0) parts.push(`# 可用技能\n${this.allSkills.join(', ')}`);
  return parts.join('\n\n');
}
```

#### 已有的人格文件

项目已预置以下 Member 的人格文件：

| Member | identity.md | soul.md |
|--------|-------------|---------|
| default | ✅ | ✅ |
| researcher | ✅ | ✅ |
| coder | ✅ | ✅ |
| writer | ❌ | ❌ |

## 🟡 配置文件

`WorkSpaceConfig.json` 配置文件示例：

```json
{
  "defaultMember": {
    "id": "default",
    "name": "管理者",
    "role": "工作空间管理者和执行者",
    "skills": []
  },
  "members": {
    "researcher": {
      "id": "researcher",
      "name": "研究员",
      "role": "专业研究员，擅长信息收集和调研",
      "skills": ["web_search", "web_fetch", "read", "list"]
    },
    "coder": {
      "id": "coder",
      "name": "开发者",
      "role": "专业开发者，擅长代码编写和调试",
      "skills": ["read", "write", "edit", "exec", "apply_patch"]
    }
  }
}
```

## 🔴 与旧架构的对比

### 旧架构（TeamLab + Team）

```
用户 → TeamLab → (当前在 Team?)
                  ├─ 是 → Team Leader 决策
                  └─ 否 → Agent 决策
```

### 新架构（WorkSpace + Member）

```
用户 → WorkSpace → submitTask()
                    ├─ memberIds? → 多个 Member 协作
                    ├─ memberId? → 指定 Member
                    └─ 无指定  → defaultMember
```

### 主要改进

| 方面 | 旧架构 | 新架构 |
|------|--------|--------|
| 层级 | TeamLab → Team → Member | WorkSpace → Member |
| 路由 | 隐式判断 | 显式指定 |
| 默认执行 | 需判断场景 | 自动使用 defaultMember |
| 多 Member | Team 内协作 | 直接指定 memberIds |

## 🟤 API 文档

### WorkSpace 类

#### `new WorkSpace(options)`

创建 WorkSpace 实例。

```javascript
const workspace = new WorkSpace({
  id: 'demo',
  name: '演示空间',
  configPath: './WorkSpaceConfig.json',
});
```

#### `async initialize()`

初始化 WorkSpace，加载配置并创建 Members。

```javascript
await workspace.initialize();
```

#### `async submitTask(task)`

提交任务（统一接口）。

```javascript
// 字符串形式
await workspace.submitTask('你好');

// 对象形式 - 使用默认 Member
await workspace.submitTask({
  description: '查找新闻',
});

// 对象形式 - 指定 Member
await workspace.submitTask({
  description: '查找新闻',
  memberId: 'researcher',
});

// 对象形式 - 多 Member 协作
await workspace.submitTask({
  description: '分析可行性',
  memberIds: ['default', 'researcher'],
});
```

#### `async addMember(config)`

添加 Member。

```javascript
await workspace.addMember({
  id: 'analyst',
  name: '分析师',
  role: '数据分析',
  skills: ['read', 'write'],
});
```

#### `removeMember(memberId)`

移除 Member（不能移除 default）。

```javascript
workspace.removeMember('analyst');
```

#### `getMember(memberId)`

获取指定 Member。

#### `getAllMembers()`

获取所有 Members。

#### `getInfo()`

获取 WorkSpace 信息。

### Member 类

#### `execute(task, options)`

执行任务。

```javascript
const result = await member.execute('分析数据', {
  guidance: { keyRequirements, suggestedTools, executionSteps },
  verbose: false,
  history: [],
});
```

#### `getSkillNames()`

获取技能清单。

#### `hasSkill(skillName)`

检查是否拥有技能。

#### `getInfo()`

获取 Member 详细信息。

## 🟢 运行演示

```bash
# 运行 WorkSpace 演示
npm run demo:workspace

# 运行 WorkSpace 测试
npm run test:ws
```

## 📁 相关文件

| 文件 | 说明 |
|------|------|
| `src/WorkSpace.js` | WorkSpace 核心实现 |
| `src/Member.js` | Member 类（基于 Agent） |
| `src/globalWorkspace.js` | 全局默认工作空间管理 |
| `src/index.js` | 入口文件，初始化全局工作空间 |
| `WorkSpaceConfig.json` | 配置文件 |
| `src/demo-workspace.js` | 演示脚本 |
| `src/tests/test-workspace-member.js` | 测试文件 |
