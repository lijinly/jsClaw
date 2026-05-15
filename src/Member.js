// ─────────────────────────────────────────────
//  Member —— 工作空间中的执行成员（基于 Agent）
// ─────────────────────────────────────────────
import { Agent } from './agent.js';
import { getToolDefinitions, executeToolCalls } from './skillRegistry.js';
import { chat } from './llm.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Member 类 - 工作空间中的执行成员
 *
 * 架构定位：
 * - 继承自 Agent，拥有 Agent 的基础能力
 * - 由 WorkSpace 直接管理和协调
 * - 拥有系统基础技能（所有 Member 共享）
 * - 可动态加载角色技能
 * - 支持从 identity.md 和 soul.md 加载身份和性格特征
 *
 * 与旧架构的区别：
 * - 不再由 Team 协调，直接由 WorkSpace 调度
 * - 简化了层级关系
 */
export class Member extends Agent {
  /**
   * @param {string} id - Member ID
   * @param {object} config - Member 配置
   * @param {string} config.role - Member 角色描述
   * @param {Array<string>} [config.skills] - 角色技能列表
   * @param {string} [config.name] - Member 显示名称
   * @param {string} [config.identityPath] - identity.md 文件路径（可选）
   * @param {string} [config.soulPath] - soul.md 文件路径（可选）
   */
  constructor(id, config) {
    // 先调用父类构造函数
    super({
      name: config.name || `Member(${id})`,
      role: config.role || '成员',
      verbose: config.verbose || false,
      maxRounds: config.maxRounds || 10,
    });

    // 在 super() 之后设置 Member 特有的属性
    this.id = id;
    this.name = config.name || `Member(${id})`;
    this.role = config.role || '成员';
    this.roleSkills = config.skills || [];

    // 人格文件路径配置
    this.identityPath = config.identityPath || null;
    this.soulPath = config.soulPath || null;

    // 加载身份和性格
    this.identity = null;  // identity.md 内容
    this.soul = null;      // soul.md 内容

    // 加载系统基础技能
    this.baseSkills = this.loadBaseSkills();

    // 加载角色技能
    this.roleSkillsLoaded = this.loadRoleSkills(this.roleSkills);

    // 合并所有技能
    this.allSkills = [...this.baseSkills, ...this.roleSkillsLoaded];

    // Member 状态
    this.isActive = false;
    this.taskCount = 0;

    // 加载人格文件
    this._loadPersonaFiles();
  }

  /**
   * 加载身份和性格文件
   * @private
   */
  _loadPersonaFiles() {
    // 确定搜索路径
    const searchPaths = [
      // 1. 配置文件中的显式路径
      this.identityPath,
      this.soulPath,
      // 2. 约定路径：members/<id>/identity.md 和 members/<id>/soul.md
      join(__dirname, '..', 'members', this.id, 'identity.md'),
      join(__dirname, '..', 'members', this.id, 'soul.md'),
      // 3. 工作区根目录下的 members/<id>/
      join(__dirname, '..', '..', 'members', this.id, 'identity.md'),
      join(__dirname, '..', '..', 'members', this.id, 'soul.md'),
    ].filter(Boolean);

    // 加载 identity.md
    for (const path of searchPaths.filter((_, i) => i % 2 === 0)) {
      if (existsSync(path)) {
        try {
          this.identity = readFileSync(path, 'utf-8');
          console.log(`✓ [${this.name}] 加载身份: ${path}`);
          break;
        } catch (e) {
          // 继续尝试下一个路径
        }
      }
    }

    // 加载 soul.md
    for (const path of searchPaths.filter((_, i) => i % 2 === 1)) {
      if (existsSync(path)) {
        try {
          this.soul = readFileSync(path, 'utf-8');
          console.log(`✓ [${this.name}] 加载性格: ${path}`);
          break;
        } catch (e) {
          // 继续尝试下一个路径
        }
      }
    }
  }

