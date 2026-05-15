# MEMORY.md —— jsClaw 项目长期记忆

## 项目位置
- **jsClaw**：`D:/.ClawSpace/pdSoftware/jsClaw`（JavaScript Agent 框架，ES Module）
- **pyClaw**：`D:/pyClaw`（Python 版 Agent 框架）

## 技术栈
- Node.js v24，`"type": "module"`（ES Module）
- 依赖：`openai`, `dotenv`, `open-websearch`, `playwright`, `puppeteer`
- LLM：阿里云千问 qwen-plus（OpenAI 兼容接口）
- API Key 配置：`.env` 文件 `OPENAI_API_KEY=sk-45d478ddd7b94b0d838d9fce6f1e3762`

## 开发规范

### 修改流程（必须遵循）

每次功能讨论/需求开发，必须严格按以下顺序执行：

```
1. 确认方案 → 2. 修改文档 → 3. 修改代码 → 4. 确认一致性
```

| 步骤 | 说明 |
|------|------|
| **1. 确认方案** | 讨论技术方案、API 设计、架构变更，形成共识后再动手 |
| **2. 修改文档** | 先修改 `docs/` 下的相关文档（README.md, API文档等） |
| **3. 修改代码** | 根据文档完成代码实现 |
| **4. 确认一致性** | 验证代码与文档描述一致，更新 memory 记录变更 |

**注意**：
- 文档是代码的契约，代码变更必须先反映在文档中
- 代码修改完成后必须对照文档检查一致性
- 更新 memory 记录本次变更内容

## 架构

### WorkSpace + Member 架构（最新）
- **WorkSpace** — 统一工作空间入口，直接管理多个 Member
- **Member** — 基于 Agent，由 WorkSpace 直接调度
- **defaultMember** — 每个 WorkSpace 默认有一个管理者/执行者
- **配置文件**：`WorkSpaceConfig.json`

**任务路由（WorkSpace）：**
- 指定 memberIds → 多个 Member 协作执行
- 指定 memberId → 交给指定 Member 执行
- 无指定 → 交给 defaultMember 执行

### 配置系统结构（2026-05-15 最终版）

所有配置统一在 `config/` 目录，Member 定义内嵌于 workspace JSON：

```
config/
├── system.json           ← 系统配置（路径 + workspace 索引）
└── workspaces/
    └── default.json      ← workspace 定义（含 member 集合）
```

**Member 定义结构（内嵌在 workspace JSON 中）**：
```json
{
  "id": "coder",
  "name": "开发者",
  "identity": "专业开发者...",   // 身份信息
  "soul": "逻辑严谨...",        // 性格特征
  "skills": ["read", "write"]   // 可用工具
}
```

**config/system.json**：
```json
{
  "version": "1.0.0",
  "paths": { "workspaces": "config/workspaces/", "data": "data/", "logs": "logs/" },
  "workspaces": { "default": { "id": "default", "configPath": "config/workspaces/default.json" }},
  "system": { "defaultWorkspaceId": "default", "maxRounds": 10 }
}
```

**API**：
- `getConfig()` - 获取配置单例
- `config.getWorkspace(id)` - 获取 workspace 配置
- `config.getWorkspaceMembers(id)` - 获取 workspace 的 members

**使用文档（集中在 docs/）：**
- `docs/WORKSPACE.md` - WorkSpace + Member 架构详解
- `docs/AGENT.md` - Agent 面向对象设计
- `docs/CONTEXT_MANAGER.md` - 上下文管理器
- `docs/GOAL_TRACKER.md` - 目标追踪器
- `docs/TEAM.md` - Team 协作系统（Legacy）

### 旧架构（TeamLab + Team）— Legacy
- Team.js 和相关代码仍保留，但不再推荐使用
- 新项目应使用 WorkSpace + Member 架构

### Agent —— Think-Act 模式
- `src/agent.js` — Agent 类，面向对象设计，支持无指引和有指引两种模式
- Think 阶段：分析问题，规划执行方案
- Act 阶段：根据方案调用工具执行
- 支持继承和重写，易于扩展

