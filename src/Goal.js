// ─────────────────────────────────────────────
//  Goal —— 统一 DAG 目标管理
//
//  架构：
//  - Goal 是唯一的 DAG 节点类型
//  - Goal 持有 children[] (子 Goal 节点)
//  - 叶子节点持有 tasks[] (实际执行的任务)
//  - 支持无限层级嵌套
// ─────────────────────────────────────────────
import { randomUUID } from 'crypto';
import { Task, TaskStatus } from './Task.js';

/**
 * GoalTracker 优先级
 */
export const GoalPriority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4,
};

/**
 * Goal 节点状态
 * 对应原 SubGoalStatus
 */
export const GoalStatus = {
  PENDING: 'pending',         // 待执行（等待依赖）
  READY: 'ready',            // 可执行（依赖已满足）
  IN_PROGRESS: 'in_progress', // 执行中
  COMPLETED: 'completed',    // 已完成
  FAILED: 'failed',         // 失败
};

// 保留别名以保持向后兼容
export const SubGoalStatus = GoalStatus;

// ─────────────────────────────────────────────
//  GoalTracker —— 目标追踪器
// ─────────────────────────────────────────────

/**
 * 追踪目标的数据结构
 * @typedef {Object} TrackedGoal
 * @property {string} id - 目标ID
 * @property {string} description - 目标描述
 * @property {number} priority - 优先级
 * @property {string} status - 状态
 * @property {number} progress - 进度 (0-100)
 * @property {Array} checkpoints - 检查点列表
 * @property {object} context - 上下文信息
 * @property {Array} context.achievements - 成就列表
 * @property {Array} context.blockers - 阻碍列表
 * @property {Array} tags - 标签
 * @property {string} createdAt - 创建时间
 * @property {string} completedAt - 完成时间
 */

/**
 * GoalTracker 类 —— 目标追踪器
 *
 * 用于在 Agent 运行时追踪和管理目标
 *
 * @example
 * const tracker = new GoalTracker();
 * const goal = tracker.createGoal('完成量化策略开发', { priority: GoalPriority.HIGH });
 * tracker.addCheckpoint(goal.id, '完成数据采集');
 * tracker.completeCheckpoint(goal.id, checkpointId);
 * const context = tracker.getGoalContext();
 */
export class GoalTracker {
  /**
   * @param {object} options
   * @param {string} [options.persistPath] - 持久化路径
   * @param {boolean} [options.autoSave=true] - 自动保存
   */
  constructor(options = {}) {
    this.persistPath = options.persistPath || null;
    this.autoSave = options.autoSave ?? true;

    /** @type {Map<string, TrackedGoal>} */
    this.goals = new Map();

    /** @type {Array<TrackedGoal>} */
    this.goalHistory = [];

    /** @type {string|null} */
    this.activeGoalId = null;

    /** @type {Map<string, Function>} */
    this._eventListeners = new Map();
  }

  // ═══════════════════════════════════════════
  //  基础 CRUD
  // ═══════════════════════════════════════════

