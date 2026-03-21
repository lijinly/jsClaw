# Agent 面向对象重构

## 重构概述

将原有的函数式 `agent.js` 重构为面向对象的 `Agent.js`，提升代码的可维护性、可扩展性和可复用性。

## 主要改进

### 1. 面向对象设计

**重构前（函数式）：**
```javascript
// 独立的函数，状态和逻辑耦合
export async function runAgentWithGuidance(userMessage, { guidance, systemPrompt, history, verbose }) {
  let tools = getToolDefinitions();
  // ... 大量代码
  let thinking = '';
  // ... 更多代码
  // Act 阶段
  const actions = [];
  // ... 循环逻辑
  return { thinking, actions, result };
}
```

**重构后（面向对象）：**
```javascript
// 状态和行为封装在类中
class Agent {
  constructor({ name, role, verbose, maxRounds }) {
    this.name = name;        // 状态
    this.role = role;        // 状态
    this.verbose = verbose;  // 状态
    this.maxRounds = maxRounds;  // 状态
  }

  async run(userMessage, options) {
    // 行为
  }

  async runWithGuidance(userMessage, options) {
    // 行为
  }

  // 私有方法封装内部逻辑
  _prepareTools(guidance) { }
  _think(userMessage, options) { }
  _act(userMessage, options) { }
}
```

### 2. 核心优势

#### ✅ 更好的封装性
- 状态（name、role、verbose、maxRounds）封装在对象内部
- 私有方法（_开头）隐藏实现细节
- 公共接口清晰明确（run、runWithGuidance）

#### ✅ 更强的可扩展性
- 可以通过继承创建专用 Agent
- 可以重写方法定制行为
- 易于添加新的属性和方法

#### ✅ 更好的可复用性
- 创建多个 Agent 实例，每个独立配置
- 支持多 Agent 协作场景
- 实例之间互不干扰

#### ✅ 更清晰的职责分离
- `_prepareTools` —— 工具准备
- `_think` —— 思考阶段
- `_act` —— 执行阶段
- 每个方法职责单一

### 3. 使用对比

#### 基础使用（无指引）

**重构前：**
```javascript
import { runAgentWithThink } from './agent.js';

const result = await runAgentWithThink('你好', {
  systemPrompt: '你是助手',
  history: [],
  verbose: true,
});
```

**重构后：**
```javascript
import { Agent } from './Agent.js';

const agent = new Agent({
  name: '助手',
  role: '智能助手',
  verbose: true,
});

const result = await agent.run('你好', {
  systemPrompt: '你是助手',
  history: [],
});
```

#### 带指引的执行

**重构前：**
```javascript
import { runAgentWithGuidance } from './agent.js';

const result = await runAgentWithGuidance('统计文件', {
  guidance: {
    keyRequirements: ['获取文件列表', '准确计数'],
    suggestedTools: ['exec'],
    executionSteps: '使用 find 命令',
  },
  systemPrompt: '你是文件助手',
  history: [],
  verbose: true,
});
```

**重构后：**
```javascript
import { Agent } from './Agent.js';

const agent = new Agent({
  name: '文件助手',
  role: '文件操作助手',
  verbose: true,
});

const result = await agent.runWithGuidance('统计文件', {
  guidance: {
    keyRequirements: ['获取文件列表', '准确计数'],
    suggestedTools: ['exec'],
    executionSteps: '使用 find 命令',
  },
  systemPrompt: '你是文件助手',
  history: [],
});
```

### 4. 新增特性

#### 4.1 自定义 Agent 子类

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
    // 添加自定义前置处理
    console.log('🔍 开始分析任务...');
    
    const result = await super.run(userMessage, options);
    
    // 添加自定义后置处理
    console.log('✅ 任务完成');
    
    return result;
  }

  // 可以重写任何私有方法
  _buildActPrompt(userMessage, systemPrompt, guidance, thinking) {
    // 自定义提示词构建逻辑
    const basePrompt = super._buildActPrompt(userMessage, systemPrompt, guidance, thinking);
    return `${basePrompt}\n\n特别注意：确保所有路径都是绝对路径。`;
  }
}

const agent = new FileAgent();
const result = await agent.run('列出当前目录文件');
```

#### 4.2 动态配置

```javascript
const agent = new Agent();

// 运行时动态修改配置
agent.setName('动态助手');
agent.setRole('可配置的助手');
agent.setVerbose(true);
agent.setMaxRounds(10);

const result = await agent.run('你好');
```

#### 4.3 多 Agent 协作

```javascript
// 研究员 Agent
const researcher = new Agent({
  name: '研究员',
  role: '信息收集和分析助手',
  verbose: true,
  maxRounds: 2,
});

