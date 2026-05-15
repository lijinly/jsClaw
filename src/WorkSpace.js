// ─────────────────────────────────────────────
//  WorkSpace —— 工作空间（无 Team 概念）
// ─────────────────────────────────────────────
import { Member } from './Member.js';
import { Agent } from './agent.js';
import { SystemConfig, getSystemConfig } from './SystemConfig.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * WorkSpace 类 - 工作空间
 *
 * 架构设计：
 * - 用 WorkSpace 代替 Team 概念
 * - WorkSpace 直接管理多个 Member
 * - 默认有一个 defaultMember 作为管理者和执行者
 * - 多个 Member 可在管理者协调下并行/协作工作
 *
 * 职责：
 * 1. 管理 Members 的生命周期
 * 2. 协调多个 Member 执行任务
 * 3. 默认使用 defaultMember 执行简单任务
 * 4. 复杂任务可分发给多个 Member 协作
 */
export class WorkSpace {
  /**
   * @param {object} options - 配置选项
   * @param {string} [options.id='default'] - WorkSpace ID
   * @param {string} [options.name='默认工作空间'] - WorkSpace 名称
   * @param {string} [options.configPath] - 配置文件路径（兼容旧配置）
   * @param {object} [options.defaultMemberConfig] - 默认 Member 配置
   * @param {SystemConfig} [options.systemConfig] - 系统配置实例
   */
  constructor(options = {}) {
    this.id = options.id || 'default';
    this.name = options.name || '默认工作空间';
    this.description = options.description || '';
    this.configPath = options.configPath || null;

    // 系统配置
    this.systemConfig = options.systemConfig || getSystemConfig();

    // Members 集合: id -> Member
    this.members = new Map();

    // 默认 Member（管理者/执行者）
    this.defaultMember = null;

    // 当前活跃 Member（执行任务的 Member）
    this.activeMemberId = null;

    // 配置
    this.config = null;
  }

  /**
   * 初始化 WorkSpace
   * 加载配置并创建 Members
   */
  async initialize() {
    console.log(`\n🚀 WorkSpace 初始化中: ${this.name}`);
    console.log('─'.repeat(50));

    // 优先使用 SystemConfig 加载配置
    const workspaceConfig = this.systemConfig.getWorkspace(this.id);
    const membersFromConfig = this.systemConfig.getWorkspaceMembers(this.id);

    if (membersFromConfig.length > 0) {
      // 使用 SystemConfig 中的成员配置
      for (const memberConfig of membersFromConfig) {
        await this.addMember(memberConfig);
      }
    } else {
      // 降级：使用旧的配置文件方式
      this.config = this.loadConfig();
      await this.createDefaultMember();
      if (this.config?.members) {
        for (const memberConfig of Object.values(this.config.members)) {
          await this.addMember(memberConfig);
        }
      }
    }

    console.log('─'.repeat(50));
    console.log(`✅ 初始化完成: ${this.members.size} 个 Member(s)`);
    console.log('');

    // 列出所有 Members
    this.listMembers();
  }

