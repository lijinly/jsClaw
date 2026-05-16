# jsClaw

> JavaScript Agent 框架，支持 Zone/Workspace/Session 三层架构、Think-Act 执行模式和可扩展的 Skill 生态系统

---

## 核心特性

### 架构：Zone → WorkSpace → Session → Member

```
用户请求
    ↓
┌─────────────┐
│    Zone     │ ← 全局入口，管理多个 Workspace
└─────┬───────┘
      │
┌─────┴───────┐
│  WorkSpace  │ ← 任务路由中心，管理 Member 和 Session
└─────┬───────┘
      │
┌─────┴───────┐
│   Session   │ ← 用户会话上下文，关联 Member
└─────┬───────┘
      │
      ▼
   Member     ← 具体执行者（基于 Agent）
```

### 关键能力

- **Session 持久化**：自动保存会话状态到文件，重启后恢复
- **Think-Act 模式**：思考 + 执行分离，精确控制工具调用
- **Skill 懒加载**：按需加载，不占用启动时 token
- **Graceful Shutdown**：CLI/Server 模式下信号处理，确保状态完整保存

---

## 快速开始

### 环境要求

- Node.js >= 18（含 ES Module 支持）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API 密钥

创建 `.env` 文件：

```env
LLM_PROVIDER=qwen
MODEL_NAME=qwen-plus
OPENAI_API_KEY=sk-your-api-key
```

支持的 Provider：`qwen` | `openai` | `deepseek` | `moonshot` | `ollama`

### 3. 启动

```bash
# 命令行交互模式
npm start

# Web 服务模式
npm run web
```

---

## 使用方式

### 方式一：WorkSpace（推荐）

适用于需要多 Member 协作的场景：

```javascript
import { Zone } from './src/Zone.js';

const zone = new Zone();
await zone.initialize();

const ws = zone.getDefaultWorkspace();
const session = ws.startSession({ memberId: 'assistant' });

const result = await session.userMessage('帮我分析这段代码');
```

### 方式二：Agent 类（高级定制）

适用于需要精确控制的场景：

```javascript
import { Agent } from './src/Agent.js';

const agent = new Agent({
  name: '代码助手',
  identity: '专业的编程助手',
  verbose: true,
  maxRounds: 10,
});

const result = await agent.run('帮我优化这段代码');
```

### 方式三：命令行交互

```bash
npm start
```

```
jsClaw CLI · Session: sess-abc123
──────────────────────────────────────────────────────
/workspaces      查看所有 Workspace
/sessions        查看当前 Workspace 的会话
/members         查看当前 Workspace 的 Member
/session [id]    切换到指定会话
/exit            退出（自动保存会话）
──────────────────────────────────────────────────────

你: 帮我创建一个 React 组件
助手: 好的，我将为您创建一个 React 组件...
```

---

## 核心概念

### Zone / WorkSpace / Session

| 层级 | 职责 |
|------|------|
| **Zone** | 全局入口，管理多个 Workspace，提供服务发现 |
| **WorkSpace** | 任务路由中心，管理 Member 集合和 Session 生命周期 |
| **Session** | 用户会话，关联 Member，管理对话历史和上下文裁剪 |

### Session 持久化

```
{workspace-path}/.workspace/sessions/ws-{wsId}-s-{sId}.json
```

- `Session.userMessage()` 成功/失败后自动保存
- `Workspace._restoreSessions()` 启动时恢复已有 Session
- CLI/Server 收到 SIGINT/SIGTERM 时调用 `workspace.save()` 后退出

### Member / Agent

- **Agent**：Think-Act 模式，工具调用控制，面向对象设计
- **Member**：基于 Agent，由 WorkSpace 直接调度

### Skill 生态系统

- **内置 12 个技能**：read / write / list / edit / apply_patch / exec / web_search / web_fetch / browser / message / list_skills / read_skill
- **懒加载机制**：启动时不注入 SKILL.md，按需调用 `list_skills` + `read_skill`
- **ClaWHub 市场**：支持安装社区技能

