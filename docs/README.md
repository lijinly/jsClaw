# jsClaw - JavaScript Agent 框架

> 基于 Node.js v24 + ES Module 的智能 Agent 开发框架

## 核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         jsClaw 架构图                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │  Zone   │───→│ WorkSpace   │───→│ Member (Agent)      │   │
│  │ 生命周期 │    │  工作空间   │    │ 执行者              │   │
│  └─────────┘    └─────────────┘    └─────────────────────┘   │
│       │                │                     │                │
│       │          ┌─────┴─────┐               │                │
│       │          │  Manager   │               │                │
│       │          │  协调器    │               │                │
│       │          └─────┬─────┘               │                │
│       │                │                     │                │
│       │          ┌─────┴─────┐         ┌─────┴─────┐        │
│       │          │   Goal     │         │  Skill    │        │
│       │          │   目标     │         │  注册表   │        │
│       │          └─────┬─────┘         └───────────┘        │
│       │                │                                    │
│       │          ┌─────┴─────┐                              │
│       │          │ SubGoal   │                              │
│       │          │ 子目标    │                              │
│       │          └─────┬─────┘                              │
│       │                │                                    │
│       │          ┌─────┴─────┐                              │
│       │          │   Task    │                              │
│       │          │ 最小单元  │                              │
│       │          └───────────┘                              │
│       │                                                     │
│       │          ┌───────────┐                              │
│       │          │  Memory   │                              │
│       │          │ 工作记忆  │                              │
│       │          └───────────┘                              │
│       │                                                     │
│       │          ┌───────────┐                              │
│       │          │  Server   │                              │
│       │          │  WebUI    │                              │
│       │          └───────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 核心模块

| 模块 | 文件 | 说明 |
|------|------|------|
| **Agent** | `src/Agent.js` | Think-Act 模式核心实现 |
| **ContextManager** | `src/Context.js` | 上下文自动清理，防止 token 溢出 |
| **Goal** | `src/Goal.js` | DAG 驱动的目标管理 |
| **Manager** | `src/Manager.js` | Goal 执行协调器 |
| **Member** | `src/Member.js` | 工作空间中的执行成员 |
| **WorkSpace** | `src/WorkSpace.js` | 统一工作空间 |
| **Zone** | `src/Zone.js` | Workspace 生命周期管理 |
| **Task** | `src/Task.js` | 最小执行单元 |
| **SubGoal** | `src/SubGoal.js` | 子目标 DAG 节点 |
| **Memory** | `src/Memory.js` | 工作空间记忆 |
| **SkillRegistry** | `src/SkillRegistry.js` | Skill 注册与执行 |
| **Llm** | `src/Llm.js` | LLM 客户端封装 |
| **Marketplace** | `src/Marketplace.js` | ClaWHub Skill 市场 |
| **Server** | `src/Server.js` | WebUI 服务器 |
| **Config** | `src/Config.js` | 系统配置加载器 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动 Agent
npm start

# 运行测试
npm run test

# Skill 市场
npm run skill:list        # 浏览
npm run skill:install -- <slug>  # 安装
```

## 文档索引

| 文档 | 内容 |
|------|------|
| `AGENT.md` | Agent Think-Act 模式详解 |
| `CONTEXT_MANAGER.md` | 上下文自动清理机制 |
| `GOAL_DAG_SYSTEM.md` | Goal-SubGoal-Task DAG 系统 |
| `WORKSPACE.md` | WorkSpace + Member 架构 |
| `SKILL_REGISTRY.md` | Skill 注册与执行 |
| `LLM.md` | LLM 客户端配置 |
| `MEMORY.md` | 工作空间记忆系统 |
| `ZONE.md` | Zone 生命周期管理 |
| `MARKETPLACE.md` | ClaWHub Skill 市场 |
| `CONFIG.md` | 配置系统详解 |

## 特色功能

- **Think-Act 模式**：先思考再执行，决策更精准
- **DAG 任务管理**：Goal → SubGoal → Task 层级结构
- **验收标准**：Task 支持三种验收方式（函数/规则/人工）
- **上下文管理**：自动清理对话历史，防止 token 溢出
- **多成员协作**：WorkSpace 支持多 Member 并行执行
- **工作记忆**：跨会话持久化记忆
- **Skill 市场**：ClaWHub 官方 Skill 生态

## 技术栈

- Node.js v24+
- ES Module ( `"type": "module"` )
- LLM: 阿里云千问 qwen-plus（OpenAI 兼容接口）
- 依赖: `openai`, `dotenv`, `open-websearch`, `playwright`, `puppeteer`
