# jsClaw

> 极简的 LLM + Skill 集成框架，支持双层协作架构（Team + Agent）、Think-Act 模式和可扩展的技能生态系统

---

## 🎯 核心特性

jsClaw 采用**双层协作架构**，提供灵活的任务处理能力：

```
用户请求
    ↓
┌─────────────┐
│  WorkSpace  │ ← 统一路由中心
└─────┬───────┘
      │
   ┌──┴──┐
   │     │
   ▼     ▼
 Team   Agent
(协作)  (执行)
```

### 🧠 双层架构

**1. Team（协作团队）**
- 多个 Members 协作处理复杂任务
- 智能任务路由：自动分配给合适的 Team 或 Agent
- 持久化状态管理
- 支持动态进入/退出

**2. Agent（执行者）**
- Think-Act 模式：思考 + 执行分离
- 精确的工具调用控制
- 面向对象设计，易于扩展
- 支持 Guidance 引导执行

---

## 🚀 快速开始

### 环境要求
- Node.js >= 18

### 1. 安装依赖
```bash
npm install
```

### 2. 配置 API 密钥
创建 `.env` 文件：
```env
OPENAI_API_KEY=sk-your-api-key
LLM_PROVIDER=qwen        # 或 openai/deepseek/moonshot/ollama
MODEL_NAME=qwen-plus     # 或其他模型
```

### 3. 启动应用
```bash
# 命令行交互模式
npm start

# Web 界面模式
npm run web
```

---

## 📚 使用方式

### 方式一：WorkSpace（推荐）
适用于复杂任务和团队协作：

```javascript
import { WorkSpace } from './src/WorkSpace.js';

const workspace = new WorkSpace();
await workspace.initialize();

// 自动路由：简单任务给 Agent，复杂任务给 Team
const result = await workspace.submitTask('分析项目代码结构');

// 指定 Team 执行
const result2 = await workspace.submitTask({
  description: '编写单元测试',
  teamId: 'dev-team'
});
```

### 方式二：Agent 类（高级定制）
适用于需要精确控制的场景：

```javascript
import { Agent } from './src/agent.js';

const agent = new Agent({
  name: '代码助手',
  role: '专业的编程助手',
  verbose: true
});

const result = await agent.run('帮我优化这段代码');
```

### 方式三：命令行交互
```bash
npm start
```
```
你: 帮我创建一个 React 组件
Agent: 好的，我将为您创建一个 React 组件...

你: 搜索最新的 JavaScript 框架
Agent: 正在为您搜索最新信息...
```

---

## 🎖️ 核心概念

### Team 协作系统
- **Team**: 专业化团队，处理特定领域任务
- **Member**: 具有特定技能的团队成员
- **WorkSpace**: 统一的任务路由和团队管理

### Think-Act 模式
1. **Think 阶段**: 分析任务，规划执行方案
2. **Act 阶段**: 根据方案调用相应工具
3. **整合**: 综合思考和执行结果给出最终答案

### Skill 生态系统
- 内置 12 个实用技能
- 支持从 ClaWHub 市场安装社区技能
- 简单的技能注册机制

---

## 🛠️ 内置技能

### 文件操作
- `read` - 读取文件内容
- `write` - 创建/覆盖文件
- `list` - 列出目录内容
- `edit` - 精准编辑文件
- `apply_patch` - 应用补丁

### 系统工具
- `exec` - 执行 Shell 命令
- `message` - 发送企业微信消息

### 网络工具
- `web_search` - 多引擎网络搜索（Bing/DuckDuckGo/百度/CSDN）
- `web_fetch` - 抓取网页内容
- `browser` - 浏览器自动化（Puppeteer）

### 技能管理
- `list_skills` - 列出已安装技能
- `read_skill` - 查看技能详细说明

---

## 🌍 支持的 LLM Provider

| Provider | 配置 | 默认模型 |
|----------|------|----------|
| 阿里云千问 | `LLM_PROVIDER=qwen` | `qwen-plus` |
| OpenAI | `LLM_PROVIDER=openai` | `gpt-4o-mini` |
| DeepSeek | `LLM_PROVIDER=deepseek` | `deepseek-chat` |
| Moonshot | `LLM_PROVIDER=moonshot` | `moonshot-v1-8k` |
| Ollama | `LLM_PROVIDER=ollama` | `llama3` |

---

## 🏗️ 项目结构

```
jsClaw/
├── src/
│   ├── index.js          # 命令行入口
│   ├── server.js         # Web 服务器
│   ├── llm.js            # LLM 客户端封装
│   ├── agent.js          # Agent 核心类
│   ├── Member.js         # Member 类（基于 Agent）
│   ├── WorkSpace.js      # 工作空间
│   ├── ContextManager.js  # 上下文管理器
│   ├── GoalTracker.js    # 目标追踪器
│   ├── skillRegistry.js  # 技能注册管理
│   ├── marketplace.js     # 技能市场
│   ├── WorkSpaceConfig.json  # 工作空间配置
│   ├── tests/            # 测试文件
│   └── skills/
│       ├── builtins.js   # 内置技能
│       └── plugins/      # 社区技能
├── docs/                 # 设计文档
├── .env                  # 环境配置
└── package.json
```

---

## 🚀 npm 命令

```bash
npm start                 # 启动命令行模式
npm run web              # 启动 Web 界面
npm run skill:list       # 搜索技能
npm run skill:install    # 安装技能
npm run skill:remove     # 卸载技能
npm run skill:installed  # 查看已安装技能
```

---

## 📖 详细文档

详细设计文档集中在 `docs/` 目录下：

- [docs/WORKSPACE.md](./docs/WORKSPACE.md) - WorkSpace + Member 架构详解
- [docs/AGENT.md](./docs/AGENT.md) - Agent 面向对象设计
- [docs/CONTEXT_MANAGER.md](./docs/CONTEXT_MANAGER.md) - 上下文管理器
- [docs/GOAL_TRACKER.md](./docs/GOAL_TRACKER.md) - 目标追踪器
- [docs/TEAM.md](./docs/TEAM.md) - Team 协作系统（Legacy）

---

## 📝 License

MIT