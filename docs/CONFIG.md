# CONFIG.md - 系统配置指南

> 本文档介绍 jsClaw 框架的配置系统，包括环境变量配置、系统配置、Workspace 配置。

---

## 目录

1. [配置架构](#1-配置架构)
2. [环境变量配置](#2-环境变量配置)
3. [系统配置文件](#3-系统配置文件)
4. [Workspace 配置](#4-workspace-配置)
5. [SystemConfig API](#5-systemconfig-api)
6. [配置优先级](#6-配置优先级)
7. [最佳实践](#7-最佳实践)

---

## 1. 配置架构

jsClaw 采用分层配置架构：

```
┌─────────────────────────────────────────────────────────┐
│                    环境变量 (.env)                        │
│         LLM_PROVIDER, MODEL_NAME, OPENAI_API_KEY        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│               系统配置 (config/system.json)               │
│         paths, workspaces, system 全局配置                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│            Workspace 配置 (config/workspaces/*.json)      │
│              members, members 的 skills                  │
└─────────────────────────────────────────────────────────┘
```

### 配置文件位置

| 配置类型 | 默认路径 | 说明 |
|---------|---------|------|
| 环境变量 | `.env` | LLM API 密钥和模型选择 |
| 系统配置 | `config/system.json` | 全局路径和 Workspace 清单 |
| Workspace 配置 | `config/workspaces/*.json` | 各 Workspace 的 Member 定义 |

---

## 2. 环境变量配置

### 2.1 创建 `.env` 文件

在项目根目录创建 `.env` 文件：

```bash
# 复制示例配置
cp .env.example .env
```

### 2.2 配置项说明

| 变量名 | 必填 | 说明 | 可选值 |
|-------|-----|------|-------|
| `LLM_PROVIDER` | 是 | LLM 服务提供商 | `qwen` \| `openai` \| `deepseek` \| `moonshot` \| `ollama` |
| `MODEL_NAME` | 是 | 模型名称 | 详见各 Provider 说明 |
| `OPENAI_API_KEY` | 是 | API 密钥 | 通过系统环境变量设置 |
| `OPENAI_BASE_URL` | 否 | 自定义 API 端点 | 留空使用 Provider 预设 |

### 2.3 Provider 预设

#### 阿里云千问（推荐）

```bash
LLM_PROVIDER=qwen
MODEL_NAME=qwen-plus
# Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
```

可选模型：
- `qwen-turbo` - 速度最快
- `qwen-plus` - 平衡模式（推荐）
- `qwen-max` - 效果最好
- `qwen-long` - 支持超长上下文
- `qwen2.5-72b-instruct` - 开源大模型

#### OpenAI

```bash
LLM_PROVIDER=openai
MODEL_NAME=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1
```

#### DeepSeek

```bash
LLM_PROVIDER=deepseek
MODEL_NAME=deepseek-chat
OPENAI_BASE_URL=https://api.deepseek.com/v1
```

#### 本地 Ollama

```bash
LLM_PROVIDER=ollama
MODEL_NAME=llama3
OPENAI_BASE_URL=http://localhost:11434/v1
```

### 2.4 API Key 安全配置

**重要**：API Key 不存储在 `.env` 文件中，而是通过系统环境变量设置。

#### Windows (PowerShell)

```powershell
$env:OPENAI_API_KEY = "your_api_key_here"
```

#### Windows (CMD)

```cmd
set OPENAI_API_KEY=your_api_key_here
```

#### macOS / Linux

```bash
export OPENAI_API_KEY=your_api_key_here
```

#### 永久配置（Windows）

1. 右键 "此电脑" → 属性 → 高级系统设置
2. 环境变量 → 新建 → `OPENAI_API_KEY = your_key`

---

## 3. 系统配置文件

### 3.1 位置

```
config/system.json
```

### 3.2 完整配置示例

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
      "description": "系统启动时自动创建的默认工作空间",
      "configPath": "config/workspaces/default.json"
    },
    "research": {
      "id": "research",
      "name": "研究空间",
      "description": "用于信息收集和数据分析",
      "path": "data/research/"
    }
  },

  "system": {
    "defaultWorkspaceId": "default",
    "maxRounds": 10,
    "verbose": false
  }
}
```

### 3.3 配置项说明

#### `version` (string)

配置版本号，用于配置兼容性检查。

#### `paths` (object)

路径配置，支持相对路径（相对于项目根目录）或绝对路径。

| 字段 | 类型 | 说明 |
|-----|------|------|
| `workspaces` | string | Workspace 配置文件目录 |
| `data` | string | 数据存储目录 |
| `logs` | string | 日志输出目录 |

#### `workspaces` (object)

Workspace 清单，key 为 Workspace ID。

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| `id` | string | 是 | Workspace 唯一标识 |
| `name` | string | 是 | 显示名称 |
| `description` | string | 否 | 描述信息 |
| `configPath` | string | 否 | 独立配置文件路径 |
| `path` | string | 否 | Workspace 数据目录 |

#### `system` (object)

系统级配置。

| 字段 | 类型 | 默认值 | 说明 |
|-----|------|-------|------|
| `defaultWorkspaceId` | string | `"default"` | 默认 Workspace ID |
| `maxRounds` | number | `10` | 单次对话最大轮数 |
| `verbose` | boolean | `false` | 是否输出详细日志 |

---

## 4. Workspace 配置

### 4.1 位置

```
config/workspaces/<workspace-id>.json
```

### 4.2 完整配置示例

```json
{
  "path": "data/workspaces/default/",
  "members": {
    "assistant": {
      "id": "assistant",
      "name": "助手",
      "role": "智能助手",
      "description": "通用的智能助手",
      "skills": ["file-operations", "web-search", "code-analysis"]
    },
    "researcher": {
      "id": "researcher",
      "name": "研究员",
      "role": "专业研究员",
      "description": "专注于信息收集和数据分析",
      "skills": ["web-search", "data-analysis", "content-summarize"]
    }
  }
}
```

### 4.3 Member 配置项

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| `id` | string | 是 | Member 唯一标识 |
| `name` | string | 是 | 显示名称 |
| `role` | string | 是 | 角色定义（用于 system prompt） |
| `description` | string | 否 | 详细描述 |
| `skills` | string[] | 否 | 关联的 Skill ID 列表 |

### 4.4 多 Member Workspace 示例

```json
{
  "path": "data/workspaces/team/",
  "members": {
    "developer": {
      "id": "developer",
      "name": "开发者",
      "role": "全栈开发工程师",
      "skills": ["code-analysis", "file-editing", "git-operations"]
    },
    "reviewer": {
      "id": "reviewer",
      "name": "代码审查员",
      "role": "资深代码审查专家",
      "skills": ["code-review", "security-scan"]
    },
    "tester": {
      "id": "tester",
      "name": "测试工程师",
      "role": "QA 测试专家",
      "skills": ["test-design", "test-execution"]
    }
  }
}
```

---

## 5. SystemConfig API

### 5.1 导入

```javascript
import { SystemConfig, getSystemConfig } from '../src/SystemConfig.js';
```

### 5.2 创建实例

```javascript
// 使用默认配置
const config = new SystemConfig();

// 自定义配置路径
const config = new SystemConfig({
  configPath: '/path/to/system.json',
  projectRoot: '/path/to/project'
});
```

### 5.3 常用方法

#### `getInfo()`

获取完整配置信息。

```javascript
const info = config.getInfo();
console.log(info);
// 输出：
// {
//   version: '1.0.0',
//   projectRoot: '/path/to/project',
//   systemConfigPath: '/path/to/system.json',
//   workspaces: [{ id, name, description, memberCount }],
//   system: { defaultWorkspaceId, maxRounds, verbose, paths, projectRoot }
// }
```

#### `listWorkspaces()`

列出所有 Workspace。

```javascript
const workspaces = config.listWorkspaces();
console.log(workspaces);
// 输出：
// [
//   { id: 'default', name: '默认工作空间', description: '...', memberCount: 2 }
// ]
```

#### `getWorkspace(id)`

获取指定 Workspace 配置。

```javascript
const workspace = config.getWorkspace('default');
```

#### `getWorkspaceMembers(id)`

获取 Workspace 的所有 Member。

```javascript
const members = config.getWorkspaceMembers('default');
console.log(members);
// 输出：
// [
//   { id: 'assistant', name: '助手', role: '智能助手', ... },
//   { id: 'researcher', name: '研究员', role: '专业研究员', ... }
// ]
```

#### `getDefaultWorkspace()`

获取默认 Workspace。

```javascript
const defaultWs = config.getDefaultWorkspace();
```

#### `getWorkspaceMemoryPath(id)`

获取 Workspace 的记忆目录路径。

```javascript
const memoryPath = config.getWorkspaceMemoryPath('default');
// 返回：/path/to/project/data/workspaces/default/.memory
```

#### `getWorkspaceDataPath(id)`

获取 Workspace 的数据目录路径。

```javascript
const dataPath = config.getWorkspaceDataPath('default');
// 返回：/path/to/project/data/workspaces/default
```

### 5.4 单例模式

```javascript
import { getSystemConfig } from '../src/SystemConfig.js';

// 获取单例实例
const config = getSystemConfig();

// 重置单例（用于测试）
import { resetSystemConfig } from '../src/SystemConfig.js';
resetSystemConfig();
```

---

## 6. 配置优先级

配置加载按以下优先级（从高到低）：

```
1. 构造函数选项 (options.configPath, options.projectRoot)
       ↓
2. 环境变量
       ↓
3. .env 文件
       ↓
4. config/system.json
       ↓
5. 内置默认值
```

### 优先级示例

```javascript
// 最高优先级：构造函数选项
const config = new SystemConfig({
  configPath: '/custom/path/system.json',
  projectRoot: '/custom/project'
});

// 次优先级：环境变量
// PROCESS_ENV.SYSTEM_CONFIG_PATH
// PROCESS_ENV.PROJECT_ROOT
```

---

## 7. 最佳实践

### 7.1 环境隔离

为不同环境创建独立的配置文件：

```
config/
├── system.json           # 开发环境
├── system.staging.json   # 预发布环境
├── system.prod.json      # 生产环境
```

使用时通过构造函数指定：

```javascript
const config = new SystemConfig({
  configPath: `config/system.${process.env.NODE_ENV}.json`
});
```

### 7.2 Workspace 目录结构

推荐的数据目录结构：

```
data/
└── workspaces/
    ├── default/
    │   ├── .memory/           # 记忆文件
    │   ├── tasks/            # 任务数据
    │   └── cache/            # 缓存文件
    └── research/
        ├── .memory/
        ├── data/
        └── outputs/
```

### 7.3 Member 复用

在多个 Workspace 间复用 Member 定义：

```json
// config/workspaces/default.json
{
  "members": {
    "assistant": {
      "id": "assistant",
      "role": "通用助手",
      "skills": ["file-operations", "web-search"]
    }
  }
}

// config/workspaces/research.json
{
  "members": {
    "assistant": {
      "id": "assistant",
      "role": "通用助手",
      "skills": ["file-operations", "web-search"]
    },
    "researcher": {
      "id": "researcher",
      "role": "研究员",
      "skills": ["data-analysis", "content-summarize"]
    }
  }
}
```

### 7.4 敏感信息管理

**不要**将 API Key 提交到版本控制系统：

```bash
# .gitignore
.env
.env.local
.env.*.local
```

使用环境变量或密钥管理服务：

```javascript
// 安全地从环境变量读取
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY 环境变量未设置');
}
```

### 7.5 配置验证

启动时验证配置完整性：

```javascript
import { SystemConfig } from '../src/SystemConfig.js';

const config = new SystemConfig();
const info = config.getInfo();

// 验证必要配置
if (!info.system.defaultWorkspaceId) {
  throw new Error('缺少默认 Workspace 配置');
}

const defaultWs = config.getDefaultWorkspace();
if (!defaultWs) {
  throw new Error(`默认 Workspace '${info.system.defaultWorkspaceId}' 不存在`);
}

console.log('✓ 配置验证通过');
```

---

## 附录：配置检查清单

创建新 Workspace 时的配置清单：

- [ ] 在 `config/system.json` 的 `workspaces` 中添加定义
- [ ] 创建 `config/workspaces/<id>.json` 配置文件
- [ ] 在配置中定义至少一个 Member
- [ ] 为 Member 分配合适的 Skills
- [ ] 验证 Workspace 目录自动创建（`path` 字段）
- [ ] 测试 Member 加载正常
- [ ] 更新本文档（如果需要）

---

## 相关文档

- [WORKSPACE.md](./WORKSPACE.md) - WorkSpace 架构详解
- [SKILL_REGISTRY.md](./SKILL_REGISTRY.md) - Skill 注册与执行
- [MEMORY.md](./MEMORY.md) - 工作空间记忆系统
