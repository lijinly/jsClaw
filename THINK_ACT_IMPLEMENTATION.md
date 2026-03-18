# Think-Act 模式实现总结

## 概述

在 jsClaw Agent 框架中新增了 **Think-Act 模式**，为 LLM Agent 提供两种工作模式。

## 两种工作模式对比

### Auto 模式（原有）
- **调用函数**：`runAgent(userMessage, options)`
- **流程**：用户输入 → LLM 直接决定 → 循环调用 Skill → 返回答案
- **特点**：快速、直接、自动决策
- **适用**：大多数常规任务

### Think-Act 模式（新增）
- **调用函数**：`runAgentWithThink(userMessage, options)`
- **流程**：
  1. **Think 阶段**：LLM 分析问题，规划需要的 Skill 和参数
  2. **Act 阶段**：根据规划逐步调用 Skill，获取数据
  3. **综合结果**：输出思考过程、执行步骤、最终答案
- **特点**：透明、可追踪、推理过程清晰
- **适用**：复杂问题、需要审计的场景、教学

## 实现细节

### 核心文件修改

**`src/agent.js`** - 新增 `runAgentWithThink()` 函数

```javascript
export async function runAgentWithThink(userMessage, { systemPrompt, history = [], verbose = false } = {})
```

**参数说明**：
- `userMessage` - 用户输入
- `systemPrompt` - 系统提示词
- `history` - 对话历史
- `verbose` - 是否打印中间步骤（调试用）

**返回值**：
```javascript
{
  thinking: string,      // Think 阶段 LLM 的分析和规划
  actions: Array,        // Act 阶段执行的每一步 Skill 和结果
  result: string         // 最终答案
}
```

### 新增文件

**`src/demo-think-act.js`** - Think-Act 模式演示脚本

运行方式：
```bash
npm run demo:think-act
```

### package.json 更新

新增 npm 脚本：
```json
"demo:think-act": "node src/demo-think-act.js"
```

### README 文档更新

1. 新增 **Agent 运行模式** 章节，详细说明两种模式
2. 项目结构中添加 `demo-think-act.js` 文件说明
3. 快速开始中新增 `npm run demo:think-act` 命令
4. 以编程方式调用中新增 Think-Act 模式的代码示例
5. 开发计划中标记 Think-Act 为已完成

## 使用示例

### 快速体验（命令行）
```bash
npm run demo:think-act
```

### 编程调用
```javascript
import { runAgentWithThink } from './src/agent.js';

const { thinking, actions, result } = await runAgentWithThink(
  '分析今天的销售数据',
  { verbose: true }
);

console.log('思考过程:', thinking);
console.log('执行步骤:', actions);
console.log('最终结果:', result);
```

## 工作原理

### Think 阶段
- 向 LLM 提交问题，**不提供任何 Tool**
- LLM 纯思考，分析问题，输出分析方案和执行计划
- 获取 `thinking` 输出

### Act 阶段
- 将 Think 阶段的思考结果作为上下文，重新提交给 LLM
- 这次 **提供完整的 Tool 定义列表**
- LLM 根据思考计划，一步步调用必要的 Skill
- 获取每一步的 `actions`

### 结果综合
- 整合思考过程、执行步骤、最终答案
- 返回完整的 `{ thinking, actions, result }` 对象

## 优势

✅ **透明化**：可以看到 LLM 的完整思考过程  
✅ **可控性**：可以审计每一步的 Skill 调用  
✅ **更准确**：先规划后执行，减少错误调用  
✅ **调试友好**：`verbose` 模式打印所有中间步骤  
✅ **可解释性**：输出包含推理过程，便于理解决策

## 兼容性

- ✅ 所有 LLM Provider（千问、OpenAI、DeepSeek 等）
- ✅ 所有已注册的 Skill
- ✅ 多轮对话支持
- ✅ 自定义 System Prompt

## 下一步

Think-Act 模式已完整实现。后续可考虑：
- Think-Act-Verify：三阶段模式，加入验证阶段
- 流式输出支持
- Skill 异步并行执行
