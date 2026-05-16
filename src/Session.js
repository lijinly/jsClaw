// ─────────────────────────────────────────────
//  Session —— 会话上下文管理器
//  关联 Member，管理对话历史 + 上下文裁剪 + 文件持久化
// ─────────────────────────────────────────────
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { ContextOptimizer } from './ContextOptimizer.js';

/**
 * Session —— 用户会话上下文
 *
 * 核心职责：
 * 1. 管理用户 ↔ Member 的对话历史
 * 2. 管理 Member ↔ Manager 的内部协作记录
 * 3. 关联到 WorkSpace 中的指定 Member
 * 4. 集成 ContextOptimizer（上下文裁剪）
 *
 * @example
 * const session = new Session({
 *   sessionId: 'user-123-session-456',
 *   memberId: 'coder',
 *   workspace,
 * });
 *
 * const result = await session.userMessage('帮我写一个函数');
 */
export class Session {
  /**
   * @param {object} options
   * @param {string}  options.sessionId           - 会话唯一ID
   * @param {string}  options.memberId           - 关联的 Member ID
   * @param {object}  options.workspace          - WorkSpace 实例
   * @param {object}  [options.contextManager]  - ContextOptimizer 配置
   */
  constructor(options) {
    this.id = options.sessionId;
    this.memberId = options.memberId;
    this.workspace = options.workspace;

    // 获取关联的 Member
    this.member = this.workspace.getMember(options.memberId);
    if (!this.member) {
      console.warn(`[Session:${this.id}] ⚠️ Member 不存在: ${options.memberId}，使用 default`);
      this.member = this.workspace.getMember('default');
    }

    // 元数据
    this.title = '新会话';
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.mode = 'member';  // 'member' | 'team'

    // ── 对话历史 ────────────────────────────────
    // 用户 ↔ Member 的对话记录
    this.chatHistory = [];

    // Member ↔ Manager 的内部协作记录
    this.internalHistory = [];

    // 完整的消息列表（用于展示）
    this.messages = [];

    // ── 上下文裁剪 ──────────────────────────────
    this.contextManager = new ContextOptimizer({
      maxTokens: options.contextManager?.maxTokens ?? 6000,
      preserveRecent: options.contextManager?.preserveRecent ?? 4,
      ...options.contextManager,
    });
  }

  // ═══════════════════════════════════════════
  //  核心 API
  // ═══════════════════════════════════════════

  /**
   * 处理用户消息
   * @param {string} content - 用户输入
   * @param {object} options - 选项
   * @param {boolean} [options.verbose] - 详细日志
   * @returns {Promise<object>} 执行结果
   */
  async userMessage(content, options = {}) {
    const userMsg = {
      role: 'user',
      content,
      ts: Date.now(),
    };
    this.messages.push(userMsg);
    this.chatHistory.push({ role: 'user', content });

    // 首条消息自动命名
    if (this.chatHistory.filter(m => m.role === 'user').length === 1) {
      this.title = this._autoTitle(content);
    }

    this.updatedAt = Date.now();

    const assistantMsg = {
      role: 'assistant',
      content: '',
      thinking: null,
      toolCalls: [],
      executor: this.member?.name || 'Member',
      ts: Date.now(),
    };

    try {
      // 使用 Member 执行
      const result = await this.member.execute(content, {
        history: this._getPrunedHistory(),
        verbose: options.verbose || false,
        workspaceMemory: this.workspace.getMemoryForPrompt(),
      });

      // 记录结果
      if (result.thinking) {
        assistantMsg.thinking = result.thinking;
      }
      if (result.actions) {
        for (const action of result.actions) {
          for (const call of action.calls || []) {
            assistantMsg.toolCalls.push({
              name: call.function.name,
              args: call.function.arguments,
            });
          }
        }
      }

      assistantMsg.content = result.result || '';

      // 记录到对话历史
      this.chatHistory.push({ role: 'assistant', content: assistantMsg.content });
      this.messages.push(assistantMsg);

      // 记录内部协作（如果有）
      if (result.internalLogs) {
        this.internalHistory.push(...result.internalLogs);
      }

      this.updatedAt = Date.now();

      // 自动保存会话状态到磁盘
      try {
        this.save();
      } catch (err) {
        console.warn(`[Session:${this.id}] ⚠️ 自动保存失败: ${err.message}`);
      }

      return result;

    } catch (error) {
      // 出错时也尝试保存，以便恢复错误状态
      try { this.save(); } catch (_) {}
      assistantMsg.content = `执行出错: ${error.message}`;
      this.messages.push(assistantMsg);
      throw error;
    }
  }

  /**
   * 获取裁剪后的历史
   * @private
   */
  _getPrunedHistory() {
    return this.contextManager.prune(this.chatHistory);
  }

  /**
   * 自动生成标题
   * @private
   */
  _autoTitle(text) {
    return text.length > 20 ? text.slice(0, 20) + '…' : text;
  }

