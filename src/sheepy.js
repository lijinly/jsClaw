// ─────────────────────────────────────────────
//  Sheepy —— 任务编排与分发 Agent
//  职责：接收任务、判断需求、分发执行、评估结果、返回最终答案
// ─────────────────────────────────────────────
import { chat } from './llm.js';
import { runAgentWithGuidance } from './agent.js';
import { getToolDefinitions } from './skillRegistry.js';

/**
 * Sheepy 主流程
 * 1. 判断任务类型（直接回答 vs 需要 agent）
 * 2. 分发执行
 * 3. 评估结果
 * 4. 返回最终答案
 *
 * @param {string} task - 用户任务
 * @param {object} options
 * @param {string}   [options.systemPrompt]   - Sheepy 的系统提示词
 * @param {Array}    [options.history]        - 对话历史
 * @param {boolean}  [options.verbose]        - 是否打印中间过程
 * @param {object}   [options.agentOptions]   - 传递给 worker agent 的配置
 * @returns {object} { decision, agentResult, evaluation, finalResult }
 */
export async function runSheepy(task, {
  systemPrompt,
  history = [],
  verbose = false,
  agentOptions = {}
} = {}) {

  // ──────────────────────────────────────────
  // 第一步：判断任务类型
  // ──────────────────────────────────────────
  const judgeSystemPrompt = `${systemPrompt || '你是 Sheepy，一个任务编排助手。'}

你的职责是判断用户任务的处理方式，并为复杂任务提供执行指引：
1. 简单任务：直接回答即可（例如：知识问答、计算、简单总结）
2. 复杂任务：需要调用工具、执行多步操作、需要 agent 参与

对于复杂任务，请从以下可选工具中选择最相关的工具（不要全部选择）：
${getToolDefinitions().map(t => `- ${t.function.name}: ${t.function.description}`).join('\n')}

请按以下格式返回判断结果：
<decision>
需要 agent 参与：是/否
理由：[你的理由]
关键需求：[如果需要 agent，列出关键需求点，用分号分隔]
建议工具：[从上述工具列表中选择最相关的工具名称，用逗号分隔，例如：read,write,exec]
执行步骤：[简要列出1-3个执行步骤]
</decision>`;

  const judgeMessages = [
    { role: 'system', content: judgeSystemPrompt },
    ...history,
    { role: 'user', content: `任务：${task}` },
  ];

  const judgeResponse = await chat(judgeMessages, { tools: [] });
  const decisionText = judgeResponse.content;

  if (verbose) {
    console.log('\n🐑 [Sheepy - 判断阶段]\n', decisionText);
  }

  // 解析判断结果
  const needsAgent = decisionText.includes('需要 agent 参与：是');

  // 解析执行指引（仅当需要 agent 时）
  let guidance = null;
  if (needsAgent) {
    // 使用正则表达式提取关键需求、建议工具、执行步骤
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

    if (verbose) {
      console.log('\n🐑 [Sheepy - 执行指引]');
      console.log('  关键需求:', guidance.keyRequirements);
      console.log('  建议工具:', guidance.suggestedTools);
      console.log('  执行步骤:', guidance.executionSteps);
    }
  }

  // ──────────────────────────────────────────
  // 第二步：分发执行
  // ──────────────────────────────────────────
  let agentResult = null;
  let directAnswer = null;

  if (needsAgent) {
    // 需要 agent 参与：调用 worker agent，并传递执行指引
    if (verbose) {
      console.log('\n🐑 [Sheepy - 分发任务给 Worker Agent]');
    }

    agentResult = await runAgentWithGuidance(task, {
      guidance,
      ...agentOptions,
      history,
      verbose,
    });

    if (verbose) {
      console.log('\n🐑 [Sheepy - Worker Agent 完成]\n');
    }
  } else {
    // 简单任务：直接回答
    if (verbose) {
      console.log('\n🐑 [Sheepy - 直接回答]');
    }

    const directSystemPrompt = `${systemPrompt || '你是一个智能助手。'}
请直接回答用户的问题，无需调用任何工具。`;

    const directMessages = [
      { role: 'system', content: directSystemPrompt },
      ...history,
      { role: 'user', content: task },
    ];

    const directResponse = await chat(directMessages, { tools: [] });
    directAnswer = directResponse.content;

    if (verbose) {
      console.log('答案:', directAnswer);
    }
  }

  // ──────────────────────────────────────────
  // 第三步：评估结果（仅对 agent 结果）
  // ──────────────────────────────────────────
  let evaluation = null;

  if (needsAgent && agentResult) {
    const evaluateSystemPrompt = `你是 Sheepy 的质量评估员。
你的任务是评估 Worker Agent 的执行结果是否满足用户需求。

评估维度：
1. **完整性**：是否完整回答了用户的问题？
2. **准确性**：信息是否准确无误？
3. **实用性**：结果是否具有实际价值？

请按以下格式返回评估结果：
<evaluation>
评分：1-5（5 分为优秀）
完整性：[评价]
准确性：[评价]
实用性：[评价]
改进建议：[如有需要]
</evaluation>`;

    const evaluateMessages = [
      { role: 'system', content: evaluateSystemPrompt },
      { role: 'user', content: `用户任务：${task}\n\nWorker Agent 的结果：\n${agentResult.result}` },
    ];

    const evaluateResponse = await chat(evaluateMessages, { tools: [] });
    evaluation = evaluateResponse.content;

    if (verbose) {
      console.log('\n🐑 [Sheepy - 结果评估]\n', evaluation);
    }
  }

  // ──────────────────────────────────────────
  // 第四步：整合最终答案
  // ──────────────────────────────────────────
  let finalResult;

  if (needsAgent) {
    // 如果有评估，可以考虑是否需要补充或修改
    finalResult = agentResult.result;
  } else {
    finalResult = directAnswer;
  }

  if (verbose) {
    console.log('\n🐑 [Sheepy - 最终结果]\n', finalResult);
  }

  return {
    decision: decisionText,      // 判断决策
    needsAgent,                  // 是否使用了 agent
    guidance,                    // 执行指引（关键需求、建议工具、执行步骤）
    agentResult,                 // Worker agent 的完整结果（含思考过程）
    directAnswer,                // 直接回答的内容
    evaluation,                  // 结果评估
    finalResult,                 // 最终答案
  };
}
