# jsClaw

> 基于 JavaScript 的双层 AI Agent 框架,支持 Team 协作、Think-Act 模式和可扩展的 Skill 生态系统,让大语言模型能够通过调用内置或自定义技能完成复杂任务。

---

## 🎯 核心特性

jsClaw 采用**双层协作架构**,从简单到复杂提供不同的能力:

```
┌─────────────────────────────────────────────────────────────┐
│                    用户请求                              │
└─────────────────┬───────────────────────────────────────┘
                  │
      ┌───────────┴───────────┐
      │                       │
      ▼                       ▼
  ┌────────┐          ┌──────────┐
  │  Team  │          │  Agent   │
  │ (协作团队)       │(执行者)   │
  └────────┘          └──────────┘
```

### 🧠 双层架构

**1. Team(协作团队)** - 持久化协作系统
- 多个 TeamMembers 协作完成复杂任务
- 智能任务路由:Team 内/Team 外自动切换
- Team 内任务由 TeamMembers 协作完成
- Team 外任务直接由 Agent 完成
- 每个专注特定领域(开发、研究、测试等)
- 支持自由进入/退出 Team

**2. Agent(执行者)** - Think-Act 模式
- 透明化的思考过程
- 精确的工具调用
- 完全可控的执行流程
- 面向对象设计,易于扩展和定制

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18

### 1. 克隆仓库

```bash
git clone https://github.com/lijinly/jsClaw.git
cd jsClaw
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 API Key

jsClaw 优先从**系统环境变量**读取 API Key,其次从 `.env` 文件。

#### ⚡ 快速配置(5 秒钟)

**Windows 用户**:双击运行 `setup-api-key-session.bat`(当前会话有效)

**永久配置**:双击运行 `setup-api-key-permanent.bat`(需要管理员权限,重启后生效)

---

#### 详细配置指南

完整的 API Key 配置指南请查看:**[API_KEY_SETUP_GUIDE.md](./API_KEY_SETUP_GUIDE.md)**

包括以下方法:

| 方法 | 时间 | 永久性 | 优先级 |
|-----|------|-------|-------|
| 临时脚本 | 5 秒 | ❌ | 高 |
| 永久脚本 | 10 秒 | ✅ | 最高 |
| 命令行设置 | 1 分钟 | ✅ | 最高 |
| .env 文件 | 30 秒 | 项目级 | 中 |
| 代码参数 | 1 分钟 | 代码级 | 最高 |

#### 验证配置

运行诊断脚本检查 API Key 是否配置正确:

```bash
node diagnose-api.js
```

---

### 4. 启动

```bash
# 启动交互式对话(需要 API Key)
npm start
```

启动后示例:

```
🚀 jsClaw Agent 启动!(输入 exit 退出)

你: 现在几点了?
Agent: 当前时间是 2026/3/21 17:30:00

你: 帮我算一下 (128 + 256) * 0.75
Agent: (128 + 256) × 0.75 = 288

你: exit
```

---

## 📚 使用方式

### 方式 1:WorkSpace(推荐用于 Team 协作)

**适用场景**:复杂多步任务、需要多个专业 TeamMembers 协作

```js
import 'dotenv/config';
import { initLLM } from './src/llm.js';
import { WorkSpace } from './src/WorkSpace.js';

// 初始化 LLM
initLLM();

// 创建 WorkSpace
const workspace = new WorkSpace();
await workspace.initialize();

// 场景 1: 不带 teamId 的任务(交给 Agent)
const result1 = await workspace.submitTask('现在几点了?');
console.log(result1.executor); // 'Agent'
console.log(result1.result);   // 执行结果

// 场景 2: 带 teamId 的任务(交给指定 Team)
const result2 = await workspace.submitTask({
  description: '帮我列出当前目录的文件',
  teamId: 'dev-team',
});
console.log(result2.executor); // 'Team'
console.log(result2.executorName); // '开发团队'
console.log(result2.result);   // 执行结果

// 场景 3: 进入 Team 后提交任务
await workspace.enterTeam('dev-team');
const result3 = await workspace.submitTask('分析项目结构');
console.log(result3.result);