**核心类：**
```javascript
class Agent {
  constructor({ name, role, verbose, maxRounds }) { }
  async run(userMessage, options) { }
  async runWithGuidance(userMessage, options) { }
}
```

**相关文档：**
- `AGENT_OO_REFACTORING.md` — 完整的重构文档

### Skill 系统
- `src/skillRegistry.js` — Skill 注册与执行
- `src/skills/builtins.js` — 内置 Skill（web_search, read, write, list, edit, apply_patch, exec, web_fetch, message, browser, list_skills, read_skill）
- `src/marketplace.js` — Skill 市场，ClaWHub 官方 API
- `src/skills/plugins/` — 已安装 Skill 目录，`index.json` 为清单

## Skill 市场（ClaWHub 官方 API）
- 搜索：`GET /api/search?q=xxx` → `{ results: [{slug, displayName, summary}] }`
- 详情：`GET /api/v1/skills/<slug>` → `{ skill, latestVersion, owner }`
- 下载：`GET https://wry-manatee-359.convex.site/api/v1/download?slug=<slug>` → zip（含 SKILL.md + _meta.json）
- ClaWHub 有严格限流（429），频繁调用需间隔
- 安装的 Skill 以 SKILL.md 目录形式存储在 `src/skills/plugins/<slug>/`

## Skill 懒加载机制
- 启动时**不在** system prompt 中注入任何 SKILL.md 内容
- 注册两个内置工具供 LLM 按需调用：
  - `list_skills` — 列出所有已安装 Skill 的 slug + 版本
  - `read_skill` — 读取指定 Skill 的 SKILL.md 全文
- Token 消耗：安装 10 个 Skill，每次请求从几千 token → 接近 0 token（仅当真正使用时才读）

## 基础工具（OpenClaw 风格）
- `read` — 读取文件内容，支持工作区内的任意文件
- `write` — 创建或覆盖文件，自动创建父目录
- `list` — 列出目录内容，支持递归和显示隐藏文件
- `edit` — 精准替换文件中的指定字符串（old_str → new_str），要求唯一匹配
- `apply_patch` — 应用 unified diff 格式补丁，支持多文件批量修改
- `exec` — 运行 shell 命令，返回 stdout/stderr，支持 cwd 和 timeout 参数
- `web_fetch` — 抓取网页正文，自动 HTML→Markdown 转换，限制 20000 字符
- `message` — 发送消息到企业微信群聊机器人（Webhook），支持 Markdown 和 @ 用户
- `browser` — 浏览器自动化（Puppeteer），支持页面操作、截图、点击、填表单、执行 JS
- `browser` 实现：自动使用系统 Edge/Chrome，无需手动启动或下载浏览器驱动
- 安全机制：路径穿越保护（禁止 `..`），工作区根目录由 `WORKSPACE_ROOT` 环境变量控制
- `WORKSPACE_ROOT` 默认值：`path.join(__dirname, '..', '..')` = 项目根目录（`src/skills` 上两级）
- `web_fetch` SSL 问题：企业网络需设置 `NODE_FETCH_REJECT_UNAUTHORIZED=false`（已在 .env 中默认开启）
- `browser` 使用：自动使用系统 Edge/Chrome，无需预先启动
- 设计理念：给 LLM 最小化、通用化的基础工具，让其自主组合完成任务

## PowerShell 注意事项
- `cd /d D:\jsClaw` 在 PowerShell 中不工作，应用 `Set-Location D:\jsClaw`
- git commit -m 带引号在 PowerShell 中有问题，改用 `.bat` 文件执行
- Windows 下 `import(绝对路径)` 需要转成 `file:///` URL

## Git 中文编码配置
**问题**：Windows 下推送到 GitHub 的中文 commit message 显示为乱码

**解决方案**（已配置）：
```bash
git config --global i18n.commitencoding utf-8
git config --global i18n.logoutputencoding utf-8
git config --global gui.encoding utf-8
git config --global core.quotePath false
```

**配置说明**：
- `i18n.commitencoding utf-8` - 提交信息使用 UTF-8 编码
- `i18n.logoutputencoding utf-8` - 日志输出使用 UTF-8 编码
- `gui.encoding utf-8` - GUI 界面使用 UTF-8 编码
- `core.quotePath false` - 不对路径中的非 ASCII 字符进行转义

