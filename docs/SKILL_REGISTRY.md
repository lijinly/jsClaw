# Skill 注册与执行

> 统一管理 Agent 可调用的工具，支持内置 Skill 和插件扩展

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    Skill 系统架构                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                   SkillRegistry                          │  │
│   │                     Skill 注册表                         │  │
│   │  ┌─────────────────────────────────────────────────┐   │  │
│   │  │                   registry                        │   │  │
│   │  │              Map<name, Skill>                    │   │  │
│   │  └─────────────────────────────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────────┘  │
│                         │                                      │
│            ┌────────────┼────────────┐                       │
│            ▼            ▼            ▼                       │
│     ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│     │ 内置 Skill│ │ 插件 Skill│ │  自定义   │                   │
│     │builtins.js│ │ marketplace│ │ register │                   │
│     └──────────┘ └──────────┘ └──────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Skill 定义

```javascript
{
  name: 'web_search',              // 唯一标识
  description: '搜索网络获取信息',  // 供 LLM 理解
  parameters: {                    // JSON Schema 参数定义
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
    },
    required: ['query'],
  },
  execute: async (params) => {     // 执行函数
    // ...
    return result;
  },
}
```

## SkillRegistry API

### 注册 Skill

```javascript
import { registerSkill } from './SkillRegistry.js';

registerSkill({
  name: 'my_tool',
  description: '我的自定义工具',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string' },
    },
    required: ['input'],
  },
  execute: async (params) => {
    console.log('执行:', params.input);
    return { success: true, result: params.input };
  },
});
```

### 获取工具定义

```javascript
import { getToolDefinitions } from './SkillRegistry.js';

// 获取所有 Skill 的 OpenAI tools 格式定义
const tools = getToolDefinitions();
// [
//   {
//     type: 'function',
//     function: {
//       name: 'web_search',
//       description: '搜索网络获取信息',
//       parameters: {...},
//     },
//   },
//   ...
// ]
```

### 执行工具调用

```javascript
import { executeToolCalls } from './SkillRegistry.js';

// 模拟 LLM 返回的 tool_calls
const toolCalls = [
  {
    id: 'call_123',
    function: {
      name: 'web_search',
      arguments: '{"query": "天气"}',
    },
  },
];

const results = await executeToolCalls(toolCalls);
// [
//   {
//     role: 'tool',
//     tool_call_id: 'call_123',
//     content: '今天天气晴朗，温度25度',
//   },
// ]
```

## 内置 Skill (builtins.js)

```javascript
// src/skills/builtins.js 加载以下内置 Skill：
import 'dotenv/config';
import { registerSkill } from './SkillRegistry.js';
import { read } from './tools/read.js';
import { write } from './tools/write.js';
// ... 其他内置工具
import './skills/builtins.js';  // 在入口文件加载
```

### 可用内置 Skill

| Skill | 说明 |
|-------|------|
| `read` | 读取文件内容 |
| `write` | 写入文件内容 |
| `list` | 列出目录内容 |
| `edit` | 编辑文件 |
| `apply_patch` | 应用补丁 |
| `exec` | 执行命令 |
| `web_fetch` | 抓取网页 |
| `web_search` | 网络搜索 |
| `message` | 发送消息 |
| `browser` | 浏览器自动化 |
| `list_skills` | 列出已安装 Skill |
| `read_skill` | 读取 Skill 内容 |

## 懒加载机制

### 问题

传统方式在 system prompt 中注入所有 SKILL.md：
- 安装 10 个 Skill → 每次请求增加几千 token
- 大部分 Skill 实际不使用

### 解决方案

```
┌─────────────────────────────────────────────────────────────────┐
│                     懒加载机制                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  启动时：                                                        │
│  • 不在 system prompt 中注入任何 SKILL.md 内容                   │
│  • 仅注册 list_skills 和 read_skill 两个内置工具                 │
│                                                                 │
│  运行时：                                                        │
│  • LLM 根据需要调用 list_skills 查看可用 Skill                   │
│  • LLM 调用 read_skill 读取目标 Skill 的 SKILL.md               │
│                                                                 │
│  Token 消耗：                                                    │
│  • 安装 10 个 Skill，每次请求 ≈ 0 token（仅在使用时读）          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### list_skills

```javascript
// LLM 调用 list_skills
{
  name: 'list_skills',
  description: '列出所有已安装的 Skill',
  execute: async () => {
    const plugins = readdirSync(pluginsDir);
    return plugins
      .filter(p => existsSync(join(pluginsDir, p, 'SKILL.md')))
      .map(p => ({
        slug: p,
        version: readJson(join(pluginsDir, p, '_meta.json'))?.version || '1.0.0',
      }));
  },
}
```

### read_skill

```javascript
// LLM 调用 read_skill
{
  name: 'read_skill',
  description: '读取指定 Skill 的完整定义',
  parameters: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Skill slug' },
    },
    required: ['slug'],
  },
  execute: async ({ slug }) => {
    const skillPath = join(pluginsDir, slug, 'SKILL.md');
    return readFileSync(skillPath, 'utf-8');
  },
}
```

## 插件 Skill

### 安装目录

```
src/skills/plugins/
├── index.json          ← 已安装清单
├── <slug>/
│   ├── SKILL.md        ← Skill 定义
│   └── _meta.json      ← 元信息
└── ...
```

### index.json

```json
{
  "skill-a": { "version": "1.0.0", "installedAt": "2024-01-01T00:00:00Z" },
  "skill-b": { "version": "2.0.0", "installedAt": "2024-01-02T00:00:00Z" }
}
```

### SKILL.md 示例

```markdown
# My Custom Skill

## 描述
这是一个自定义 Skill，用于...

## 触发词
my-skill, 自定义

## 参数
- input: 输入内容（必填）

## 执行
\`\`\`javascript
export default {
  name: 'my_custom_skill',
  description: '自定义 Skill',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string' },
    },
    required: ['input'],
  },
  execute: async (params) => {
    // 业务逻辑
    return { result: params.input.toUpperCase() };
  },
};
\`\`\`
```

## Skill 市场集成

```bash
# 浏览 Skill
npm run skill:list

# 搜索 Skill
npm run skill:list -- pdf

# 查看详情
node src/marketplace.js info <slug>

# 安装
npm run skill:install -- <slug>

# 卸载
npm run skill:remove -- <slug>

# 查看已安装
npm run skill:installed
```

## 测试

```bash
node tests/TestSkillRegistry.js
```