// 退出 Team
await workspace.exitTeam();
```

#### Team 配置

在 `src/Config.json` 中定义 Teams:

```json
{
  "teams": {
    "dev-team": {
      "id": "dev-team",
      "name": "开发团队",
      "description": "用于代码开发、文件操作和系统命令执行",
      "teamMembers": [
        {
          "id": "dev-member-1",
          "role": "developer",
          "skills": ["code-analysis", "file-editing"]
        }
      ]
    },
    "research-team": {
      "id": "research-team",
      "name": "研究团队",
      "description": "用于信息收集、数据分析和内容总结",
      "teamMembers": [
        {
          "id": "research-member-1",
          "role": "researcher",
          "skills": ["data-analysis", "web-scraping"]
        }
      ]
    }
  }
}
```

### 方式 2:Agent 类(面向对象,高级定制)

**适用场景**:需要扩展、定制、多 Agent 协作

```js
import 'dotenv/config';
import { initLLM } from './src/llm.js';
import { Agent } from './src/agent.js';
import './src/skills/builtins.js';

initLLM();

// 创建 Agent 实例
const agent = new Agent({
  name: '助手',
  role: '智能助手',
  verbose: true,
  maxRounds: 5,
});

// 运行 Agent(无指引)
const result = await agent.run('你好,请介绍一下你自己');
console.log(result.result);

// 运行 Agent(带指引)
const result2 = await agent.runWithGuidance('统计当前目录文件', {
  guidance: {
    keyRequirements: ['获取文件列表', '准确计数'],
    suggestedTools: ['exec'],
    executionSteps: '使用 find 或 dir 命令',
  },
  systemPrompt: '你是文件操作助手',
  history: [],
});
```

**自定义 Agent 子类:**

```js
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
    // 添加自定义前置处理
    console.log('🔍 开始分析任务...');
    
    const result = await super.run(userMessage, options);
    
    // 添加自定义后置处理
    console.log('✅ 任务完成');
    
    return result;
  }
}

const agent = new FileAgent();
const result = await agent.run('列出当前目录文件');
```

**多 Agent 协作:**

```js
const researcher = new Agent({
  name: '研究员',
  role: '信息收集和分析助手',
  maxRounds: 2,
});

const writer = new Agent({
  name: '作者',
  role: '内容创作助手',
  maxRounds: 2,
});

// 研究阶段
const researchResult = await researcher.run('什么是 JavaScript 闭包?');

// 写作阶段
const articleResult = await writer.run(
  `基于以下内容写一篇文章:\n\n${researchResult.result}`
);
```

📖 **完整文档**:查看 [AGENT_OO_REFACTORING.md](./AGENT_OO_REFACTORING.md) 了解面向对象设计的详细信息。

---

## 🎖️ 核心概念

### Team —— 协作团队

**Team** 是 jsClaw 的协作层,支持持久化的团队协作。

**核心概念:**

1. **Team(团队)** - 持久化的工作环境,专门处理某一类任务
2. **TeamMember(成员)** - 具有特定技能组的 Agent
3. **Team 领导者** - Team 的编排者,负责:
   - 在 Team 内:接收任务 → 组织 TeamMembers 执行 → 输出结果
   - 在 Team 外:分析任务 → 选择是否进入 Team 或自己完成

**工作流程:**
```
用户任务
   ↓
[WorkSpace 路由]
   ├─ 没有 teamId → [Agent 完成]
   └─ 有 teamId    → [Team 组织 TeamMembers] → [TeamMembers 执行] → 最终结果