// 作者 Agent
const writer = new Agent({
  name: '作者',
  role: '内容创作助手',
  verbose: true,
  maxRounds: 2,
});

// 协作流程
const researchResult = await researcher.run('什么是 JavaScript 闭包？');
const articleResult = await writer.run(
  `基于以下内容写一篇文章：\n\n${researchResult.result}`
);
```

### 5. 向后兼容

为了保持向后兼容性，保留了原有的函数接口：

```javascript
// 兼容函数：内部创建 Agent 实例
export async function runAgentWithThink(userMessage, options) {
  const agent = new Agent({ verbose: options.verbose });
  return agent.run(userMessage, options);
}

export async function runAgentWithGuidance(userMessage, options) {
  const agent = new Agent({ verbose: options.verbose });
  return agent.runWithGuidance(userMessage, options);
}
```

### 6. 代码结构

```
Agent.js
├── Agent 类
│   ├── constructor()           // 构造函数
│   ├── run()                  // 运行（无指引）
│   ├── runWithGuidance()      // 运行（带指引）
│   │
│   ├── 私有方法（内部逻辑）
│   │   ├── _prepareTools()           // 准备工具
│   │   ├── _think()                  // 思考阶段
│   │   │   ├── _thinkWithGuidance()  // 基于指引
│   │   │   └── _thinkFull()          // 完整思考
│   │   ├── _act()                    // 执行阶段
│   │   ├── _buildActPrompt()         // 构建提示词
│   │   └── _logActRound()            // 打印日志
│   │
│   └── 公共方法（配置）
│       ├── setName()        // 设置名称
│       ├── setRole()        // 设置角色
│       ├── setVerbose()     // 设置日志
│       └── setMaxRounds()   // 设置最大轮次
│
└── 兼容函数（向后兼容）
    ├── runAgentWithThink()
    └── runAgentWithGuidance()
```

### 7. 迁移指南

#### 从函数式迁移到面向对象

**步骤 1：导入**
```javascript
// 旧
import { runAgentWithThink } from './agent.js';

// 新
import { Agent } from './Agent.js';
```

**步骤 2：创建实例**
```javascript
const agent = new Agent({
  name: '助手',
  role: '智能助手',
  verbose: true,
});
```

**步骤 3：调用方法**
```javascript
// 旧
const result = await runAgentWithThink('你好', { verbose: true });

// 新
const result = await agent.run('你好');
```

#### 快速迁移（保持兼容）

如果不想立即修改现有代码，可以继续使用旧接口：

```javascript
import { runAgentWithThink, runAgentWithGuidance } from './Agent.js';

// 代码无需修改，直接可用
const result = await runAgentWithThink('你好', { verbose: true });
```

### 8. 性能优化

#### 对比表

| 维度 | 函数式（旧） | 面向对象（新） |
|------|-------------|---------------|
| 内存占用 | 较低（无实例） | 稍高（实例化） |
| 启动速度 | 快 | 稍慢（实例化） |
| 执行速度 | 相同 | 相同 |
| 可扩展性 | 差 | 好 |
| 可维护性 | 中 | 好 |
| 复用性 | 差 | 好 |

**建议：**
- 简单场景：可以使用兼容函数
- 复杂场景：使用 Agent 类
- 需要扩展：必须使用 Agent 类

### 9. 未来扩展方向

基于面向对象设计，未来可以轻松添加：

1. **生命周期钩子**
   ```javascript
   class Agent {
     async beforeRun(userMessage) { }
     async afterRun(result) { }
     async beforeThink() { }
     async afterThink(thinking) { }
     async beforeAct() { }
     async afterAct(actions) { }
   }
   ```

2. **中间件系统**
   ```javascript
   class Agent {
     use(middleware) {
       this.middlewares.push(middleware);
     }
   }
   ```

3. **事件系统**
   ```javascript
   const agent = new Agent();
   agent.on('error', (error) => { });
   agent.on('action', (action) => { });
   ```

4. **插件系统**
   ```javascript
   class PluginAgent extends Agent {
     loadPlugin(plugin) {
       plugin.install(this);
     }
   }
   ```

## 总结

面向对象重构带来了：
- ✅ 更清晰的代码结构
- ✅ 更强的可扩展性
- ✅ 更好的可复用性
- ✅ 向后兼容性
- ✅ 更易于维护

同时：
- 保持了原有的 Think-Act 模式
- 保持了与 Manager 的协作能力
- 提供了更灵活的配置方式

**推荐做法：**
- 新项目：直接使用 `Agent` 类
- 旧项目：先使用兼容函数，逐步迁移
- 需要扩展：使用 `Agent` 类并创建子类
