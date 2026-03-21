# Manager —— 任务编排 Agent

## 👔 什么是 Manager？

Manager 是一个智能任务编排 Agent，位于用户和 Worker Agent 之间，负责：

1. **接收任务**：接受用户提交的任务
2. **智能判断**：分析任务类型，决定执行策略
3. **任务分发**：
   - 简单任务 → 直接回答
   - 复杂任务 → 分发到 Worker Agent
4. **结果评估**：评估 Worker Agent 的执行结果质量
5. **返回结果**：整合并返回最终答案

## 🎯 工作流程

```
用户任务
   ↓
[Manager 判断阶段]
   ├─ 简单任务 → [直接回答] → 最终结果
   └─ 复杂任务 → [Worker Agent] → [结果评估] → 最终结果
```

## 📝 使用示例

### 基础用法

```javascript
import { initLLM } from './llm.js';
import { runManager } from './manager.js';

// 初始化 LLM
initLLM();

// 调用 Manager
const result = await runManager('帮我读取当前目录下的文件', {
  verbose: true,  // 打印中间过程
});

console.log(result.finalResult);
```

### 返回结果结构

```javascript
{
  decision: '需要 agent 参与：是\n理由：...\n关键需求：...',  // 判断决策
  needsAgent: true,                                             // 是否使用了 agent
  agentResult: {                                                // Worker agent 的完整结果（含思考过程）
    thinking: '...',
    actions: [...],
    result: '...'
  },
  directAnswer: null,                                          // 直接回答的内容
  evaluation: '评分：5\n完整性：...\n准确性：...',              // 结果评估
  finalResult: '...'                                           // 最终答案
}
```

## 🚀 运行演示

```bash
# 运行 Manager 演示
npm run demo:manager
```

演示包含三个示例：
1. 简单任务（知识问答）—— 直接回答
2. 复杂任务（读取文件）—— 调用 Worker Agent
3. 带上下文的任务—— 支持对话历史

## 🛠️ 高级用法

### 自定义系统提示词

```javascript
const result = await runManager('...', {
  systemPrompt: '你是一个专业的技术顾问。',
});
```

### 传递对话历史

```javascript
const history = [
  { role: 'user', content: '帮我创建一个文件' },
  { role: 'assistant', content: '已经创建完成' },
];

const result = await runManager('检查文件是否存在', { history });
```

### 配置 Worker Agent

```javascript
const result = await runManager('...', {
  agentOptions: {
    systemPrompt: '你是一个文件操作专家。',
    verbose: false,
  },
});
```

## 📋 设计理念

Manager 的核心设计思想是**智能分流**：

- **简单任务**：直接调用 LLM 快速回答，节省资源
- **复杂任务**：交给 Worker Agent 使用工具执行，保证能力

这样可以：
- ✅ 提高响应速度（简单任务不浪费 agent 资源）
- ✅ 降低成本（减少不必要的工具调用）
- ✅ 提升质量（复杂任务由专业 agent 处理）

## 📦 相关文件

- `src/manager.js` — Manager 核心实现
- `src/agent.js` — Worker Agent（Think-Act 模式）
- `src/demo-manager.js` — 演示示例