```

**优势:**
- ✅ 任务分类更清晰 - 每个 Team 专注于特定领域
- ✅ 资源利用更高效 - 不带 teamId 的简单任务直接用 Agent 完成
- ✅ 协作更灵活 - 可多个 Team 并存,用户自由进入和退出
- ✅ 显式路由 - 通过 teamId 显式指定执行者,更可控

详见 [WORKSPACE.md](./WORKSPACE.md) 和 [TEAM.md](./TEAM.md)

---

### Agent —— Think-Act 模式

**Think-Act 模式**,分两个阶段处理:

**第一步(Think)**:让 LLM 先思考问题的分析方案,详细规划需要调用哪些工具
**第二步(Act)**:根据思考结果执行相应的 Skill
**第三步**:综合思考过程和执行结果给出最终答案

**工作流程:**
```
用户问题 → Think(纯思考,无工具调用)→ 输出分析方案
                                      ↓
                         Act(根据方案执行工具)
                              ↓
                         [需要更多工具?]
                            ├─ 是 → 循环调用工具
                            └─ 否 → 输出最终答案
```

---

## 🏗️ 项目结构

```
jsClaw/
├── src/
│   ├── index.js              # 命令行交互入口(REPL)
│   ├── llm.js                # LLM 客户端封装,支持多 Provider
│   ├── agent.js              # Agent 类(Think-Act 模式,面向对象)
│   ├── Team.js               # Team 类,持久化协作团队
│   ├── Member.js             # TeamMember 类,具有基础技能和角色技能的 Agent
│   ├── WorkSpace.js          # 工作空间,统一入口和任务路由
│   ├── skillRegistry.js      # Skill 注册和执行管理
│   ├── marketplace.js        # Skill 市场(ClaWHub 官方 API)
│   ├── Config.json           # Team 配置文件
│   └── skills/
│       ├── builtins.js       # 内置技能:read/write/list/exec/web_search/browser 等
│       └── plugins/          # 从 ClaWHub 安装的 Skill
│           ├── index.json    # 已安装 Skill 清单
│           └── <slug>/       # 每个 Skill 一个目录
│               ├── SKILL.md  # Skill 说明(注入 system prompt)
│               └── _meta.json
├── .env                      # 本地配置(不进 git)
├── .env.example              # 配置模板
├── TEAM.md                   # Team 使用文档
├── WORKSPACE.md              # WorkSpace 使用文档
├── AGENT_OO_REFACTORING.md   # Agent 面向对象重构文档
├── GIT_UTF8_CONFIG.md        # Git 中文编码配置指南
└── package.json
```

---

## 🛠️ 内置 Skill 说明

jsClaw 预装了以下实用技能,开箱即用:

### 基础工具(OpenClaw 风格)

| 技能名 | 描述 | 参数 |
|-------|------|------|
| `read` | 读取文件内容 | `path: string`(相对工作区根目录) |
| `write` | 创建或覆盖文件 | `path: string`, `content: string` |
| `list` | 列出目录内容 | `path?: string`, `recursive?: boolean`, `showHidden?: boolean` |
| `edit` | 精准替换文件内容 | `path: string`, `old_str: string`, `new_str: string` |
| `apply_patch` | 应用 unified diff 补丁 | `patch: string` |
| `exec` | 执行 shell 命令 | `command: string`, `cwd?: string`, `timeout?: number` |
| `web_search` | 多引擎实时网络搜索 | `query: string`, `engine?: string`, `limit?: number` |
| `web_fetch` | 抓取网页内容(HTML → Markdown) | `url: string` |
| `message` | 发送消息到企业微信群聊 | `webhookUrl: string`, `content: string`, `mentioned_list?: string[]` |
| `browser` | 浏览器自动化(自动使用系统 Edge/Chrome) | `action: string`, `url?/selector?/text?/script?` |
| `list_skills` | 列出已安装的 Skill | 无 |
| `read_skill` | 读取 Skill 详细说明 | `name: string` |

### 🌐 Web Search 详解

**jsClaw 已集成 open-websearch!** 框架现在内置了功能完整的网络搜索能力。

#### 支持的搜索引擎

| 引擎 | 简介 | 无需 API Key |
|-----|------|-----------|
| **bing** | 微软 Bing 搜索(默认) | ✅ |
| **duckduckgo** | 隐私友好型搜索 | ✅ |
| **baidu** | 百度搜索(中文友好) | ✅ |
| **csdn** | CSDN 技术博客搜索 | ✅ |

#### 使用示例

```js
// 基础搜索
const result = await web_search({
  query: "Node.js 最佳实践"
});