**相关文档**：`GIT_UTF8_CONFIG.md`

**历史乱码 commit**：
- commit `ac81245`：原文是"实现团队协作系统并更新文档"，显示为乱码"瀹炵幇鍥㈤槦鍗忎綺绯荤粺骞舵洿鏂版枃妗?"
- 如需修正，可使用 `git rebase -i` 手动修改

## npm 命令
```bash
npm start               # 启动 Agent
npm run demo:workspace   # 运行 WorkSpace 演示
npm run demo:agent      # 运行 Agent 类演示
npm run skill:list      # 浏览 Skill 市场
npm run skill:install -- <name>   # 安装 Skill
npm run skill:remove  -- <name>   # 卸载 Skill
npm run skill:installed           # 查看已安装
npm run test             # 运行所有测试
npm run test:ws          # 运行 WorkSpace + Member 测试
npm run test:cm          # 运行 ContextManager 测试
npm run test:gt          # 运行 GoalTracker 测试
```

## Agent 类 —— 面向对象设计

**重构时间**：2026-03-21

**核心特性**：
- 面向对象设计，封装状态和行为
- 支持无指引和有指引两种模式
- 支持继承和重写，易于扩展
- 保留兼容函数，向后兼容

**Agent 类结构**：
```javascript
class Agent {
  constructor({ name, role, verbose, maxRounds }) { }
  async run(userMessage, options) { }
  async runWithGuidance(userMessage, options) { }

  // 私有方法
  _prepareTools(guidance) { }
  _think(userMessage, options) { }
  _act(userMessage, options) { }

  // Setter 方法
  setName(name) { }
  setRole(role) { }
  setVerbose(verbose) { }
  setMaxRounds(maxRounds) { }
}
```

**使用示例**：
```javascript
import { Agent } from './agent.js';

const agent = new Agent({
  name: '助手',
  role: '智能助手',
  verbose: true,
});

const result = await agent.run('你好');
```

**自定义子类**：
```javascript
class FileAgent extends Agent {
  constructor() {
    super({
      name: '文件专家',
      role: '专业的文件管理助手',
      verbose: true,
      maxRounds: 3,
    });
  }

  async run(userMessage, options = {}) {
    console.log('🔍 开始分析任务...');
    const result = await super.run(userMessage, options);
    console.log('✅ 任务完成');
    return result;
  }
}
```

**多 Agent 协作**：
```javascript
const researcher = new Agent({ name: '研究员', role: '信息收集助手' });
const writer = new Agent({ name: '作者', role: '内容创作助手' });

const research = await researcher.run('什么是 JavaScript 闭包？');
const article = await writer.run(`写一篇文章：\n\n${research.result}`);
```

**相关文件**：
- `src/agent.js` — Agent 类实现（含兼容函数）
- `AGENT_OO_REFACTORING.md` — 完整的重构文档
- `.workbuddy/REFACTOR_SUMMARY.md` — 重构总结

**向后兼容**：
- 保留 `runAgentWithThink` 和 `runAgentWithGuidance` 函数
- 兼容函数内部使用 Agent 类实现
- 旧代码无需修改

**优势**：
- ✅ 更好的封装性：状态和行为封装在对象内部
- ✅ 更强的可扩展性：支持继承和重写
- ✅ 更好的可复用性：创建多个独立 Agent 实例
- ✅ 更清晰的职责分离：私有方法封装内部逻辑
- ✅ 向后兼容：保留原有函数接口

**测试结果**：
- ✅ Agent 类创建成功
- ✅ Agent.run() 方法正常工作
- ✅ Agent.runWithGuidance() 方法正常工作
- ✅ Setter 方法正常工作
- ✅ 兼容函数正常工作

**未来扩展**：
- 生命周期钩子（beforeRun, afterRun）
- 中间件系统
- 事件系统（on error, on action, on complete）
- 插件系统

## WorkSpace 重构（2026-03-21）

**重构目标**：将 TeamLab 重构为 WorkSpace，实现基于 teamId 的显式任务路由