  /**
   * 加载配置文件
   */
  loadConfig() {
    try {
      if (existsSync(this.configPath)) {
        const configData = readFileSync(this.configPath, 'utf-8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.warn(`⚠️ 配置加载失败: ${error.message}`);
    }
    return { members: {} };
  }

  /**
   * 创建默认 Member（管理者/执行者）
   */
  async createDefaultMember() {
    const defaultConfig = this.config?.defaultMember || {
      id: 'default',
      name: '管理者',
      role: '工作空间管理者和执行者',
      skills: [],
    };

    this.defaultMember = new Member(defaultConfig.id, {
      role: defaultConfig.role || '管理者',
      skills: defaultConfig.skills || [],
      name: defaultConfig.name,
    });

    this.members.set(defaultConfig.id, this.defaultMember);
    console.log(`✓ 默认 Member 创建: ${this.defaultMember.name} (${this.defaultMember.id})`);
  }

  /**
   * 添加 Member 到 WorkSpace
   * @param {object} memberConfig - Member 配置
   * @param {string} memberConfig.id - Member ID
   * @param {string} memberConfig.name - Member 名称
   * @param {string} memberConfig.role - Member 角色
   * @param {Array} [memberConfig.skills] - Member 技能列表
   * @returns {Promise<Member>} 创建的 Member 实例
   */
  async addMember(memberConfig) {
    if (this.members.has(memberConfig.id)) {
      console.warn(`⚠️ Member 已存在: ${memberConfig.id}`);
      return this.members.get(memberConfig.id);
    }

    const member = new Member(memberConfig.id, {
      role: memberConfig.role || '成员',
      skills: memberConfig.skills || [],
      name: memberConfig.name,
    });

    this.members.set(memberConfig.id, member);
    console.log(`✓ Member 添加: ${member.name || memberConfig.role} (${member.id})`);

    return member;
  }

  /**
   * 从 WorkSpace 移除 Member
   * @param {string} memberId - Member ID
   * @returns {boolean} 是否成功移除
   */
  removeMember(memberId) {
    if (memberId === 'default') {
      console.warn(`⚠️ 不能移除默认 Member`);
      return false;
    }

    if (!this.members.has(memberId)) {
      console.warn(`⚠️ Member 不存在: ${memberId}`);
      return false;
    }

    const member = this.members.get(memberId);
    this.members.delete(memberId);
    console.log(`✓ Member 移除: ${member.name || memberId}`);

    // 清理活跃状态
    if (this.activeMemberId === memberId) {
      this.activeMemberId = null;
    }

    return true;
  }

  /**
   * 提交任务（统一接口）
   *
   * 任务路由逻辑：
   * - 指定 memberId → 交给指定 Member
   * - 指定 memberIds → 多个 Member 协作
   * - 不指定 → 交给 defaultMember（默认）
   *
   * @param {object|string} task - 任务对象或任务描述
   * @param {string} [task.description] - 任务描述
   * @param {string} [task.memberId] - 指定 Member ID
   * @param {Array<string>} [task.memberIds] - 多个 Member ID（协作执行）
   * @param {object} [task.options] - 执行选项
   * @returns {Promise<object>} 任务执行结果
   */
  async submitTask(task) {
    // 如果 task 是字符串，转换为对象格式
    const taskObj = typeof task === 'string' ? { description: task } : task;
    const { description, memberId, memberIds, options = {} } = taskObj;

    // 确定执行者
    if (memberIds && memberIds.length > 0) {
      // 多 Member 协作
      return await this.executeWithMembers(memberIds, description, options);
    } else if (memberId) {
      // 指定 Member
      return await this.executeWithMember(memberId, description, options);
    } else {
      // 默认 Member
      return await this.executeWithMember('default', description, options);
    }
  }

  /**
   * 使用指定 Member 执行任务
   * @param {string} memberId - Member ID
   * @param {string} task - 任务描述
   * @param {object} options - 执行选项
   * @returns {Promise<object>} 任务执行结果
   */
  async executeWithMember(memberId, task, options = {}) {
    const member = this.members.get(memberId);

    if (!member) {
      return {
        success: false,
        error: `Member "${memberId}" 不存在`,
        availableMembers: this.getMemberSummaries(),
      };
    }

    console.log(`\n📋 执行任务: ${member.name || memberId}`);
    if (options.verbose) {
      console.log(`   技能: ${member.getSkillNames().join(', ') || '无'}`);
    }

    this.activeMemberId = memberId;

    try {
      const result = await member.execute(task, {
        ...options,
        verbose: options.verbose || false,
      });

      return {
        success: true,
        executor: 'Member',
        executorName: member.name || memberId,
        memberId: member.id,
        result,
      };
    } catch (error) {
      return {
        success: false,
        executor: 'Member',
        executorName: member.name || memberId,
        memberId: member.id,
        error: error.message,
      };
    }
  }

  /**
   * 多个 Member 协作执行任务
   * @param {Array<string>} memberIds - Member IDs
   * @param {string} task - 任务描述
   * @param {object} options - 执行选项
   * @returns {Promise<object>} 任务执行结果
   */
  async executeWithMembers(memberIds, task, options = {}) {
    console.log(`\n🤝 协作执行任务: ${memberIds.length} 个 Member(s)`);

    const results = [];
    const membersUsed = [];

    for (const memberId of memberIds) {
      const member = this.members.get(memberId);

      if (!member) {
        console.warn(`⚠️ Member 不存在，跳过: ${memberId}`);
        continue;
      }

      console.log(`   → 调用: ${member.name || memberId}`);

      try {
        const result = await member.execute(task, {
          ...options,
          verbose: false,
        });

        results.push({
          memberId,
          memberName: member.name,
          result,
        });
        membersUsed.push(memberId);
      } catch (error) {
        console.error(`   ❌ Member 执行失败: ${error.message}`);
        results.push({
          memberId,
          memberName: member.name,
          error: error.message,
        });
      }
    }

    // 整合结果
    const finalResult = results.length === 1
      ? results[0].result
      : results.map(r => r.result || r.error).join('\n\n');

    return {
      success: true,
      executor: 'Members',
      membersUsed,
      result: finalResult,
      detailedResults: results,
    };
  }

  /**
   * 使用 defaultMember 执行任务
   * @param {string} task - 任务描述
   * @param {object} options - 执行选项
   * @returns {Promise<object>} 任务执行结果
   */
  async executeDefault(task, options = {}) {
    return await this.executeWithMember('default', task, options);
  }

  /**
   * 获取所有 Members
   * @returns {Array<Member>} 所有 Member 实例
   */
  getAllMembers() {
    return Array.from(this.members.values());
  }

  /**
   * 获取指定 Member
   * @param {string} memberId - Member ID
   * @returns {Member|null} Member 实例
   */
  getMember(memberId) {
    return this.members.get(memberId) || null;
  }

  /**
   * 获取默认 Member
   * @returns {Member} 默认 Member
   */
  getDefaultMember() {
    return this.defaultMember;
  }

  /**
   * 获取 Member 概要信息
   * @returns {Array<object>} Member 信息列表
   */
  getMemberSummaries() {
    return this.getAllMembers().map(m => ({
      id: m.id,
      name: m.name,
      role: m.role,
      skills: m.getSkillNames(),
    }));
  }

  /**
   * 列出所有 Members
   */
  listMembers() {
    const members = this.getAllMembers();

    console.log(`\n📋 Members (${members.length}):\n`);

    for (const member of members) {
      const isDefault = member.id === 'default' ? ' [默认]' : '';
      const isActive = member.id === this.activeMemberId ? ' [活跃]' : '';
      const skills = member.getSkillNames().join(', ') || '无';

      console.log(`  ${member.name}${isDefault}${isActive}`);
      console.log(`    ID: ${member.id} | 角色: ${member.role}`);
      console.log(`    技能: ${skills}`);
      console.log('');
    }
  }

  /**
   * 获取 WorkSpace 信息
   * @returns {object} WorkSpace 信息
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      memberCount: this.members.size,
      members: this.getMemberSummaries(),
      defaultMember: this.defaultMember ? {
        id: this.defaultMember.id,
        name: this.defaultMember.name,
        role: this.defaultMember.role,
      } : null,
    };
  }
}
