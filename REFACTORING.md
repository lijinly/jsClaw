# Manager + Worker Agent 重构说明 (方案 C)

## 📋 重构概述

**重构目标:** 优化 Manager 和 Worker Agent 的协作效率,减少重复判断,降低 token 消耗

**采用方案:** 方案 C - Manager 提供执行指引给 Worker Agent

## 🔄 重构前后对比

### 重构前

```
用户任务
  ↓
[Manager 判断] → 决策: 需要 agent
  ↓
[Worker Agent - Think 阶段] → 再次分析任务,规划工具
  ↓
[Worker Agent - Act 阶段] → 调用所有可用工具
  ↓
[Manager 评估] → 评估结果
```

**问题:**
- ❌ Manager 和 Worker Agent 重复判断任务类型
- ❌ Worker Agent 接收所有工具定义,浪费 token
- ❌ Manager 的判断结果未被充分利用

### 重构后

```
用户任务
  ↓
[Manager 判断] → 决策 + 执行指引(关键需求、建议工具、执行步骤)
  ↓
[Worker Agent - Act 阶段] → 根据指引,只使用建议的工具
  ↓
[Manager 评估] → 评估结果
```

**改进:**
- ✅ 消除重复判断
- ✅ 只传递相关工具,减少 token 消耗
- ✅ Manager 的判断结果被充分利用
- ✅ 保留 Worker Agent 的灵活性(基于指引执行)

## 📝 核心代码变更

### 1. Manager 增强功能 (`src/manager.js`)

#### 1.1 增强判断提示词

**修改前:**
```javascript
const judgeSystemPrompt = `...请按以下格式返回判断结果：
<decision>
需要 agent 参与：是/否
理由：[你的理由]
关键需求：[如果需要 agent，列出关键需求点]
</decision>`;
```

**修改后:**
```javascript
const judgeSystemPrompt = `...从以下可选工具中选择最相关的工具：
${getToolDefinitions().map(t => `- ${t.function.name}: ${t.function.description}`).join('\n')}

请按以下格式返回判断结果：
<decision>
需要 agent 参与：是/否
理由：[你的理由]
关键需求：[如果需要 agent，列出关键需求点，用分号分隔]
建议工具：[从上述工具列表中选择最相关的工具名称，用逗号分隔，例如：read,write,exec]
执行步骤：[简要列出1-3个执行步骤]
</decision>`;
```

#### 1.2 解析执行指引

```javascript
// 解析判断结果
const needsAgent = decisionText.includes('需要 agent 参与：是');

// 解析执行指引（仅当需要 agent 时）
let guidance = null;
if (needsAgent) {
  const keyRequirementsMatch = decisionText.match(/关键需求：([^\n]+)/);
  const suggestedToolsMatch = decisionText.match(/建议工具：([^\n]+)/);
  const executionStepsMatch = decisionText.match(/执行步骤：([^\n<]+)/);

  guidance = {
    keyRequirements: keyRequirementsMatch
      ? keyRequirementsMatch[1].split(';').map(s => s.trim()).filter(s => s)
      : [],
    suggestedTools: suggestedToolsMatch
      ? suggestedToolsMatch[1].split(',').map(s => s.trim()).filter(s => s)
      : [],
    executionSteps: executionStepsMatch
      ? executionStepsMatch[1].trim()
      : '',
  };
}
```

#### 1.3 传递指引给 Worker Agent

**修改前:**
```javascript
agentResult = await runAgentWithThink(task, {
  ...agentOptions,
  history,
  verbose,
});
```

**修改后:**
```javascript
agentResult = await runAgentWithGuidance(task, {
  guidance,  // 传递执行指引
  ...agentOptions,
  history,
  verbose,
});
```

### 2. Worker Agent 新增接口 (`src/agent.js`)

#### 2.1 新增 `runAgentWithGuidance()` 函数

```javascript
export async function runAgentWithGuidance(userMessage, {
  guidance = null,
  systemPrompt,
  history = [],
  verbose = false
} = {}) {
  // 根据建议工具筛选工具定义
  let tools = getToolDefinitions();
  if (guidance?.suggestedTools?.length > 0) {
    // 只保留建议的工具
    tools = tools.filter(t => guidance.suggestedTools.includes(t.function.name));
    if (verbose) {
      console.log(`\n🎯 [Guidance] 已筛选工具：${tools.map(t => t.function.name).join(', ')}`);
    }
  }

  // ──────────────────────────────────────────
  // 第一步：Think —— 让 LLM 分析问题（可选，基于指引）
  // ──────────────────────────────────────────
  let thinking = '';

  if (guidance) {
    // 有指引时，直接使用指引的执行步骤作为思考过程
    thinking = `<guidance>
