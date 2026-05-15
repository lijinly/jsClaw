# Agent —— Think-Act 模式

> 智能 Agent 的核心实现，基于"先思考后执行"的双阶段模式

## 核心概念

```
┌─────────────────────────────────────────────────────────────┐
│                    Think-Act 执行流程                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   用户输入 ──→ Think 阶段 ──→ Act 阶段 ──→ 返回结果        │
│                     │               │                       │
│                     ↓               ↓                       │
│              分析问题            调用工具                    │
│              规划方案            执行操作                    │
│              预测结果            获取反馈                    │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Think 阶段                                          │  │
│   │  • 理解用户问题                                      │  │
│   │  • 分析需要调用的工具                                │  │
│   │  • 规划工具调用顺序和参数                            │  │
│   │  • 预测可能的结果                                    │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Act 阶段                                            │  │
│   │  • 根据 Think 计划调用工具                           │  │
│   │  • 获取工具执行结果                                  │  │
│   │  • 如需更多操作，继续调用                            │  │
│   │  • 最终返回自然语言结果                              │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Agent 类

### 构造函数

```javascript
import { Agent } from './Agent.js';

const agent = new Agent({
  name: '助手',              // Agent 名称
  role: '智能助手',          // 角色描述
  verbose: true,             // 是否打印详细日志
  maxRounds: 5,             // Act 阶段最大轮次
  contextManager: {          // 上下文管理器配置
    maxTokens: 6000,
    preserveRecent: 4,
  },
  goalTracker: {             // 目标追踪器配置
    autoSave: true,
  },
});
```

### 核心方法

#### `run(userMessage, options)`

无 guidance 模式运行

```javascript
const result = await agent.run('帮我搜索最新新闻', {
  systemPrompt: '你是专业的新闻助手',  // 自定义系统提示
  history: [],                         // 对话历史
  autoPrune: true,                     // 自动清理上下文
  injectGoal: true,                    // 注入目标上下文
  goalId: 'goal-123',                 // 指定目标ID
});

// 返回
{
  thinking: '思考过程...',             // Think 阶段输出
  actions: [                           // Act 阶段工具调用
    {
      calls: [{ function: { name: 'web_search', arguments: '...' } }],
      results: [{ role: 'tool', content: '...' }],
    }
  ],
  result: '最终回答...',               // 最终结果
  contextStats: {                      // 上下文统计
    totalPrunes: 0,
    savedTokens: 0,
  },
  goal: {                             // 目标信息
    id: 'goal-123',
    description: '...',
    progress: 50,
  },
}
```

#### `runWithGuidance(userMessage, options)`

带 guidance 模式运行（内部使用）

```javascript
const result = await agent.runWithGuidance('分析代码', {
  guidance: {
    keyRequirements: '识别代码中的bug',
    suggestedTools: ['read', 'exec'],
    executionSteps: '1. 读取代码 2. 执行测试',
  },
  history: [],
  verbose: true,
  systemPrompt: '你是代码审查助手',
});
```

### 目标管理（GoalTracker 集成）

Agent 内置 GoalTracker，支持目标追踪：

```javascript
// 创建目标
agent.createGoal('完成市场分析报告', { priority: 3 });

// 设置活跃目标
agent.setActiveGoal('goal-123');

// 添加检查点
agent.addGoalCheckpoint('收集数据');
agent.addGoalCheckpoint('数据分析');

// 更新进度
agent.updateGoalProgress(50);

// 记录成就/阻碍
agent.addGoalAchievement('数据收集完成');
agent.addGoalBlocker('数据源不可用');

// 完成目标
agent.completeCurrentGoal();

// 获取目标上下文（自动注入到 system prompt）
const context = agent.getGoalContext();
```

### 上下文管理

```javascript
// 获取上下文统计
const stats = agent.getContextStats();
// { totalPrunes: 0, totalSummaries: 0, savedTokens: 0, config: {...} }

// 手动触发裁剪
const pruned = await agent.pruneContext(messages);

// 估算 token
const tokens = agent.estimateContextTokens(messages);
```

### Setter 方法

```javascript
agent.setName('新名称');
agent.setRole('新角色');
agent.setVerbose(true);
agent.setMaxRounds(10);
```

## 继承扩展

Agent 支持继承和重写，便于扩展：

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

  // 自定义方法
  async analyzeFile(filePath) {
    // ...
  }
}
```

## 状态机

```
           ┌─────────────────────────────────────────┐
           │           Agent 运行状态                 │
           └─────────────────────────────────────────┘

  用户输入
      │
      ▼
  ┌─────────────────┐
  │  Think 阶段     │ ──→ 分析、规划
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Act 阶段       │ ──→ 循环调用工具
  │  (maxRounds)    │
  └────────┬────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
  ┌─────┐   ┌────────┐
  │循环 │   │ 完成   │
  │继续 │   │ 返回   │
  └─────┘   └────────┘
```

## 与 Member 的关系

```
Agent（基类）
    │
    ├── 独立使用：直接创建 Agent 实例
    │
    └── Member（继承）
            │
            ├── 继承 Agent 的 Think-Act 能力
            ├── 增加 identity/soul 人格配置
            ├── 增加 skill 技能管理
            └── 由 WorkSpace 管理和调度
```

## 事件流

```javascript
agent.on('thinking', (thinking) => {
  console.log('思考中:', thinking);
});

agent.on('tool_call', (tool) => {
  console.log('调用工具:', tool);
});

agent.on('complete', (result) => {
  console.log('完成:', result);
});
```

## 最佳实践

1. **设置合适的 maxRounds**：根据任务复杂度调整，通常 3-5 轮足够
2. **开启 verbose**：开发调试时查看详细日志
3. **配置 contextManager**：长对话场景下避免 token 溢出
4. **使用 GoalTracker**：复杂任务分解为子目标
5. **继承扩展**：针对特定场景创建子类

## 测试

```bash
node tests/TestAgent.js
```