---

## 内置工具（内置 Skill）

### 文件操作

| Skill | 说明 |
|-------|------|
| `read` | 读取文件内容 |
| `write` | 创建/覆盖文件，自动创建父目录 |
| `list` | 列出目录内容，支持递归 |
| `edit` | 精准替换文件中的指定字符串 |
| `apply_patch` | 应用 unified diff 格式补丁 |

### 系统工具

| Skill | 说明 |
|-------|------|
| `exec` | 执行 Shell 命令 |
| `message` | 发送企业微信群聊消息 |

### 网络工具

| Skill | 说明 |
|-------|------|
| `web_search` | 多引擎网络搜索 |
| `web_fetch` | 抓取网页正文，HTML→Markdown 转换 |
| `browser` | 浏览器自动化（Puppeteer，自动使用系统 Edge/Chrome） |

---

## 项目结构

```
jsClaw/
├── src/
│   ├── Zone.js            # Zone 全局入口
│   ├── WorkSpace.js       # WorkSpace 路由中心
│   ├── Session.js         # Session 会话管理
│   ├── Member.js          # Member 类（基于 Agent）
│   ├── Agent.js           # Agent 核心类（Think-Act）
│   ├── Service.js         # Zone 门面，HTTP API
│   ├── CLI.js             # 命令行入口
│   ├── Server.js          # Web 服务（Express）
│   ├── Llm.js             # LLM 客户端封装
│   ├── Config.js          # 配置系统
│   ├── SkillRegistry.js   # Skill 注册管理
│   ├── Marketplace.js     # ClaWHub 市场
│   ├── Memory.js          # 长期记忆管理
│   ├── ContextOptimizer.js # 上下文裁剪器
│   ├── Goal.js            # 目标抽象
│   ├── Task.js            # 任务抽象
│   ├── Manager.js         # Manager 抽象
│   ├── public/            # Web 静态资源
│   └── skills/
│       ├── builtins.js    # 内置 Skill 实现
│       └── plugins/       # 社区 Skill
├── config/
│   ├── system.json        # 系统配置
│   └── workspaces/       # Workspace 定义
├── docs/                  # 设计文档
│   ├── ZONE.md           # Zone 架构
│   ├── WORKSPACE.md      # WorkSpace + Member 架构
│   ├── SESSION.md        # Session 会话管理
│   ├── AGENT.md          # Agent 面向对象设计
│   ├── CONTEXT_MANAGER.md # 上下文管理器
│   ├── SKILL_REGISTRY.md # Skill 注册机制
│   ├── MARKETPLACE.md    # ClaWHub 市场
│   └── MEMORY.md         # 长期记忆系统
└── tests/                 # 测试文件
```

---

## npm 命令

```bash
# 启动
npm start                 # 命令行交互模式
npm run web              # Web 服务模式

# 测试
npm test                  # 运行所有测试
npm run test:ws          # WorkSpace + Member 测试
npm run test:cm          # ContextManager 测试
npm run test:cm-large    # 大上下文测试
npm run test:gt          # GoalTracker 测试

# Skill 管理
npm run skill:list       # 搜索 ClaWHub 市场
npm run skill:info       # 查看 Skill 详情
npm run skill:install    # 安装 Skill
npm run skill:remove     # 卸载 Skill
npm run skill:installed  # 查看已安装 Skill
```

---

## 配置系统

所有配置统一在 `config/` 目录，Member 定义内嵌于 workspace JSON：

```json
// config/system.json
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
      "configPath": "config/workspaces/default.json"
    }
  },
  "system": {
    "defaultWorkspaceId": "default",
    "maxRounds": 10
  }
}
```

```json
// config/workspaces/default.json
{
  "id": "default",
  "name": "默认工作空间",
  "members": [
    {
      "id": "assistant",
      "name": "助手",
      "identity": "专业助手...",
      "skills": ["read", "write", "list", "edit"]
    }
  ]
}
```

