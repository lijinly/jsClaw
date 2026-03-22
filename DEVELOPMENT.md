# jsClaw 开发规范

本文档定义了 jsClaw 项目的开发规范，包括代码风格、架构设计、Git 提交规范、测试规范等。

---

## 📋 目录

- [代码风格](#代码风格)
- [文件命名规范](#文件命名规范)
- [项目架构](#项目架构)
- [Git 提交规范](#git-提交规范)
- [代码审查](#代码审查)
- [文档规范](#文档规范)
- [开发流程](#开发流程)

---

## 代码风格

### JavaScript/Node.js

jsClaw 使用原生 ES Modules (`.mjs` 风格的 `import/export`)。

#### 1. 缩进与格式

- **缩进**：2 空格（不使用 Tab）
- **分号**：结尾必须使用分号
- **引号**：字符串优先使用单引号 `'`，必要时使用双引号 `"`

```js
// ✅ 正确
import { Agent } from './agent.js';

function hello(name) {
  console.log(`Hello, ${name}`);
}

// ❌ 错误
import { Agent } from "./agent.js"
const hello = (name)=>{console.log("Hello, "+name)}
```

#### 2. 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 类名 | PascalCase | `Agent`, `WorkSpace`, `TeamMember` |
| 函数/方法 | camelCase | `runTask()`, `sendMessage()` |
| 常量 | UPPER_SNAKE_CASE | `MAX_ROUNDS`, `DEFAULT_TIMEOUT` |
| 变量 | camelCase | `sessionId`, `teamId` |
| 私有方法 | 前缀下划线 | `_internalMethod()` |
| 文件名 | camelCase.js | `agent.js`, `skillRegistry.js` |

```js
// ✅ 正确
class WorkSpace {
  static DEFAULT_TIMEOUT = 30000;
  
  constructor(config) {
    this.maxRounds = config.maxRounds || 5;
  }
  
  async runTask(task) {
    // ...
  }
  
  _internalHelper() {
    // 私有方法
  }
}

// ❌ 错误
class workspace {
  constructor(config) {
    this.MaxRounds = config.maxRounds;
  }
}
```

#### 3. 函数设计

- 单一职责：一个函数只做一件事
- 参数数量：不超过 5 个参数，多参数使用对象
- 返回值：异步函数必须返回 Promise

```js
// ✅ 正确
async function createSession({ title, mode, teamId }) {
  const session = {
    id: generateId(),
    title,
    mode,
    teamId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  return session;
}

// ❌ 错误
async function createSession(title, mode, teamId, createdBy, tags, metadata) {
  // 参数太多
}
```

#### 4. 错误处理

- 使用 try-catch 捕获异步错误
- 抛出明确的错误对象，包含上下文信息

```js
// ✅ 正确
async function executeTool(toolName, params) {
  try {
    const tool = skillRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return await tool.execute(params);
  } catch (error) {
    throw new Error(`Failed to execute tool ${toolName}: ${error.message}`);
  }
}

// ❌ 错误
async function executeTool(toolName, params) {
  const tool = skillRegistry.get(toolName);
  return tool.execute(params);
}
```

#### 5. 注释

- JSDoc 格式用于公共 API
- 单行注释 `//` 用于说明逻辑
- 避免无意义的注释

```js
// ✅ 正确
/**
 * 创建一个新的会话
 * @param {Object} config - 会话配置
 * @param {string} config.title - 会话标题
 * @param {'agent'|'team'} config.mode - 模式
 * @param {string} [config.teamId] - 团队 ID（Team 模式）
 * @returns {Promise<Session>} 创建的会话对象
 */
async function createSession(config) {
  // 生成唯一 ID
  const id = generateId();
  // ...
}

// ❌ 错误
function createSession(config) {
  // This function creates a session
  const id = generateId();
  // return session
}
```

---

### CSS/HTML

WebUI 使用内联样式在 `src/public/index.html` 中。

#### 1. CSS 变量

所有颜色、尺寸使用 CSS 变量定义。

```css
/* ✅ 正确 */
:root {
  --accent: #3b82f6;
  --radius: 8px;
  --sidebar-w: 64px;
}

/* ❌ 错误 */
button {
  background: #3b82f6;
  border-radius: 8px;
}
```

#### 2. 类名

使用 kebab-case，语义化命名。

```css
/* ✅ 正确 */
.session-item { }
.session-item.active { }
.chat-header { }
.input-wrapper { }

/* ❌ 错误 */
.sessionItem { }
.session_item { }
.ChatHeader { }
```

#### 3. 样式组织

按功能分组，使用注释分隔。

```css
/* ── Layout ── */
.app { display: flex; }
.nav { width: 64px; }

/* ── Components ── */
.session-item { padding: 12px; }
.chat-header { height: 56px; }

/* ── Utilities ── */
.hidden { display: none !important; }
```

---

## 文件命名规范

| 类型 | 命名 | 示例 |
|------|------|------|
| JS 源文件 | camelCase.js | `agent.js`, `skillRegistry.js` |
| HTML 文件 | kebab-case.html | `index.html`, `settings.html` |
| JSON 配置 | PascalCase.json | `Config.json`, `package.json` |
| Markdown 文档 | UPPER_SNAKE_CASE.md | `README.md`, `CHANGELOG.md`, `API_KEY_SETUP_GUIDE.md` |

---

## 项目架构

### 目录结构

```
jsClaw/
├── src/
│   ├── index.js              # CLI 入口
│   ├── server.js             # WebUI 服务器
│   ├── agent.js              # Agent 类（核心）
│   ├── llm.js                # LLM 客户端封装
│   ├── Team.js               # Team 类
│   ├── Member.js             # TeamMember 类
│   ├── WorkSpace.js          # WorkSpace 类
│   ├── skillRegistry.js      # Skill 注册表
│   ├── marketplace.js        # Skill 市场
│   ├── Config.json           # Team 配置
│   ├── public/
│   │   └── index.html        # WebUI 界面
│   └── skills/
│       ├── builtins.js       # 内置技能
│       └── plugins/          # 已安装技能
│           ├── index.json    # 技能清单
│           └── <slug>/
│               ├── SKILL.md  # 技能说明
│               └── _meta.json
├── .env                      # 环境变量（不进 Git）
├── .env.example              # 环境变量模板
├── package.json
├── README.md
├── CHANGELOG.md
├── DEVELOPMENT.md            # 开发规范（本文件）
├── WORKSPACE.md
├── TEAM.md
└── AGENT_OO_REFACTORING.md
```

### 模块依赖关系

```
┌─────────────────────────────────────────────────┐
│                   Entry Points                  │
│  ┌──────────────┐          ┌──────────────┐   │
│  │ index.js     │          │ server.js    │   │
│  │ (CLI)        │          │ (WebUI)      │   │
│  └──────┬───────┘          └──────┬───────┘   │
│         │                         │           │
│         ▼                         ▼           │
│  ┌──────────────┐          ┌──────────────┐   │
│  │ WorkSpace    │          │   Sessions   │   │
│  │              │◄─────────┤   Manager    │   │
│  └──────┬───────┘          └──────────────┘   │
│         │                                      │
│         ▼                                      │
│  ┌──────────────┐          ┌──────────────┐   │
│  │   Team       │          │   Agent      │   │
│  │              │          │              │   │
│  └──────┬───────┘          └──────┬───────┘   │
│         │                         │           │
│         └─────────┬───────────────┘           │
│                   │                           │
│                   ▼                           │
│  ┌──────────────────────────────────────┐      │
│  │         skillRegistry                │      │
│  │   (管理所有 Skills)                   │      │
│  └──────────────────────────────────────┘      │
│                   │                           │
│         ┌─────────┴─────────┐                │
│         ▼                   ▼                │
│  ┌──────────────┐   ┌──────────────┐         │
│  │   builtins   │   │   plugins    │         │
│  └──────────────┘   └──────────────┘         │
│                                              │
│  ┌──────────────────────────────────────┐      │
│  │            llm.js                     │      │
│  │    (统一的 LLM 客户端封装)            │      │
│  └──────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

### 核心类设计

#### Agent 类

```js
class Agent {
  constructor(config) {
    this.name = config.name;
    this.role = config.role;
    this.maxRounds = config.maxRounds || 5;
    this.verbose = config.verbose || false;
  }
  
  async run(userMessage, options = {}) {
    // Think-Act 模式
  }
  
  async runWithGuidance(userMessage, options = {}) {
    // 带指引的执行
  }
}
```

#### WorkSpace 类

```js
class WorkSpace {
  constructor() {
    this.teams = new Map();
    this.currentTeam = null;
  }
  
  async initialize() {
    // 加载 Team 配置
  }
  
  async enterTeam(teamId) {
    // 进入 Team
  }
  
  async exitTeam() {
    // 退出 Team
  }
  
  async submitTask(task) {
    // 提交任务（智能路由）
  }
}
```

---

## Git 提交规范

### Commit Message 格式

使用 Conventional Commits 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 类型

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 代码格式调整（不影响功能） |
| `refactor` | 重构（非新增功能，非修复 bug） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具相关 |

#### Scope（作用域）

常见的 scope：
- `agent` - Agent 相关
- `team` - Team 相关
- `workspace` - WorkSpace 相关
- `skill` - Skill 相关
- `ui` - WebUI 相关
- `server` - 服务器相关

#### 示例

```bash
# ✅ 正确
feat(agent): 添加 Agent 子类支持
fix(team): 修复 Team 路由逻辑错误
refactor(ui): 重构 WebUI 布局为三栏结构
docs(readme): 更新快速开始指南

# ❌ 错误
update code
fix bug
add new feature
```

### 分支策略

```
main (生产)
  │
  ├─ develop (开发主分支)
  │   │
  │   ├─ feature/xxx (功能分支)
  │   │
  │   ├─ fix/xxx (修复分支)
  │   │
  │   └─ refactor/xxx (重构分支)
  │
  └─ release/v1.0.0 (发布分支)
```

#### 分支命名

- `feature/<功能名>` - 新功能
- `fix/<问题描述>` - Bug 修复
- `refactor/<重构内容>` - 代码重构
- `docs/<文档更新>` - 文档更新

---

## 代码审查

### 审查清单

#### 功能性

- [ ] 代码是否实现了预期功能？
- [ ] 边界情况是否处理？
- [ ] 错误处理是否完善？

#### 代码质量

- [ ] 代码风格是否符合本规范？
- [ ] 是否有重复代码？
- [ ] 是否有明显的性能问题？
- [ ] 变量/函数命名是否清晰？

#### 文档

- [ ] 复杂逻辑是否有注释？
- [ ] 公共 API 是否有 JSDoc？
- [ ] README 是否需要更新？

#### 测试

- [ ] 是否有对应的测试用例？
- [ ] 测试是否通过？

---

## 文档规范

### README.md

README 应包含：
- 项目简介
- 快速开始
- 核心特性
- 使用示例
- 项目结构

### 代码文档

公共 API 必须使用 JSDoc 注释：

```js
/**
 * 创建一个新的会话
 * @param {Object} config - 会话配置
 * @param {string} config.title - 会话标题
 * @param {'agent'|'team'} config.mode - 模式
 * @param {string} [config.teamId] - 团队 ID（Team 模式）
 * @returns {Promise<Session>} 创建的会话对象
 * @throws {Error} 当配置无效时抛出错误
 */
async function createSession(config) {
  // ...
}
```

### CHANGELOG.md

每个版本更新时，按以下格式记录：

```markdown
## [1.0.0] - 2026-03-22

### Added
- Agent 类支持子类继承
- Team 协作系统
- WebUI 界面

### Changed
- 重构 WorkSpace 任务路由逻辑

### Fixed
- 修复 Team 成员技能加载问题

### Deprecated
- 移除旧的 Worker Agent

### Removed
- 移除 Manager 角色
```

---

## 开发流程

### 新功能开发

1. 从 `develop` 创建功能分支
   ```bash
   git checkout develop
   git checkout -b feature/xxx
   ```

2. 开发并提交代码
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

3. 推送到远程
   ```bash
   git push origin feature/xxx
   ```

4. 创建 Pull Request

5. 代码审查通过后合并到 `develop`

### Bug 修复

1. 从 `develop` 创建修复分支
   ```bash
   git checkout develop
   git checkout -b fix/xxx
   ```

2. 修复并测试
   ```bash
   npm run test
   ```

3. 提交并推送
   ```bash
   git add .
   git commit -m "fix(scope): description"
   git push origin fix/xxx
   ```

4. 创建 Pull Request

### 发布流程

1. 从 `develop` 创建发布分支
   ```bash
   git checkout develop
   git checkout -b release/v1.0.0
   ```

2. 更新版本号和 CHANGELOG

3. 合并到 `main` 并打标签
   ```bash
   git checkout main
   git merge release/v1.0.0
   git tag v1.0.0
   git push origin main --tags
   ```

4. 回到 `develop` 并合并
   ```bash
   git checkout develop
   git merge release/v1.0.0
   git push origin develop
   ```

---

## 测试规范

### 测试文件结构

```
tests/
├── unit/
│   ├── agent.test.js
│   ├── team.test.js
│   └── workspace.test.js
├── integration/
│   └── workflow.test.js
└── e2e/
    └── cli.test.js
```

### 测试命名

```js
// ✅ 正确
describe('Agent', () => {
  describe('run()', () => {
    it('should execute task successfully', () => {});
    it('should handle tool errors', () => {});
    it('should respect maxRounds limit', () => {});
  });
});

// ❌ 错误
describe('Agent', () => {
  it('works', () => {});
  it('test1', () => {});
});
```

---

## 安全规范

### 1. API Key 管理

- ✅ 使用环境变量存储 API Key
- ❌ 禁止将 API Key 提交到 Git
- ✅ `.env` 添加到 `.gitignore`

### 2. 敏感信息

- 禁止在日志中输出敏感信息
- 使用 `***` 替换敏感参数

```js
// ✅ 正确
console.log('Executing tool with params:', { 
  ...params, 
  apiKey: '***' 
});

// ❌ 错误
console.log('Executing tool with params:', params);
```

### 3. 命令注入防护

使用 `exec` 时需要验证参数：

```js
// ✅ 正确
if (!/^[a-zA-Z0-9_-]+$/.test(safeCommand)) {
  throw new Error('Invalid command');
}
await exec(safeCommand);

// ❌ 错误
await exec(userInput);
```

---

## 性能优化

### 1. 避免重复计算

```js
// ✅ 正确
const result = expensiveOperation();
cache.set(key, result);

// ❌ 错误
function process() {
  return expensiveOperation();
}
```

### 2. 异步并行

```js
// ✅ 正确
await Promise.all([
  fetchTeamData(),
  fetchUserData(),
]);

// ❌ 错误
await fetchTeamData();
await fetchUserData();
```

### 3. 大文件处理

```js
// ✅ 正确 - 使用流
import { createReadStream } from 'fs';
const stream = createReadStream('large-file.txt');

// ❌ 错误 - 一次性读取
const content = fs.readFileSync('large-file.txt');
```

---

## 相关文档

- [README.md](./README.md) - 项目说明
- [WORKSPACE.md](./WORKSPACE.md) - WorkSpace 使用文档
- [TEAM.md](./TEAM.md) - Team 使用文档
- [AGENT_OO_REFACTORING.md](./AGENT_OO_REFACTORING.md) - Agent 面向对象设计文档
- [CHANGELOG.md](./CHANGELOG.md) - 版本变更日志
- [API_KEY_SETUP_GUIDE.md](./API_KEY_SETUP_GUIDE.md) - API Key 配置指南

---

## 贡献指南

欢迎贡献！请按照以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/xxx`)
3. 提交更改 (`git commit -m 'feat: description'`)
4. 推送到分支 (`git push origin feature/xxx`)
5. 创建 Pull Request

---

## License

MIT
