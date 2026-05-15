// ─────────────────────────────────────────────
//  Goal —— DAG 驱动的目标管理
// ─────────────────────────────────────────────
import { randomUUID } from 'crypto';
import { SubGoal, SubGoalStatus } from './SubGoal.js';
import { Task, TaskStatus } from './Task.js';

/**
 * Goal 状态
 */
export const GoalStatus = {
  PENDING: 'pending',       // 待解析
  IN_PROGRESS: 'in_progress', // 进行中
  COMPLETED: 'completed',   // 已完成
  FAILED: 'failed',        // 失败
  CANCELLED: 'cancelled',  // 已取消
};

/**
 * Goal 类 —— DAG 驱动的目标管理
 *
 * 核心职责：
 * 1. 将任务解析为 SubGoal + Task 的 DAG 结构
 * 2. 管理 SubGoal 间的依赖关系
 * 3. 提供可执行的 Task 队列
 * 4. 判断 Goal 完成状态
 *
 * DAG 结构：
 * Goal
 * └── SubGoals[] (可嵌套)
 *     ├── dependsOn: [otherSubGoalId, ...]  // DAG 依赖
 *     ├── sequential: [taskId1, taskId2, ...] // 执行顺序
 *     └── Tasks[]
 *         └── tool + args
 */
export class Goal {
  /**
   * @param {object} options
   * @param {string}  options.goalId          - Goal ID
   * @param {string}  options.description      - 目标描述
   * @param {object}  [options.config]        - 配置
   */
  constructor(options) {
    this.id = options.goalId || randomUUID().substring(0, 8);
    this.description = options.description || '';
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;

    // 配置
    this.config = {
      maxRetries: options.config?.maxRetries || 3,
      parallelTasks: options.config?.parallelTasks || 1,
      ...options.config,
    };

    // 根级 SubGoals
    this.subGoals = [];

    // 所有 SubGoals 的 Map（用于依赖查找）
    this._subGoalsMap = new Map();

    // 所有 Tasks 的 Map（用于快速查找）
    this._tasksMap = new Map();

    // 状态
    this.status = GoalStatus.PENDING;

    // 执行信息
    this.startedAt = null;
    this.completedAt = null;
    this.duration = null;

    // 事件回调
    this._onTaskAssigned = null;
    this._onSubGoalCompleted = null;
    this._onGoalCompleted = null;
    this._onGoalFailed = null;
  }

  // ═══════════════════════════════════════════
  //  DAG 构建
  // ═══════════════════════════════════════════

  /**
   * 解析任务为 DAG 结构
   * @param {Array} dagSpec - DAG 规格
   *
   * dagSpec 格式：
   * [
   *   {
   *     id: 'sg1',
   *     description: '数据采集',
   *     dependsOn: [],  // 可选，依赖的 SubGoal IDs
   *     sequential: ['task1', 'task2'],  // 可选，执行顺序
   *     tasks: [
   *       { id: 'task1', description: '获取数据', tool: 'web_fetch', args: {...} },
   *       { id: 'task2', description: '处理数据', tool: 'exec', args: {...} }
   *     ]
   *   },
   *   {
   *     id: 'sg2',
   *     description: '数据分析',
   *     dependsOn: ['sg1'],  // 依赖 sg1
   *     tasks: [...]
   *   }
   * ]
   */
  parse(dagSpec) {
    if (!Array.isArray(dagSpec)) {
      throw new Error('dagSpec 必须是数组');
    }

    // 第一遍：创建所有 SubGoals
    for (const spec of dagSpec) {
      const subGoal = new SubGoal({
        subGoalId: spec.id,
        description: spec.description,
        dependsOn: spec.dependsOn || [],
        sequential: spec.sequential || [],
      });

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
          subGoal.addTask(task);
          this._tasksMap.set(task.id, task);
        }
      }

