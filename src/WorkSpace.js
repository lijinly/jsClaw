// ─────────────────────────────────────────────
//  WorkSpace —— 工作空间
// ─────────────────────────────────────────────
import { TeamRegistry } from './TeamRegistry.js';
import { Team } from './Team.js';
import { Agent } from './agent.js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * WorkSpace 类 - 工作空间
 *
 * 职责：
 * 1. 创建 Team 及管理 Team 的生命周期
 * 2. 根据任务是否带有 teamId，决定交给指定 Team 或 Agent
 * 3. 返回 Team 或 Agent 完成的结果给用户
 */
export class WorkSpace {
  constructor(configPath = './src/TeamConfig.json') {
    this.registry = new TeamRegistry();
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
    const team = this.registry.getTeam(teamId);

    if (!team) {
      return {
        success: false,
        error: `❌ Team "${teamId}" 不存在`,
        availableTeams: this.registry.getAllTeams().map(t => ({ id: t.id, name: t.name })),
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
   * @param {Array} teamConfig.teamMembers - TeamMembers 配置
   * @returns {Promise<Team>} 创建的 Team 实例
   */
  async createTeam(teamConfig) {
    const team = new Team(teamConfig.id, teamConfig);
    await team.initialize();
    this.registry.registerTeam(team);

    console.log(`✓ Team 创建成功: ${team.name} (${team.members.length} Members)`);

    return team;
  }

  /**
   * 销毁 Team
   * @param {string} teamId - Team ID
   */
  destroyTeam(teamId) {
    const success = this.registry.unregisterTeam(teamId);

    if (success) {
      console.log(`✓ Team 已销毁: ${teamId}`);
    } else {
      console.log(`❌ Team 不存在: ${teamId}`);
    }

    return success;
  }

  /**
   * 进入 Team
   * @param {string} teamId - Team ID
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

  /**
   * 获取所有 Teams
   * @returns {Array<Team>} 所有 Team 实例
   */
  getAllTeams() {
    return this.registry.getAllTeams();
  }

  /**
   * 获取指定 Team
   * @param {string} teamId - Team ID
   * @returns {Team|null} Team 实例
   */
  getTeam(teamId) {
    return this.registry.getTeam(teamId);
  }

  /**
   * 获取当前活跃 Team
   * @returns {Team|null} 当前活跃 Team 实例
   */
  getCurrentTeam() {
    return this.registry.getCurrentTeam();
  }
}
