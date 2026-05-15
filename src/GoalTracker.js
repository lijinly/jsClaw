// ─────────────────────────────────────────────
//  GoalTracker —— 目标保持机制
// ─────────────────────────────────────────────
import { randomUUID } from 'crypto';

/**
 * 目标状态枚举
 */
export const GoalStatus = {
  ACTIVE: 'active',       // 进行中
  COMPLETED: 'completed',   // 已完成
  PAUSED: 'paused',        // 已暂停
  CANCELLED: 'cancelled',  // 已取消
  FAILED: 'failed',        // 失败
};

/**
 * 目标优先级
 */
export const GoalPriority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4,
};

/**
 * GoalTracker - 目标保持机制
 *
 * 功能：
 * 1. 设置和追踪长期目标
 * 2. 目标分解为子目标/检查点
 * 3. 进度追踪和状态管理
 * 4. 生成目标上下文注入 Agent
 * 5. 目标持久化支持
 */
export class GoalTracker {
  /**
   * @param {object} options
   * @param {string}  [options.persistPath]  - 持久化路径（可选）
   * @param {boolean} [options.autoSave=true] - 是否自动保存
   */
  constructor(options = {}) {
    this.goals = new Map();           // goalId -> goal
    this.activeGoalId = null;          // 当前活跃目标ID
    this.goalHistory = [];            // 已完成/取消的目标历史
    this.persistPath = options.persistPath;
    this.autoSave = options.autoSave ?? true;

    // 事件回调
    this._eventListeners = {
      onGoalCreated: [],
      onGoalUpdated: [],
      onGoalCompleted: [],
      onGoalCancelled: [],
    };
  }

  // ═══════════════════════════════════════════
  //  核心API
  // ═══════════════════════════════════════════

  /**
   * 创建新目标
   * @param {string} description - 目标描述
   * @param {object} options - 配置选项
   * @returns {object} 创建的目标
   */
  createGoal(description, options = {}) {
    const goal = {
      id: randomUUID().substring(0, 8),
      description,
      status: GoalStatus.ACTIVE,
      priority: options.priority ?? GoalPriority.NORMAL,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,

      // 子目标/检查点
      checkpoints: [],

      // 进度
      progress: 0,

      // 元数据
      metadata: {
        ...options.metadata,
      },

      // 关联的上下文
      context: {
        achievements: [],    // 已完成的关键结果
        blockers: [],        // 遇到的阻碍
        learnings: [],       // 学到的经验
      },

      // 标签
      tags: options.tags ?? [],
    };

    this.goals.set(goal.id, goal);

    // 如果没有活跃目标，自动设为活跃
    if (!this.activeGoalId) {
      this.activeGoalId = goal.id;
    }

    this._emit('onGoalCreated', goal);
    this._maybeSave();

    return goal;
  }

  /**
   * 设置活跃目标
   * @param {string} goalId - 目标ID
   */
  setActiveGoal(goalId) {
    if (!this.goals.has(goalId)) {
      throw new Error(`目标不存在: ${goalId}`);
    }

    const previousId = this.activeGoalId;
    this.activeGoalId = goalId;

    const goal = this.goals.get(goalId);
    goal.updatedAt = new Date().toISOString();

    this._emit('onGoalUpdated', goal, { previousId });
    this._maybeSave();
  }

  /**
   * 获取活跃目标
   * @returns {object|null}
   */
  getActiveGoal() {
    if (!this.activeGoalId) return null;
    return this.goals.get(this.activeGoalId) || null;
  }

  /**
   * 获取目标
   * @param {string} goalId - 目标ID
   * @returns {object|null}
   */
  getGoal(goalId) {
    return this.goals.get(goalId) || null;
  }

  /**
   * 获取所有目标
   * @param {string} [status] - 按状态过滤
   * @returns {Array}
   */
  getAllGoals(status = null) {
    const all = Array.from(this.goals.values());
    if (status) {
      return all.filter(g => g.status === status);
    }
    return all;
  }

