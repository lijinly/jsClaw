// ─────────────────────────────────────────────
//  WorkSpace —— 工作空间（物理实例）
//
//  每个 Workspace 对应一个物理目录，拥有独立 Manager 和 Session 列表。
//  由 Zone 统一管理生命周期（创建/加载/关闭/删除）。
//
//  目录结构：
//  <workspace-path>/
//  ├── .workspace/
//  │   └── sessions/
//  │       └── ws-{id}-s-{sessionId}.json
//  └── .memory/          ← WorkspaceMemory
// ─────────────────────────────────────────────
import { Member } from './Member.js';
import { Manager } from './Manager.js';
import { Config, getConfig } from './Config.js';
import { WorkspaceMemory } from './Memory.js';
import { Session } from './Session.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * WorkSpace 类 - 工作空间
 *
 * 架构设计：
 * - WorkSpace 直接管理多个 Member
 * - 初始化时自动创建默认 Manager（协调者/执行者）
 * - 多个 Member 可在 Manager 协调下并行/协作工作
 * - 自动加载工作空间记忆到 system prompt
 *
 * 职责：
 * 1. 管理 Members 的生命周期
 * 2. 协调多个 Member 执行任务
 * 3. 默认使用 default Manager 执行任务
 * 4. 复杂任务可分发给多个 Member 协作
 * 5. 管理工作空间记忆
 */
export class WorkSpace {
  /**
   * @param {object} options - 配置选项
   * @param {string} [options.id='default'] - WorkSpace ID
   * @param {string} [options.name='默认工作空间'] - WorkSpace 名称
   * @param {string} [options.configPath] - 配置文件路径（兼容旧配置）
   * @param {Config} [options.config] - 系统配置实例
   */
  constructor(options = {}) {
    this.id = options.id || 'default';
    this.name = options.name || '默认工作空间';
    this.description = options.description || '';
    this.configPath = options.configPath || null;

    // ── 物理路径 ──────────────────────────────
    // Zone.createWorkspace / loadWorkspace 传入，指向物理目录
    this.path = options.path || null;
    this.sessionsDir = this.path
      ? join(this.path, '.workspace', 'sessions')
      : null;

    // 系统配置
    this.config = options.config || getConfig();

    // Members 集合: id -> Member
    this.members = new Map();

    // 默认 Member（管理者/执行者）
    this.defaultMember = null;

    // 当前活跃 Member（执行任务的 Member）
    this.activeMemberId = null;

    // 工作空间记忆
    this.memory = null;
    this.memoryDir = null;

    // ── Session 集合 ─────────────────────────
    this._sessions = new Map();
  }

  /**
   * 初始化 WorkSpace
   * 确保物理目录结构，加载记忆，创建 Members，恢复 Sessions
   */
  async initialize() {
    console.log(`\n🚀 WorkSpace 初始化中: ${this.name}`);
    console.log('─'.repeat(50));

    // ── 1. 确保物理目录结构 ─────────────────
    if (this.path) {
      const dirs = [
        this.path,
        join(this.path, '.workspace'),
        this.sessionsDir,
        join(this.path, '.memory'),
      ];
      for (const dir of dirs) {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      }
    }

    // ── 2. 加载工作空间记忆 ───────────────────
    this._initializeMemory();

    // ── 3. 加载 Members ──────────────────────
    const workspaceConfig = this.config.getWorkspace(this.id);
    const membersFromConfig = this.config.getWorkspaceMembers(this.id);

    if (membersFromConfig.length > 0) {
      for (const memberConfig of membersFromConfig) {
        await this.addMember(memberConfig);
      }
    }

    if (this.members.size === 0) {
      await this.createDefaultManager();
    }

    // ── 4. 恢复 Sessions ─────────────────────
    await this._restoreSessions();

    console.log('─'.repeat(50));
    console.log(`✅ 初始化完成: ${this.members.size} 个 Member(s)`);
    if (this.memory) {
      console.log(`   记忆: ${this.memory.getCount()} 条已加载`);
    }
    console.log(`   Session(s): ${this._sessions.size} 个已恢复`);
    console.log('');

    // 列出所有 Members
    this.listMembers();
  }

  /**
   * 初始化工作空间记忆
   * @private
   */
  _initializeMemory() {
    // 从 Config 获取记忆目录
    this.memoryDir = this.config.getWorkspaceMemoryPath(this.id);
    
    if (this.memoryDir) {
      this.memory = new WorkspaceMemory(this.memoryDir);
      this.memory.load();
    }
  }

  /**
   * 获取工作空间记忆
   * @returns {WorkspaceMemory|null}
   */
  getMemory() {
    return this.memory;
  }

  /**
   * 获取用于 system prompt 的记忆内容
   * @returns {string}
   */
  getMemoryForPrompt() {
    if (!this.memory) return '';
    return this.memory.getForSystemPrompt();
  }