// 指定引擎
const result = await web_search({
  query: "React 18 新特性",
  engine: "baidu",
  limit: 10
});
```

#### 优势

✅ **无需 API Key** - 完全免费使用
✅ **多引擎支持** - 灵活切换搜索源
✅ **实时信息** - 获取最新的网络数据
✅ **中文支持** - 内置百度和 CSDN 搜索

### 🌍 Browser 详解

**浏览器自动化**,基于 Puppeteer 实现,自动检测并使用系统浏览器(Chrome/Edge)。

#### 优势

✅ **零配置** - 自动检测系统浏览器路径
✅ **无需手动启动** - 自动启动和管理浏览器实例
✅ **支持 Edge/Chrome** - 自动按优先级检测可用浏览器
✅ **Headless 模式** - 无需显示窗口,后台运行

#### 支持的操作

| action | 说明 | 参数 |
|--------|------|------|
| `open` | 打开页面 | `url` |
| `page` | 获取当前页面信息 | 无 |
| `screenshot` | 截图 | `path?: string` |
| `click` | 点击元素 | `selector` |
| `fill` | 填写表单 | `selector`, `text` |
| `type` | 模拟输入 | `selector`, `text` |
| `select` | 下拉选择 | `selector`, `text` |
| `evaluate` | 执行 JavaScript | `script` |
| `close` | 关闭页面 | 无 |

#### 使用示例

```js
// 打开页面
await browser({ action: 'open', url: 'https://example.com' });

// 截图
await browser({ action: 'screenshot', path: 'screenshot.png' });

// 点击按钮
await browser({ action: 'click', selector: 'button#submit' });

// 填写表单
await browser({ action: 'fill', selector: 'input[name="username"]', text: 'testuser' });

// 执行脚本
await browser({ action: 'evaluate', script: 'document.title' });

// 关闭页面
await browser({ action: 'close' });
```

---

## 🌍 Skill 市场(ClaWHub)

jsClaw 内置 **Skill 市场**,直接接入 [ClaWHub](https://clawhub.ai) 官方注册中心,拥有 20,000+ 社区贡献的 Skill。

### 基础命令

```bash
npm run skill:list [query]        # 搜索 Skill(支持关键词)
npm run skill:info -- <slug>      # 查看 Skill 详情
npm run skill:install -- <slug>   # 安装 Skill
npm run skill:remove  -- <slug>   # 卸载 Skill
npm run skill:installed           # 查看已安装
```

### 示例

```bash
# 搜索天气相关 Skill
npm run skill:list weather

# 查看详情
npm run skill:info -- weather

# 安装
npm run skill:install -- weather

# 重启 Agent 后即可使用
npm start
```

### 工作原理

```
1. npm run skill:install -- weather
   → 从 ClaWHub API 获取 Skill 元信息
   → 下载 zip 包(含 SKILL.md + _meta.json)
   → 解压保存到 src/skills/plugins/weather/

2. npm start
   → 扫描 plugins/ 目录
   → 读取所有 SKILL.md 内容
   → 注入 system prompt,让 LLM 知道有哪些 Skill 可用
```

### 什么是 SKILL.md?

ClaWHub 的 Skill 不是可执行代码,而是 **Markdown 格式的说明文件**(SKILL.md),告诉 AI 如何使用某个工具。例如 `weather` Skill 的 SKILL.md 会说明:

> 使用 `curl wttr.in/城市` 可以查询天气,返回格式是……

Agent 读取后,就知道该怎么帮用户查天气了。

### 发布自己的 Skill

在 [clawhub.ai](https://clawhub.ai) 注册后即可发布 Skill,格式就是一个包含 `SKILL.md` 的 zip 包。详见 [ClaWHub 官方文档](https://openclaws.io/zh/docs/tools/clawhub/)。

---

## 🔧 添加自定义 Skill

在 `src/skills/` 下新建一个文件,调用 `registerSkill()` 注册即可。

```js
// src/skills/mySkills.js
import { registerSkill } from '../skillRegistry.js';

