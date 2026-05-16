# MEMORY.md —— jsClaw 项目长期记忆

## 项目位置
- **jsClaw**：`D:/.ClawSpace/pdSoftware/jsClaw`（JavaScript Agent 框架，ES Module）
- **pyClaw**：`D:/pyClaw`（Python 版 Agent 框架）

## 技术栈
- Node.js v24，`"type": "module"`
- LLM：阿里云千问 qwen-plus（OpenAI 兼容接口）
- 核心依赖：`openai`, `dotenv`, `playwright`, `puppeteer`

## 核心约束

### 修改流程
```
1. 确认方案 → 2. 修改文档 → 3. 修改代码 → 4. 确认一致性
```

### 文件组织
- 测试文件 → `tests/` 文件夹
- 调试脚本临时放根目录，完成后移入 tests/ 或删除
- 文档集中在 `docs/` 目录

---

## 整体设计

### Zone + WorkSpace + Session 三层架构

```
Zone (单例)
├── Workspace 实例池（懒加载）
├── system.json 注册表
└── Workspace CRUD
    └── Workspace
        ├── path（物理路径）
        ├── Members（自建）
        ├── Session 管理
        └── WorkspaceMemory
            └── Session（会话）
                ├── userMessage() + 自动 save()
                └── 文件持久化
```

### 会话生命周期
```
启动 → Zone.loadWorkspace() → _restoreSessions() 恢复会话
会话 → chat(msg, {sessionId}) → session.userMessage() → save()
退出 → gracefulShutdown() → workspace.save() → exit
```

### 核心类
- **Zone** — 全局入口，多 Workspace 管理
- **WorkSpace** — 任务路由，Member + Session 管理
- **Session** — 用户会话，对话历史 + 上下文裁剪
- **Member** — 基于 Agent 的执行者
- **Agent** — Think-Act 模式，面向对象设计

### Skill 系统
- 内置 12 个 Skill（read/write/list/edit/exec/web_search/web_fetch/browser 等）
- 懒加载机制：list_skills + read_skill 按需调用
- ClaWHub 市场支持

### 配置系统
- `config/system.json` — 系统配置
- `config/workspaces/*.json` — Workspace + Member 定义
- `src/Config.js` — 配置 API

---

## 文档索引

| 文档 | 内容 |
|------|------|
| `docs/WORKSPACE.md` | Zone/WorkSpace/Session 架构 |
| `docs/SESSION.md` | Session 会话管理 |
| `docs/AGENT.md` | Agent 面向对象设计 |
| `docs/CONTEXT_MANAGER.md` | 上下文裁剪器 |
| `docs/SKILL_REGISTRY.md` | Skill 注册机制 |
| `docs/MARKETPLACE.md` | ClaWHub 市场 |
| `docs/MEMORY.md` | 长期记忆系统 |
| `docs/ZONE.md` | Zone 架构 |
| `docs/GOAL_TRACKER.md` | 目标追踪器 |
| `docs/GOAL_DAG_SYSTEM.md` | Goal/Task DAG 系统 |

---

## npm 命令
```bash
npm start              # CLI 交互模式
npm run web           # Web 服务模式
npm test              # 运行所有测试
npm run test:ws       # WorkSpace 测试
npm run test:cm       # ContextManager 测试
npm run skill:list    # 浏览 Skill 市场
npm run skill:install # 安装 Skill
```

---

## 待办（优先级排序）

### 高优先级（用户痛点驱动）
- 工具执行验证机制（减少幻觉）
- SQLite FTS5 记忆升级
- 错误处理与恢复（Graceful Degradation）

### 中优先级
- 可观测性（日志追踪）
- 增强上下文管理
- Skill 自动生成

### 低优先级（对标 Hermes）
- 子代理并行、Cron、MCP、消息网关、安全沙盒、GEPA 进化

详见 README.md Roadmap 章节。
