# ContextManager —— 上下文自动清理机制

> 自动管理对话历史，控制 token 消耗，避免超出 LLM 上下文限制

## 问题背景

```
┌─────────────────────────────────────────────────────────────────┐
│                    Token 消耗增长示意                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Token 数量                                                     │
│       │                                                         │
│       │                    ╭───────────╮                        │
│       │                ╭──╯           ╰──╮                      │
│       │            ╭──╯                   ╰──╮                  │
│       │        ╭──╯                         ╰──╮                │
│       │    ╭──╯                               ╰──╮            │
│       │╭──╯                                       ╰──╮         │
│       ╰─────────────────────────────────────────────────→       │
│       0    5    10   15   20   25   30   35   40   轮次        │
│                                                                 │
│       ═══════════════                                        │
│       ContextManager 干预点                                    │
│                        ════════════════════════                 │
│                        裁剪旧消息，保留关键信息                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 核心策略

| 策略 | 说明 |
|------|------|
| **保留系统提示** | 系统提示不参与裁剪 |
| **保留最近对话** | 最近 N 轮完整保留 |
| **旧消息压缩** | 超出阈值的消息压缩为摘要 |
| **自动触发** | Token 超过阈值时自动裁剪 |

## ContextManager 类

### 构造函数

```javascript
import { ContextManager } from './ContextManager.js';

const cm = new ContextManager({
  maxTokens: 6000,           // 最大保留 token 数（估算）
  preserveRecent: 4,          // 保留最近 N 轮完整对话
  summaryModel: 'qwen-plus', // LLM 摘要模型
  tokenPerMessage: 4,         // 每条消息的基础 token 开销
  tokenPerChar: 0.25,        // 字符到 token 的估算比率
  autoPrune: true,            // 是否自动裁剪
});
```

### 核心方法

#### `estimateTokens(messages)`

估算消息数组的 token 数

```javascript
const messages = [
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好，有什么可以帮你的？' },
  // ...
];

const tokens = cm.estimateTokens(messages);
console.log(`估算: ${tokens} tokens`);
```

#### `needsPrune(messages)`

判断是否需要裁剪

```javascript
if (cm.needsPrune(messages)) {
  console.log('需要裁剪');
}
```

#### `prune(messages)` —— 同步版本

自动裁剪消息数组（同步版本，优先使用简单裁剪）

```javascript
const pruned = cm.prune(messages);
// 返回裁剪后的消息数组
```

#### `pruneAsync(messages)` —— 异步版本

使用 LLM 生成摘要并重组消息

```javascript
const pruned = await cm.pruneAsync(messages);
// 异步调用 LLM 生成摘要
```

### 统计方法

```javascript
// 获取统计信息
const stats = cm.getStats();
console.log(stats);
// {
//   totalPrunes: 5,        // 总裁剪次数
//   totalSummaries: 2,     // LLM 摘要次数
//   savedTokens: 3500,     // 节省的 tokens
//   config: {
//     maxTokens: 6000,
//     preserveRecent: 4,
//   }
// }

// 重置统计
cm.resetStats();

// 打印状态
cm.logStatus(messages);
```

## 裁剪流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     裁剪决策流程                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   输入 messages[]                                               │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────┐                                            │
│  │ autoPrune 开启？ │ ──否──→ 直接返回原消息                     │
│  └────────┬────────┘                                            │
│           │是                                                    │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │ messages < 6 条？│ ──是──→ 直接返回原消息                     │
│  └────────┬────────┘                                            │
│           │否                                                    │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │ needsPrune？    │ ──否──→ 直接返回原消息                     │
│  └────────┬────────┘                                            │
│           │是                                                    │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │ 分离消息类型     │                                            │
│  │ system / other  │                                            │
│  └────────┬────────┘                                            │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │ 保留最近 N 轮    │                                            │
│  │ + 简单裁剪/摘要  │                                            │
│  └────────┬────────┘                                            │
│           ▼                                                     │
│      输出裁剪后消息                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 裁剪策略详解

### 简单裁剪

适用于消息结构简单、无需 LLM 摘要的场景：

```javascript
// 输入: [sys1, user1, asst1, user2, asst2, user3, asst3, user4, asst4, ...]
// 保留: [sys1, user3, asst3, user4, asst4]  // 最近 2 轮

// 被裁剪的消息: user1, asst1, user2, asst2
```

### LLM 摘要

适用于消息内容丰富、需要保留上下文的场景：

```javascript
// 摘要提示词
`你是一个对话摘要专家。请将以下对话历史压缩成一个简洁的摘要。

要求：
1. 保留关键信息（用户意图、已完成的任务、重要决策）
2. 移除重复内容和中间过程
3. 格式：保持为一段连贯的摘要文字
4. 长度：尽量控制在200字以内

对话历史：
${oldMessages}

摘要格式：
[摘要] <你的摘要内容> [/摘要]`

// 输出: [sys1, [历史摘要], user3, asst3, user4, asst4]
```

## Token 估算

### 估算公式

```
totalTokens = Σ(baseCost + contentCost + toolCost)

其中：
- baseCost = tokenPerMessage (默认 4) × 消息数
- contentCost = content.length × tokenPerChar (默认 0.25)
- toolCost = tool_calls.length × 50 (每个 tool_call 约 50 tokens)
- tool 角色额外开销 = 20
```

### 验证示例

```javascript
// 1000 字的内容 ≈ 250 tokens
// 50 条消息 ≈ 200 tokens (基础开销)
// 5 个 tool_calls ≈ 250 tokens

// 总计 ≈ 700 tokens
```

## 与 Session 集成

```javascript
import { Session } from './Session.js';
import { WorkSpace } from './WorkSpace.js';

const workspace = new WorkSpace({ id: 'default' });
await workspace.initialize();

const session = new Session({
  sessionId: 'user-123',
  memberId: 'default',
  workspace,
  contextManager: {
    maxTokens: 6000,      // 最大 token 数
    preserveRecent: 4,    // 保留最近 4 轮
    autoPrune: true,      // 自动裁剪
  },
});

// Session.userMessage() 自动使用 ContextManager
const result = await session.userMessage('长对话任务', {
  verbose: true,
});
```

## 配置建议

| 场景 | maxTokens | preserveRecent | 策略 |
|------|-----------|----------------|------|
| 短对话 | 3000 | 2 | 简单裁剪 |
| 标准对话 | 6000 | 4 | 简单裁剪 |
| 长对话 | 10000 | 6 | LLM 摘要 |
| 超长对话 | 20000 | 8 | LLM 摘要 |

## 注意事项

1. **Token 估算是近似的**：实际 token 数可能因模型而异
2. **系统提示不算裁剪**：系统提示太长会影响效果
3. **摘要有成本**：LLM 摘要需要额外 API 调用
4. **历史太长会稀释**：建议定期开启新会话

## 测试

```bash
node tests/TestContextManager.js
node tests/TestContextIntegration.js
node tests/TestContextLarge.js
```