  /**
   * 保存内容为工作空间记忆
   * @param {string} content - 记忆内容
   * @param {object} options - 选项
   * @param {string} [options.filename] - 文件名
   * @param {string} [options.category='general'] - 分类
   */
  saveMemory(content, options = {}) {
    if (!this.memory) {
      console.warn('⚠️ 工作空间记忆未初始化');
      return;
    }
    this.memory.distill(content, options);
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
   * 创建默认 Manager（协调者/执行者）
   * 每个 WorkSpace 初始化时自动创建一个默认 Manager
   */
  async createDefaultManager() {
    const defaultConfig = this.config?.defaultMember || {
      id: 'default',
      name: '协调者',
      identity: '任务协调者和执行者',
      soul: '高效严谨，善于规划',
      skills: [],
    };

    const manager = new Manager({
      id: defaultConfig.id,
      config: {
        name: defaultConfig.name || '协调者',
        identity: defaultConfig.identity || '任务协调者和执行者',
        soul: defaultConfig.soul || '高效严谨，善于规划',
        skills: defaultConfig.skills || [],
        maxRounds: defaultConfig.maxRounds || 10,
      },
      workspace: this,
      managerConfig: defaultConfig.managerConfig || {},
    });

    this.members.set(defaultConfig.id, manager);
    this.defaultMember = manager;  // 保持兼容，指向同一个 Manager
    console.log(`✓ 默认 Manager 创建: ${manager.name} (${manager.id})`);
    
    return manager;
  }

  /**
   * 添加 Member 到 WorkSpace
   * @param {object} memberConfig - Member 配置
   * @param {string} memberConfig.id - Member ID
   * @param {string} memberConfig.name - Member 名称
   * @param {string} memberConfig.identity - Member 身份描述
   * @param {string} [memberConfig.soul] - Member 性格描述
   * @param {Array} [memberConfig.skills] - Member 技能列表
   * @returns {Promise<Member>} 创建的 Member 实例
   */
  async addMember(memberConfig) {
    if (this.members.has(memberConfig.id)) {
      console.warn(`⚠️ Member 已存在: ${memberConfig.id}`);
      return this.members.get(memberConfig.id);
    }

    const member = new Member(memberConfig.id, {
      name: memberConfig.name || `Member(${memberConfig.id})`,
      identity: memberConfig.identity || memberConfig.role || '成员',
      soul: memberConfig.soul || '',
      skills: memberConfig.skills || [],
    });

    this.members.set(memberConfig.id, member);
    console.log(`✓ Member 添加: ${member.name} (${member.id})`);

    return member;
  }

  /**
   * 添加 Manager 到 WorkSpace
   * Manager 也是 Member，但具有额外的 Goal 协调能力
   *
   * @param {object} managerConfig - Manager 配置
   * @param {string} managerConfig.id - Manager ID
   * @param {string} managerConfig.name - Manager 名称
   * @param {string} [managerConfig.identity] - Manager 身份描述
   * @param {string} [managerConfig.soul] - Manager 性格描述
   * @param {Array<string>} [managerConfig.skills] - Manager 技能列表
   * @param {object} [managerConfig.managerConfig] - Manager 特有配置
   * @returns {Promise<Manager>} 创建的 Manager 实例
   */
  async addManager(managerConfig) {
    const id = managerConfig.id || `manager_${Date.now()}`;

    if (this.members.has(id)) {
      console.warn(`⚠️ Manager 已存在: ${id}`);
      return this.members.get(id);
    }

    const manager = new Manager({
      id,
      config: {
        name: managerConfig.name || `Manager(${id})`,
        identity: managerConfig.identity || '任务协调者',
        soul: managerConfig.soul || '高效严谨，善于规划',
        skills: managerConfig.skills || [],
        maxRounds: managerConfig.maxRounds || 10,
      },
      workspace: this,  // 传入 workspace 引用
      managerConfig: managerConfig.managerConfig || {},
    });

    this.members.set(id, manager);
    console.log(`✓ Manager 添加: ${manager.name} (${manager.id})`);

    return manager;
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
    console.log(`✓ Member 移除: ${member.name}`);

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
   * - 不指定 → 交给 default Manager（默认）
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

    console.log(`\n📋 执行任务: ${member.name}`);
    if (options.verbose) {
      console.log(`   技能: ${member.getSkillNames().join(', ') || '无'}`);
    }

    this.activeMemberId = memberId;

    try {
      // 注入工作空间记忆到选项中
      const promptOptions = {
        ...options,
        verbose: options.verbose || false,
        workspaceMemory: this.getMemoryForPrompt(),
      };

      const result = await member.execute(task, promptOptions);

      return {
        success: true,
        executor: 'Member',
        executorName: member.name,
        memberId: member.id,
        result,
      };
    } catch (error) {
      return {
        success: false,
        executor: 'Member',
        executorName: member.name,
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

      console.log(`   → 调用: ${member.name}`);

      try {
        const result = await member.execute(task, {
          ...options,
          verbose: false,
          workspaceMemory: this.getMemoryForPrompt(),
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
      identity: m.identity,
      type: m instanceof Manager ? 'Manager' : 'Member',
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
      const isManager = member instanceof Manager ? ' [Manager]' : '';
      const skills = member.getSkillNames().join(', ') || '无';

      console.log(`  ${member.name}${isDefault}${isManager}${isActive}`);
      console.log(`    ID: ${member.id} | 身份: ${member.identity}`);
      console.log(`    技能: ${skills}`);
      console.log('');
    }
  }

  /**
   * 获取 WorkSpace 信息
   * @returns {object} WorkSpace 信息
   */
  getInfo() {
    const managers = this.getAllMembers().filter(m => m instanceof Manager);
    const regularMembers = this.getAllMembers().filter(m => !(m instanceof Manager));

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      path: this.path,
      memberCount: this.members.size,
      managerCount: managers.length,
      regularMemberCount: regularMembers.length,
      members: this.getMemberSummaries(),
      managers: managers.map(m => m.getStatus()),
      defaultMember: this.defaultMember ? {
        id: this.defaultMember.id,
        name: this.defaultMember.name,
        identity: this.defaultMember.identity,
      } : null,
      memory: this.memory ? {
        count: this.memory.getCount(),
        dir: this.memoryDir,
      } : null,
      sessionCount: this._sessions.size,
    };
  }

  // ═══════════════════════════════════════════
  //  Session 管理
  //  每个 Session 隶属于本 Workspace，持久化到 .workspace/sessions/
  // ═══════════════════════════════════════════

  /**
   * 从 .workspace/sessions/ 恢复已有 Session
   * @private
   */
  async _restoreSessions() {
    if (!this.sessionsDir || !existsSync(this.sessionsDir)) return;

    try {
      const files = readdirSync(this.sessionsDir)
        .filter(f => f.startsWith(`ws-${this.id}-s-`) && f.endsWith('.json'));

      for (const file of files) {
        try {
          const data = JSON.parse(readFileSync(join(this.sessionsDir, file), 'utf-8'));
          const session = Session.fromFile(data, this.id);

          // 重建 Member 引用（Members 已在此之前加载）
          session.workspace = this;
          session.member = this.getMember(session.memberId)
            || this.getMember('default');

          // 重建 ContextOptimizer
          session.contextManager = null; // 暂时置空，首次 userMessage 时重建

          this._sessions.set(session.id, session);
        } catch (err) {
          console.warn(`⚠️ Session 恢复失败: ${file} — ${err.message}`);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Session 目录读取失败: ${err.message}`);
    }
  }

  /**
   * 创建新 Session（建立与用户的会话）
   * @param {object} [opts]
   * @param {string}  [opts.sessionId]       - Session ID（不填则自动生成）
   * @param {string}  [opts.memberId='default'] - 关联 Member
   * @param {string}  [opts.title]           - 会话标题
   * @param {'member'|'team'} [opts.mode='member']
   * @returns {Session}
   */
  startSession(opts = {}) {
    const sessionId = opts.sessionId || `s-${Date.now()}`;

    if (this._sessions.has(sessionId)) {
      return this._sessions.get(sessionId);
    }

    const session = new Session({
      sessionId,
      memberId: opts.memberId || 'default',
      workspace: this,
    });

    if (opts.title) session.setTitle(opts.title);
    if (opts.mode)  session.setMode(opts.mode);

    this._sessions.set(sessionId, session);
    return session;
  }

  /**
   * 获取 Session（不存在则返回 null）
   * @param {string} sessionId
   * @returns {Session|null}
   */
  getSession(sessionId) {
    return this._sessions.get(sessionId) || null;
  }

  /**
   * 删除 Session（从内存移除，不删除文件）
   * @param {string} sessionId
   * @returns {boolean}
   */
  closeSession(sessionId) {
    return this._sessions.delete(sessionId);
  }

  /**
   * 列出所有 Session 概要
   * @returns {Array<object>}
   */
  listSessions() {
    return Array.from(this._sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(s => s.getSummary());
  }

  // ═══════════════════════════════════════════
  //  持久化
  // ═══════════════════════════════════════════

  /**
   * 保存 Workspace 状态到磁盘
   * - 保存所有活跃 Session
   * - 触发 Zone.closeWorkspace() 调用
   * @returns {Promise<void>}
   */
  async save() {
    let savedCount = 0;
    for (const session of this._sessions.values()) {
      try {
        session.save();
        savedCount++;
      } catch (err) {
        console.warn(`⚠️ Session 保存失败: ${session.id} — ${err.message}`);
      }
    }
    console.log(`✓ Workspace 已保存: ${savedCount} 个 Session`);
  }
}
