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
 * @param {object}   [skill.validation] - 验证规则（可选）
 * @param {Function} [skill.validation.beforeExecute] - 前置验证 (skill, args) => { valid, error }
 * @param {Function} [skill.validation.afterExecute]  - 后置验证 (skill, result) => { valid, error }
 * @param {number}   [skill.validation.timeout]       - 超时毫秒，默认 30000
 * @param {boolean}  [skill.validation.retryable]      - 是否可重试，默认 true
 */
export function registerSkill({ name, description, parameters, execute, validation }) {
  registry.set(name, { name, description, parameters, execute, validation });
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

/** 根据 LLM 返回的 tool_calls 执行对应 skill（支持验证层） */
export async function executeToolCalls(toolCalls) {
  const results = [];
  for (const call of toolCalls) {
    const skill = registry.get(call.function.name);
    if (!skill) {
      results.push({ tool_call_id: call.id, content: `未找到 Skill: ${call.function.name}` });
      continue;
    }

    // 解析参数
    let args;
    try {
      args = JSON.parse(call.function.arguments);
    } catch (e) {
      results.push({ tool_call_id: call.id, content: `参数解析失败: ${e.message}` });
      continue;
    }

    // ── 前置验证 ──────────────────────────────
    if (skill.validation?.beforeExecute) {
      const validation = skill.validation.beforeExecute(skill, args);
      if (!validation.valid) {
        results.push({ tool_call_id: call.id, content: `验证失败: ${validation.error}` });
        continue;
      }
    }

    // ── 执行（带超时）────────────────────────
    const timeout = skill.validation?.timeout || 30000;
    try {
      console.log(`[Skill] 执行: ${call.function.name}`, args);
      const result = await Promise.race([
        skill.execute(args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`执行超时 (${timeout}ms)`)), timeout)
        ),
      ]);

      // ── 后置验证 ───────────────────────────
      if (skill.validation?.afterExecute) {
        const validation = skill.validation.afterExecute(skill, result);
        if (!validation.valid) {
          results.push({ tool_call_id: call.id, content: `结果验证失败: ${validation.error}` });
          continue;
        }
      }

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
