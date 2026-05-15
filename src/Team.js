// ─────────────────────────────────────────────
//  Team —— 持久化协作团队
// ─────────────────────────────────────────────
import { Member } from './Member.js';
import { chat } from './Llm.js';

/**
 * Team 类 - 协作团队
 *
 * 职责：
 * - 管理 Team 的状态（激活/非激活）
 * - 管理 Team 中的 Members
 * - 直接协调 Members 执行任务
 * - 分析任务需求并选择合适的 Members
 */
export class Team {
  constructor(id, config) {
    this.id = id;
    this.name = config.name || id;
    this.description = config.description || '';
    this.config = config;  // 保存配置
    this.members = [];
    this.isActive = false;
  }

  /**
   * 初始化 Team
   * 创建 Members
   */
  async initialize() {
    // 根据配置创建 Members
    if (this.config?.teamMembers) {
      for (const memberConfig of this.config.teamMembers) {
        const member = new Member(memberConfig.id, {
          role: memberConfig.role,
          skills: memberConfig.skills,
        });
        this.members.push(member);
      }
    }
  }

  /**
   * 进入 Team
   * 激活 Team，准备接收任务
   */
  async enter() {
    if (this.isActive) {
      console.log(`\n📍 你已经在 ${this.name} 中了`);
      return;
    }

    this.isActive = true;

    // 初始化 Team（如果还未初始化）
    if (this.members.length === 0) {
      await this.initialize();
    }

    console.log(`\n🚪 进入 ${this.name}`);
    console.log(`   ${this.description}`);
    console.log(`   Members: ${this.members.map(m => m.role).join(', ')}`);
  }

  /**
   * 退出 Team
   * 保持 Team 持久化，但用户离开
   */
  async exit() {
    if (!this.isActive) {
      console.log(`\n📍 你当前不在任何 Team 中`);
      return;
    }

    this.isActive = false;

    console.log(`\n🚪 离开 ${this.name}`);
  }

  /**
   * 在 Team 内提交任务
   * Team 分析任务需求，选择合适的 TeamMembers 执行
   */
  async submitTask(task) {
    if (!this.isActive) {
      throw new Error(`你需要先进入 ${this.name} 才能提交任务`);
    }

    console.log(`\n👔 [${this.name}] 处理任务`);

    // 分析任务需求
    const analysis = await this.analyzeTask(task);

    // 选择合适的 Members
    const selectedMembers = this.selectMembers(analysis.requiredSkills);

    if (!selectedMembers || selectedMembers.length === 0) {
      return {
        result: '没有合适的 Member 可以完成这个任务',
        needsMoreSkills: true,
        requiredSkills: analysis.requiredSkills,
      };
    }

    // 执行任务
    const results = await this.executeWithMembers(selectedMembers, task);

    return {
      result: results.finalResult,
      members: results.membersUsed,
      executionDetails: results,
    };
  }

  /**
   * 分析任务需求
   * 返回任务需要的技能列表
   */
  async analyzeTask(task) {
    const systemPrompt = `你是任务分析专家。
分析用户任务，识别完成这个任务需要哪些技能。

可用技能类别：
- 文件操作：read, write, list, edit, apply_patch, exec
- 网络操作：web_search, web_fetch, browser
- 数据操作：message, list_skills, read_skill

请按以下格式返回：
<analysis>
需要的技能：[用逗号分隔，例如：read, write, exec]
复杂度：[1-10，1最简单，10最复杂]
说明：[简要说明]`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `任务：${task}` },
    ];

    const response = await chat(messages, { tools: [] });

    // 解析结果
    const skillsMatch = response.content.match(/需要的技能：([^\n]+)/);
    const complexityMatch = response.content.match(/复杂度：([0-9]+)/);

    return {
      requiredSkills: skillsMatch ? skillsMatch[1].split(',').map(s => s.trim()) : [],
      complexity: complexityMatch ? parseInt(complexityMatch[1]) : 5,
      description: response.content,
    };
  }

  /**
   * 为 Member 生成执行指引
   * 分析任务并生成 guidance，传递给 Member.runWithGuidance()
   */
  async generateGuidance(task, member) {
    const memberSkills = member.getSkillNames();

    const systemPrompt = `你是任务编排专家。
分析用户任务，为具有特定技能的 Member 生成执行指引。

用户任务：${task}

Member 拥有的技能：${memberSkills.join(', ')}

请按以下格式返回：
<guidance>
关键需求：[用1-2句话描述完成任务的要点]
建议工具：[从 Member 的技能中选择最相关的工具，用逗号分隔]
执行步骤：[用1-3步简述如何完成任务]`;

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    const response = await chat(messages, { tools: [] });

    // 解析结果
    const requirementsMatch = response.content.match(/关键需求：([^\n]+)/);
    const toolsMatch = response.content.match(/建议工具：([^\n]+)/);
    const stepsMatch = response.content.match(/执行步骤：([^\n]+)/);

    return {
      keyRequirements: requirementsMatch ? requirementsMatch[1].trim() : '完成任务',
      suggestedTools: toolsMatch ? toolsMatch[1].split(',').map(t => t.trim()) : [],
      executionSteps: stepsMatch ? stepsMatch[1].trim() : '自主分析并执行',
    };
  }

  /**
   * 选择合适的 Members
   * 根据需要的技能，选择拥有这些技能的 Member
   */
  selectMembers(requiredSkills) {
    const selectedMembers = [];

    for (const member of this.members) {
      // 检查 Member 是否拥有所需技能
      const hasAllRequiredSkills = requiredSkills.every(skill =>
        member.hasSkill(skill)
      );

      if (hasAllRequiredSkills && !selectedMembers.includes(member)) {
        selectedMembers.push(member);

        // 如果一个 Member 能完成所有技能，就不再查找
        break;
      }
    }

    return selectedMembers;
  }

  /**
   * 使用 Members 执行任务
   * 支持单个 Member 或多个 Members 协作
   */
  async executeWithMembers(members, task) {
    const results = [];
    const membersUsed = [];

    for (const member of members) {
      console.log(`\n   调用 Member: ${member.role}`);

      try {
        // 为 Member 生成执行指引
        const guidance = await this.generateGuidance(task, member);

        if (this.isActive) {
          console.log(`   ✅ Guidance 生成成功`);
        }

        // 调用 Member，传递 guidance
        const result = await member.execute(task, {
          guidance,
          verbose: false,
        });

        results.push(result);
        membersUsed.push(member.role);
      } catch (error) {
        console.error(`   Member 执行失败: ${error.message}`);
        results.push({ error: error.message });
      }
    }

    // 整合结果
    const finalResult = results.length === 1
      ? results[0].result
      : `多个 Members 协作完成：\n${results.map((r, i) => `[Member ${i + 1}]: ${r.result || r.error}`).join('\n')}`;

    return {
      membersUsed,
      finalResult,
      detailedResults: results,
    };
  }

  /**
   * 获取 Team 的能力清单
   * 用于技能匹配
   */
  getCapabilities() {
    const allSkills = new Set();
    for (const member of this.members) {
      for (const skill of member.allSkills) {
        allSkills.add(skill);
      }
    }
    return Array.from(allSkills);
  }
}
