# jsClaw

> 一个用 JavaScript 写的极简 Agent 框架，让大语言模型能够调用自定义技能（Skill）完成实际任务。

---

## 创作背景

市面上的 Agent 框架（LangChain、AutoGen 等）功能强大，但上手成本高、抽象层太厚，很多时候你只是想让 LLM **调用几个自己写的函数**，却要先啃完一本文档。

jsClaw 从另一个方向出发——**能跑起来的最小实现**。整个框架只有 4 个核心文件，不到 200 行代码，把 LLM 调用、Skill 注册、Agentic 循环三件事拆干净，让你看一眼就懂、改一行就能用。

名字来自 "JS" + "Claw"（爪子）——轻量、灵活、能抓住东西。

---

## 🆕 Manager —— 智能任务编排 Agent

**Manager** 是 jsClaw 的任务编排层，位于用户和 Worker Agent 之间，负责：

- 🧠 **智能判断**：分析任务类型，决定是直接回答还是需要工具
- 🎯 **任务分发**：简单任务快速回答，复杂任务交给 Worker Agent
- 📋 **执行指引**：为复杂任务提供关键需求、建议工具、执行步骤
- 📊 **结果评估**：评估执行结果的完整性、准确性、实用性

### 工作流程

```
用户任务
   ↓
[Manager 判断]
   ├─ 简单任务 → [直接回答] → 最终结果
   └─ 复杂任务 → [生成执行指引] → [Worker Agent]
                                      ↓
                                 [执行工具]
                                      ↓
                                 [Manager 评估] → 最终结果
```

### 快速体验

直接使用交互式命令行体验 Manager（需要 API Key）：

```bash
npm start
```

### 编程方式使用

```js
import { initLLM } from './src/llm.js';
import { runManager } from './src/manager.js';

initLLM();

const result = await runManager('读取当前目录下的文件并统计数量', {
  verbose: true,  // 打印中间过程
});

console.log(result.finalResult);  // 最终答案
console.log(result.guidance);     // 执行指引（关键需求、建议工具、执行步骤）
console.log(result.evaluation);   // 结果评估（评分 1-5）
```

### 优势

✅ **减少重复判断** - Manager 和 Worker Agent 不再重复分析任务  
✅ **降低 Token 消耗** - 只传递相关工具给 Worker Agent  
✅ **紧密协作** - Manager 的判断结果被充分利用  
✅ **向后兼容** - 保留 `runAgentWithThink()` 接口，现有代码无需改动

详见 [MANAGER.md](./MANAGER.md) 和 [REFACTORING.md](./REFACTORING.md)

---

## 🏠 Team —— 协作团队

**Team** 是 jsClaw 的协作层，支持持久化的团队协作，让多个 Members 配合完成复杂任务。

### 核心概念

1. **Team（团队）** - 持久化的工作环境，专门处理某一类任务
2. **Member（成员）** - 具有特定技能组的 Agent
3. **Leader（队长）** - Team 的编排者，负责：
   - 在 Team 内：接收任务 → 组织 Members 执行 → 输出结果
   - 在 Team 外：接收任务 → 决定自己完成或引导用户进入 Team

### 工作流程

```
用户任务
   ↓
[Leader 决策]
   ├─ Team 外简单任务 → [Leader 直接回答] → 最终结果
   ├─ Team 外复杂任务 → [引导用户进入 Team]
   └─ Team 内任务 → [Team Leader 组织 Members] → [Members 执行] → 最终结果
```

### 快速体验

```bash
# 运行 Team 系统演示
npm run demo:team
```

### 编程方式使用

```js
import 'dotenv/config';
import { initLLM } from './llm.js';
import { TeamLab } from './TeamLab.js';

// 初始化 LLM
initLLM();

// 创建 Team 系统
const teamSystem = new TeamLab();
await teamSystem.initialize();

// Team 外提交任务（Leader 决策）
const result = await teamSystem.submitTask('现在几点了？');
// → Leader 自己完成，无需 Team

const result2 = await teamSystem.submitTask('帮我分析项目代码结构');
// → Leader 建议进入"开发团队"

// 进入 Team
await teamSystem.enterTeam('dev-team');

// Team 内提交任务（Members 协作）
const result3 = await teamSystem.submitTask('读取并分析 package.json');
// → Team Leader 组织 Members 执行

// 退出 Team
await teamSystem.exitTeam();
```