关键需求：${guidance.keyRequirements.join('; ')}
建议工具：${guidance.suggestedTools.join(', ')}
执行步骤：${guidance.executionSteps}
</guidance>`;

    if (verbose) {
      console.log('\n💭 [Think 阶段 - 基于指引]\n', thinking);
    }
  } else {
    // 无指引时，执行完整的思考流程（保留向后兼容）
    // ...
  }

  // ──────────────────────────────────────────
  // 第二步：Act —— 根据思考/指引调用 Skill
  // ──────────────────────────────────────────
  const actSystemPrompt = `${systemPrompt || '你是一个智能助手。'}

用户问题：${userMessage}

${guidance ? `执行指引：
${thinking}

请根据上述指引，直接调用必要的工具来完成任务。` : `你之前的思考过程：
${thinking}

现在，根据你的思考计划，调用必要的工具来获取数据或执行操作。`}`;

  // ... Act 循环
}
```

#### 2.2 保持向后兼容

```javascript
/**
 * Think-Act 模式（保留原有接口以兼容）
 * @deprecated 建议使用 runAgentWithGuidance
 */
export async function runAgentWithThink(userMessage, { systemPrompt, history = [], verbose = false } = {}) {
  return runAgentWithGuidance(userMessage, {
    guidance: null,
    systemPrompt,
    history,
    verbose,
  });
}
```

## 📊 性能改进

### Token 消耗对比

假设有 10 个已注册工具,每个工具定义约 100 tokens:

| 场景 | 重构前 | 重构后 | 节省 |
|------|--------|--------|------|
| 简单任务 (无需 agent) | ~200 tokens | ~200 tokens | 0 |
| 复杂任务 (需要 agent, 建议 2 个工具) | ~2000 tokens | ~600 tokens | ~70% |

### 调用次数对比

| 场景 | 重构前 | 重构后 | 节省 |
|------|--------|--------|------|
| LLM 调用次数 | 3-4 次 | 2-3 次 | ~25% |

## 🎯 测试结果

### 示例 1: 简单任务

```
任务: 什么是 JavaScript？
结果: ✅ 直接回答,无需 agent
```

### 示例 2: 复杂任务

```
任务: 读取当前目录下的所有文件，并统计文件数量
判断结果:
  - 需要 agent: 是
  - 关键需求: 获取当前工作目录的实时文件列表;准确排除子目录;可靠计数
  - 建议工具: exec  ← 只选了这一个工具!
  - 执行步骤: 使用 find 命令统计文件数量

工具筛选: 🎯 [Guidance] 已筛选工具: exec
执行结果: ✅ 返回准确结果 (7 个文件)
评估评分: 5/5
```

### 示例 3: 带上下文任务

```
任务: 检查 test.txt 文件是否存在
判断结果:
  - 需要 agent: 是
  - 关键需求: 检查指定路径下 test.txt 是否存在
  - 建议工具: file_exists
  - 执行步骤: 调用 file_exists 工具检查文件是否存在

工具筛选: 🎯 [Guidance] 已筛选工具: file_exists
执行结果: ✅ 文件 test.txt 存在
评估评分: 4/5
```

## 📦 相关文件

- `src/manager.js` - Manager 核心实现 (已更新)
- `src/agent.js` - Worker Agent 实现 (已更新)
- `src/demo-manager.js` - 演示示例 (已更新)
- `c:/Users/lijin/WorkBuddy/20260317164838/.workbuddy/memory/agent-llm-skill-flow.md` - 详细分析文档

## 🚀 使用方法

### 基础用法 (无需改动)

```javascript
import { initLLM } from './llm.js';
import { runManager } from './manager.js';

initLLM();

const result = await runManager('任务内容', {
  verbose: true,
});

console.log(result.finalResult);
```

### 获取执行指引

```javascript
const result = await runManager('复杂任务', {
  verbose: true,
});

// 查看执行指引
console.log('关键需求:', result.guidance.keyRequirements);
console.log('建议工具:', result.guidance.suggestedTools);
console.log('执行步骤:', result.guidance.executionSteps);
```

### 直接使用 Worker Agent (向后兼容)

```javascript
import { runAgentWithThink } from './agent.js';

// 旧代码仍然可用
const result = await runAgentWithThink('任务内容', {
  verbose: true,
});
```

## 💡 设计亮点

1. **向后兼容**: 保留 `runAgentWithThink()` 接口,现有代码无需改动
2. **智能筛选**: 只传递相关工具,减少 token 消耗
3. **灵活执行**: Worker Agent 仍可根据指引灵活调整执行策略
4. **协作紧密**: Manager 的判断结果被充分利用,避免重复工作
5. **可追溯**: 完整保留执行指引和评估结果,便于调试和优化

## 🔮 未来优化方向

1. **工具建议优化**: 可以基于历史任务统计,自动优化工具选择
2. **执行步骤细化**: 可以增加更详细的执行步骤和参数建议
3. **结果缓存**: 对相同任务可以缓存执行指引,进一步优化性能
4. **学习机制**: Worker Agent 可以反馈执行效果,帮助 Manager 优化判断
