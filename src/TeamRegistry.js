// ─────────────────────────────────────────────
//  TeamRegistry —— Team 管理和查找
// ─────────────────────────────────────────────
import { Team } from './Team.js';

/**
 * TeamRegistry 类 - Team 的注册和管理
 *
 * 职责：
 * - 管理所有已创建的 Team
 * - 提供 Team 查找和匹配功能
 * - 管理当前激活的 Team（用户所在的 Team）
 */
export class TeamRegistry {
  constructor() {
    this.teams = new Map();  // id -> Team
    this.currentTeamId = null;  // 用户当前所在的 Team（null = Team 外）
  }

  /**
   * 注册 Team
   */
  registerTeam(team) {
    this.teams.set(team.id, team);
  }

  /**
   * 获取所有 Team
   */
  getAllTeams() {
    return Array.from(this.teams.values());
  }

  /**
   * 根据 ID 获取 Team
   */
  getTeam(teamId) {
    return this.teams.get(teamId);
  }

  /**
   * 根据 ID 移除 Team
   */
  removeTeam(teamId) {
    const team = this.teams.get(teamId);
    if (team) {
      // 先退出 Team（如果用户在其中）
      if (this.currentTeamId === teamId) {
        team.exit();
        this.currentTeamId = null;
      }
      this.teams.delete(teamId);
    }
  }

  /**
   * 进入 Team
   */
  async enterTeam(teamId) {
    const team = this.teams.get(teamId);
    if (!team) {
      console.log(`\n❌ Team "${teamId}" 不存在`);
      return false;
    }

    // 如果在其他 Team，先退出
    if (this.currentTeamId && this.currentTeamId !== teamId) {
      const currentTeam = this.teams.get(this.currentTeamId);
      await currentTeam.exit();
    }

    // 进入新 Team
    await team.enter();
    this.currentTeamId = teamId;

    return true;
  }

  /**
   * 退出当前 Team
   */
  async exitCurrentTeam() {
    if (!this.currentTeamId) {
      console.log('\n📍 你当前不在任何 Team 中');
      return;
    }

    const team = this.teams.get(this.currentTeamId);
    await team.exit();
    this.currentTeamId = null;
  }

  /**
   * 获取当前 Team
   */
  getCurrentTeam() {
    if (!this.currentTeamId) {
      return null;
    }
    return this.teams.get(this.currentTeamId);
  }

  /**
   * 列出所有 Team 信息
   */
  listTeams() {
    const teams = this.getAllTeams();
    const currentTeamId = this.currentTeamId;

    console.log('\n📋 可用的 Teams：\n');

    for (const team of teams) {
      const isCurrent = team.id === currentTeamId ? ' [当前]' : '';
      const memberCount = team.members.length;
      const capabilities = team.getCapabilities().join(', ') || '无';

      console.log(`  ${team.name} (${team.id})${isCurrent}`);
      console.log(`    描述: ${team.description || '无'}`);
      console.log(`    Members: ${memberCount} 个`);
      console.log(`    能力: ${capabilities}`);
      console.log('');
    }
  }
}
