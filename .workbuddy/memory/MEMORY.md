# MEMORY.md —— jsClaw 项目长期记忆

## 项目位置
- **jsClaw**：`D:/jsClaw`（JavaScript Agent 框架，ES Module）
- **pyClaw**：`D:/pyClaw`（Python 版 Agent 框架）

## 技术栈
- Node.js v24，`"type": "module"`（ES Module）
- 依赖：`openai`, `dotenv`, `open-websearch`
- LLM：阿里云千问 qwen-plus（OpenAI 兼容接口）
- API Key 配置：`.env` 文件 `OPENAI_API_KEY=sk-45d478ddd7b94b0d838d9fce6f1e3762`

## 架构

### WorkSpace —— 统一工作空间入口
- `src/WorkSpace.js` — WorkSpace 核心实现，负责：
  - Team 生命周期管理（createTeam, destroyTeam, initialize）
  - 任务路由（submitTask: 带 teamId → Team，不带 → Agent）
  - Team 访问控制（enterTeam, exitTeam, listTeams）

### Team 系统 —— 任务执行场所
- **Team** — 持久化工作场所，可常驻一组 TeamMembers
- **TeamMember** — 具有系统基础技能和动态角色技能的 Agent
- **TeamLeader** — Team 内的任务编排者，组织 TeamMembers 协作执行
- **TeamRegistry** — Team 注册和管理，处理 Team 进入/退出

**任务路由（WorkSpace）：**
- 带 teamId → 交给指定 Team 执行
- 不带 teamId → 交给 Agent 执行
- 进入 Team 后 → Team 内任务由 TeamLeader 组织 TeamMembers 执行

**配置文件：** `src/TeamConfig.json`

**使用文档：**
- `WORKSPACE.md` - WorkSpace 使用文档
- `TEAM.md` - Team 使用文档

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
npm run demo:team       # 运行 Team 系统演示
npm run demo:agent      # 运行 Agent 类演示
npm run skill:list      # 浏览 Skill 市场
npm run skill:install -- <name>   # 安装 Skill
npm run skill:remove  -- <name>   # 卸载 Skill
npm run skill:installed           # 查看已安装
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