registerSkill({
  name: 'get_weather',                          // 技能唯一名称
  description: '查询指定城市的当前天气',          // LLM 靠这句话决定何时调用它
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名,例如 "北京"' },
    },
    required: ['city'],
  },
  async execute({ city }) {
    // 这里接入真实天气 API
    return `${city} 今天晴,25°C,东南风 3 级`;
  },
});
```

然后在 `src/index.js` 中导入:

```js
import './skills/mySkills.js';
```

启动后,当用户问"北京今天天气怎么样?",LLM 会自动判断并调用 `get_weather`。

---

## 📡 支持的 LLM Provider

在 `.env` 中修改 `LLM_PROVIDER` 即可一键切换,无需改代码。

| Provider | LLM_PROVIDER | 默认模型 | 获取 API Key |
|----------|-------------|---------|-------------|
| 阿里云千问 | `qwen` | `qwen-plus` | [百炼平台](https://bailian.console.aliyun.com/) |
| OpenAI | `openai` | `gpt-4o-mini` | [platform.openai.com](https://platform.openai.com/) |
| DeepSeek | `deepseek` | `deepseek-chat` | [platform.deepseek.com](https://platform.deepseek.com/) |
| Moonshot | `moonshot` | `moonshot-v1-8k` | [platform.moonshot.cn](https://platform.moonshot.cn/) |
| Ollama(本地) | `ollama` | `llama3` | 无需 Key,本地运行 |

**千问可选模型:**

| 模型 | 特点 |
|------|------|
| `qwen-turbo` | 最快、最便宜,适合简单任务 |
| `qwen-plus` | 均衡,默认推荐 |
| `qwen-max` | 能力最强,适合复杂推理 |
| `qwen-long` | 超长上下文(100万 token) |
| `qwen2.5-72b-instruct` | 开源旗舰模型 |

---

## 🚀 npm 命令

```bash
npm start               # 启动 Agent
npm run skill:list      # 浏览 Skill 市场
npm run skill:install -- <name>   # 安装 Skill
npm run skill:remove  -- <name>   # 卸载 Skill
npm run skill:installed           # 查看已安装
```

---

## 💡 Team vs Agent 选择指南

| 场景 | 使用 Team | 使用 Agent 类 |
|------|----------|---------------|
| 通用任务处理 | - | ✅ 推荐 |
| 复杂多步任务 | ✅ 推荐 | ✅ 推荐 |
| 需要多个专业 Agents 协作 | ✅ 推荐 | ✅ 推荐 |
| 简单任务(知识问答) | ✅ 自动优化 | ❌ 浪费资源 |
| 完全自主控制 | ❌ 不推荐 | ✅ 推荐 |
| 调试 Agent 行为 | - | ✅ 更直观 |
| 需要扩展和定制 | - | ✅ 推荐 |
| 多 Agent 协作 | ✅ 推荐 | ✅ 推荐 |

**建议:**
- 日常使用推荐 **Agent 类**
- 复杂协作任务使用 **Team**
- 需要扩展、定制或多 Agent 协作使用 **Agent 类**
- 调试时使用 **Agent 类** 或 **Worker Agent(函数式)**

---

## 🛣️ 开发计划

- [x] Think-Act 模式(思考 + 行动分离)
- [x] Team 协作系统
- [x] Agent 面向对象重构
- [x] Team 外任务直接使用 Agent(移除 Manager)
- [ ] 流式输出支持(stream 模式)
- [ ] Skill 异步并行执行
- [ ] Web UI 界面
- [ ] 更多内置 Skills

---

## 📖 详细文档

- [WORKSPACE.md](./WORKSPACE.md) - WorkSpace 使用文档
- [TEAM.md](./TEAM.md) - Team 使用文档
- [AGENT_OO_REFACTORING.md](./AGENT_OO_REFACTORING.md) - Agent 面向对象重构文档
- [API_KEY_SETUP_GUIDE.md](./API_KEY_SETUP_GUIDE.md) - API Key 配置指南
- [GIT_UTF8_CONFIG.md](./GIT_UTF8_CONFIG.md) - Git 中文编码配置指南

---

## 📝 License

MIT
