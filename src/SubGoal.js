// ─────────────────────────────────────────────
//  SubGoal —— Goal 的子目标（DAG 节点）
// ─────────────────────────────────────────────
import { randomUUID } from 'crypto';
import { Task, TaskStatus } from './Task.js';

/**
 * SubGoal 状态
 */
export const SubGoalStatus = {
  PENDING: 'pending',       // 待执行（等待依赖）
  READY: 'ready',          // 可执行（依赖已满足）
  IN_PROGRESS: 'in_progress', // 执行中
  COMPLETED: 'completed',   // 已完成
  FAILED: 'failed',        // 失败
};

/**
 * SubGoal 类 —— Goal 的子目标（DAG 节点）
 *
 * 特性：
 * - 可包含子 SubGoals（嵌套）
 * - 或包含 Tasks（叶子节点）
 * - 支持 DAG 依赖关系
 */
export class SubGoal {
  /**
   * @param {object} options
   * @param {string}  options.subGoalId      - SubGoal ID
   * @param {string}  options.description    - 描述
   * @param {string}  [options.parentId]     - 父节点 ID
   * @param {Array<string>} [options.dependsOn] - 依赖的 SubGoal IDs（DAG）
   * @param {Array<string>} [options.sequential] - 顺序执行列表（Task IDs 或 SubGoal IDs）
   */
  constructor(options) {
    this.id = options.subGoalId || randomUUID().substring(0, 8);
    this.description = options.description || '';
    this.parentId = options.parentId || null;  // 父 Goal 或 SubGoal

    // DAG 依赖
    this.dependsOn = options.dependsOn || [];  // 依赖的其他 SubGoal IDs

    // 执行顺序
    this.sequential = options.sequential || [];  // Task/SubGoal 的执行顺序

    // 子节点
    this.subGoals = [];  // 子 SubGoals
    this.tasks = [];      // 直接子 Tasks

    // 状态
    this.status = SubGoalStatus.PENDING;
    this.completedAt = null;

    // 执行信息
    this.completedChildren = 0;  // 已完成的子节点数
    this.failedChildren = 0;      // 失败的子节点数
  }

  // ═══════════════════════════════════════════
  //  树操作
  // ═══════════════════════════════════════════

  /**
   * 添加子 SubGoal
   * @param {SubGoal} subGoal
   */
  addSubGoal(subGoal) {
    subGoal.parentId = this.id;
    this.subGoals.push(subGoal);
  }

  /**
   * 添加 Task
   * @param {Task} task
   */
  addTask(task) {
    task.subGoalId = this.id;
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
   * 获取所有叶子 Tasks（递归）
   */
  getAllTasks() {
    const allTasks = [...this.tasks];
    for (const sg of this.subGoals) {
      allTasks.push(...sg.getAllTasks());
    }
    return allTasks;
  }

  /**
   * 获取所有叶子 SubGoals（无子 SubGoal 的）
   */
  getLeafSubGoals() {
    if (this.subGoals.length === 0) {
      return [this];
    }
    const leaves = [];
    for (const sg of this.subGoals) {
      leaves.push(...sg.getLeafSubGoals());
    }
    return leaves;
  }

  // ═══════════════════════════════════════════
  //  DAG 状态
  // ═══════════════════════════════════════════

  /**
   * 设置依赖的 SubGoals
   * @param {Array<string>} dependsOn - SubGoal IDs
   */
  setDependencies(dependsOn) {
    this.dependsOn = dependsOn;
  }

  /**
   * 检查依赖是否已满足
   * @param {Map<string, SubGoal>} subGoalsMap - 所有 SubGoals 的 Map
   * @returns {boolean}
   */
  checkDependencies(subGoalsMap) {
    if (this.dependsOn.length === 0) {
      return true;
    }
    return this.dependsOn.every(depId => {
      const dep = subGoalsMap.get(depId);
      return dep && dep.status === SubGoalStatus.COMPLETED;
    });
  }

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

    // 如果有顺序，按顺序返回第一个
    if (this.sequential.length > 0) {
      return executable[0];
    }

    return executable[0];
  }

  // ═══════════════════════════════════════════
  //  状态更新
  // ═══════════════════════════════════════════