  /**
   * 创建新目标
   * @param {string} description - 目标描述
   * @param {object} options - 配置选项
   * @param {number} [options.priority=GoalPriority.NORMAL] - 优先级
   * @param {Array<string>} [options.tags=[]] - 标签
   * @returns {TrackedGoal}
   */
  createGoal(description, options = {}) {
    const goal = {
      id: randomUUID().substring(0, 8),
      description,
      priority: options.priority || GoalPriority.NORMAL,
      status: 'active',
      progress: 0,
      checkpoints: [],
      context: {
        achievements: [],
        blockers: [],
      },
      tags: options.tags || [],
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    this.goals.set(goal.id, goal);
    this.activeGoalId = goal.id;

    this._emit('onGoalCreated', goal);
    return goal;
  }

  /**
   * 获取目标
   * @param {string} goalId - 目标ID
   * @returns {TrackedGoal|null}
   */
  getGoal(goalId) {
    return this.goals.get(goalId) || null;
  }

  /**
   * 获取所有目标
   * @returns {Array<TrackedGoal>}
   */
  getAllGoals() {
    return Array.from(this.goals.values());
  }

  /**
   * 获取活跃目标
   * @returns {TrackedGoal|null}
   */
  getActiveGoal() {
    if (!this.activeGoalId) return null;
    return this.goals.get(this.activeGoalId) || null;
  }

  /**
   * 设置活跃目标
   * @param {string} goalId - 目标ID
   */
  setActiveGoal(goalId) {
    if (this.goals.has(goalId)) {
      this.activeGoalId = goalId;
      this._emit('onGoalUpdated', this.getGoal(goalId));
    }
  }

  /**
   * 删除目标
   * @param {string} goalId - 目标ID
   */
  deleteGoal(goalId) {
    this.goals.delete(goalId);
    if (this.activeGoalId === goalId) {
      this.activeGoalId = this.goals.keys().next().value || null;
    }
  }

  /**
   * 完成目标
   * @param {string} goalId - 目标ID
   * @param {string} [note] - 完成备注
   */
  completeGoal(goalId, note = '') {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    goal.status = 'completed';
    goal.progress = 100;
    goal.completedAt = new Date().toISOString();

    if (note) {
      goal.context.achievements.push({
        description: note,
        timestamp: goal.completedAt,
      });
    }

    // 移到历史
    this.goals.delete(goalId);
    this.goalHistory.push(goal);

    // 更新活跃目标
    if (this.activeGoalId === goalId) {
      this.activeGoalId = this.goals.keys().next().value || null;
    }

    this._emit('onGoalCompleted', goal);
    this._autoSave();
  }

  // ═══════════════════════════════════════════
  //  检查点管理
  // ═══════════════════════════════════════════

  /**
   * 添加检查点
   * @param {string} goalId - 目标ID
   * @param {string} description - 检查点描述
   * @returns {object}
   */
  addCheckpoint(goalId, description) {
    const goal = this.goals.get(goalId);
    if (!goal) return null;

    const checkpoint = {
      id: randomUUID().substring(0, 8),
      description,
      status: 'pending',
      completedAt: null,
      note: '',
    };

    goal.checkpoints.push(checkpoint);
    this._emit('onGoalUpdated', goal);
    this._autoSave();

    return checkpoint;
  }

  /**
   * 完成检查点
   * @param {string} goalId - 目标ID
   * @param {string} checkpointId - 检查点ID
   * @param {string} [note] - 完成备注
   */
  completeCheckpoint(goalId, checkpointId, note = '') {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    const checkpoint = goal.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) return;

    checkpoint.status = 'completed';
    checkpoint.completedAt = new Date().toISOString();
    checkpoint.note = note;

    if (note) {
      goal.context.achievements.push({
        description: note,
        timestamp: checkpoint.completedAt,
      });
    }

    // 更新进度
    const completed = goal.checkpoints.filter(cp => cp.status === 'completed').length;
    goal.progress = Math.round((completed / goal.checkpoints.length) * 100);

    this._emit('onGoalUpdated', goal);
    this._autoSave();
  }

  /**
   * 获取检查点
   * @param {string} goalId - 目标ID
   * @returns {Array}
   */
  getCheckpoints(goalId) {
    const goal = this.goals.get(goalId);
    return goal ? goal.checkpoints : [];
  }

  // ═══════════════════════════════════════════
  //  上下文管理
  // ═══════════════════════════════════════════

  /**
   * 添加成就
   * @param {string} goalId - 目标ID
   * @param {string} achievement - 成就描述
   */
  addAchievement(goalId, achievement) {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    goal.context.achievements.push({
      description: achievement,
      timestamp: new Date().toISOString(),
    });

    this._emit('onGoalUpdated', goal);
    this._autoSave();
  }

  /**
   * 添加阻碍
   * @param {string} goalId - 目标ID
   * @param {string} blocker - 阻碍描述
   */
  addBlocker(goalId, blocker) {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    goal.context.blockers.push({
      description: blocker,
      timestamp: new Date().toISOString(),
    });

    this._emit('onGoalUpdated', goal);
    this._autoSave();
  }

  /**
   * 清除阻碍
   * @param {string} goalId - 目标ID
   * @param {number} index - 阻碍索引
   */
  clearBlocker(goalId, index) {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    goal.context.blockers.splice(index, 1);
    this._emit('onGoalUpdated', goal);
    this._autoSave();
  }

  /**
   * 更新目标进度
   * @param {string} goalId - 目标ID
   * @param {number} progress - 进度 (0-100)
   */
  updateProgress(goalId, progress) {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    goal.progress = Math.max(0, Math.min(100, progress));
    this._emit('onGoalUpdated', goal);
    this._autoSave();
  }

  // ═══════════════════════════════════════════
  //  上下文生成
  // ═══════════════════════════════════════════

