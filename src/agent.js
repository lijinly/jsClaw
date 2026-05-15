// ─────────────────────────────────────────────
//  Agent —— Think-Act 模式（无 guidance 版本）
// ─────────────────────────────────────────────
import { chat } from './Llm.js';
import { getToolDefinitions, executeToolCalls } from './SkillRegistry.js';
import { ContextManager } from './Context.js';
import { GoalTracker } from './Goal.js';

/**
 * Agent 类 —— Think-Act 模式的核心实现
 *
 * 特点：
 * - 面向对象设计，易于扩展和继承
 * - 支持 Think-Act 模式
 * - 支持自定义思考策略
 * - 可配置的日志输出
 * - 内置上下文自动清理（ContextManager）
 * - 内置目标保持机制（GoalTracker）
 */
export class Agent {
  /**
   * 创建 Agent 实例
   * @param {object} options
   * @param {string} [options.name='Agent']         - Agent 名称
   * @param {string} [options.role='智能助手']     - Agent 角色描述
   * @param {boolean} [options.verbose=false]       - 是否打印详细日志
   * @param {number}  [options.maxRounds=5]         - Act 阶段最大轮次
   * @param {object}  [options.contextManager]     - ContextManager配置
   * @param {object}  [options.goalTracker]        - GoalTracker配置
   */
  constructor({
    name = 'Agent',
    role = '智能助手',
    verbose = false,
    maxRounds = 5,
    contextManager: contextConfig = {},
    goalTracker: goalConfig = {},
  } = {}) {
    this.name = name;
    this.role = role;
    this.verbose = verbose;
    this.maxRounds = maxRounds;

    // 初始化上下文管理器
    this.contextManager = new ContextManager({
      maxTokens: contextConfig.maxTokens ?? 6000,
      preserveRecent: contextConfig.preserveRecent ?? 4,
      ...contextConfig,
    });

    // 初始化目标追踪器
    this.goalTracker = new GoalTracker({
      persistPath: goalConfig.persistPath,
      autoSave: goalConfig.autoSave ?? true,
    });
  }

  /**
   * 运行 Agent
   * @param {string} userMessage - 用户输入
   * @param {object} options
   * @param {string}   [options.systemPrompt]   - 系统提示词
   * @param {Array}    [options.history]        - 对话历史
   * @param {boolean}  [options.autoPrune=true] - 是否自动清理上下文
   * @param {boolean}  [options.injectGoal=true] - 是否注入目标上下文
   * @param {string}   [options.goalId]         - 指定目标ID（默认使用活跃目标）
   * @returns {Promise<object>} { thinking, actions, result }
   */
  async run(userMessage, { systemPrompt, history = [], autoPrune = true, injectGoal = true, goalId } = {}) {
    // 准备工具（无 guidance，使用所有工具）
    const tools = getToolDefinitions();

    // 自动清理上下文
    let managedHistory = history;
    if (autoPrune && history.length > 0) {
      managedHistory = this.contextManager.prune(history);
      if (this.verbose) {
        this.contextManager.logStatus(managedHistory);
      }
    }

    // 注入目标上下文
    let enhancedSystemPrompt = systemPrompt || `你是${this.role}。`;
    if (injectGoal) {
      const goalContext = this.goalTracker.getGoalContext(goalId);
      enhancedSystemPrompt = `${enhancedSystemPrompt}\n\n${goalContext}`;
    }

    // Think 阶段
    const thinking = await this._think(userMessage, {
      systemPrompt: enhancedSystemPrompt,
      history: managedHistory,
    });

    // Act 阶段
    const { actions, result } = await this._act(userMessage, {
      systemPrompt: enhancedSystemPrompt,
      history: managedHistory,
      thinking,
      tools,
    });

    return {
      thinking,
      actions,
      result,
      contextStats: autoPrune ? this.contextManager.getStats() : null,
      goal: injectGoal ? this.goalTracker.getGoalSummary(goalId) : null,
    };
  }

  /**
   * Think 阶段 —— 分析问题
   * @private
   */
  async _think(userMessage, { systemPrompt, history }) {
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
  async _act(userMessage, { systemPrompt, history, thinking, tools }) {
    const actSystemPrompt = `${systemPrompt || `你是${this.role}。`}

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

  /**
   * 获取上下文管理统计
   * @returns {object} 统计信息
   */
  getContextStats() {
    return this.contextManager.getStats();
  }

  /**
   * 手动触发上下文裁剪
   * @param {Array} messages - 消息数组
   * @returns {Promise<Array>} 裁剪后的消息
   */
  async pruneContext(messages) {
    return this.contextManager.pruneAsync(messages);
  }

  /**
   * 估算消息的token数
   * @param {Array} messages - 消息数组
   * @returns {number} 估算的token数
   */
  estimateContextTokens(messages) {
    return this.contextManager.estimateTokens(messages);
  }

  // ═══════════════════════════════════════════
  //  目标管理（代理到 GoalTracker）
  // ═══════════════════════════════════════════

  /**
   * 创建新目标
   * @param {string} description - 目标描述
   * @param {object} options - 配置选项
   * @returns {object} 创建的目标
   */
  createGoal(description, options = {}) {
    return this.goalTracker.createGoal(description, options);
  }

  /**
   * 设置活跃目标
   * @param {string} goalId - 目标ID
   */
  setActiveGoal(goalId) {
    this.goalTracker.setActiveGoal(goalId);
  }

  /**
   * 获取当前目标上下文
   * @returns {string}
   */
  getGoalContext() {
    return this.goalTracker.getGoalContext();
  }

  /**
   * 更新目标进度
   * @param {number} progress - 进度 (0-100)
   */
  updateGoalProgress(progress) {
    const activeGoal = this.goalTracker.getActiveGoal();
    if (activeGoal) {
      this.goalTracker.updateProgress(activeGoal.id, progress);
    }
  }

  /**
   * 添加检查点
   * @param {string} checkpoint - 检查点描述
   */
  addGoalCheckpoint(checkpoint) {
    const activeGoal = this.goalTracker.getActiveGoal();
    if (activeGoal) {
      return this.goalTracker.addCheckpoint(activeGoal.id, checkpoint);
    }
    return null;
  }

  /**
   * 记录成就
   * @param {string} achievement - 成就描述
   */
  addGoalAchievement(achievement) {
    const activeGoal = this.goalTracker.getActiveGoal();
    if (activeGoal) {
      this.goalTracker.addAchievement(activeGoal.id, achievement);
    }
  }

  /**
   * 记录阻碍
   * @param {string} blocker - 阻碍描述
   */
  addGoalBlocker(blocker) {
    const activeGoal = this.goalTracker.getActiveGoal();
    if (activeGoal) {
      this.goalTracker.addBlocker(activeGoal.id, blocker);
    }
  }

  /**
   * 完成当前目标
   */
  completeCurrentGoal() {
    const activeGoal = this.goalTracker.getActiveGoal();
    if (activeGoal) {
      this.goalTracker.completeGoal(activeGoal.id);
    }
  }
}