  /**
   * 更新状态（根据子节点状态）
   * 状态转换规则：
   * - PENDING → IN_PROGRESS：当有任务开始执行
   * - IN_PROGRESS → COMPLETED：所有任务完成且无失败
   * - IN_PROGRESS → FAILED：所有任务完成但有失败
   */
  updateStatus() {
    // 检查是否全部完成
    const allTasks = this.getAllTasks();
    const allSubGoals = this.getLeafSubGoals();

    // 统计
    let completedTasks = 0;
    let failedTasks = 0;
    let pendingTasks = 0;
    let runningTasks = 0;

    for (const t of allTasks) {
      if (t.status === TaskStatus.SUCCESS) completedTasks++;
      else if (t.status === TaskStatus.FAILED) failedTasks++;
      else if (t.status === TaskStatus.RUNNING) runningTasks++;
      else pendingTasks++;
    }

    for (const sg of allSubGoals) {
      if (sg.status === SubGoalStatus.COMPLETED) completedTasks++;
      else if (sg.status === SubGoalStatus.FAILED) failedTasks++;
      else if (sg.status === SubGoalStatus.IN_PROGRESS) runningTasks++;
      else pendingTasks++;
    }

    this.completedChildren = completedTasks;
    this.failedChildren = failedTasks;

    const total = allTasks.length + allSubGoals.length;

    // 所有任务都已处理（完成或失败）
    if (pendingTasks === 0 && total > 0) {
      if (failedTasks > 0) {
        this.status = SubGoalStatus.FAILED;
      } else {
        this.status = SubGoalStatus.COMPLETED;
        this.completedAt = new Date().toISOString();
      }
    }
    // 有任务正在进行或有任务已完成/失败（但还有待处理）
    else if (runningTasks > 0 || completedTasks > 0 || failedTasks > 0) {
      this.status = SubGoalStatus.IN_PROGRESS;
    }
    // 否则保持 PENDING（等待依赖）
  }

  /**
   * 标记为可执行（依赖已满足）
   */
  markReady() {
    if (this.status === SubGoalStatus.PENDING) {
      this.status = SubGoalStatus.READY;
    }
  }

  /**
   * 标记为完成
   */
  markCompleted() {
    this.status = SubGoalStatus.COMPLETED;
    this.completedAt = new Date().toISOString();
    this.updateStatus();
  }

  /**
   * 标记为失败
   */
  markFailed() {
    this.status = SubGoalStatus.FAILED;
    this.completedAt = new Date().toISOString();
    this.updateStatus();
  }

  /**
   * 获取进度
   * @returns {number} 0-100
   */
  getProgress() {
    const allTasks = this.getAllTasks();
    const allSubGoals = this.getLeafSubGoals();
    const total = allTasks.length + allSubGoals.length;

    if (total === 0) return 0;

    let completed = 0;
    for (const t of allTasks) {
      if (t.status === TaskStatus.SUCCESS) completed++;
    }
    for (const sg of allSubGoals) {
      if (sg.status === SubGoalStatus.COMPLETED) completed++;
    }

    return Math.round((completed / total) * 100);
  }

  /**
   * 是否完成
   */
  isDone() {
    return this.status === SubGoalStatus.COMPLETED || this.status === SubGoalStatus.FAILED;
  }

  // ═══════════════════════════════════════════
  //  信息
  // ═══════════════════════════════════════════

  /**
   * 获取概要
   */
  getSummary() {
    return {
      id: this.id,
      description: this.description,
      status: this.status,
      progress: this.getProgress(),
      dependsOn: this.dependsOn,
      subGoalCount: this.subGoals.length,
      taskCount: this.tasks.length,
      completedChildren: this.completedChildren,
      failedChildren: this.failedChildren,
    };
  }

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
      subGoals: this.subGoals.map(sg => sg.export()),
      tasks: this.tasks.map(t => t.export()),
    };
  }

  /**
   * 从导出数据恢复
   */
  static fromExport(data) {
    const sg = new SubGoal({
      subGoalId: data.id,
      description: data.description,
      parentId: data.parentId,
      dependsOn: data.dependsOn,
      sequential: data.sequential,
    });
    sg.status = data.status;
    sg.completedAt = data.completedAt;

    for (const sgData of (data.subGoals || [])) {
      sg.addSubGoal(SubGoal.fromExport(sgData));
    }
    for (const taskData of (data.tasks || [])) {
      sg.addTask(Task.fromExport(taskData));
    }

    return sg;
  }
}
