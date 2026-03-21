// ─────────────────────────────────────────────
//  Agent —— Think-Act 模式（面向对象版本）
// ─────────────────────────────────────────────
import { chat } from './llm.js';
import { getToolDefinitions, executeToolCalls } from './skillRegistry.js';

/**
 * Agent 类 —— Think-Act 模式的核心实现
 * 
 * 特点：
 * - 面向对象设计，易于扩展和继承
 * - 支持无指引和有指引两种模式
 * - 支持自定义思考策略
 * - 可配置的日志输出
 */
export class Agent {
  /**
   * 创建 Agent 实例
   * @param {object} options
   * @param {string} [options.name='Agent']         - Agent 名称
   * @param {string} [options.role='智能助手']     - Agent 角色描述
   * @param {boolean} [options.verbose=false]       - 是否打印详细日志
   * @param {number}  [options.maxRounds=5]         - Act 阶段最大轮次
   */
  constructor({
    name = 'Agent',
    role = '智能助手',
    verbose = false,
    maxRounds = 5,
  } = {}) {
    this.name = name;
    this.role = role;
    this.verbose = verbose;
    this.maxRounds = maxRounds;
  }

  /**
   * 运行 Agent（无指引模式）
   * @param {string} userMessage - 用户输入
   * @param {object} options
   * @param {string}   [options.systemPrompt]   - 系统提示词
   * @param {Array}    [options.history]        - 对话历史
   * @returns {Promise<object>} { thinking, actions, result }
   */
  async run(userMessage, { systemPrompt, history = [] } = {}) {
    return this.runWithGuidance(userMessage, {
      guidance: null,
      systemPrompt,
      history,
    });
  }

  /**
   * 运行 Agent（带指引模式）
   * @param {string} userMessage - 用户输入
   * @param {object} options
   * @param {object}   [options.guidance]       - 执行指引 { keyRequirements, suggestedTools, executionSteps }
   * @param {string}   [options.systemPrompt]   - 系统提示词
   * @param {Array}    [options.history]        - 对话历史
   * @returns {Promise<object>} { thinking, actions, result }
   */
  async runWithGuidance(userMessage, {
    guidance = null,
    systemPrompt,
    history = [],
  } = {}) {
    // 准备工具
    const tools = this._prepareTools(guidance);

    // Think 阶段
    const thinking = await this._think(userMessage, {
      systemPrompt,
      history,
      guidance,
    });

    // Act 阶段
    const { actions, result } = await this._act(userMessage, {
      systemPrompt,
      history,
      guidance,
      thinking,
      tools,
    });

    return {
      thinking,
      actions,
      result,
    };
  }

  /**
   * 准备工具列表
   * @private
   */
  _prepareTools(guidance) {
    const tools = getToolDefinitions();

    if (guidance?.suggestedTools?.length > 0) {
      // 只保留建议的工具
      const filtered = tools.filter(t => guidance.suggestedTools.includes(t.function.name));
      
      if (this.verbose) {
        console.log(`\n🎯 [${this.name}] 已筛选工具：${filtered.map(t => t.function.name).join(', ')}`);
      }
      
      return filtered;
    }

    return tools;
  }

  /**
   * Think 阶段 —— 分析问题
   * @private
   */
  async _think(userMessage, { systemPrompt, history, guidance }) {
    if (guidance) {
      return this._thinkWithGuidance(guidance);
    } else {
      return this._thinkFull(userMessage, { systemPrompt, history });
    }
  }

  /**
   * Think 基于指引（快速模式）
   * @private
   */
  _thinkWithGuidance(guidance) {
    const thinking = `<guidance>
关键需求：${guidance.keyRequirements.join('; ')}
建议工具：${guidance.suggestedTools.join(', ')}
执行步骤：${guidance.executionSteps}
</guidance>`;

    if (this.verbose) {
      console.log(`\n💭 [${this.name}] Think 阶段 - 基于指引\n`, thinking);
    }

    return thinking;
  }

  /**
   * Think 完整流程（自主思考模式）
   * @private
   */
  async _thinkFull(userMessage, { systemPrompt, history }) {
    const thinkSystemPrompt = `${systemPrompt || `你是${this.role}。`}

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

    const thinkResponse = await chat(thinkMessages, { tools: [] });
    const thinking = thinkResponse.content;

    if (this.verbose) {
      console.log(`\n💭 [${this.name}] Think 阶段\n`, thinking);
    }

    return thinking;
  }

  /**
   * Act 阶段 —— 调用工具
   * @private
   */
  async _act(userMessage, { systemPrompt, history, guidance, thinking, tools }) {
    const actSystemPrompt = this._buildActPrompt(userMessage, systemPrompt, guidance, thinking);

    const actMessages = [
      { role: 'system', content: actSystemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    const actions = [];
    let actResponse = await chat(actMessages, { tools });
    actMessages.push(actResponse);

    // Act 循环
    for (let round = 0; round < this.maxRounds; round++) {
      if (actResponse.tool_calls?.length) {
        const toolResults = await executeToolCalls(actResponse.tool_calls);

        actions.push({
          calls: actResponse.tool_calls,
          results: toolResults,
        });

        if (this.verbose) {
          this._logActRound(round, actResponse.tool_calls);
        }

        actMessages.push(...toolResults);
        actResponse = await chat(actMessages, { tools });
        actMessages.push(actResponse);
      } else {
        // 获得最终回复
        break;
      }
    }

    return {
      actions,
      result: actResponse.content,
    };
  }

  /**
   * 构建 Act 阶段的系统提示词
   * @private
   */
  _buildActPrompt(userMessage, systemPrompt, guidance, thinking) {
    const basePrompt = systemPrompt || `你是${this.role}。`;

    if (guidance) {
      return `${basePrompt}

用户问题：${userMessage}

执行指引：
${thinking}

请根据上述指引，直接调用必要的工具来完成任务。`;
    } else {
      return `${basePrompt}

用户问题：${userMessage}

你之前的思考过程：
${thinking}

现在，根据你的思考计划，调用必要的工具来获取数据或执行操作。`;
    }
  }

  /**
   * 打印 Act 轮次日志
   * @private
   */
  _logActRound(round, toolCalls) {
    console.log(`\n⚙️  [${this.name}] Act 阶段 - 第 ${round + 1} 步`);
    toolCalls.forEach(call => {
      console.log(`  • 调用 ${call.function.name}(${call.function.arguments})`);
    });
  }

  /**
   * 设置 Agent 名称
   */
  setName(name) {
    this.name = name;
  }

  /**
   * 设置 Agent 角色描述
   */
  setRole(role) {
    this.role = role;
  }

  /**
   * 设置详细日志开关
   */
  setVerbose(verbose) {
    this.verbose = verbose;
  }

  /**
   * 设置最大轮次
   */
  setMaxRounds(maxRounds) {
    this.maxRounds = maxRounds;
  }
}

/**
 * 兼容函数 —— 保留原有接口
 * @deprecated 建议使用 Agent 类
 */
export async function runAgentWithThink(userMessage, { systemPrompt, history = [], verbose = false } = {}) {
  const agent = new Agent({ verbose });
  return agent.run(userMessage, { systemPrompt, history });
}

/**
 * 兼容函数 —— 保留原有接口
 * @deprecated 建议使用 Agent 类
 */
export async function runAgentWithGuidance(userMessage, {
  guidance = null,
  systemPrompt,
  history = [],
  verbose = false
} = {}) {
  const agent = new Agent({ verbose });
  return agent.runWithGuidance(userMessage, { guidance, systemPrompt, history });
}