  /**
   * 构建完整的 System Prompt
   * 包含：身份 + 性格 + 角色描述
   * @returns {string} 完整的 system prompt
   */
  buildSystemPrompt() {
    const parts = [];

    // 1. 身份描述（来自 identity.md）
    if (this.identity) {
      parts.push(`# 身份定义\n${this.identity}`);
    }

    // 2. 性格特征（来自 soul.md）
    if (this.soul) {
      parts.push(`# 性格特征\n${this.soul}`);
    }

    // 3. 基础角色描述（来自配置）
    if (this.role) {
      parts.push(`# 角色定位\n你是 ${this.name}。${this.role}`);
    }

    // 4. 技能说明
    if (this.allSkills.length > 0) {
      parts.push(`# 可用技能\n你拥有以下技能：${this.allSkills.join(', ')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * 获取带人格的 system prompt（供 Agent 使用）
   * @returns {string} system prompt
   */
  getPersonaPrompt() {
    return this.buildSystemPrompt();
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
    // 预留扩展：可从 plugins/ 动态加载
    return roleSkills;
  }

  /**
   * 获取 Member 的技能清单
   * @returns {Array<string>} 技能名称列表
   */
  getSkillNames() {
    return this.allSkills;
  }

  /**
   * 判断是否拥有某个技能
   * @param {string} skillName - 技能名称
   * @returns {boolean} 是否拥有该技能
   */
  hasSkill(skillName) {
    return this.allSkills.includes(skillName);
  }

  /**
   * 执行任务（公共接口，供 WorkSpace 调用）
   *
   * @param {string} task - 任务描述
   * @param {object} options - 执行选项
   * @param {object} [options.guidance] - 执行指引 { keyRequirements, suggestedTools, executionSteps }
   * @param {boolean} [options.verbose] - 是否打印详细日志
   * @param {Array} [options.history] - 对话历史
   * @param {boolean} [options.usePersona=true] - 是否使用 Member 的身份/性格
   * @returns {Promise<object>} { thinking, actions, result }
   */
  async execute(task, options = {}) {
    const { guidance, verbose = false, history = [], usePersona = true } = options;

    this.taskCount++;
    this.isActive = true;

    // 构建 system prompt（优先使用 Member 的人格配置）
    const systemPrompt = usePersona ? this.buildSystemPrompt() : null;

    if (verbose) {
      console.log(`\n🔧 [Member: ${this.name}] 执行任务 #${this.taskCount}`);
      console.log(`   角色: ${this.role}`);
      console.log(`   技能: ${this.allSkills.join(', ') || '无'}`);
      if (this.identity || this.soul) {
        console.log(`   人格: ${this.identity ? '✓ 身份' : ''} ${this.soul ? '✓ 性格' : ''}`);
      }
      if (guidance) {
        console.log(`   Guidance: 已提供`);
      }
    }

    try {
      let result;

      if (guidance) {
        // 带 guidance 模式
        result = await this.runWithGuidance(task, {
          guidance,
          history,
          verbose,
          systemPrompt,
        });
      } else {
        // 标准模式 - 使用 Member 的人格 prompt
        result = await this.run(task, { 
          history, 
          verbose,
          systemPrompt,
        });
      }

      this.isActive = false;
      return result;
    } catch (error) {
      this.isActive = false;
      throw error;
    }
  }

  /**
   * 运行 Member（重写父类方法，实现带 guidance 的逻辑）
   *
   * @param {string} userMessage - 用户输入
   * @param {object} options - 执行选项
   * @param {object} [options.guidance] - 执行指引
   * @param {string} [options.systemPrompt] - 系统提示词
   * @param {Array} [options.history] - 对话历史
   * @returns {Promise<object>} { thinking, actions, result }
   */
  async runWithGuidance(userMessage, {
    guidance = null,
    systemPrompt,
    history = [],
  } = {}) {
    if (!guidance) {
      // 如果没有 guidance，调用父类方法
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
      const filtered = tools.filter(t =>
        guidance.suggestedTools.includes(t.function.name)
      );

      if (this.verbose) {
        console.log(`\n🎯 [${this.name}] 工具筛选: ${filtered.map(t => t.function.name).join(', ')}`);
      }

      return filtered;
    }

    return tools;
  }

  /**
   * Think 阶段 —— 基于 guidance 的分析
   * @private
   */
  _thinkWithGuidance(guidance) {
    const thinking = `<guidance>
关键需求：${guidance.keyRequirements}
建议工具：${guidance.suggestedTools?.join(', ') || '无'}
执行步骤：${guidance.executionSteps}
</guidance>`;

    if (this.verbose) {
      console.log(`\n💭 [${this.name}] Think 阶段`);
      console.log(thinking);
    }

    return thinking;
  }

  /**
   * Act 阶段 —— 调用工具执行
   * @private
   */
  async _actWithGuidance(userMessage, { systemPrompt, history, guidance, thinking, tools }) {
    const actSystemPrompt = `${systemPrompt || `你是 ${this.role}。`}

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
      console.log(`  • ${call.function.name}()`);
    });
  }

  /**
   * 获取 Member 信息
   * @returns {object} Member 详细信息
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      skillCount: this.allSkills.length,
      skills: this.allSkills,
      taskCount: this.taskCount,
      isActive: this.isActive,
    };
  }

  /**
   * 获取简短的 Member 概要
   * @returns {object} 概要信息
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      skillCount: this.allSkills.length,
    };
  }
}
