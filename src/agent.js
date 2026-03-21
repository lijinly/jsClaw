// ─────────────────────────────────────────────
//  Agent —— Think-Act 模式
// ─────────────────────────────────────────────
import { chat } from './llm.js';
import { getToolDefinitions, executeToolCalls } from './skillRegistry.js';

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

/**
 * Think-Act 模式（带执行指引）
 * 接收来自 Manager 的执行指引，优化执行效率
 *
 * @param {string} userMessage - 用户输入
 * @param {object} options
 * @param {object}   [options.guidance]       - 执行指引 { keyRequirements, suggestedTools, executionSteps }
 * @param {string}   [options.systemPrompt]   - 系统提示词
 * @param {Array}    [options.history]        - 对话历史
 * @param {boolean}  [options.verbose]        - 是否打印中间思考过程
 * @returns {object} { thinking, actions, result }
 */
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
    // 无指引时，执行完整的思考流程
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
    thinking = thinkResponse.content;

    if (verbose) {
      console.log('\n💭 [Think 阶段]\n', thinking);
    }
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
    thinking,      // 思考过程或指引
    actions,       // 执行的 Skills 和结果
    result,        // 最终答案
  };
}
