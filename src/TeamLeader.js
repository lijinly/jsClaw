// ─────────────────────────────────────────────
//  TeamLeader —— Team 内的任务编排者
// ─────────────────────────────────────────────
import { chat } from './llm.js';

/**
 * TeamLeader 类 - Team 内的任务编排和管理
 *
 * 职责：
 * - Team 内：接收用户任务，组织 Members 执行
 * - Team 外：接收用户任务，决定自己完成或引导进入 Team
 * - 技能匹配：分析任务需求，匹配合适的 Team
 */
export class TeamLeader {
  constructor(team) {
    this.team = team;
  }

  /**
   * 在 Team 内处理任务
   *
   * 流程：
   * 1. 分析任务需求（需要哪些技能）
   * 2. 选择合适的 Member（或多个 Members 协作）
   * 3. 协调 Members 执行
   * 4. 返回结果
   */
  async handleTaskInTeam(task) {
    console.log('\n👔 [Team Leader - Team 内任务]');

    // 分析任务需求
    const analysis = await this.analyzeTask(task);

    // 选择合适的 Member
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
   * 在 Team 外处理任务
   *
   * 决策：
   * 1. 简单任务 → Leader 自己完成
   * 2. 复杂任务，有匹配的 Team → 引导用户进入
   * 3. 复杂任务，无匹配 Team → Leader 自己完成
   */
  async handleTaskOutsideTeam(task, allTeams) {
    console.log('\n👔 [Team Leader - Team 外任务]');

    // 分析任务
    const analysis = await this.analyzeTask(task);

    // 检查是否有匹配的 Team
    const matchingTeam = this.findMatchingTeam(analysis.requiredSkills, allTeams);

    if (matchingTeam) {
      // 引导用户进入 Team
      return {
        action: 'suggest_team',
        message: `建议进入"${matchingTeam.name}"来完成这个任务`,
        team: matchingTeam,
        taskAnalysis: analysis,
      };
    } else {
      // Leader 自己完成
      const result = await this.completeBySelf(task);

      return {
        action: 'completed',
        message: 'Leader 已完成',
        result: result,
      };
    }
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
   * 选择合适的 Member
   * 根据需要的技能，选择拥有这些技能的 Member
   */
  selectMembers(requiredSkills) {
    const selectedMembers = [];

    for (const member of this.team.members) {
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
        const result = await member.execute(task, { verbose: false });
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
   * 查找匹配的 Team
   * 根据需要的技能，查找可以完成任务的 Team
   */
  findMatchingTeam(requiredSkills, allTeams) {
    for (const team of allTeams) {
      const teamCapabilities = team.getCapabilities();

      // 检查 Team 是否拥有所有必需技能
      const hasAllSkills = requiredSkills.every(skill =>
        teamCapabilities.includes(skill)
      );

      if (hasAllSkills) {
        return team;
      }
    }

    return null;
  }

  /**
   * Leader 自己完成任务
   * 对于简单任务或无匹配 Team 的任务
   */
  async completeBySelf(task) {
    const systemPrompt = '你是一个智能助手。请直接回答用户的问题。';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task },
    ];

    const response = await chat(messages, { tools: [] });

    return response.content;
  }
}
