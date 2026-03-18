# jsClaw

> 一个用 JavaScript 写的极简 Agent 框架，让大语言模型能够调用自定义技能（Skill）完成实际任务。

---

## 创作背景

市面上的 Agent 框架（LangChain、AutoGen 等）功能强大，但上手成本高、抽象层太厚，很多时候你只是想让 LLM **调用几个自己写的函数**，却要先啃完一本文档。

jsClaw 从另一个方向出发——**能跑起来的最小实现**。整个框架只有 4 个核心文件，不到 200 行代码，把 LLM 调用、Skill 注册、Agentic 循环三件事拆干净，让你看一眼就懂、改一行就能用。

名字来自 "JS" + "Claw"（爪子）——轻量、灵活、能抓住东西。

---

## Think-Act 模式

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

**快速体验 Think-Act 演示**（需要 API Key）：

```bash
npm run demo:think-act
```

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
│   ├── demo.js               # 本地 Skill 演示，不需要 API Key
│   ├── demo-think-act.js     # Think-Act 模式演示（需要 API Key）
│   ├── llm.js                # LLM 客户端封装，支持多 Provider
│   ├── agent.js              # Agent 核心（Think-Act 模式）
│   ├── skillRegistry.js      # Skill 注册和执行管理
│   └── skills/
│       └── builtins.js       # 内置技能：数学计算 / 当前时间 / 网络搜索
├── setup-env.bat             # Windows 环境变量设置脚本
├── setup-env.sh              # macOS/Linux 环境变量设置脚本
├── .env                      # 本地配置（不进 git）
├── .env.example              # 配置模板
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

为了安全起见，**API Key 不存储在 .env 文件中**，需要设置为**系统环境变量**。

#### Windows 用户（推荐）

**方法一：使用自动化脚本**

```bash
# 用管理员身份运行（右键选择以管理员身份运行）
setup-env.bat
```

然后按提示输入你的 API Key，脚本会自动配置系统环境变量。

**方法二：手动配置**

在 PowerShell 中执行：
```powershell
$env:OPENAI_API_KEY = "your_api_key_here"
```

或在 CMD 中执行：
```cmd
set OPENAI_API_KEY=your_api_key_here
```

**方法三：永久配置**

1. 右键 "此电脑" → 属性
2. 高级系统设置 → 环境变量
3. 系统变量 → 新建
4. 变量名：`OPENAI_API_KEY`，变量值：你的 API Key
5. 重启 IDE 或命令行

#### macOS / Linux 用户

**方法一：使用自动化脚本**

```bash
bash setup-env.sh
```

然后按提示输入你的 API Key。

**方法二：手动配置**

编辑 `~/.bashrc` 或 `~/.zshrc`，添加：
```bash
export OPENAI_API_KEY="your_api_key_here"
```

然后运行：
```bash
source ~/.bashrc  # 或 source ~/.zshrc
```

#### 配置 .env（可选）

如果想要本地测试（不提交到 git），可以在 `.env` 中临时设置：

```bash
cp .env.example .env
# 编辑 .env，取消注释并填入你的 API Key
OPENAI_API_KEY=your_api_key_here
```

**⚠️ 重要：不要将含真实 API Key 的 .env 提交到 git！**

### 4. 启动

```bash
# 启动交互式对话（需要 API Key）
npm start

# 本地 Skill 功能演示（不需要 API Key）
npm run demo

# Think-Act 模式演示（需要 API Key）
npm run demo:think-act
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

直接引入 `runAgentWithThink` 集成到你自己的项目里：

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
const r1 = await runAgentWithThink('我叫小明', { history });
history.push({ role: 'user', content: '我叫小明' });
history.push({ role: 'assistant', content: r1.result });

// 第二轮（LLM 记得上文）
const r2 = await runAgentWithThink('我叫什么名字？', { history });
console.log(r2.result); // → 你叫小明
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

---

## 开发计划

- [x] Think-Act 模式（思考 + 行动分离）
- [ ] 流式输出支持（stream 模式）
- [ ] Skill 异步并行执行
- [ ] Web UI 界面
- [ ] Skill 市场 / 插件化加载

---

## License

MIT