---

## 详细文档

| 文档 | 说明 |
|------|------|
| [docs/ZONE.md](./docs/ZONE.md) | Zone 全局入口架构 |
| [docs/WORKSPACE.md](./docs/WORKSPACE.md) | WorkSpace + Member 架构 |
| [docs/SESSION.md](./docs/SESSION.md) | Session 会话管理 |
| [docs/AGENT.md](./docs/AGENT.md) | Agent 面向对象设计 |
| [docs/CONTEXT_MANAGER.md](./docs/CONTEXT_MANAGER.md) | 上下文裁剪器 |
| [docs/MEMORY.md](./docs/MEMORY.md) | 长期记忆系统 |
| [docs/SKILL_REGISTRY.md](./docs/SKILL_REGISTRY.md) | Skill 注册机制 |
| [docs/MARKETPLACE.md](./docs/MARKETPLACE.md) | ClaWHub 市场 |

---

## 📋 发展规划 (Roadmap)

基于两大维度：**用户痛点** + **Hermes Agent 能力借鉴**

---

### 🔴 核心问题（用户高频抱怨）

| 问题 | 数据 | 来源 |
|-----|------|------|
| 生产失败率 | >80% | RAND 研究 |
| 工具执行幻觉率 | 15-20%（无验证） | Agent Harness |
| 数据质量障碍 | 43% | 行业调查 |
| 预计 2027 年取消率 | 40% | Gartner |

---

### ⭐⭐⭐ 高优先级（解决用户最痛的问题）

#### 1. 工具执行验证机制
**用户痛点**：AI 说执行成功了，实际文件是空的、命令报错了
**目标**：将工具执行错误率从 15-20% 降至 1-2%
**方案**：
- 工具执行后自动验证结果（文件存在性、退出码、输出格式）
- 不确定时主动提示用户
- 参考 Agent Harness 验证循环

#### 2. SQLite FTS5 记忆升级
**用户痛点**：对话久了就忘，前后矛盾
**目标**：零人工维护的持久记忆
**方案**：
- better-sqlite3 替代纯文件存储
- FTS5 全文索引
- LLM 自动摘要

#### 3. 错误处理与恢复
**用户痛点**：Agent 执行到一半崩溃，不知道发生了什么
**目标**：Graceful Degradation，部分失败降级而非整体崩溃
**方案**：
- 完善 try-catch 包裹所有异步操作
- 错误信息友好化
- 支持自动重试

---

### ⭐⭐ 中优先级（提升可靠性）

#### 4. 可观测性（执行日志）
**用户痛点**：不知道 Agent 在干嘛，像黑盒
**方案**：
- 完善的执行日志（工具调用、参数、结果）
- 支持执行回放
- 实时状态反馈

#### 5. 增强上下文管理
**用户痛点**：上下文窗口满了就忘
**方案**（参考 Agent Harness）：
- 压缩：接近限制时总结对话
- 观察遮蔽：隐藏旧的工具输出
- 即时检索：动态加载相关数据

#### 6. Skill 自动生成
**用户痛点**：每次都要手动配置技能
**目标**：越用越强，自动沉淀经验
**方案**：任务完成后自动生成 SKILL.md

---

### ⭐ 低优先级（功能增强）

| 任务 | 说明 | 对标 |
|------|------|------|
| **子代理并行执行** | spawn 隔离子代理 | Hermes 分布式架构 |
| **Cron 定时任务** | 内置调度器 | Hermes 内置 Cron |
| **MCP 协议集成** | 原生支持 | Hermes MCP v0.6.0 |
| **消息网关** | 企微/飞书/钉钉 | Hermes 15+ 平台 |
| **安全沙盒** | 命令审批 + Docker | Hermes 企业安全 |
| **GEPA 进化引擎** | Prompt 自动优化 | Hermes GEPA |

---

## License

MIT