  // ═══════════════════════════════════════════
  //  内部协作记录（Member ↔ Manager）
  // ═══════════════════════════════════════════

  /**
   * 记录内部协作日志
   * @param {object} log - 协作日志
   */
  addInternalLog(log) {
    this.internalHistory.push({
      ...log,
      ts: Date.now(),
    });
  }

  /**
   * 获取内部协作记录
   * @returns {Array}
   */
  getInternalHistory() {
    return this.internalHistory;
  }

  // ═══════════════════════════════════════════
  //  上下文裁剪
  // ═══════════════════════════════════════════

  /**
   * 手动触发上下文裁剪
   * @returns {Array} 裁剪后的历史
   */
  pruneHistory() {
    const pruned = this._getPrunedHistory();
    return pruned;
  }

  /**
   * 获取上下文统计
   * @returns {object}
   */
  getContextStats() {
    return {
      ...this.contextManager.getStats(),
      messageCount: this.messages.length,
      chatHistoryCount: this.chatHistory.length,
      internalHistoryCount: this.internalHistory.length,
    };
  }

  /**
   * 估算当前 token 数
   * @returns {number}
   */
  estimateTokens() {
    return this.contextManager.estimateTokens(this.chatHistory);
  }

  // ═══════════════════════════════════════════
  //  元数据管理
  // ═══════════════════════════════════════════

  /**
   * 设置标题
   * @param {string} title
   */
  setTitle(title) {
    this.title = title;
    this.updatedAt = Date.now();
  }

  /**
   * 设置模式
   * @param {'member'|'team'} mode
   */
  setMode(mode) {
    this.mode = mode;
    this.updatedAt = Date.now();
  }

  /**
   * 切换 Member
   * @param {string} memberId
   */
  switchMember(memberId) {
    const member = this.workspace.getMember(memberId);
    if (!member) {
      console.warn(`[Session:${this.id}] ⚠️ Member 不存在: ${memberId}`);
      return false;
    }
    this.memberId = memberId;
    this.member = member;
    this.updatedAt = Date.now();
    return true;
  }

  // ═══════════════════════════════════════════
  //  序列化
  // ═══════════════════════════════════════════

  /**
   * 获取会话摘要（用于列表展示）
   * @returns {object}
   */
  getSummary() {
    return {
      id: this.id,
      title: this.title,
      memberId: this.memberId,
      memberName: this.member?.name || '未知',
      mode: this.mode,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      messageCount: this.messages.length,
      preview: this.messages.findLast(m => m.role === 'assistant')?.content?.slice(0, 60) || '',
    };
  }

  /**
   * 获取完整信息
   * @returns {object}
   */
  getDetail() {
    return {
      ...this.getSummary(),
      messages: this.messages,
      internalHistory: this.internalHistory,
      contextStats: this.getContextStats(),
    };
  }

  // ═══════════════════════════════════════════
  //  文件持久化
  //  路径: <workspace-path>/.workspace/sessions/ws-{workspaceId}-s-{sessionId}.json
  // ═══════════════════════════════════════════

  /**
   * 获取会话文件路径
   * @returns {string} 绝对路径
   */
  getFilePath() {
    const baseDir = this.workspace?.sessionsDir || '.workspace/sessions';
    return join(baseDir, `ws-${this.workspace?.id || 'unknown'}-s-${this.id}.json`);
  }

  /**
   * 保存会话到磁盘
   * 自动创建父目录，返回写入的字节数
   * @returns {number} 写入字节数
   */
  save() {
    const filePath = this.getFilePath();
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // 只序列化核心状态（不含运行时对象引用）
    const payload = {
      id: this.id,
      title: this.title,
      memberId: this.memberId,
      mode: this.mode,
      createdAt: this.createdAt,
      updatedAt: Date.now(),
      messages: this.messages,
      internalHistory: this.internalHistory,
      chatHistory: this.chatHistory,
    };

    writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return payload.updatedAt;
  }

  /**
   * 从磁盘数据恢复会话实例
   * 注意：恢复后 caller 需重新设置 workspace / member 引用
   *
   * @static
   * @param {object} data        - load() 返回的原始 JSON 对象
   * @param {string} workspaceId - 所属 workspace ID（用于日志标识）
   * @returns {Session}          - 临时会话实例（无 workspace 引用）
   */
  static fromFile(data, workspaceId = '?') {
    const tempSession = Object.create(Session.prototype);
    Object.assign(tempSession, {
      id: data.id,
      title: data.title || '新会话',
      memberId: data.memberId || 'default',
      workspace: null,          // caller 负责填充
      member: null,             // caller 负责填充
      mode: data.mode || 'member',
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now(),
      messages: data.messages || [],
      internalHistory: data.internalHistory || [],
      chatHistory: data.chatHistory || [],
      contextManager: null,      // caller 负责重建
    });
    return tempSession;
  }
}