      this.subGoals.push(subGoal);
      this._subGoalsMap.set(subGoal.id, subGoal);
    }

    // 第二遍：处理嵌套（如果支持）
    // 目前仅支持扁平结构

    this.status = GoalStatus.PENDING;
    return this;
  }

  /**
   * 手动添加 SubGoal
   * @param {SubGoal} subGoal
   */
  addSubGoal(subGoal) {
    this.subGoals.push(subGoal);
    this._subGoalsMap.set(subGoal.id, subGoal);

    // 递归注册所有 Tasks
    for (const task of subGoal.getAllTasks()) {
      this._tasksMap.set(task.id, task);
    }
  }

  /**
   * 获取所有 Tasks
   */
  getAllTasks() {
    const allTasks = [];
    for (const sg of this.subGoals) {
      allTasks.push(...sg.getAllTasks());
    }
    return allTasks;
  }

  // ═══════════════════════════════════════════
  //  依赖解析
  // ═══════════════════════════════════════════

  /**
   * 获取可执行的 Tasks
   * @returns {Array<Task>}
   */
  getExecutableTasks() {
    const executable = [];

    for (const sg of this.subGoals) {
      // 检查依赖是否满足
      if (!sg.checkDependencies(this._subGoalsMap)) {
        continue;
      }

      // 获取可执行的 Task
      const tasks = sg.getExecutableTasks();
      executable.push(...tasks);
    }

    return executable;
  }

  /**
   * 获取下一个可执行的 Task（按 DAG 顺序）
   */
  getNextTask() {
    // 按 SubGoal 顺序遍历
    for (const sg of this.subGoals) {
      if (!sg.checkDependencies(this._subGoalsMap)) {
        continue;
      }

      const task = sg.getNextTask();
      if (task) {
        return task;
      }
    }
    return null;
  }

  /**
   * 获取所有就绪的 SubGoals（无依赖或依赖已满足）
   */
  getReadySubGoals() {
    return this.subGoals.filter(sg =>
      sg.status === SubGoalStatus.PENDING && sg.checkDependencies(this._subGoalsMap)
    );
  }

  /**
   * 获取可并行的 Tasks
   * @param {number} maxParallel - 最大并行数
   */
  getParallelTasks(maxParallel = null) {
    maxParallel = maxParallel || this.config.parallelTasks;
    const executable = this.getExecutableTasks();
    return executable.slice(0, maxParallel);
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
    const task = this._tasksMap.get(taskId);
    if (!task) {
      console.warn(`[Goal] 未找到 Task: ${taskId}`);
      return;
    }

    if (success) {
      task.succeed(result);
    } else {
      task.fail(error || 'Unknown error');
    }

    // 更新父 SubGoal 状态
    this._updateParentSubGoal(task.subGoalId);

    // 更新 Goal 状态
    this._updateGoalStatus();

    this.updatedAt = new Date().toISOString();
  }

  /**
   * 更新父 SubGoal 状态
   * @private
   */
  _updateParentSubGoal(subGoalId) {
    const subGoal = this._subGoalsMap.get(subGoalId);
    if (!subGoal) return;

    subGoal.updateStatus();

    // 如果 SubGoal 完成，通知
    if (subGoal.isDone()) {
      if (this._onSubGoalCompleted) {
        this._onSubGoalCompleted(subGoal);
      }

      // 更新依赖此 SubGoal 的其他 SubGoals 的就绪状态
      this._updateDependentSubGoals(subGoalId);
    }
  }

  /**
   * 更新依赖某个 SubGoal 的其他 SubGoals
   * @private
   */
  _updateDependentSubGoals(completedId) {
    for (const sg of this.subGoals) {
      if (sg.dependsOn.includes(completedId) && sg.status === SubGoalStatus.PENDING) {
        if (sg.checkDependencies(this._subGoalsMap)) {
          sg.markReady();
        }
      }
    }
  }

  /**
   * 更新 Goal 状态
   * @private
   */
  _updateGoalStatus() {
    const allTasks = this.getAllTasks();
    const allSubGoals = this._collectAllSubGoals();

    // 待处理：非成功、非失败的 tasks
    const pending = allTasks.filter(t =>
      t.status !== TaskStatus.SUCCESS && t.status !== TaskStatus.FAILED
    ).length;
    const failed = allTasks.filter(t => t.status === TaskStatus.FAILED).length;
    const completed = allTasks.filter(t => t.status === TaskStatus.SUCCESS).length;

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
    // 有任务正在进行或有任务已完成/失败（但还有待处理）
    else {
      this.status = GoalStatus.IN_PROGRESS;
    }
  }

  /**
   * 收集所有 SubGoals（递归）
   * @private
   */
  _collectAllSubGoals() {
    const all = [];
    const collect = (sgs) => {
      for (const sg of sgs) {
        all.push(sg);
        collect(sg.subGoals);
      }
    };
    collect(this.subGoals);
    return all;
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

    // 标记无依赖的 SubGoals 为就绪
    for (const sg of this.subGoals) {
      if (sg.dependsOn.length === 0) {
        sg.markReady();
      }
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
   * 注册 SubGoal 完成回调
   * @param {function} callback - (subGoal) => void
   */
  onSubGoalCompleted(callback) {
    this._onSubGoalCompleted = callback;
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
  //  状态查询
  // ═══════════════════════════════════════════

  /**
   * 是否完成
   */
  isDone() {
    return this.status === GoalStatus.COMPLETED ||
           this.status === GoalStatus.FAILED ||
           this.status === GoalStatus.CANCELLED;
  }

  /**
   * 获取进度
   */
  getProgress() {
    const allTasks = this.getAllTasks();
    if (allTasks.length === 0) return 0;

    const completed = allTasks.filter(t => t.status === TaskStatus.SUCCESS).length;
    return Math.round((completed / allTasks.length) * 100);
  }

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
    };
  }

  /**
   * 获取完整状态树
   */
  getTree() {
    return {
      goal: this.getSummary(),
      subGoals: this.subGoals.map(sg => this._subGoalToTree(sg)),
    };
  }

  /**
   * SubGoal 转树节点
   * @private
   */
  _subGoalToTree(subGoal) {
    return {
      ...subGoal.getSummary(),
      tasks: subGoal.tasks.map(t => t.getSummary()),
      children: subGoal.subGoals.map(sg => this._subGoalToTree(sg)),
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.duration,
      config: this.config,
      subGoals: this.subGoals.map(sg => sg.export()),
    };
  }

  /**
   * 从导出数据恢复
   */
  static fromExport(data) {
    const goal = new Goal({
      goalId: data.id,
      description: data.description,
      config: data.config,
    });
    goal.status = data.status;
    goal.createdAt = data.createdAt;
    goal.updatedAt = data.updatedAt;
    goal.startedAt = data.startedAt;
    goal.completedAt = data.completedAt;
    goal.duration = data.duration;

    // 重建 SubGoals
    for (const sgData of (data.subGoals || [])) {
      goal.addSubGoal(SubGoal.fromExport(sgData));
    }

    return goal;
  }
}
