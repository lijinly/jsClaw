// ─────────────────────────────────────────────
//  WorkSpace —— 工作空间
// ─────────────────────────────────────────────
import { Team } from './Team.js';
import { Agent } from './agent.js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * WorkSpace 类 - 工作空间
 *
 * 职责：
 * 1. 创建 Team 及管理 Team 的生命周期
 * 2. 管理 Teams 的集合和当前 Team 状态
 * 3. 根据任务是否带有 teamId，决定交给指定 Team 或 Agent
 * 4. 返回 Team 或 Agent 完成的结果给用户
 */
export class WorkSpace {
  constructor(configPath = './src/Config.json') {
    this.teams = new Map();  // id -> Team
    this.currentTeamId = null;  // 用户当前所在的 Team（null = Team 外）
    this.configPath = configPath;
    this.defaultAgent = null;  // 默认 Agent（用于非 Team 任务）
  }

  /**
   * 初始化系统
   * 加载配置并创建 Teams
   */
  async initialize() {
    console.log('\n🚀 WorkSpace 初始化中...\n');

    // 加载配置
    const config = this.loadConfig();

    // 创建 Teams
    for (const teamConfig of Object.values(config.teams)) {
      const team = new Team(teamConfig.id, teamConfig);
      this.teams.set(team.id, team);
      console.log(`✓ Team 创建成功: ${team.name} (${team.members.length} members)`);
    }

    console.log(`\n📦 共加载 ${this.teams.size} 个 Teams`);

    // 列出所有 Teams
    this.listTeams();
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
   * @param {object|string} task - 任务对象或任务描述
   * @param {string} [task.description] - 任务描述（如果 task 是字符串，则直接使用）
   * @param {string} [task.teamId] - 指定 Team ID（可选）
   * @returns {Promise<object>} 任务执行结果
   */
  async submitTask(task) {
    // 如果 task 是字符串，转换为对象格式
    const taskObj = typeof task === 'string' ? { description: task } : task;
    const { description, teamId } = taskObj;

    if (teamId) {
      // 有 teamId：交给指定 Team
      return await this.handleTaskWithTeam(teamId, description);
    } else {
      // 没有 teamId：交给 Agent
      return await this.handleTaskWithAgent(description);
    }
  }

  /**
   * 使用指定 Team 处理任务
   * @param {string} teamId - Team ID
   * @param {string} task - 任务描述
   * @returns {Promise<object>} 任务执行结果
   */
  async handleTaskWithTeam(teamId, task) {
    const team = this.teams.get(teamId);

    if (!team) {
      return {
        success: false,
        error: `❌ Team "${teamId}" 不存在`,
        availableTeams: this.getAllTeams().map(t => ({ id: t.id, name: t.name })),
      };
    }

    console.log(`\n📋 提交任务到 Team: ${team.name}`);

    // 如果 Team 未激活，先进入
    if (!team.isActive) {
      await team.enter();
    }

    // 提交任务给 Team
    const result = await team.submitTask(task);

    return {
      success: true,
      executor: 'Team',
      executorName: team.name,
      teamId: team.id,
      result,
    };
  }

  /**
   * 使用 Agent 处理任务
   * @param {string} task - 任务描述
   * @returns {Promise<object>} 任务执行结果
   */
  async handleTaskWithAgent(task) {
    console.log(`\n📋 提交任务到 Agent`);

    // 获取或创建默认 Agent
    if (!this.defaultAgent) {
      this.defaultAgent = new Agent({
        name: 'WorkSpace Agent',
        role: '智能助手',
        verbose: false,
      });
    }

    // 执行任务
    const { result } = await this.defaultAgent.run(task);

    return {
      success: true,
      executor: 'Agent',
      executorName: this.defaultAgent.name,
      result,
    };
  }

  /**
   * 创建新的 Team
   * @param {object} teamConfig - Team 配置
   * @param {string} teamConfig.id - Team ID
   * @param {string} teamConfig.name - Team 名称
   * @param {string} teamConfig.description - Team 描述
   * @param {Array} teamConfig.teamMembers - Members 配置
   * @returns {Promise<Team>} 创建的 Team 实例
   */
  async createTeam(teamConfig) {
    const team = new Team(teamConfig.id, teamConfig);
    await team.initialize();
    this.teams.set(team.id, team);

    console.log(`✓ Team 创建成功: ${team.name} (${team.members.length} members)`);

    return team;
  }

  /**
   * 销毁 Team
   * @param {string} teamId - Team ID
   * @returns {boolean} 是否成功销毁
   */
  destroyTeam(teamId) {
    const team = this.teams.get(teamId);
    if (!team) {
      console.log(`❌ Team 不存在: ${teamId}`);
      return false;
    }

    // 先退出 Team（如果用户在其中）
    if (this.currentTeamId === teamId) {
      team.exit();
      this.currentTeamId = null;
    }

    this.teams.delete(teamId);
    console.log(`✓ Team 已销毁: ${teamId}`);

    return true;
  }

  /**
   * 进入 Team
   * @param {string} teamId - Team ID
   * @returns {Promise<boolean>} 是否成功进入
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
  async exitTeam() {
    if (!this.currentTeamId) {
      console.log('\n📍 你当前不在任何 Team 中');
      return;
    }

    const team = this.teams.get(this.currentTeamId);
    await team.exit();
    this.currentTeamId = null;
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
      console.log(`    Members: ${memberCount} members`);
      console.log(`    能力: ${capabilities}`);
      console.log('');
    }
  }

  /**
   * 获取所有 Teams
   * @returns {Array<Team>} 所有 Team 实例
   */
  getAllTeams() {
    return Array.from(this.teams.values());
  }

  /**
   * 获取指定 Team
   * @param {string} teamId - Team ID
   * @returns {Team|null} Team 实例
   */
  getTeam(teamId) {
    return this.teams.get(teamId);
  }

  /**
   * 获取当前活跃 Team
   * @returns {Team|null} 当前活跃 Team 实例
   */
  getCurrentTeam() {
    if (!this.currentTeamId) {
      return null;
    }
    return this.teams.get(this.currentTeamId);
  }
}
