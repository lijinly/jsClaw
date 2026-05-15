# WorkspaceMemory —— 工作空间记忆系统

> 跨会话持久化记忆，自动加载和保存，智能注入到 Agent

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                  WorkspaceMemory 架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    Memory 文件                          │  │
│   │  data/workspaces/<id>/.memory/                        │  │
│   │  ├── MEMORY.md           ← 主记忆文件                  │  │
│   │  ├── 2024-01-15.md       ← 每日记忆                   │  │
│   │  └── <category>/                                       │  │
│   │      └── topic.md       ← 分类记忆                     │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                   WorkspaceMemory                        │  │
│   │                                                         │  │
│   │  • load()        加载所有记忆                          │  │
│   │  • save()        保存记忆                               │  │
│   │  • distill()     提炼内容                               │  │
│   │  • update()      更新现有记忆                           │  │
│   │  • search()      搜索记忆                               │  │
│   │  • getForSystemPrompt() 生成供 Agent 使用的内容        │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                      Agent                               │  │
│   │  systemPrompt + Memory → 更智能的响应                   │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## WorkspaceMemory 类

### 构造函数

```javascript
import { WorkspaceMemory } from './Memory.js';

const memory = new WorkspaceMemory('/path/to/.memory');
```

### 加载和保存

```javascript
// 加载所有 .md 记忆文件
memory.load();

// 保存新记忆
memory.save('这是重要的项目配置信息', 'project-config');
// 保存到: .memory/project-config.md

// 提炼并保存
memory.distill('原始内容', { category: 'config' });
```

### 查询

```javascript
// 搜索记忆
const results = memory.search('关键词');

// 获取记忆数量
const count = memory.getCount();

// 获取记忆摘要
const summary = memory.getSummary({ maxLength: 2000 });

// 获取用于 system prompt 的内容
const promptContent = memory.getForSystemPrompt({
  maxLength: 3000,
  category: null,  // 可按分类过滤
});
```

### 更新和删除

```javascript
// 更新现有记忆
memory.update('project-config', '更新后的内容');

// 删除记忆
memory.delete('project-config');
```

## 文件格式

### 记忆文件结构

```markdown
---
updated: 2024-01-15T10:30:00.000Z
---

# 工作空间记忆 [config]

**提炼时间**: 2024/1/15 上午10:30

## 内容

这是重要的项目配置信息...

## 标签

- config
```

### 自动生成文件名

```javascript
// 无文件名时自动生成
memory.save('内容');
// 文件名: memory-2024-01-15T10-30-00-000Z.md

// 带文件名
memory.save('内容', 'my-note');
// 文件名: my-note.md
```

## 与 WorkSpace 集成

```javascript
import { WorkSpace } from './WorkSpace.js';

const workspace = new WorkSpace({ id: 'default' });
await workspace.initialize();

// 获取记忆
const memory = workspace.getMemory();

// 获取用于 prompt
const prompt = workspace.getMemoryForPrompt();

// 保存内容
workspace.saveMemory('项目进展...', {
  filename: 'weekly-report',
  category: 'report',
});
```

## 与 Agent 集成

### 手动注入

```javascript
import { Agent } from './Agent.js';

const agent = new Agent({
  name: '助手',
  role: '智能助手',
});

// 获取记忆
const workspaceMemory = workspace.getMemoryForPrompt();

// 在执行时传入
const result = await agent.run('分析项目', {
  systemPrompt: `你是助手。

${workspaceMemory}`,
});
```

### 自动注入（通过 Member）

```javascript
import { Member } from './Member.js';

const member = new Member('assistant', {
  name: '助手',
  identity: '专业助手',
});

// Member.execute() 自动接收 workspaceMemory 参数
const result = await member.execute('分析项目', {
  workspaceMemory: workspace.getMemoryForPrompt(),
});
```

## 使用场景

### 1. 记住项目上下文

```javascript
// 重要决策
memory.save(`
项目架构决策:
1. 使用 PostgreSQL 作为主数据库
2. Redis 用于缓存
3. 前端使用 React + TypeScript
`, 'architecture');
```

### 2. 记录进展

```javascript
// 每日进展
memory.save(`
2024-01-15 工作进展:
- 完成用户认证模块
- 修复了登录页面的样式问题
- 下一步: 开发用户管理模块
`, '2024-01-15');
```

### 3. 知识沉淀

```javascript
// 技术知识
memory.save(`
API 设计规范:
- RESTful 风格
- 使用 JSON 格式
- 统一错误响应格式
`, 'api-spec');
```

### 4. 配置同步

```javascript
// 环境配置
memory.save(`
环境配置:
- NODE_ENV: production
- DATABASE_URL: postgres://...
- REDIS_URL: redis://...
`, 'env-config');
```

## 配置

### 目录自动创建

Config 在初始化时自动创建：

```javascript
// 确保目录存在
data/workspaces/<id>/
├── state.json
└── .memory/
    └── (记忆文件)
```

### 自定义目录

```javascript
import { WorkspaceMemory } from './Memory.js';

const memory = new WorkspaceMemory('/custom/path/.memory');
memory.load();
```

## API 汇总

| 方法 | 说明 |
|------|------|
| `load()` | 从目录加载所有 .md 记忆文件 |
| `save(content, filename?)` | 保存记忆到文件 |
| `distill(content, options?)` | 提炼并保存为结构化记忆 |
| `update(filename, newContent)` | 更新现有记忆 |
| `search(keyword)` | 搜索包含关键词的记忆 |
| `getCount()` | 获取记忆数量 |
| `getSummary(options?)` | 获取记忆摘要 |
| `getForSystemPrompt(options?)` | 生成供 system prompt 使用的内容 |
| `delete(filename)` | 删除记忆文件 |

## 测试

```bash
node tests/TestMemory.js
```
