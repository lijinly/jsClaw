// ─────────────────────────────────────────────
//  Agent —— 将 LLM 与 Skill 串联起来
// ─────────────────────────────────────────────
import { chat } from './llm.js';
import { getToolDefinitions, executeToolCalls } from './skillRegistry.js';

/**
 * 标准 Agent 模式（Auto 模式）
 * 自动处理 tool_calls 循环，直到 LLM 给出最终文本回复
 */
export async function runAgent(userMessage, { systemPrompt, history = [] } = {}) {
  const messages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...history,
    { role: 'user', content: userMessage },
  ];

  const tools = getToolDefinitions();

  // ── Agentic 循环 ──
  for (let round = 0; round < 10; round++) {
    const response = await chat(messages, { tools });

    messages.push(response); // 追加 assistant 消息

    // LLM 决定调用工具
    if (response.tool_calls?.length) {
      const toolResults = await executeToolCalls(response.tool_calls);
      messages.push(...toolResults);
      continue; // 把工具结果喂回 LLM
    }

    // LLM 给出最终回复
    return response.content;
  }

  return '（Agent 超过最大轮次）';
}

/**
 * Think-Act 模式
 * 第一步：让 LLM 思考方案（包含reasoning过程）
 * 第二步：根据思考结果调用相应的 Skill
 * 第三步：综合思考和执行结果给出最终答案
 *
 * @param {string} userMessage - 用户输入
 * @param {object} options
 * @param {string}   [options.systemPrompt]   - 系统提示词
 * @param {Array}    [options.history]        - 对话历史
 * @param {boolean}  [options.verbose]        - 是否打印中间思考过程
 * @returns {object} { thinking, actions, result }
 */
export async function runAgentWithThink(userMessage, { systemPrompt, history = [], verbose = false } = {}) {
  const tools = getToolDefinitions();

  // ──────────────────────────────────────────
  // 第一步：Think —— 让 LLM 分析问题
  // ──────────────────────────────────────────
  const thinkSystemPrompt = `${systemPrompt || '你是一个智能助手。'}

请按以下步骤思考：
1. 理解用户的问题
2. 分析需要调用哪些工具来解决这个问题
3. 规划调用工具的顺序和参数
4. 预测可能的结果

请在 <thinking> 标签中详细说出你的思考过程，然后在 <plan> 标签中给出具体的执行计划。`;

  const thinkMessages = [
    { role: 'system', content: thinkSystemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const thinkResponse = await chat(thinkMessages, { tools: [] }); // 纯思考，不调用 tools
  const thinking = thinkResponse.content;

  if (verbose) {
    console.log('\n💭 [Think 阶段]\n', thinking);
  }

  // ──────────────────────────────────────────
  // 第二步：Act —— 根据思考调用 Skill
  // ──────────────────────────────────────────
  const actSystemPrompt = `${systemPrompt || '你是一个智能助手。'}

用户问题：${userMessage}

你之前的思考过程：
${thinking}

现在，根据你的思考计划，调用必要的工具来获取数据或执行操作。`;

  const actMessages = [
    { role: 'system', content: actSystemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const actions = [];
  let actResponse = await chat(actMessages, { tools });
  actMessages.push(actResponse);

  // ── Act 循环 ──
  for (let round = 0; round < 5; round++) {
    if (actResponse.tool_calls?.length) {
      const toolResults = await executeToolCalls(actResponse.tool_calls);

      actions.push({
        calls: actResponse.tool_calls,
        results: toolResults,
      });

      if (verbose) {
        console.log(`\n⚙️  [Act 阶段 - 第 ${round + 1} 步]`);
        actResponse.tool_calls.forEach(call => {
          console.log(`  • 调用 ${call.function.name}(${call.function.arguments})`);
        });
      }

      actMessages.push(...toolResults);
      actResponse = await chat(actMessages, { tools });
      actMessages.push(actResponse);
    } else {
      // 获得最终回复
      break;
    }
  }

  const result = actResponse.content;

  return {
    thinking,      // 思考过程
    actions,       // 执行的 Skills 和结果
    result,        // 最终答案
  };
}
