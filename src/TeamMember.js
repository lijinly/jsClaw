// ─────────────────────────────────────────────
//  TeamMember —— 具有特定技能的团队成员
// ─────────────────────────────────────────────
import { runAgentWithThink } from './agent.js';
import { getToolDefinitions } from './skillRegistry.js';

/**
 * TeamMember 类 - 具有特定技能的团队成员
 *
 * 特点：
 * - 拥有系统基础技能（所有 TeamMember 共享）
 * - 动态加载角色技能（根据创建时的角色配置）
 * - 可以独立执行任务
 */
export class TeamMember {
  constructor(id, roleConfig) {
    this.id = id;
    this.role = roleConfig.role;
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
   * 所有 TeamMember 共享的基础技能集
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
   * 获取 TeamMember 的技能清单
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
   * 执行任务
   * 使用 TeamMember 的技能完成任务
   */
  async execute(task, options = {}) {
    const { verbose = false, history = [] } = options;

    if (verbose) {
      console.log(`\n🔧 [TeamMember: ${this.role}] 执行任务`);
      console.log(`   技能: ${this.allSkills.join(', ')}`);
    }

    // 使用基础 Agent 执行任务
    // TeamMember 本质上是一个有特定技能集的 Agent
    const result = await runAgentWithThink(task, {
      history,
      verbose,
    });

    return result;
  }

  /**
   * 获取 TeamMember 信息
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
