# ContextManager —— 上下文自动清理机制

## 概述

ContextManager 是 jsClaw 的核心组件，负责自动管理对话历史，控制 token 消耗，避免超出 LLM 上下文限制。

## 核心策略

```
┌─────────────────────────────────────────────────────┐
│                    输入消息历史                       │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  1. 保留系统提示（不裁剪）                            │
│  2. 保留最近N轮完整对话（preserveRecent）             │
│  3. 旧消息 → LLM摘要 或 简单裁剪                     │
│  4. 超过阈值自动触发（maxTokens）                    │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                    输出精简上下文                      │
└─────────────────────────────────────────────────────┘
```

## 快速开始

### 方式1：独立使用 ContextManager

```javascript
import { ContextManager } from './src/ContextManager.js';

const cm = new ContextManager({
  maxTokens: 6000,       // 最大 token 数
  preserveRecent: 4,      // 保留最近N轮完整对话
});

// 估算 token
const tokens = cm.estimateTokens(messages);

// 自动裁剪（同步，简单裁剪）
const pruned = cm.prune(messages);

// 异步裁剪（LLM摘要，更智能）
const prunedWithSummary = await cm.pruneAsync(messages);

// 查看统计
console.log(cm.getStats());
// { totalPrunes: 1, totalSummaries: 0, savedTokens: 2699 }
```

### 方式2：集成到 Agent（推荐）

```javascript
import { Agent } from './src/agent.js';

const agent = new Agent({
  name: '我的助手',
  role: '智能助手',
  verbose: true,
  contextManager: {
    maxTokens: 6000,
    preserveRecent: 4,
  },
});

// Agent.run() 自动管理上下文
const result = await agent.run('用户消息', {
  history: longHistory,  // 很长的话题历史
});

// 查看上下文管理统计
console.log(result.contextStats);
```

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `maxTokens` | 6000 | 最大保留 token 数（估算值） |
| `preserveRecent` | 4 | 保留最近N轮完整对话 |
| `tokenPerMessage` | 4 | 每条消息的基础 token 开销 |
| `tokenPerChar` | 0.25 | 字符到 token 的估算比率 |
| `autoPrune` | true | 是否自动裁剪 |
| `summaryModel` | qwen-plus | LLM摘要使用的模型 |

## 裁剪策略

### 同步裁剪（prune）
- 保留系统消息
- 保留最近 `preserveRecent * 2` 条对话（user + assistant）
- 丢弃旧消息（不生成摘要）
- 适用于：不需要 LLM 摘要的场景，快速裁剪

### 异步裁剪（pruneAsync）
- 保留系统消息
- 保留最近 `preserveRecent * 2` 条对话
- 旧消息 → LLM 生成摘要
- 摘要格式：`[历史摘要 - 日期] <摘要内容>`
- 适用于：需要保留历史关键信息的场景

## 使用场景

### 场景1：长对话分析任务

```javascript
// 量化分析场景，对话历史很长
const result = await agent.run('生成今日市场报告', {
  history: veryLongHistory,  // 可能包含几百条消息
});
// Agent 自动裁剪历史，只保留最近对话 + 系统提示
```

### 场景2：手动控制

```javascript
// 检查是否需要裁剪
if (cm.needsPrune(history)) {
  const pruned = cm.prune(history);
  // 继续使用 pruned 消息
}

// 查看 token 消耗
const tokens = cm.estimateTokens(history);
console.log(`当前消耗: ${tokens} tokens`);
```

### 场景3：自定义阈值

```javascript
// 针对不同模型调整阈值
const cmGpt4 = new ContextManager({ maxTokens: 3000 });  // GPT-4 较贵
const cmQwen = new ContextManager({ maxTokens: 8000 });  // 千问支持更多
```

## 统计信息

```javascript
const stats = cm.getStats();
// {
//   totalPrunes: 5,      // 裁剪次数
//   totalSummaries: 2,   // LLM摘要次数
//   savedTokens: 12500,  // 共节省的 token
//   config: { ... }
// }

// 重置统计
cm.resetStats();
```

## 集成到 Team 系统

```javascript
// 在 Team 成员间共享 ContextManager
const teamContext = new ContextManager({ maxTokens: 10000 });

// 每个成员处理完后，统一管理上下文
for (const member of team.members) {
  const result = await member.execute(task);
  teamContext.prune(member.history);
}
```

## 注意事项

1. **Token 估算是近似值**：实际 token 消耗可能略有差异，建议设置 `maxTokens` 时留 10-20% 余量

2. **系统提示过长警告**：当系统提示超过 `maxTokens * 0.3` 时会发出警告，建议优化系统提示

3. **LLM 摘要依赖**：调用 `pruneAsync` 需要有效的 LLM 配置

4. **消息结构要求**：消息必须符合 `{ role, content }` 结构

## 扩展：自定义摘要策略

```javascript
// 继承 ContextManager 实现自定义摘要
class CustomContextManager extends ContextManager {
  async _customSummarize(oldMessages) {
    // 自定义摘要逻辑
    const summary = await myLLMSummarize(oldMessages);
    return summary;
  }
}
```