  /**
   * 更新目标进度
   * @param {string} goalId - 目标ID
   * @param {number} progress - 进度 (0-100)
   */
  updateProgress(goalId, progress) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`目标不存在: ${goalId}`);

    goal.progress = Math.min(100, Math.max(0, progress));
    goal.updatedAt = new Date().toISOString();

    // 进度100%自动完成
    if (goal.progress >= 100) {
      this.completeGoal(goalId);
    } else {
      this._emit('onGoalUpdated', goal);
      this._maybeSave();
    }
  }

  /**
   * 添加检查点
   * @param {string} goalId - 目标ID
   * @param {string} checkpoint - 检查点描述
   * @param {object} options - 配置
   * @returns {object} 添加的检查点
   */
  addCheckpoint(goalId, checkpoint, options = {}) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`目标不存在: ${goalId}`);

    const cp = {
      id: randomUUID().substring(0, 8),
      description: checkpoint,
      completed: false,
      completedAt: null,
      result: null,
      ...options,
    };

    goal.checkpoints.push(cp);
    goal.updatedAt = new Date().toISOString();

    this._emit('onGoalUpdated', goal, { checkpointAdded: cp });
    this._maybeSave();

    return cp;
  }

  /**
   * 完成检查点
   * @param {string} goalId - 目标ID
   * @param {string} checkpointId - 检查点ID
   * @param {string} [result] - 执行结果
   */
  completeCheckpoint(goalId, checkpointId, result = null) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`目标不存在: ${goalId}`);

    const checkpoint = goal.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) throw new Error(`检查点不存在: ${checkpointId}`);

    checkpoint.completed = true;
    checkpoint.completedAt = new Date().toISOString();
    checkpoint.result = result;

    goal.updatedAt = new Date().toISOString();

    // 自动更新进度
    const completedCount = goal.checkpoints.filter(cp => cp.completed).length;
    goal.progress = Math.round((completedCount / goal.checkpoints.length) * 100);

    // 检查点全部完成，自动完成目标
    if (goal.progress >= 100) {
      this.completeGoal(goalId);
    } else {
      this._emit('onGoalUpdated', goal, { checkpointCompleted: checkpoint });
      this._maybeSave();
    }
  }

  /**
   * 记录目标成就
   * @param {string} goalId - 目标ID
   * @param {string} achievement - 成就描述
   */
  addAchievement(goalId, achievement) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`目标不存在: ${goalId}`);

    goal.context.achievements.push({
      description: achievement,
      timestamp: new Date().toISOString(),
    });
    goal.updatedAt = new Date().toISOString();

    this._maybeSave();
  }

  /**
   * 记录阻碍
   * @param {string} goalId - 目标ID
   * @param {string} blocker - 阻碍描述
   */
  addBlocker(goalId, blocker) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`目标不存在: ${goalId}`);

    goal.context.blockers.push({
      description: blocker,
      timestamp: new Date().toISOString(),
    });
    goal.updatedAt = new Date().toISOString();

    this._maybeSave();
  }

  /**
   * 完成目标
   * @param {string} goalId - 目标ID
   * @param {object} [result] - 完成结果
   */
  completeGoal(goalId, result = null) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`目标不存在: ${goalId}`);

    goal.status = GoalStatus.COMPLETED;
    goal.progress = 100;
    goal.completedAt = new Date().toISOString();
    goal.updatedAt = new Date().toISOString();
    goal.result = result;

    // 从活跃目标移除
    if (this.activeGoalId === goalId) {
      this.activeGoalId = null;
    }

    // 移到历史
    this.goalHistory.push({ ...goal });

    this._emit('onGoalCompleted', goal);
    this._maybeSave();
  }

  /**
   * 暂停目标
   * @param {string} goalId - 目标ID
   * @param {string} [reason] - 暂停原因
   */
  pauseGoal(goalId, reason = null) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`目标不存在: ${goalId}`);

    goal.status = GoalStatus.PAUSED;
    goal.pauseReason = reason;
    goal.updatedAt = new Date().toISOString();

    if (this.activeGoalId === goalId) {
      this.activeGoalId = null;
    }

    this._emit('onGoalUpdated', goal);
    this._maybeSave();
  }

  /**
   * 恢复目标
   * @param {string} goalId - 目标ID
   */
  resumeGoal(goalId) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`目标不存在: ${goalId}`);

    goal.status = GoalStatus.ACTIVE;
    goal.updatedAt = new Date().toISOString();

    // 设为活跃目标
    this.activeGoalId = goalId;

    this._emit('onGoalUpdated', goal);
    this._maybeSave();
  }

  /**
   * 取消目标
   * @param {string} goalId - 目标ID
   * @param {string} [reason] - 取消原因
   */
  cancelGoal(goalId, reason = null) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`目标不存在: ${goalId}`);

    goal.status = GoalStatus.CANCELLED;
    goal.cancelReason = reason;
    goal.updatedAt = new Date().toISOString();

    if (this.activeGoalId === goalId) {
      this.activeGoalId = null;
    }

    this.goalHistory.push({ ...goal });

    this._emit('onGoalCancelled', goal);
    this._maybeSave();
  }

  /**
   * 删除目标
   * @param {string} goalId - 目标ID
   */
  deleteGoal(goalId) {
    this.goals.delete(goalId);
    if (this.activeGoalId === goalId) {
      this.activeGoalId = null;
    }
    this._maybeSave();
  }

  // ═══════════════════════════════════════════
  //  上下文生成
  // ═══════════════════════════════════════════

  /**
   * 生成目标上下文（注入 Agent system prompt）
   * @param {string} [goalId] - 指定目标ID，默认活跃目标
   * @returns {string} 格式化的上下文字符串
   */
  getGoalContext(goalId = null) {
    const targetGoal = goalId ? this.goals.get(goalId) : this.getActiveGoal();

    if (!targetGoal) {
      return '## 当前目标\n暂无进行中的目标。';
    }

    const checkpointStatus = targetGoal.checkpoints.length > 0
      ? targetGoal.checkpoints.map(cp =>
          `- [${cp.completed ? '✓' : ' '}] ${cp.description}`
        ).join('\n')
      : '无子目标';

    const recentAchievements = targetGoal.context.achievements.slice(-3);
    const achievementsText = recentAchievements.length > 0
      ? recentAchievements.map(a => `- ${a.description}`).join('\n')
      : '暂无';

    const context = `
## 当前目标
- **目标**: ${targetGoal.description}
- **优先级**: ${this._priorityLabel(targetGoal.priority)}
- **进度**: ${targetGoal.progress}%
- **状态**: ${this._statusLabel(targetGoal.status)}
${targetGoal.tags.length > 0 ? `- **标签**: ${targetGoal.tags.join(', ')}` : ''}

### 检查点
${checkpointStatus}

### 近期成就
${achievementsText}

### 注意事项
${targetGoal.context.blockers.length > 0
  ? `⚠️ 当前阻碍:\n${targetGoal.context.blockers.map(b => `- ${b.description}`).join('\n')}`
  : '暂无记录阻碍。'}`;

    return context;
  }

  /**
   * 生成简短目标摘要（用于日志）
   * @param {string} [goalId] - 目标ID
   * @returns {string}
   */
  getGoalSummary(goalId = null) {
    const goal = goalId ? this.goals.get(goalId) : this.getActiveGoal();
    if (!goal) return '无活跃目标';

    return `[${goal.id}] ${goal.description} (${goal.progress}%)`;
  }

  // ═══════════════════════════════════════════
  //  事件系统
  // ═══════════════════════════════════════════

  /**
   * 注册事件监听器
   * @param {string} event - 事件名
   * @param {function} callback - 回调
   */
  on(event, callback) {
    if (this._eventListeners[event]) {
      this._eventListeners[event].push(callback);
    }
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名
   * @param {function} callback - 回调
   */
  off(event, callback) {
    if (this._eventListeners[event]) {
      this._eventListeners[event] = this._eventListeners[event]
        .filter(cb => cb !== callback);
    }
  }

  _emit(event, ...args) {
    if (this._eventListeners[event]) {
      this._eventListeners[event].forEach(cb => cb(...args));
    }
  }

  // ═══════════════════════════════════════════
  //  持久化
  // ═══════════════════════════════════════════

  /**
   * 导出数据
   * @returns {object}
   */
  export() {
    return {
      goals: Array.from(this.goals.values()),
      activeGoalId: this.activeGoalId,
      goalHistory: this.goalHistory,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * 导入数据
   * @param {object} data
   */
  import(data) {
    if (data.goals) {
      this.goals = new Map(data.goals.map(g => [g.id, g]));
    }
    this.activeGoalId = data.activeGoalId;
    this.goalHistory = data.goalHistory || [];
  }

  async save() {
    if (!this.persistPath) return;

    const { writeFileSync } = await import('fs');
    const data = JSON.stringify(this.export(), null, 2);
    writeFileSync(this.persistPath, data, 'utf-8');
  }

  async load() {
    if (!this.persistPath) return;

    try {
      const { readFileSync } = await import('fs');
      const data = readFileSync(this.persistPath, 'utf-8');
      this.import(JSON.parse(data));
    } catch (e) {
      // 文件不存在或解析失败，忽略
    }
  }

  _maybeSave() {
    if (this.autoSave && this.persistPath) {
      this.save().catch(console.error);
    }
  }

  // ═══════════════════════════════════════════
  //  辅助方法
  // ═══════════════════════════════════════════

  _priorityLabel(priority) {
    const labels = {
      [GoalPriority.LOW]: '低',
      [GoalPriority.NORMAL]: '普通',
      [GoalPriority.HIGH]: '高',
      [GoalPriority.CRITICAL]: '紧急',
    };
    return labels[priority] || '未知';
  }

  _statusLabel(status) {
    const labels = {
      [GoalStatus.ACTIVE]: '进行中',
      [GoalStatus.COMPLETED]: '已完成',
      [GoalStatus.PAUSED]: '已暂停',
      [GoalStatus.CANCELLED]: '已取消',
      [GoalStatus.FAILED]: '失败',
    };
    return labels[status] || '未知';
  }
}

/**
 * 便捷函数：创建默认配置的GoalTracker
 */
export function createGoalTracker(options = {}) {
  return new GoalTracker(options);
}
