// ─────────────────────────────────────────────
//  Member —— 具有特定技能的团队成员（支持 guidance）
// ─────────────────────────────────────────────
import { Agent } from './agent.js';
import { getToolDefinitions, executeToolCalls } from './skillRegistry.js';
import { chat } from './llm.js';

/**
 * Member 类 - 具有特定技能的团队成员
 *
 * 特点：
 * - 继承自 Agent，拥有 Agent 的基础能力
 * - 拥有系统基础技能（所有 Member 共享）
 * - 动态加载角色技能（根据创建时的角色配置）
 * - 执行带 guidance 的任务（重写 runWithGuidance 方法）
 */
export class Member extends Agent {
  constructor(id, roleConfig) {
    super({
      name: `Member(${id})`,
      role: roleConfig.role,
      verbose: false,
    });

    this.id = id;
    this.roleSkills = roleConfig.skills || [];

    // 加载系统基础技能
    this.baseSkills = this.loadBaseSkills();

    // 加载角色技能
    this.roleSkillsLoaded = this.loadRoleSkills(this.roleSkills);

    // 合并所有技能
    this.allSkills = [...this.baseSkills, ...this.roleSkillsLoaded];
  }

  /**
   * 加载系统基础技能
   * 所有 Member 共享的基础技能集
   */
  loadBaseSkills() {
    const tools = getToolDefinitions();
    return tools.map(t => t.function.name);
  }

  /**
   * 动态加载角色技能
   * 根据角色配置加载特定技能
   */
  loadRoleSkills(roleSkills) {
    // 这里可以实现技能懒加载机制
    // 目前先返回角色技能名称列表
    // 实际实现时，可以从 plugins/ 动态加载

    return roleSkills;
  }

  /**
   * 获取 Member 的技能清单
   */
  getSkillNames() {
    return this.allSkills;
  }

  /**
   * 判断是否拥有某个技能
   */
  hasSkill(skillName) {
    return this.allSkills.includes(skillName);
  }

  /**
   * 执行任务（公共接口，供 Team 调用）
   * @param {string} task - 任务描述
   * @param {object} options
   * @param {object}   [options.guidance]       - 执行指引 { keyRequirements, suggestedTools, executionSteps }
   * @param {boolean}  [options.verbose]       - 是否打印详细日志
   * @param {Array}    [options.history]        - 对话历史
   * @returns {Promise<object>} { thinking, actions, result }
   */
  async execute(task, options = {}) {
    const { guidance, verbose, history = [] } = options;

    if (verbose) {
      console.log(`\n🔧 [Member: ${this.role}] 执行任务`);
      console.log(`   技能: ${this.allSkills.join(', ')}`);
      console.log(`   Guidance: ${guidance || '无'}`);
    }

    // 调用 runWithGuidance 方法
    return await this.runWithGuidance(task, {
      guidance,
      history,
      verbose,
    });
  }

  /**
   * 运行 Member（重写父类方法，实现带 guidance 的逻辑）
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
    if (!guidance) {
      // 如果没有 guidance，调用父类方法（无 guidance 模式）
      return super.run(userMessage, { systemPrompt, history });
    }

    // 准备工具（根据 guidance 筛选）
    const tools = this._prepareTools(guidance);

    // Think 阶段（基于 guidance）
    const thinking = this._thinkWithGuidance(guidance);

    // Act 阶段（带 guidance）
    const { actions, result } = await this._actWithGuidance(userMessage, {
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
   * 准备工具列表（根据 guidance 筛选）
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
   * Think 阶段 —— 基于 guidance 的快速模式
   * @private
   */
  _thinkWithGuidance(guidance) {
    const thinking = `<guidance>
关键需求：${guidance.keyRequirements}
建议工具：${guidance.suggestedTools.join(', ')}
执行步骤：${guidance.executionSteps}
</guidance>`;

    if (this.verbose) {
      console.log(`\n💭 [${this.name}] Think 阶段 - 基于指引\n`, thinking);
    }

    return thinking;
  }

  /**
   * Act 阶段 —— 带 guidance 调用工具
   * @private
   */
  async _actWithGuidance(userMessage, { systemPrompt, history, guidance, thinking, tools }) {
    const actSystemPrompt = `${systemPrompt || `你是${this.role}。`}

用户问题：${userMessage}

执行指引：
${thinking}

请根据上述指引，直接调用必要的工具来完成任务。`;

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
   * 获取 Member 信息
   */
  getInfo() {
    return {
      id: this.id,
      role: this.role,
      skillCount: this.allSkills.length,
      skills: this.allSkills,
    };
  }
}
