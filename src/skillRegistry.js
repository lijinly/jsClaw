// ─────────────────────────────────────────────
//  Skill 注册表 & 执行引擎
// ─────────────────────────────────────────────

const registry = new Map();

/**
 * 注册一个 Skill
 * @param {object} skill
 * @param {string}   skill.name        - 技能名称（唯一）
 * @param {string}   skill.description - 供 LLM 理解的功能说明
 * @param {object}   skill.parameters  - JSON Schema 参数定义
 * @param {Function} skill.execute     - 实际执行函数 async (params) => result
 */
export function registerSkill({ name, description, parameters, execute }) {
  registry.set(name, { name, description, parameters, execute });
  console.log(`[Skill] 已注册: ${name}`);
}

/** 获取所有 skill 的 OpenAI tools 格式定义 */
export function getToolDefinitions() {
  return [...registry.values()].map(s => ({
    type: 'function',
    function: {
      name: s.name,
      description: s.description,
      parameters: s.parameters,
    },
  }));
}

/** 根据 LLM 返回的 tool_calls 执行对应 skill */
export async function executeToolCalls(toolCalls) {
  const results = [];
  for (const call of toolCalls) {
    const skill = registry.get(call.function.name);
    if (!skill) {
      results.push({ tool_call_id: call.id, content: `未找到 Skill: ${call.function.name}` });
      continue;
    }
    try {
      const args = JSON.parse(call.function.arguments);
      console.log(`[Skill] 执行: ${call.function.name}`, args);
      const result = await skill.execute(args);
      results.push({
        role: 'tool',
        tool_call_id: call.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      });
    } catch (err) {
      results.push({ role: 'tool', tool_call_id: call.id, content: `执行出错: ${err.message}` });
    }
  }
  return results;
}
