// ─────────────────────────────────────────────
//  Team —— 持久化协作团队
// ─────────────────────────────────────────────
import { TeamLeader } from './TeamLeader.js';
import { Member } from './Member.js';

/**
 * Team 类 - 协作团队
 *
 * 职责：
 * - 管理 Team 的状态（激活/非激活）
 * - 管理 Team 中的 Members
 * - 提供 Leader 接口给用户交互
 */
export class Team {
  constructor(id, config) {
    this.id = id;
    this.name = config.name || id;
    this.description = config.description || '';
    this.leader = null;
    this.members = [];
    this.isActive = false;
  }

  /**
   * 初始化 Team
   * 创建 Leader 和 Members
   */
  async initialize() {
    // 创建 Team 的 Leader
    this.leader = new TeamLeader(this);

    // 根据配置创建 Members
    if (this.config?.members) {
      for (const memberConfig of this.config.members) {
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
    if (!this.leader) {
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
   * 任务会交给 Team Leader 处理
   */
  async submitTask(task) {
    if (!this.isActive) {
      throw new Error(`你需要先进入 ${this.name} 才能提交任务`);
    }

    return await this.leader.handleTaskInTeam(task);
  }

  /**
   * 获取 Team 的能力清单
   * 用于 Leader 匹配
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