### 优势

✅ **任务分类更清晰** - 每个 Team 专注于特定领域（开发、研究、测试等）  
✅ **资源利用更高效** - Team 外简单任务不启动 Members，复杂任务专门优化  
✅ **协作更灵活** - 可多个 Team 并存，用户自由进入和退出  
✅ **智能决策** - Leader 判断在哪里完成任务最合适  

详见 [TEAM.md](./TEAM.md)

---

## Think-Act 模式（Worker Agent）

jsClaw 采用 **Think-Act 模式**，分两个阶段处理：

**第一步（Think）**：让 LLM 先思考问题的分析方案，详细规划需要调用哪些工具  
**第二步（Act）**：根据思考结果执行相应的 Skill  
**第三步**：综合思考过程和执行结果给出最终答案

这种设计提高了推理的透明性和准确性。Agent 内置了默认的系统提示词，会自动指导 LLM 如何有效地使用 Skill。

```js
const { thinking, actions, result } = await runAgentWithThink(
  '帮我分析这个数据',
  { verbose: true }  // 打印中间过程
);

console.log(thinking);  // 思考过程
console.log(actions);   // 执行的 Skill 和结果
console.log(result);    // 最终答案
```

**工作流程：**
```
用户问题 → Think（纯思考，无工具调用）→ 输出分析方案
                                      ↓
                         Act（根据方案执行工具）
                              ↓
                         [需要更多工具?]
                            ├─ 是 → 循环调用工具
                            └─ 否 → 输出最终答案
```

**快速体验**（需要 API Key）：

```bash
npm start
```

**Manager vs Worker Agent 的选择：**

| 场景 | 使用 Manager | 直接使用 Worker Agent |
|------|-------------|---------------------|
| 通用任务处理 | ✅ 推荐 | - |
| 需要任务分类和评估 | ✅ 推荐 | - |
| 简单任务（知识问答） | ✅ 自动优化 | ❌ 浪费资源 |
| 复杂任务（工具调用） | ✅ 智能分发 | ✅ 可直接调用 |
| 完全自主控制 | ❌ 不推荐 | ✅ 推荐 |
| 调试 Agent 行为 | - | ✅ 更直观 |

**建议：日常使用推荐 Manager，调试时使用 Worker Agent。**

---

## 核心概念

```
用户输入
   │
   ▼
┌──────────────────┐    注册的 Skills     ┌─────────────────┐
│ Agent            │ ◄─────────────────── │  Skill Registry │
│ (Think-Act 模式) │                      │  registerSkill()│
└──────────────────┘                      └─────────────────┘
   │  ▲
   │  │ tool_calls / tool results
   ▼  │
┌──────────┐
│   LLM    │  支持千问 / OpenAI / DeepSeek / Moonshot / Ollama
└──────────┘
```

- **LLM**：负责思考问题方案，决定调用哪个 Skill、传什么参数
- **Skill**：你自己写的函数，干真正的活（查数据库、调 API、做计算……）
- **Agent**：Think-Act 两阶段模式，透明化推理过程

---

## 项目结构

```
jsClaw/
├── src/
│   ├── index.js              # 命令行交互入口（REPL）
│   ├── llm.js                # LLM 客户端封装，支持多 Provider
│   ├── agent.js              # Worker Agent 核心（Think-Act 模式）
│   ├── manager.js            # Manager 任务编排 Agent
│   ├── Team.js               # Team 类，持久化协作团队
│   ├── Member.js             # Member 类，具有基础技能和角色技能的 Agent
│   ├── TeamLeader.js         # Team 内的 Leader，任务编排和 Member 管理
│   ├── TeamRegistry.js       # Team 注册和管理，处理 Team 进入/退出
│   ├── TeamLab.js            # Team 实验室，加载配置和管理
│   ├── skillRegistry.js      # Skill 注册和执行管理
│   ├── marketplace.js        # Skill 市场（ClaWHub 官方 API）
│   ├── TeamConfig.json       # Team 配置文件
│   └── skills/
│       ├── builtins.js       # 内置技能：read/write/list/exec/web_search/browser 等
│       └── plugins/          # 从 ClaWHub 安装的 Skill
│           ├── index.json    # 已安装 Skill 清单
│           └── <slug>/       # 每个 Skill 一个目录
│               ├── SKILL.md  # Skill 说明（注入 system prompt）
│               └── _meta.json
├── .env                      # 本地配置（不进 git）
├── .env.example              # 配置模板
├── MANAGER.md                # Manager 使用文档
├── TEAM.md                   # Team 使用文档
├── REFACTORING.md            # 重构说明文档
└── package.json
```

