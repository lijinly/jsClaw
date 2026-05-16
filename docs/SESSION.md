# Session —— 会话上下文管理器

> 用户与系统的会话抽象，关联 Member，管理对话历史 + 上下文裁剪

## 架构定位

```
┌─────────────────────────────────────────────────────────────────┐
│                        WorkSpace                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Session                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │   │
│  │  │ chatHistory │  │internalHist.│  │ ContextManager  │ │   │
│  │  │ 用户↔Member │  │Member↔Mgr   │  │ (上下文裁剪)    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │   │
│  │         │                                    ↓          │   │
│  │         │                              ┌─────────────┐  │   │
│  │         └──────────→ Member ←──────────│ 裁剪历史    │  │   │
│  │                              │         └─────────────┘  │   │
│  └──────────────────────────────┼──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Session 类

### 构造函数

```javascript
import { Session } from './Session.js';

const session = new Session({
  sessionId: 'user-123-sess-456',
  memberId: 'coder',           // 关联的 Member
  workspace,                    // WorkSpace 实例
  contextManager: {             // 可选
    maxTokens: 6000,
    preserveRecent: 4,
  },
});
```

### 核心方法

#### `userMessage(content, options)`

处理用户消息

```javascript
const result = await session.userMessage('帮我写一个排序算法', {
  verbose: false,
});

// 返回值
{
  result: '...',       // 执行结果
  thinking: '...',     // 思考过程
  actions: [...],      // 执行的操作
  internalLogs: [...], // 内部日志
}
```

#### `switchMember(memberId)`

切换关联的 Member

```javascript
session.switchMember('writer');  // 切换到 writer Member
```

#### `pruneHistory()`

手动触发上下文裁剪

```javascript
const pruned = session.pruneHistory();
```

#### `getContextStats()`

获取上下文统计

```javascript
const stats = session.getContextStats();
console.log(stats);
// {
//   totalPrunes: 5,
//   messageCount: 20,
//   chatHistoryCount: 10,
//   ...
// }
```

### 元数据管理

```javascript
session.setTitle('新标题');      // 设置会话标题
session.setMode('team');         // 设置模式: 'member' | 'team'
session.getSummary();             // 获取摘要
session.getDetail();              // 获取完整信息
```

## 与 Server 集成

```javascript
import { Server } from './Server.js';
import { Session } from './Session.js';

// Server 自动管理 Session 生命周期
// POST /api/sessions      - 创建 Session
// GET  /api/sessions      - 列表
// GET  /api/sessions/:id  - 详情
// DELETE /api/sessions/:id - 删除
// PATCH /api/sessions/:id - 更新

// POST /api/chat          - 对话（SSE）
const { sessionId } = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    message: '你好',
    sessionId: 'existing-session',  // 可选
    memberId: 'coder',              // 可选
  }),
});
```

## ContextManager 集成

Session 内置 ContextManager，自动管理上下文裁剪：

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `maxTokens` | 6000 | 最大保留 token 数 |
| `preserveRecent` | 4 | 保留最近 N 轮完整对话 |
| `autoPrune` | true | 是否自动裁剪 |

详见 [CONTEXT_MANAGER.md](./CONTEXT_MANAGER.md)

## 状态流转

```
Session 生命周期:
┌─────────┐   userMessage()   ┌──────────┐
│  空闲   │ ───────────────→ │ 处理中   │
└─────────┘                   └────┬─────┘
     ↑                              │
     │ ←─── 返回结果 ───────────────┘
     │
     └── switchMember() / 重置
```
