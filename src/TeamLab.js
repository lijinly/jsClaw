// ─────────────────────────────────────────────
//  TeamLab —— Team 实验室
// ─────────────────────────────────────────────
import { TeamRegistry } from './TeamRegistry.js';
import { Team } from './Team.js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * TeamLab 类 - Team 实验室
 *
 * 职责：
 * - 加载 Team 配置
 * - 创建和管理 Teams
 * - 提供统一的任务提交接口
 */
export class TeamLab {
  constructor(configPath = './src/TeamConfig.json') {
    this.registry = new TeamRegistry();
    this.configPath = configPath;
    this.globalLeader = null;  // Team 外的全局 Leader
  }

  /**
   * 初始化系统
   * 加载配置并创建 Teams
   */
  async initialize() {
    console.log('\n🚀 TeamLab 初始化中...\n');

    // 加载配置
    const config = this.loadConfig();

    // 创建 Teams
    for (const teamConfig of Object.values(config.teams)) {
      const team = new Team(teamConfig.id, teamConfig);
      this.registry.registerTeam(team);
      console.log(`✓ Team 创建成功: ${team.name} (${team.members.length} Members)`);
    }

    console.log(`\n📦 共加载 ${this.registry.getAllTeams().length} 个 Teams`);

    // 列出所有 Teams
    this.registry.listTeams();
  }

  /**
   * 加载 Team 配置
   */
  loadConfig() {
    try {
      const configData = readFileSync(join(process.cwd(), this.configPath), 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      console.error(`❌ 配置加载失败: ${error.message}`);
      return { teams: {} };
    }
  }

  /**
   * 提交任务（统一接口）
   * 自动判断是在 Team 内还是 Team 外
   */
  async submitTask(task) {
    const currentTeam = this.registry.getCurrentTeam();

    if (currentTeam) {
      // Team 内：交给 Team Leader
      return await currentTeam.submitTask(task);
    } else {
      // Team 外：使用全局 Leader 决策
      return await this.handleTaskOutsideTeam(task);
    }
  }

  /**
   * 在 Team 外处理任务
   */
  async handleTaskOutsideTeam(task) {
    // 这里可以创建一个临时的 Leader
    // 复用 Leader 的决策逻辑
    const allTeams = this.registry.getAllTeams();

    // 简化版决策（实际应使用 TeamLeader）
    const response = await this.makeDecision(task, allTeams);

    if (response.action === 'suggest_team') {
      console.log(`\n💡 ${response.message}`);
      console.log(`   ${response.taskAnalysis.description}\n`);

      return {
        suggestedTeam: response.team,
        requiresTeamEnter: true,
      };
    } else {
      console.log(`\n✅ ${response.message}`);
      return {
        result: response.result,
        requiresTeamEnter: false,
      };
    }
  }

  /**
   * 决策是否需要进入 Team
   */
  async makeDecision(task, allTeams) {
    // 这里简化了决策逻辑
    // 实际应使用 TeamLeader.handleTaskOutsideTeam()

    // 判断是否需要复杂技能
    const needsComplexSkills = ['web_search', 'exec', 'browser'].some(skill =>
      task.toLowerCase().includes(skill)
    );

    if (needsComplexSkills && allTeams.length > 0) {
      // 建议进入第一个 Team（简化逻辑）
      const suggestedTeam = allTeams[0];
      return {
        action: 'suggest_team',
        message: `建议进入"${suggestedTeam.name}"来完成这个任务`,
        team: suggestedTeam,
        taskAnalysis: {
          requiredSkills: ['complex-skills'],
          complexity: 7,
          description: '需要复杂技能集',
        },
      };
    } else {
      // 自己完成
      return {
        action: 'completed',
        message: 'Leader 已完成',
        result: `(模拟完成): ${task}`,
      };
    }
  }

  /**
   * 进入 Team
   */
  async enterTeam(teamId) {
    return await this.registry.enterTeam(teamId);
  }

  /**
   * 退出当前 Team
   */
  async exitTeam() {
    return await this.registry.exitCurrentTeam();
  }

  /**
   * 列出所有 Teams
   */
  listTeams() {
    this.registry.listTeams();
  }
}