**核心变更**：
1. 新增 `src/WorkSpace.js` — WorkSpace 核心实现
2. 新增 `WORKSPACE.md` — WorkSpace 使用文档
3. 新增 `WORKSPACE_REFACTORING.md` — 重构总结
4. 更新 `src/demo-team.js` — 使用 WorkSpace API
5. 更新 `README.md` — 更新文档说明

**WorkSpace 核心职责**：
1. Team 生命周期管理（createTeam, destroyTeam, initialize）
2. 任务路由（submitTask: 带 teamId → Team，不带 → Agent）
3. Team 访问控制（enterTeam, exitTeam, listTeams）

**任务路由逻辑**：
- 旧架构（TeamLab）：用户 → TeamLab → (当前在 Team?) → Leader 决策
- 新架构（WorkSpace）：用户 → WorkSpace → (任务有 teamId?) → 显式路由

**API 变更**：
```javascript
// 旧 API（TeamLab）
const teamSystem = new TeamLab();
await teamSystem.initialize();
const result = await teamSystem.submitTask('简单任务');

// 新 API（WorkSpace）
const workspace = new WorkSpace();
await workspace.initialize();

// 交给 Agent（不带 teamId）
const result1 = await workspace.submitTask('简单任务');

// 交给指定 Team（带 teamId）
const result2 = await workspace.submitTask({
  description: '复杂任务',
  teamId: 'dev-team'
});
```

**返回结果格式**：
```javascript
{
  success: boolean,
  executor: 'Agent' | 'Team',
  executorName: string,
  teamId?: string,
  result?: any,
  error?: string,
  availableTeams?: Array<{ id, name }>
}
```

**改进点**：
- ✅ 更清晰的路由逻辑：显式指定 teamId 或默认使用 Agent
- ✅ 更简单的接口：统一 submitTask() 方法
- ✅ 更可控的执行：用户明确知道任务会交给谁执行
- ✅ 保持兼容：支持传统的进入/退出 Team 模式

**测试结果**：
- ✅ `npm run demo:team` 运行成功
- ✅ WorkSpace 初始化正常，加载 3 个 Teams
- ✅ 不带 teamId 的任务正确交给 Agent
- ✅ 带 teamId 的任务正确交给指定 Team
- ✅ 进入 Team 后提交任务正常工作

## ContextManager —— 上下文自动清理机制（P0）

**实现时间**：2026-05-15

**核心功能**：自动管理对话历史，控制 token 消耗，避免超出 LLM 上下文限制

**核心策略**：
1. 保留系统提示（不裁剪）
2. 保留最近N轮完整对话（preserveRecent）
3. 旧消息 → LLM摘要 或 简单裁剪
4. 超过阈值自动触发（maxTokens）

**相关文件**：
- `src/ContextManager.js` — ContextManager 核心实现
- `src/agent.js` — Agent 集成 ContextManager
- `CONTEXT_MANAGER.md` — 使用文档

**API**：
```javascript
// 独立使用
const cm = new ContextManager({ maxTokens: 6000, preserveRecent: 4 });
cm.prune(messages);           // 同步裁剪
await cm.pruneAsync(messages); // 异步裁剪（LLM摘要）
cm.estimateTokens(messages);   // 估算token
cm.getStats();                // 统计信息

// Agent集成（自动管理）
const agent = new Agent({
  contextManager: { maxTokens: 6000, preserveRecent: 4 }
});
const result = await agent.run('消息', { history: longHistory });
```

**测试结果**：
- ✅ Token估算功能正常
- ✅ 自动裁剪功能正常
- ✅ Agent集成正常
- ✅ 大规模裁剪测试通过（61条→5条，节省2699 tokens）

**配置参数**：
| 参数 | 默认值 | 说明 |
|------|--------|------|
| maxTokens | 6000 | 最大保留token数 |
| preserveRecent | 4 | 保留最近N轮对话 |
| autoPrune | true | 是否自动裁剪 |
| summaryModel | qwen-plus | LLM摘要模型 |

## GoalTracker —— 目标保持机制（P1）

**实现时间**：2026-05-15

**核心功能**：追踪和管理长期目标，确保Agent在多轮对话中保持目标一致性

