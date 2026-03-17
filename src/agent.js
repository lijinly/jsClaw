// ─────────────────────────────────────────────
//  Agent —— 将 LLM 与 Skill 串联起来
// ─────────────────────────────────────────────
import { chat } from './llm.js';
import { getToolDefinitions, executeToolCalls } from './skillRegistry.js';

/**
 * 单轮或多轮 Agent 调用
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