  /**
   * 获取目标上下文（用于注入到 system prompt）
   * @param {string} [goalId] - 指定目标ID（默认使用活跃目标）
   * @returns {string}
   */
  getGoalContext(goalId = null) {
    const goal = goalId ? this.goals.get(goalId) : this.getActiveGoal();
    if (!goal) return '';

    const lines = [];

    lines.push('## 当前目标');
    lines.push(`- ${goal.description}`);
    lines.push(`- 进度: ${goal.progress}%`);

    // 检查点
    if (goal.checkpoints.length > 0) {
      lines.push('- 检查点:');
      for (const cp of goal.checkpoints) {
        const status = cp.status === 'completed' ? '✓' : '○';
        lines.push(`  ${status} ${cp.description}`);
      }
    }

    // 阻碍
    if (goal.context.blockers.length > 0) {
      lines.push('- 阻碍:');
      for (const blocker of goal.context.blockers) {
        lines.push(`  ⚠ ${blocker.description}`);
      }
    }

    // 成就
    if (goal.context.achievements.length > 0) {
      lines.push('- 成就:');
      for (const ach of goal.context.achievements.slice(-3)) {
        lines.push(`  🎉 ${ach.description}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 获取目标概要
   * @param {string} [goalId] - 指定目标ID（默认使用活跃目标）
   * @returns {object|null}
   */
  getGoalSummary(goalId = null) {
    const goal = goalId ? this.goals.get(goalId) : this.getActiveGoal();
    if (!goal) return null;

    return {
      id: goal.id,
      description: goal.description,
      priority: goal.priority,
      status: goal.status,
      progress: goal.progress,
      checkpoints: goal.checkpoints.length,
      completedCheckpoints: goal.checkpoints.filter(cp => cp.status === 'completed').length,
      blockers: goal.context.blockers.length,
      achievements: goal.context.achievements.length,
    };
  }

  // ═══════════════════════════════════════════
  //  事件系统
  // ═══════════════════════════════════════════

  /**
   * 注册事件监听器
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, []);
    }
    this._eventListeners.get(event).push(callback);
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} [callback] - 回调函数（不传则移除所有）
   */
  off(event, callback = null) {
    if (!callback) {
      this._eventListeners.delete(event);
    } else {
      const listeners = this._eventListeners.get(event) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  /**
   * 触发事件
   * @private
   */
  _emit(event, ...args) {
    const listeners = this._eventListeners.get(event) || [];
    for (const callback of listeners) {
      try {
        callback(...args);
      } catch (error) {
        console.error(`[GoalTracker] 事件处理错误: ${error.message}`);
      }
    }
  }

  // ═══════════════════════════════════════════
  //  持久化
  // ═══════════════════════════════════════════

  /**
   * 自动保存（如果有配置路径）
   * @private
   */
  _autoSave() {
    if (this.autoSave && this.persistPath) {
      this.save();
    }
  }

  /**
   * 保存到文件
   */
  save() {
    if (!this.persistPath) return;

    const data = {
      goals: Array.from(this.goals.values()),
      goalHistory: this.goalHistory,
      activeGoalId: this.activeGoalId,
    };

    try {
      const { writeFileSync } = require('fs');
      writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`[GoalTracker] 保存失败: ${error.message}`);
    }
  }

  /**
   * 从文件加载
   */
  load() {
    if (!this.persistPath) return;

    try {
      const { readFileSync, existsSync } = require('fs');
      if (existsSync(this.persistPath)) {
        const data = JSON.parse(readFileSync(this.persistPath, 'utf-8'));
        this.goals = new Map(data.goals.map(g => [g.id, g]));
        this.goalHistory = data.goalHistory || [];
        this.activeGoalId = data.activeGoalId;
      }
    } catch (error) {
      console.error(`[GoalTracker] 加载失败: ${error.message}`);
    }
  }

  /**
   * 导出所有数据
   * @returns {object}
   */
  export() {
    return {
      goals: Array.from(this.goals.values()),
      goalHistory: this.goalHistory,
      activeGoalId: this.activeGoalId,
    };
  }

  /**
   * 清除所有数据
   */
  clear() {
    this.goals.clear();
    this.goalHistory = [];
    this.activeGoalId = null;
  }
}

// ─────────────────────────────────────────────
//  Goal —— 统一 DAG 目标管理
// ─────────────────────────────────────────────

/**
 * Goal 类 —— 统一 DAG 目标管理
 *
 * 特性：
 * - 唯一的 DAG 节点类型（替代原来的 Goal + SubGoal 双层结构）
 * - 叶子节点持有 tasks[]（实际执行的任务）
 * - 内部节点持有 children[]（子 Goal 节点）
 * - 支持 DAG 依赖关系（dependsOn）
 * - 支持顺序执行（sequential）
 */
export class Goal {
  /**
   * @param {object} options
   * @param {string}  options.goalId          - Goal ID
   * @param {string}  options.description      - 目标描述
   * @param {string}  [options.parentId]      - 父节点 ID
   * @param {Array<string>} [options.dependsOn] - 依赖的其他 Goal IDs（DAG）
   * @param {Array<string>} [options.sequential] - 顺序执行列表（Task IDs 或子 Goal IDs）
   * @param {object}  [options.config]        - 配置
   */
  constructor(options) {
    this.id = options.goalId || randomUUID().substring(0, 8);
    this.description = options.description || '';
    this.parentId = options.parentId || null;  // 父 Goal 节点

    // DAG 依赖
    this.dependsOn = options.dependsOn || [];  // 依赖的其他 Goal IDs

    // 执行顺序
    this.sequential = options.sequential || [];  // Task/子 Goal 的执行顺序

    // ─── 统一节点结构 ───
    this.children = [];   // 子 Goal 节点（内部节点使用）
    this.tasks = [];      // 直接子 Tasks（叶子节点使用）

    // 状态
    this.status = GoalStatus.PENDING;
    this.completedAt = null;

    // 配置
    this.config = {
      maxRetries: options.config?.maxRetries || 3,
      parallelTasks: options.config?.parallelTasks || 1,
      ...options.config,
    };

    // 执行信息
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
    this.startedAt = null;
    this.duration = null;

    // 统计
    this.completedChildren = 0;
    this.failedChildren = 0;

    // 事件回调
    this._onTaskAssigned = null;
    this._onChildGoalCompleted = null;
    this._onGoalCompleted = null;
    this._onGoalFailed = null;
  }

  // ═══════════════════════════════════════════
  //  树操作（统一接口）
  // ═══════════════════════════════════════════

  /**
   * 添加子 Goal
   * @param {Goal} childGoal
   */
  addChild(childGoal) {
    childGoal.parentId = this.id;
    this.children.push(childGoal);
  }

  /**
   * 添加 Task（仅叶子节点使用）
   * @param {Task} task
   */
  addTask(task) {
    task.goalId = this.id;  // 关联到父 Goal
    this.tasks.push(task);
  }

  /**
   * 添加多个 Tasks
   * @param {Array<Task>} tasks
   */
  addTasks(tasks) {
    tasks.forEach(t => this.addTask(t));
  }

  /**
   * 是否为叶子节点（包含 Tasks）
   */
  isLeaf() {
    return this.children.length === 0 && this.tasks.length > 0;
  }

  /**
   * 是否为内部节点（包含子 Goals）
   */
  isInternal() {
    return this.children.length > 0;
  }

  /**
   * 获取所有叶子 Goals（递归）
   */
  getLeafGoals() {
    if (this.children.length === 0) {
      return [this];
    }
    const leaves = [];
    for (const child of this.children) {
      leaves.push(...child.getLeafGoals());
    }
    return leaves;
  }

  /**
   * 获取所有 Tasks（递归，从叶子节点收集）
   */
  getAllTasks() {
    const allTasks = [...this.tasks];
    for (const child of this.children) {
      allTasks.push(...child.getAllTasks());
    }
    return allTasks;
  }

  /**
   * 收集所有 Goals（递归，包含自己）
   * @private
   */
  _collectAllGoals() {
    const all = [this];
    for (const child of this.children) {
      all.push(...child._collectAllGoals());
    }
    return all;
  }

  /**
   * 获取所有 Goals 的 Map（用于依赖查找）
   * @public 供外部调用
   */
  getGoalsMap() {
    const map = new Map();
    for (const goal of this._collectAllGoals()) {
      map.set(goal.id, goal);
    }
    return map;
  }

  // ═══════════════════════════════════════════
  //  DAG 依赖管理
  // ═══════════════════════════════════════════

  /**
   * 设置依赖的 Goals
   * @param {Array<string>} dependsOn - Goal IDs
   */
  setDependencies(dependsOn) {
    this.dependsOn = dependsOn;
  }

  /**
   * 检查依赖是否已满足
   * @param {Map<string, Goal>} goalsMap - 所有 Goals 的 Map
   * @returns {boolean}
   */
  checkDependencies(goalsMap) {
    if (this.dependsOn.length === 0) {
      return true;
    }
    return this.dependsOn.every(depId => {
      const dep = goalsMap.get(depId);
      return dep && dep.status === GoalStatus.COMPLETED;
    });
  }

  /**
   * 标记为可执行（依赖已满足）
   */
  markReady() {
    if (this.status === GoalStatus.PENDING) {
      this.status = GoalStatus.READY;
    }
  }

  // ═══════════════════════════════════════════
  //  Task 执行顺序
  // ═══════════════════════════════════════════

  /**
   * 获取可执行的 Tasks（按顺序）
   * @returns {Array<Task>}
   */
  getExecutableTasks() {
    if (this.tasks.length === 0) {
      return [];
    }

    // 如果有顺序定义，按顺序返回
    if (this.sequential.length > 0) {
      return this.sequential
        .map(id => this.tasks.find(t => t.id === id))
        .filter(t => t && t.status === TaskStatus.PENDING);
    }

    // 否则返回所有待执行的
    return this.tasks.filter(t => t.status === TaskStatus.PENDING);
  }

  /**
   * 获取下一个待执行的 Task
   */
  getNextTask() {
    const executable = this.getExecutableTasks();
    if (executable.length === 0) {
      return null;
    }
    return executable[0];
  }

  /**
   * 获取可执行的 Tasks（从所有就绪的子 Goal 中）
   * @param {Map<string, Goal>} goalsMap - 所有 Goals 的 Map
   * @returns {Array<Task>}
   */
  getExecutableTasksFromAll(goalsMap) {
    const executable = [];

    for (const goal of goalsMap.values()) {
      // 检查依赖
      if (!goal.checkDependencies(goalsMap)) {
        continue;
      }

      // 获取叶子节点的 Tasks
      if (goal.isLeaf()) {
        executable.push(...goal.getExecutableTasks());
      }
    }

    return executable;
  }

  // ═══════════════════════════════════════════
  //  状态更新
  // ═══════════════════════════════════════════

  /**
   * 更新状态（根据子节点状态）
   * 状态转换规则：
   * - PENDING → READY/IN_PROGRESS：依赖已满足
   * - READY/IN_PROGRESS → COMPLETED：所有子节点完成且无失败
   * - READY/IN_PROGRESS → FAILED：所有子节点完成但有失败
   */
  updateStatus() {
    // 叶子节点：根据 tasks 状态更新
    if (this.isLeaf()) {
      return this._updateLeafStatus();
    }

    // 内部节点：根据 children 状态更新
    return this._updateInternalStatus();
  }

  /**
   * 更新叶子节点状态
   * @private
   */
  _updateLeafStatus() {
    let completedTasks = 0;
    let failedTasks = 0;
    let pendingTasks = 0;
    let runningTasks = 0;

    for (const t of this.tasks) {
      if (t.status === TaskStatus.SUCCESS) completedTasks++;
      else if (t.status === TaskStatus.FAILED) failedTasks++;
      else if (t.status === TaskStatus.RUNNING) runningTasks++;
      else pendingTasks++;
    }

    this.completedChildren = completedTasks;
    this.failedChildren = failedTasks;

    const total = this.tasks.length;

    // 所有任务都已处理（完成或失败）
    if (pendingTasks === 0 && total > 0) {
      if (failedTasks > 0) {
        this.status = GoalStatus.FAILED;
      } else {
        this.status = GoalStatus.COMPLETED;
        this.completedAt = new Date().toISOString();
      }
    }
    // 有任务正在进行
    else if (runningTasks > 0 || completedTasks > 0) {
      this.status = GoalStatus.IN_PROGRESS;
    }
    // 否则保持 PENDING（等待依赖）
  }

  /**
   * 更新内部节点状态
   * @private
   */
  _updateInternalStatus() {
    let completedChildren = 0;
    let failedChildren = 0;
    let pendingChildren = 0;
    let runningChildren = 0;

    for (const child of this.children) {
      if (child.status === GoalStatus.COMPLETED) completedChildren++;
      else if (child.status === GoalStatus.FAILED) failedChildren++;
      else if (child.status === GoalStatus.IN_PROGRESS) runningChildren++;
      else pendingChildren++;
    }

    this.completedChildren = completedChildren;
    this.failedChildren = failedChildren;

    const total = this.children.length;

    // 所有子节点都已处理（完成或失败）
    if (pendingChildren === 0 && total > 0) {
      if (failedChildren > 0) {
        this.status = GoalStatus.FAILED;
        this.completedAt = new Date().toISOString();
      } else {
        this.status = GoalStatus.COMPLETED;
        this.completedAt = new Date().toISOString();
      }
    }
    // 有子节点正在进行
    else if (runningChildren > 0 || completedChildren > 0) {
      this.status = GoalStatus.IN_PROGRESS;
    }
    // 否则保持 PENDING（等待依赖）
  }

  /**
   * 标记为完成
   */
  markCompleted() {
    this.status = GoalStatus.COMPLETED;
    this.completedAt = new Date().toISOString();
    this.updateStatus();
  }

  /**
   * 标记为失败
   */
  markFailed() {
    this.status = GoalStatus.FAILED;
    this.completedAt = new Date().toISOString();
    this.updateStatus();
  }

  /**
   * 获取进度
   * @returns {number} 0-100
   */
  getProgress() {
    if (this.isLeaf()) {
      if (this.tasks.length === 0) return 0;
      const completed = this.tasks.filter(t => t.status === TaskStatus.SUCCESS).length;
      return Math.round((completed / this.tasks.length) * 100);
    }

    if (this.children.length === 0) return 0;
    const completed = this.children.filter(c => c.status === GoalStatus.COMPLETED).length;
    return Math.round((completed / this.children.length) * 100);
  }

  /**
   * 是否完成
   */
  isDone() {
    return this.status === GoalStatus.COMPLETED ||
           this.status === GoalStatus.FAILED ||
           this.status === GoalStatus.CANCELLED;
  }

  // ═══════════════════════════════════════════
  //  生命周期
  // ═══════════════════════════════════════════

  /**
   * 开始执行
   */
  start() {
    this.status = GoalStatus.IN_PROGRESS;
    this.startedAt = new Date().toISOString();

    // 标记无依赖的子 Goal 为就绪
    for (const child of this.children) {
      if (child.dependsOn.length === 0) {
        child.markReady();
      }
    }

    // 叶子节点直接标记为就绪
    if (this.isLeaf() && this.dependsOn.length === 0) {
      this.markReady();
    }
  }

  /**
   * 取消 Goal
   */
  cancel() {
    this.status = GoalStatus.CANCELLED;
    this.completedAt = new Date().toISOString();
  }

  /**
   * 重试失败的 Tasks
   */
  retryFailedTasks() {
    const failedTasks = this.getAllTasks().filter(t => t.status === TaskStatus.FAILED);
    for (const task of failedTasks) {
      if (task.canRetry()) {
        task.status = TaskStatus.PENDING;
      }
    }
    this.updatedAt = new Date().toISOString();
  }

  // ═══════════════════════════════════════════
  //  事件注册
  // ═══════════════════════════════════════════

  /**
   * 注册 Task 分派回调
   * @param {function} callback - (task, memberId) => void
   */
  onTaskAssigned(callback) {
    this._onTaskAssigned = callback;
  }

  /**
   * 注册子 Goal 完成回调
   * @param {function} callback - (childGoal) => void
   */
  onChildGoalCompleted(callback) {
    this._onChildGoalCompleted = callback;
  }

  /**
   * 注册 Goal 完成回调
   * @param {function} callback - (goal) => void
   */
  onGoalCompleted(callback) {
    this._onGoalCompleted = callback;
  }

  /**
   * 注册 Goal 失败回调
   * @param {function} callback - (goal, stats) => void
   */
  onGoalFailed(callback) {
    this._onGoalFailed = callback;
  }

  // ═══════════════════════════════════════════
  //  DAG 解析（兼容旧接口）
  // ═══════════════════════════════════════════

  /**
   * 解析 DAG 规格
   * @param {Array} dagSpec - DAG 规格
   *
   * dagSpec 格式：
   * [
   *   {
   *     id: 'goal1',
   *     description: '数据采集',
   *     dependsOn: [],  // 可选，依赖的 Goal IDs
   *     sequential: ['task1', 'task2'],  // 可选，执行顺序
   *     tasks: [
   *       { id: 'task1', description: '获取数据', tool: 'web_fetch', args: {...} },
   *       { id: 'task2', description: '处理数据', tool: 'exec', args: {...} }
   *     ]
   *   },
   *   {
   *     id: 'goal2',
   *     description: '数据分析',
   *     dependsOn: ['goal1'],  // 依赖 goal1
   *     tasks: [...]
   *   }
   * ]
   *
   * 支持嵌套结构：
   * [
   *   {
   *     id: 'parent',
   *     description: '父目标',
   *     children: [
   *       { id: 'child1', description: '子目标1', tasks: [...] },
   *       { id: 'child2', description: '子目标2', dependsOn: ['child1'], tasks: [...] }
   *     ]
   *   }
   * ]
   */
  parse(dagSpec) {
    if (!Array.isArray(dagSpec)) {
      throw new Error('dagSpec 必须是数组');
    }

    for (const spec of dagSpec) {
      const childGoal = new Goal({
        goalId: spec.id,
        description: spec.description,
        dependsOn: spec.dependsOn || [],
        sequential: spec.sequential || [],
      });

      // 递归解析子节点
      if (spec.children && Array.isArray(spec.children)) {
        for (const childSpec of spec.children) {
          childGoal._parseChildSpec(childSpec);
        }
      }

      // 添加 Tasks（叶子节点）
      if (spec.tasks && Array.isArray(spec.tasks)) {
        for (const taskSpec of spec.tasks) {
          const task = new Task({
            taskId: taskSpec.id,
            description: taskSpec.description,
            tool: taskSpec.tool,
            args: taskSpec.args || {},
            maxAttempts: taskSpec.maxAttempts || this.config.maxRetries,
          });
          childGoal.addTask(task);
        }
      }

      this.addChild(childGoal);
    }

    this.status = GoalStatus.PENDING;
    return this;
  }

  /**
   * 递归解析子规格
   * @private
   */
  _parseChildSpec(spec) {
    const childGoal = new Goal({
      goalId: spec.id,
      description: spec.description,
      dependsOn: spec.dependsOn || [],
      sequential: spec.sequential || [],
    });

    // 递归解析嵌套
    if (spec.children && Array.isArray(spec.children)) {
      for (const childSpec of spec.children) {
        childGoal._parseChildSpec(childSpec);
      }
    }

    // 添加 Tasks
    if (spec.tasks && Array.isArray(spec.tasks)) {
      for (const taskSpec of spec.tasks) {
        const task = new Task({
          taskId: taskSpec.id,
          description: taskSpec.description,
          tool: taskSpec.tool,
          args: taskSpec.args || {},
          maxAttempts: taskSpec.maxAttempts || this.config.maxRetries,
        });
        childGoal.addTask(task);
      }
    }

    this.addChild(childGoal);
  }

  /**
   * 手动添加子 Goal（兼容旧接口）
   * @param {Goal} childGoal
   */
  addSubGoal(childGoal) {
    // 递归注册所有 Tasks
    for (const task of childGoal.getAllTasks()) {
      task.goalId = childGoal.id;
    }
    this.addChild(childGoal);
  }

  // ═══════════════════════════════════════════
  //  执行反馈
  // ═══════════════════════════════════════════

  /**
   * Task 执行完成回调
   * @param {string} taskId - Task ID
   * @param {boolean} success - 是否成功
   * @param {object} result - 执行结果
   * @param {string} [error] - 错误信息
   */
  onTaskComplete(taskId, success, result, error = null) {
    const goalsMap = this.getGoalsMap();
    let foundGoal = null;
    let task = null;

    // 查找包含该 Task 的 Goal
    for (const goal of goalsMap.values()) {
      const found = goal.tasks.find(t => t.id === taskId);
      if (found) {
        task = found;
        foundGoal = goal;
        break;
      }
    }

    if (!task) {
      console.warn(`[Goal] 未找到 Task: ${taskId}`);
      return;
    }

    if (success) {
      task.succeed(result);
    } else {
      task.fail(error || 'Unknown error');
    }

    // 更新父 Goal 状态
    if (foundGoal) {
      foundGoal.updateStatus();

      // 如果 Goal 完成，通知
      if (foundGoal.isDone()) {
        if (this._onChildGoalCompleted) {
          this._onChildGoalCompleted(foundGoal);
        }

        // 更新依赖此 Goal 的其他 Goals 的就绪状态
        this._updateDependentGoals(foundGoal.id, goalsMap);
      }
    }

    // 更新根 Goal 状态
    this._updateRootStatus(goalsMap);

    this.updatedAt = new Date().toISOString();
  }

  /**
   * 更新依赖某个 Goal 的其他 Goals
   * @private
   */
  _updateDependentGoals(completedId, goalsMap) {
    for (const goal of goalsMap.values()) {
      if (goal.dependsOn.includes(completedId) && goal.status === GoalStatus.PENDING) {
        if (goal.checkDependencies(goalsMap)) {
          goal.markReady();
        }
      }
    }
  }

  /**
   * 更新根 Goal 状态
   * @private
   */
  _updateRootStatus(goalsMap) {
    const allTasks = this.getAllTasks();

    // 待处理：非成功、非失败的 tasks
    const pending = allTasks.filter(t =>
      t.status !== TaskStatus.SUCCESS && t.status !== TaskStatus.FAILED
    ).length;
    const failed = allTasks.filter(t => t.status === TaskStatus.FAILED).length;

    // 所有任务都已处理（完成或失败）
    if (pending === 0) {
      if (failed > 0) {
        this.status = GoalStatus.FAILED;
        this.completedAt = new Date().toISOString();
        this.duration = new Date(this.completedAt) - new Date(this.startedAt);
        if (this._onGoalFailed) {
          this._onGoalFailed(this, { failedTasks: failed, totalTasks: allTasks.length });
        }
      } else {
        this.status = GoalStatus.COMPLETED;
        this.completedAt = new Date().toISOString();
        this.duration = new Date(this.completedAt) - new Date(this.startedAt);
        if (this._onGoalCompleted) {
          this._onGoalCompleted(this);
        }
      }
    }
  }

  // ═══════════════════════════════════════════
  //  状态查询
  // ═══════════════════════════════════════════

  /**
   * 获取统计信息
   */
  getStats() {
    const allTasks = this.getAllTasks();
    return {
      totalTasks: allTasks.length,
      pending: allTasks.filter(t => t.status === TaskStatus.PENDING).length,
      running: allTasks.filter(t => t.status === TaskStatus.RUNNING).length,
      success: allTasks.filter(t => t.status === TaskStatus.SUCCESS).length,
      failed: allTasks.filter(t => t.status === TaskStatus.FAILED).length,
      progress: this.getProgress(),
    };
  }

  /**
   * 获取概要
   */
  getSummary() {
    return {
      id: this.id,
      description: this.description,
      status: this.status,
      progress: this.getProgress(),
      stats: this.getStats(),
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.duration,
      isLeaf: this.isLeaf(),
      childrenCount: this.children.length,
      tasksCount: this.tasks.length,
    };
  }

  /**
   * 获取完整状态树
   */
  getTree() {
    return {
      ...this.getSummary(),
      children: this.children.map(child => child.getTree()),
      tasks: this.tasks.map(t => t.getSummary()),
    };
  }

  // ═══════════════════════════════════════════
  //  持久化
  // ═══════════════════════════════════════════

  /**
   * 导出
   */
  export() {
    return {
      id: this.id,
      description: this.description,
      parentId: this.parentId,
      dependsOn: this.dependsOn,
      sequential: this.sequential,
      status: this.status,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      startedAt: this.startedAt,
      duration: this.duration,
      config: this.config,
      children: this.children.map(child => child.export()),
      tasks: this.tasks.map(t => t.export()),
    };
  }

  /**
   * 从导出数据恢复
   * @param {object} data - 导出的数据
   * @returns {Goal}
   */
  static fromExport(data) {
    const goal = new Goal({
      goalId: data.id,
      description: data.description,
      parentId: data.parentId,
      dependsOn: data.dependsOn,
      sequential: data.sequential,
      config: data.config,
    });
    goal.status = data.status;
    goal.completedAt = data.completedAt;
    goal.createdAt = data.createdAt;
    goal.updatedAt = data.updatedAt;
    goal.startedAt = data.startedAt;
    goal.duration = data.duration;

    // 重建子节点
    for (const childData of (data.children || [])) {
      goal.addChild(Goal.fromExport(childData));
    }

    // 重建 Tasks
    for (const taskData of (data.tasks || [])) {
      goal.addTask(Task.fromExport(taskData));
    }

    return goal;
  }

  // ═══════════════════════════════════════════
  //  向后兼容别名
  // ═══════════════════════════════════════════

  /**
   * @deprecated 请使用 addChild
   */
  addSubGoal(childGoal) {
    return this.addChild(childGoal);
  }

  /**
   * @deprecated 请使用 children
   */
  get subGoals() {
    return this.children;
  }

  /**
   * @deprecated 请使用 children
   */
  set subGoals(val) {
    this.children = val;
  }
}