**相关文件**：
- `src/GoalTracker.js` — GoalTracker 核心实现
- `src/agent.js` — Agent 集成 GoalTracker
- `GOAL_TRACKER.md` — 使用文档

**API**：
```javascript
// 独立使用
const tracker = new GoalTracker();
tracker.createGoal('目标描述', { priority: 3, tags: ['标签'] });
tracker.addCheckpoint(goalId, '检查点');
tracker.completeCheckpoint(goalId, cpId);
tracker.addAchievement(goalId, '成就');
tracker.addBlocker(goalId, '阻碍');
tracker.getGoalContext();  // 生成注入Agent的上下文

// Agent集成（自动注入目标）
const agent = new Agent({
  goalTracker: { autoSave: true }
});
agent.createGoal('分析市场');
agent.addGoalCheckpoint('获取数据');
agent.updateGoalProgress(50);
await agent.run('生成报告');  // 自动注入目标上下文
```

**目标状态**：active, completed, paused, cancelled, failed

**优先级**：LOW(1), NORMAL(2), HIGH(3), CRITICAL(4)

**测试结果**：
- ✅ 目标创建、切换、状态管理正常
- ✅ 检查点添加、完成、进度更新正常
- ✅ 成就/阻碍记录正常
- ✅ 上下文生成正常
- ✅ 事件监听正常
- ✅ Agent集成正常

## WorkspaceMemory —— 工作空间记忆系统

**实现时间**：2026-05-15

**核心功能**：
- 跨会话持久化记忆
- 自动加载/保存记忆到 `.memory` 目录
- 记忆提炼和更新机制
- 智能注入到 Agent 的 system prompt

**目录结构**：
```
data/workspaces/<workspaceId>/.memory/
├── MEMORY.md          ← 主记忆文件
├── YYYY-MM-DD.md      ← 每日记忆
└── <category>/        ← 按分类组织（可选）
```

**相关文件**：
- `src/Memory.js` — WorkspaceMemory 核心实现
- `src/WorkSpace.js` — WorkSpace 集成记忆系统
- `src/Member.js` — Member 使用记忆构建 prompt
- `src/Config.js` — 提供 getWorkspaceMemoryPath() 方法

**核心 API**：
```javascript
// WorkspaceMemory 类
const memory = new WorkspaceMemory(memoryDir);
memory.load();                              // 从 .memory 目录加载所有记忆
memory.save(content, filename);              // 保存记忆到文件
memory.distill(content, options);           // 提炼内容为结构化记忆
memory.update(filename, newContent);          // 更新现有记忆
memory.getForSystemPrompt();                 // 生成供 system prompt 使用的内容
memory.search(keyword);                      // 搜索记忆
memory.getCount();                           // 获取记忆数量

// WorkSpace 集成
const workspace = new WorkSpace({ id: 'default' });
await workspace.initialize();
workspace.getMemory();                       // 获取 WorkspaceMemory 实例
workspace.getMemoryForPrompt();               // 获取用于 system prompt 的记忆
workspace.saveMemory(content, options);      // 保存记忆
```

**Member 集成**：
```javascript
// buildSystemPrompt() 自动接收 workspaceMemory 参数
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
// <skills>
//
// # 工作空间记忆       ← 仅当有记忆时添加
// <memory content>
```

**自动创建目录**：
- Config 在初始化时自动创建 `data/workspaces/<id>/` 和 `.memory/` 目录
- 无需手动创建

**Git 提交记录**：
- commit `8e2ac2f`：集成工作空间记忆系统到 Member prompt
- commit `c8fb632`：修复配置字段不一致
- commit `1864f07`：workspace 定义增加 path 字段，自动创建 .memory 目录

## Goal DAG 系统（2026-05-15）

**核心功能**：实现 DAG 驱动的目标管理系统

**组件架构**：
```
Manager（管理者）— 协调 Goal 执行和 Member 分派
├── Goal — 统一 DAG 节点
│   ├── children[] — 子 Goal（内部节点）
│   ├── tasks[] — Task（叶子节点）
│   ├── dependsOn — DAG 依赖
│   └── sequential — 执行顺序
└── Member — 执行者
```