---

## 快速开始

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

jsClaw 优先从**系统环境变量**读取 API Key，其次从 `.env` 文件。这样做更安全，避免不小心提交敏感信息到 git。

#### ⚡ 快速配置（5 秒钟）

**Windows 用户**：双击运行 `setup-api-key-session.bat`（当前会话有效）

**永久配置**：双击运行 `setup-api-key-permanent.bat`（需要管理员权限，重启后生效）

---

#### 详细配置指南

完整的 API Key 配置指南请查看：**[API_KEY_SETUP_GUIDE.md](./API_KEY_SETUP_GUIDE.md)**

包括以下方法：

| 方法 | 时间 | 永久性 | 优先级 |
|-----|------|-------|-------|
| 临时脚本 | 5 秒 | ❌ | 高 |
| 永久脚本 | 10 秒 | ✅ | 最高 |
| 命令行设置 | 1 分钟 | ✅ | 最高 |
| .env 文件 | 30 秒 | 项目级 | 中 |
| 代码参数 | 1 分钟 | 代码级 | 最高 |

#### 验证配置

运行诊断脚本检查 API Key 是否配置正确：

```bash
node diagnose-api.js
```

---

### 4. 启动

```bash
# 启动交互式对话（需要 API Key）
npm start
```

启动后示例：

```
🚀 jsClaw Agent 启动！（输入 exit 退出）

你: 现在几点了？
Agent: 当前时间是 2026/3/17 17:30:00

你: 帮我算一下 (128 + 256) * 0.75
Agent: (128 + 256) × 0.75 = 288

你: exit
```

---

## 支持的 LLM Provider

在 `.env` 中修改 `LLM_PROVIDER` 即可一键切换，无需改代码。

| Provider | LLM_PROVIDER | 默认模型 | 获取 API Key |
|----------|-------------|---------|-------------|
| 阿里云千问 | `qwen` | `qwen-plus` | [百炼平台](https://bailian.console.aliyun.com/) |
| OpenAI | `openai` | `gpt-4o-mini` | [platform.openai.com](https://platform.openai.com/) |
| DeepSeek | `deepseek` | `deepseek-chat` | [platform.deepseek.com](https://platform.deepseek.com/) |
| Moonshot | `moonshot` | `moonshot-v1-8k` | [platform.moonshot.cn](https://platform.moonshot.cn/) |
| Ollama（本地） | `ollama` | `llama3` | 无需 Key，本地运行 |

**千问可选模型：**

| 模型 | 特点 |
|------|------|
| `qwen-turbo` | 最快、最便宜，适合简单任务 |
| `qwen-plus` | 均衡，默认推荐 |
| `qwen-max` | 能力最强，适合复杂推理 |
| `qwen-long` | 超长上下文（100万 token） |
| `qwen2.5-72b-instruct` | 开源旗舰模型 |

---

## 内置 Skill 说明

jsClaw 预装了以下实用技能，开箱即用：

### 基础工具（OpenClaw 风格）

| 技能名 | 描述 | 参数 |
|-------|------|------|
| `read` | 读取文件内容 | `path: string`（相对工作区根目录） |
| `write` | 创建或覆盖文件 | `path: string`, `content: string` |
| `list` | 列出目录内容 | `path?: string`, `recursive?: boolean`, `showHidden?: boolean` |
| `edit` | 精准替换文件内容 | `path: string`, `old_str: string`, `new_str: string` |
| `apply_patch` | 应用 unified diff 补丁 | `patch: string` |
| `exec` | 执行 shell 命令 | `command: string`, `cwd?: string`, `timeout?: number` |
| `web_search` | 多引擎实时网络搜索 | `query: string`, `engine?: string`, `limit?: number` |
| `web_fetch` | 抓取网页内容（HTML → Markdown） | `url: string` |
| `message` | 发送消息到企业微信群聊 | `webhookUrl: string`, `content: string`, `mentioned_list?: string[]` |
| `browser` | 浏览器自动化（自动使用系统 Edge/Chrome，无需预先启动） | `action: string`, `url?/selector?/text?/script?` |
| `list_skills` | 列出已安装的 Skill | 无 |
| `read_skill` | 读取 Skill 详细说明 | `name: string` |

### 🌐 Web Search 详解

**jsClaw 已集成 open-websearch！** 框架现在内置了功能完整的网络搜索能力。

#### 支持的搜索引擎

| 引擎 | 简介 | 无需 API Key |
|-----|------|-----------|
| **bing** | 微软 Bing 搜索（默认） | ✅ |
| **duckduckgo** | 隐私友好型搜索 | ✅ |
| **baidu** | 百度搜索（中文友好） | ✅ |
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

**浏览器自动化**，基于 Puppeteer 实现，自动检测并使用系统浏览器（Chrome/Edge），无需预先启动。

#### 优势

✅ **零配置** - 自动检测系统浏览器路径  
✅ **无需手动启动** - 自动启动和管理浏览器实例  
✅ **支持 Edge/Chrome** - 自动按优先级检测可用浏览器  
✅ **Headless 模式** - 无需显示窗口，后台运行  

#### 支持的操作

#### 支持的操作

| action | 说明 | 参数 |
|--------|------|------|
| `open` | 打开页面 | `url` |
| `page` | 获取当前页面信息 | 无 |
| `screenshot` | 截图 | `path?: string`（保存路径） |
| `click` | 点击元素 | `selector`（CSS 选择器） |
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

### 🔍 Web Search 详解

**jsClaw 已集成 open-websearch！** 框架现在内置了功能完整的网络搜索能力。

#### 支持的搜索引擎

| 引擎 | 简介 | 无需 API Key |
|-----|------|-----------|
| **bing** | 微软 Bing 搜索（默认） | ✅ |
| **duckduckgo** | 隐私友好型搜索 | ✅ |
| **baidu** | 百度搜索（中文友好） | ✅ |
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

// DuckDuckGo 搜索
const result = await web_search({ 
  query: "Python asyncio",
  engine: "duckduckgo",
  limit: 5
});
```

#### 响应格式

```json
[搜索结果] 使用 bing 搜索 "Node.js" 的前 5 条结果：

1. Node.js 官方网站
   链接: https://nodejs.org/
   描述: Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行环境...

2. Node.js 中文官网
   链接: https://nodejs.cn/
   描述: Node.js 官方中文网站...
```

#### 优势

✅ **无需 API Key** - 完全免费使用  
✅ **多引擎支持** - 灵活切换搜索源  
✅ **实时信息** - 获取最新的网络数据  
✅ **中文支持** - 内置百度和 CSDN 搜索  
✅ **错误处理** - 自动处理搜索失败和超时  

#### 技术细节

jsClaw 基于 **open-websearch** 实现网络搜索，该项目提供了：
- 多搜索引擎的统一接口
- 智能的结果解析和格式化
- 代理支持（可配置 HTTP 代理）
- 速率限制管理

更多信息请查看 [open-websearch GitHub](https://github.com/Aas-ee/open-websearch)

---

## Skill 市场（ClaWHub）

jsClaw 内置 **Skill 市场**，直接接入 [ClaWHub](https://clawhub.ai) 官方注册中心，拥有 20,000+ 社区贡献的 Skill。

### 基础命令

```bash
npm run skill:list [query]        # 搜索 Skill（支持关键词）
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
   → 下载 zip 包（含 SKILL.md + _meta.json）
   → 解压保存到 src/skills/plugins/weather/

2. npm start
   → 扫描 plugins/ 目录
   → 读取所有 SKILL.md 内容
   → 注入 system prompt，让 LLM 知道有哪些 Skill 可用
```

### 什么是 SKILL.md？

ClaWHub 的 Skill 不是可执行代码，而是 **Markdown 格式的说明文件**（SKILL.md），告诉 AI 如何使用某个工具。例如 `weather` Skill 的 SKILL.md 会说明：

> 使用 `curl wttr.in/城市` 可以查询天气，返回格式是……

Agent 读取后，就知道该怎么帮用户查天气了。

### 发布自己的 Skill

在 [clawhub.ai](https://clawhub.ai) 注册后即可发布 Skill，格式就是一个包含 `SKILL.md` 的 zip 包。详见 [ClaWHub 官方文档](https://openclaws.io/zh/docs/tools/clawhub/)。

---

## 添加自定义 Skill

在 `src/skills/` 下新建一个文件，调用 `registerSkill()` 注册即可。

```js
// src/skills/mySkills.js
import { registerSkill } from '../skillRegistry.js';

registerSkill({
  name: 'get_weather',                          // 技能唯一名称
  description: '查询指定城市的当前天气',          // LLM 靠这句话决定何时调用它
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名，例如 "北京"' },
    },
    required: ['city'],
  },
  async execute({ city }) {
    // 这里接入真实天气 API
    return `${city} 今天晴，25°C，东南风 3 级`;
  },
});
```

然后在 `src/index.js` 中导入：

```js
import './skills/mySkills.js';
```

启动后，当用户问"北京今天天气怎么样"，LLM 会自动判断并调用 `get_weather`。

---

## 以编程方式调用

### 方式 1：使用 Manager（推荐）

Manager 会自动判断任务类型，优化执行效率：

```js
import 'dotenv/config';
import { initLLM } from './src/llm.js';
import { runManager } from './src/manager.js';
import './src/skills/builtins.js';

initLLM();

const result = await runManager('帮我计算 3 的 10 次方');
console.log(result.finalResult);
```

### 方式 2：直接使用 Worker Agent

完全自主控制 Worker Agent 的行为：

```js
import 'dotenv/config';
import { initLLM } from './src/llm.js';
import { runAgentWithThink } from './src/agent.js';
import './src/skills/builtins.js';

initLLM(); // 读取 .env 配置

const { thinking, actions, result } = await runAgentWithThink(
  '帮我计算 3 的 10 次方'
);
console.log(result);
```

Agent 会自动使用内置的系统提示词来指导 LLM 思考和调用 Skill。

**携带对话历史实现多轮对话：**

```js
const history = [];

// 第一轮
const r1 = await runManager('我叫小明', { history });
history.push({ role: 'user', content: '我叫小明' });
history.push({ role: 'assistant', content: r1.finalResult });

// 第二轮（LLM 记得上文）
const r2 = await runManager('我叫什么名字？', { history });
console.log(r2.finalResult); // → 你叫小明
```

**获取完整的执行过程（调试用）：**

```js
const { thinking, actions, result } = await runAgentWithThink(
  '分析今天的销售数据',
  { verbose: true }  // 打印 Think 和 Act 的中间过程
);

console.log('💭 思考过程：', thinking);
console.log('⚙️  执行步骤：', actions);  // 包含所有 Skill 调用和结果
console.log('📊 最终结果：', result);
```

**返回值说明：**

- `thinking`：LLM 的分析和规划过程
- `actions`：数组，每项包含 `{ calls, results }`
  - `calls`：该步骤调用的 tool_calls
  - `results`：该步骤执行的结果
- `result`：最终答案文本

### Manager 返回值说明

```js
const result = await runManager('任务内容', { verbose: true });

// 判断决策
console.log(result.decision);     // 判断文本
console.log(result.needsAgent);   // 是否使用了 agent

// 执行指引
console.log(result.guidance.keyRequirements);  // 关键需求数组
console.log(result.guidance.suggestedTools);  // 建议工具数组
console.log(result.guidance.executionSteps);  // 执行步骤文本

// 执行结果
console.log(result.agentResult);  // Worker agent 的完整结果
console.log(result.directAnswer); // 直接回答的内容
console.log(result.evaluation);   // 结果评估（评分 1-5）
console.log(result.finalResult);  // 最终答案
```

---

## Team 配置

在 `src/TeamConfig.json` 中定义 Teams：

```json
{
  "teams": {
    "dev-team": {
      "id": "dev-team",
      "name": "开发团队",
      "description": "用于代码开发、文件操作和系统命令执行",
      "members": [
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
      "members": [
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

### npm 命令
```bash
npm start               # 启动 Agent
npm run demo:team       # 运行 Team 系统演示
npm run skill:list      # 浏览 Skill 市场
npm run skill:install -- <name>   # 安装 Skill
npm run skill:remove  -- <name>   # 卸载 Skill
npm run skill:installed           # 查看已安装
```

---

## 开发计划

- [x] Think-Act 模式（思考 + 行动分离）
- [x] Manager 任务编排 Agent
- [x] 执行指引优化（减少 token 消耗）
- [x] Team 协作系统
- [ ] 流式输出支持（stream 模式）
- [ ] Skill 异步并行执行
- [ ] Web UI 界面
- [ ] Skill 市场 / 插件化加载

---

## License

MIT