**重构 (2026-05-16)**：SubGoal.js 已合并到 Goal.js
- 统一节点类型：Goal（内部节点/叶子节点）
- 叶子节点包含 tasks[]
- 内部节点包含 children[]（子 Goal）
- Task.goalId 替代 Task.subGoalId

**相关文件**：
- `src/Goal.js` — 统一 Goal 类（DAG 管理、状态机）
- `src/Task.js` — Task 类（最小执行单元）
- `src/Manager.js` — Manager 类（协调器）
- `tests/TestGoalDag.js` — 测试用例
- `docs/GOAL_DAG_SYSTEM.md` — 使用文档

**状态机**：
- Task: `PENDING → RUNNING → SUCCESS/FAILED/RETRY`
- Goal: `PENDING → READY → IN_PROGRESS → COMPLETED/FAILED`

**DAG 规格格式**：
```javascript
[
  { id: 'sg1', dependsOn: [], tasks: [{ id: 't1', tool: 'web_search', args: {} }] },
  { id: 'sg2', dependsOn: ['sg1'], tasks: [{ id: 't2', tool: 'exec', args: {} }] }
]
```

**测试结果**：✅ 10/10 通过
- ✅ 简单 Goal（无依赖）
- ✅ 顺序执行 Goal
- ✅ DAG 依赖 Goal
- ✅ 失败 Task 与重试
- ✅ 进度跟踪
- ✅ 持久化（导出/导入）
- ✅ 验收标准（规则式）
- ✅ 验收标准（函数式）
- ✅ 人工验收（描述式）
- ✅ 嵌套字段验收

**Task 验收标准**：
- `goalId`：Task 所属的 Goal ID（叶子节点）
- `acceptanceCriteria`：验收标准，支持三种类型：
  1. **函数式**：`{ type: 'function', fn: (result) => boolean }`
  2. **规则式**：`{ type: 'rules', checks: [{ field, operator, value }] }`
  3. **描述式**：`{ type: 'description', description: '...' }`（人工验收）
- 支持嵌套字段：`response.data.items.length`
- 支持 15+ 操作符：equals, greaterThan, contains, isNull, matches 等

**Bug 修复**：
- Goal.updateStatus()：修复状态转换逻辑，支持 IN_PROGRESS 状态

## jsClaw 框架文档（2026-05-15/16）

### 完成工作
为 jsClaw 框架编写了完整的结构化文档，包含 12 个文档文件（docs/）：

| 文档 | 说明 |
|------|------|
| `README.md` | 框架概览、架构图、快速开始、文档索引 |
| `AGENT.md` | Think-Act 模式、核心方法、目标管理、状态机、继承扩展 |
| `CONTEXT_MANAGER.md` | 上下文自动清理、Token 估算、裁剪策略、配置参数 |
| `GOAL_DAG_SYSTEM.md` | Goal/Task 统一 DAG 系统、验收标准、状态机 |
| `WORKSPACE.md` | WorkSpace、Member、Config、Zone 集成、任务路由 |
| `SKILL_REGISTRY.md` | Skill 注册、内置 Skill、懒加载机制、扩展开发 |
| `LLM.md` | LLM 客户端配置、多 Provider 预设、环境变量 |
| `MEMORY.md` | WorkspaceMemory、记忆持久化、文件格式、自动注入 |
| `ZONE.md` | Zone 生命周期管理、多 Zone 管理、API |
| `MARKETPLACE.md` | ClaWHub Skill 市场、API、限流说明、安装管理 |
| `CONFIG.md` | 系统配置、环境变量、Workspace 配置、Config API |
| `GOAL_TRACKER.md` | 目标追踪器、检查点、成就/阻碍记录 |

### CONFIG.md 核心内容
- 环境变量配置（LLM_PROVIDER, MODEL_NAME, OPENAI_API_KEY）
- Provider 预设（千问、OpenAI、DeepSeek、Ollama）
- 系统配置文件（config/system.json）结构
- Workspace 配置（config/workspaces/*.json）Member 定义
- Config API 完整文档（getInfo, listWorkspaces, getWorkspace 等）
- 最佳实践（环境隔离、目录结构、敏感信息管理）
- 配置优先级和验证清单
