// ─────────────────────────────────────────────
//  Manager —— Goal 执行协调器（管理者，继承自 Member）
// ─────────────────────────────────────────────
import { Goal, GoalStatus } from './Goal.js';
import { Task, TaskStatus } from './Task.js';
import { executeToolCalls } from './SkillRegistry.js';
import { Member } from './Member.js';

/**
 * Manager 类 —— Goal 执行协调器（管理者）
 *
 * 继承自 Member，因此也是一种执行成员。
 *
 * 核心职责：
 * 1. 接受任务 → 解析为 Goal（DAG 树）
 * 2. 分派 Task 给 Member 执行（可分派给自己或其他成员）
 * 3. 判断执行是否达标
 * 4. 协调多个 Member 并行/顺序执行
 * 5. 处理 Task 完成通知
 *
 * 继承关系：
 * - 继承自 Member，拥有所有 Member 能力
 * - Manager 本身也是执行者，可以直接执行任务
 * - 可以分派任务给其他 Member
 *
 * 使用示例：
 * ```javascript
 * const manager = new Manager({
 *   id: 'manager1',
 *   config: { name: '任务管理器', identity: '任务协调者', soul: '高效严谨' },
 *   workspace,
 * });
 *
 * // 方式 1: 分派给其他 Member 执行
 * await manager.submit('分析市场趋势', {
 *   dagSpec: [
 *     { id: 'gather', tasks: [{ id: 't1', tool: 'web_search', args: {...} }] },
 *     { id: 'analyze', dependsOn: ['gather'], tasks: [{ id: 't2', tool: 'exec', args: {...} }] },
 *   ],
 *   memberId: 'researcher',  // 指定执行者
 * });
 *
 * // 方式 2: Manager 自己执行
 * const result = await manager.execute('帮我搜索最新新闻并总结');
 *
 * // 方式 3: 混合模式 - 分派部分任务给自己
 * const goal = await manager.submit('复杂任务', {
 *   dagSpec: [
 *     { id: 'step1', tasks: [{ id: 't1', tool: 'agent_chat', args: {...} }] },  // Manager 自己执行
 *     { id: 'step2', dependsOn: ['step1'], tasks: [{ id: 't2', tool: 'exec', args: {...} }] },  // 分派给其他 Member
 *   ],
 *   memberId: 'helper',  // 优先使用 helper 执行
 * });
 * ```
 */
export class Manager extends Member {
  /**
   * @param {object} options
   * @param {string} options.id - Manager ID
   * @param {object} options.config - Member 配置
   * @param {string} [options.config.name] - Manager 名称
   * @param {string} [options.config.identity] - 身份描述
   * @param {string} [options.config.soul] - 性格描述
   * @param {Array<string>} [options.config.skills] - 角色技能
   * @param {number} [options.config.maxRounds] - 最大执行轮次
   * @param {WorkSpace} options.workspace - 关联的工作空间（必填，用于访问其他 Members）
   * @param {object} [options.managerConfig] - Manager 特有配置
   * @param {number} [options.managerConfig.maxParallelTasks] - 最大并行任务数
   * @param {boolean} [options.managerConfig.autoResolve] - 自动解析任务为 DAG
   * @param {boolean} [options.managerConfig.enableRetry] - 启用自动重试
   */
  constructor(options) {
    const { id, config = {}, workspace, managerConfig = {} } = options;

    // 调用 Member 构造函数
    super(id, {
      name: config.name || `Manager(${id})`,
      identity: config.identity || '任务协调者',
      soul: config.soul || '高效严谨，善于规划',
      skills: config.skills || [],
      maxRounds: config.maxRounds || 10,
      verbose: config.verbose || false,
    });

    // Manager 特有属性
    this.workspace = workspace;  // 访问其他 Members

    // Manager 配置
    this.config = {
      maxParallelTasks: managerConfig.maxParallelTasks || 3,
      autoResolve: managerConfig.autoResolve || false,  // 自动解析任务为 DAG
      enableRetry: managerConfig.enableRetry ?? true,   // 启用自动重试
      ...managerConfig,
    };

    // 活跃的 Goals
    this._activeGoals = new Map();

    // Member 任务分配映射: taskId -> memberId
    this._taskAssignments = new Map();

    // 回调函数
    this._onTaskAssigned = null;     // Task 分派回调 (task, memberId)
    this._onTaskComplete = null;     // Task 完成回调 (task, success)
    this._onGoalComplete = null;     // Goal 完成回调 (goal)
    this._onGoalFailed = null;       // Goal 失败回调 (goal, reason)

    // Manager 统计
    this.goalCount = 0;
    this.totalTasksDispatched = 0;
  }

  // ═══════════════════════════════════════════
  //  核心 API（提交任务）
  // ═══════════════════════════════════════════

  /**
   * 提交任务（统一入口）
   *
   * 支持两种模式：
   * 1. 显式 DAG 模式：提供 dagSpec 显式定义 Goal 结构
   * 2. 自动分解模式：提供 description，让 LLM 自动分解为 DAG
   *
   * @param {string} description - 任务描述
   * @param {object} options
   * @param {Array} [options.dagSpec] - 显式 DAG 规格
   * @param {string} [options.memberId] - 指定执行者（可选）
   * @param {object} [options.context] - 上下文信息
   * @returns {Promise<Goal>} Goal 实例
   */
  async submit(description, options = {}) {
    const { dagSpec, memberId, context = {} } = options;

    // 创建 Goal
    const goal = new Goal({
      description,
      config: this.config,
    });

    if (dagSpec) {
      // 显式 DAG 模式
      goal.parse(dagSpec);
    } else if (this.config.autoResolve) {
      // 自动分解模式（需要 LLM）
      const autoDagSpec = await this._resolveTaskToDag(description, context);
      goal.parse(autoDagSpec);
    } else {
      // 简化模式：单个 Goal，单个 Task
      goal.parse([{
        id: 'main',
        description,
        tasks: [{
          id: 't1',
          description,
          tool: 'agent_chat',
          args: { message: description },
        }],
      }]);
    }

    // 注册活跃 Goal
    this._activeGoals.set(goal.id, goal);
    this.goalCount++;

    // 注册事件回调
    goal.onGoalCompleted((g) => this._handleGoalComplete(g));
    goal.onGoalFailed((g, stats) => this._handleGoalFailed(g, stats));

    // 开始执行
    goal.start();

    // 分派 Tasks
    await this._dispatchTasks(goal, memberId);

    return goal;
  }

  /**
   * 同步执行（等待完成）- Manager 自己执行
   * @param {string} description - 任务描述
   * @param {object} options - submit 的选项
   * @returns {Promise<object>} 最终结果
   */
  async execute(description, options = {}) {
    const goal = await this.submit(description, options);

    // 等待 Goal 完成
    await this._waitForGoal(goal);

    return {
      success: goal.status === GoalStatus.COMPLETED,
      goalId: goal.id,
      result: this._aggregateResults(goal),
      stats: goal.getStats(),
    };
  }

  /**
   * 获取活跃 Goal
   * @param {string} goalId - Goal ID
   * @returns {Goal|null}
   */
  getGoal(goalId) {
    return this._activeGoals.get(goalId) || null;
  }

  /**
   * 获取所有活跃 Goals
   * @returns {Array<Goal>}
   */
  getActiveGoals() {
    return Array.from(this._activeGoals.values());
  }

  /**
   * 取消 Goal
   * @param {string} goalId - Goal ID
   */
  cancelGoal(goalId) {
    const goal = this._activeGoals.get(goalId);
    if (goal) {
      goal.cancel();
      this._activeGoals.delete(goalId);
    }
  }

  // ═══════════════════════════════════════════
  //  Task 分派
  // ═══════════════════════════════════════════

  /**
   * 分派 Tasks 给 Members
   * @param {Goal} goal - Goal 实例
   * @param {string} [preferredMemberId] - 优先使用的 Member
   * @private
   */
  async _dispatchTasks(goal, preferredMemberId = null) {
    // 获取可执行的 Tasks
    const executableTasks = goal.getExecutableTasks();

    for (const task of executableTasks) {
      // 选择 Member
      const memberId = preferredMemberId || this._selectMember(task);
      const member = this.workspace.getMember(memberId);

      if (!member) {
        console.warn(`[Manager:${this.id}] Member 不存在: ${memberId}`);
        goal.onTaskComplete(task.id, false, null, `Member 不存在: ${memberId}`);
        continue;
      }

      // 检查是否是 Manager 自己
      const isSelf = memberId === this.id;

      // 分配 Task
      this._taskAssignments.set(task.id, memberId);
      task.start(memberId);
      this.totalTasksDispatched++;

      // 通知回调
      if (this._onTaskAssigned) {
        this._onTaskAssigned(task, memberId);
      }

      // 执行 Task
      if (isSelf) {
        // Manager 自己执行
        await this._executeTaskAsMember(goal, task);
      } else {
        // 分派给其他 Member
        await this._executeTask(goal, task, member);
      }
    }
  }

  /**
   * 选择执行 Task 的 Member
   * @param {Task} task - Task 实例
   * @returns {string} memberId
   * @private
   */
  _selectMember(task) {
    // 简单策略：使用 defaultMember
    const defaultMember = this.workspace.getDefaultMember();
    return defaultMember ? defaultMember.id : 'default';
  }

  /**
   * 执行单个 Task（分派给其他 Member）
   * @param {Goal} goal - Goal 实例
   * @param {Task} task - Task 实例
   * @param {Member} member - Member 实例
   * @private
   */
  async _executeTask(goal, task, member) {
    console.log(`[Manager:${this.id}] 分派 Task: ${task.id} (${task.tool}) → ${member.name}`);

    try {
      let result;

      switch (task.tool) {
        case 'agent_chat':
          // 通用聊天任务
          result = await member.execute(task.args.message || task.description, {
            verbose: this.verbose,
          });
          break;

        case 'web_search':
        case 'web_fetch':
        case 'exec':
        default:
          // 其他工具
          result = await this._executeTool(task.tool, task.args);
      }

      // 标记成功
      goal.onTaskComplete(task.id, true, result);

      if (this._onTaskComplete) {
        this._onTaskComplete(task, true, result);
      }

      // 检查是否有新的可执行 Task
      await this._dispatchTasks(goal);

    } catch (error) {
      console.error(`[Manager:${this.id}] Task 执行失败: ${task.id} - ${error.message}`);

      // 标记失败
      goal.onTaskComplete(task.id, false, null, error.message);

      if (this._onTaskComplete) {
        this._onTaskComplete(task, false, null, error);
      }

      // 自动重试
      if (this.config.enableRetry && task.canRetry()) {
        console.log(`[Manager:${this.id}] 重试 Task: ${task.id} (${task.attempts}/${task.maxAttempts})`);
        setTimeout(() => {
          const retryTask = goal._tasksMap.get(task.id);
          if (retryTask) {
            this._executeTask(goal, retryTask, member);
          }
        }, 1000);
      }
    }
  }

  /**
   * Manager 自己执行 Task（作为 Member）
   * @param {Goal} goal - Goal 实例
   * @param {Task} task - Task 实例
   * @private
   */
  async _executeTaskAsMember(goal, task) {
    console.log(`[Manager:${this.id}] 自执行 Task: ${task.id} (${task.tool})`);

    try {
      let result;

      switch (task.tool) {
        case 'agent_chat':
          // 通用聊天任务 - 使用继承自 Member 的 execute 方法
          result = await this.execute(task.args.message || task.description, {
            verbose: this.verbose,
          });
          break;

        case 'web_search':
        case 'web_fetch':
        case 'exec':
        default:
          // 其他工具
          result = await this._executeTool(task.tool, task.args);
      }

      // 标记成功
      goal.onTaskComplete(task.id, true, result);

      if (this._onTaskComplete) {
        this._onTaskComplete(task, true, result);
      }

      // 检查是否有新的可执行 Task
      await this._dispatchTasks(goal);

    } catch (error) {
      console.error(`[Manager:${this.id}] Task 自执行失败: ${task.id} - ${error.message}`);

      // 标记失败
      goal.onTaskComplete(task.id, false, null, error.message);

      if (this._onTaskComplete) {
        this._onTaskComplete(task, false, null, error);
      }
    }
  }

  /**
   * 执行工具调用
   * @param {string} toolName - 工具名称
   * @param {object} args - 工具参数
   * @returns {Promise<object>}
   * @private
   */
  async _executeTool(toolName, args) {
    // 直接调用 SkillRegistry 的 executeToolCalls
    const toolCalls = [{
      id: `call_${Date.now()}`,
      function: {
        name: toolName,
        arguments: JSON.stringify(args),
      },
    }];

    const results = await executeToolCalls(toolCalls);

    if (results[0]?.isError) {
      throw new Error(results[0].content);
    }

    return results[0]?.content || null;
  }

  // ═══════════════════════════════════════════
  //  等待与结果
  // ═══════════════════════════════════════════

  /**
   * 等待 Goal 完成
   * @param {Goal} goal - Goal 实例
   * @private
   */
  async _waitForGoal(goal) {
    return new Promise((resolve) => {
      const checkInterval = 100; // 100ms 检查一次

      const interval = setInterval(() => {
        if (goal.isDone()) {
          clearInterval(interval);
          resolve(goal);
        }
      }, checkInterval);

      // 超时保护（5 分钟）
      setTimeout(() => {
        clearInterval(interval);
        console.warn(`[Manager:${this.id}] Goal 超时: ${goal.id}`);
        resolve(goal);
      }, 5 * 60 * 1000);
    });
  }

  /**
   * 聚合 Goal 的所有结果
   * @param {Goal} goal - Goal 实例
   * @returns {object}
   * @private
   */
  _aggregateResults(goal) {
    const results = {};

    for (const task of goal.getAllTasks()) {
      results[task.id] = {
        description: task.description,
        status: task.status,
        result: task.result,
        error: task.error,
        duration: task.duration,
      };
    }

    return results;
  }

  // ═══════════════════════════════════════════
  //  事件处理
  // ═══════════════════════════════════════════

  /**
   * Goal 完成处理
   * @param {Goal} goal - Goal 实例
   * @private
   */
  _handleGoalComplete(goal) {
    console.log(`[Manager:${this.id}] Goal 完成: ${goal.id} - ${goal.description}`);

    // 清理活跃 Goal
    setTimeout(() => {
      this._activeGoals.delete(goal.id);
    }, 5000); // 5 秒后清理

    if (this._onGoalComplete) {
      this._onGoalComplete(goal);
    }
  }

  /**
   * Goal 失败处理
   * @param {Goal} goal - Goal 实例
   * @param {object} stats - 统计信息
   * @private
   */
  _handleGoalFailed(goal, stats) {
    console.error(`[Manager:${this.id}] Goal 失败: ${goal.id} - ${goal.description}`);
    console.error(`   失败 Tasks: ${stats.failedTasks}/${stats.totalTasks}`);

    if (this._onGoalFailed) {
      this._onGoalFailed(goal, stats);
    }
  }

  // ═══════════════════════════════════════════
  //  回调注册
  // ═══════════════════════════════════════════

  /**
   * 注册 Task 分派回调
   * @param {function} callback - (task, memberId) => void
   */
  onTaskAssigned(callback) {
    this._onTaskAssigned = callback;
  }

  /**
   * 注册 Task 完成回调
   * @param {function} callback - (task, success, result, error) => void
   */
  onTaskComplete(callback) {
    this._onTaskComplete = callback;
  }

  /**
   * 注册 Goal 完成回调
   * @param {function} callback - (goal) => void
   */
  onGoalComplete(callback) {
    this._onGoalComplete = callback;
  }

  /**
   * 注册 Goal 失败回调
   * @param {function} callback - (goal, stats) => void
   */
  onGoalFailed(callback) {
    this._onGoalFailed = callback;
  }

  // ═══════════════════════════════════════════
  //  自动分解（高级功能）
  // ═══════════════════════════════════════════

  /**
   * 将任务自动分解为 DAG 规格
   * 需要 LLM 支持
   * @param {string} description - 任务描述
   * @param {object} context - 上下文
   * @returns {Promise<Array>} dagSpec
   * @private
   */
  async _resolveTaskToDag(description, context) {
    // TODO: 使用 LLM 自动分解
    console.warn('[Manager] 自动分解未实现，使用简化模式');
    return [{
      id: 'main',
      description,
      tasks: [{
        id: 't1',
        description,
        tool: 'agent_chat',
        args: { message: description },
      }],
    }];
  }

  // ═══════════════════════════════════════════
  //  工具方法
  // ═══════════════════════════════════════════

  /**
   * 获取 Manager 状态
   * @returns {object}
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      type: 'Manager',
      activeGoals: this._activeGoals.size,
      taskAssignments: this._taskAssignments.size,
      goalCount: this.goalCount,
      totalTasksDispatched: this.totalTasksDispatched,
      config: this.config,
    };
  }

  /**
   * 获取执行统计
   * @returns {object}
   */
  getStats() {
    const goals = this.getActiveGoals();
    const totalTasks = goals.reduce((sum, g) => sum + g.getAllTasks().length, 0);

    return {
      // 继承自 Member
      id: this.id,
      name: this.name,
      type: 'Manager',
      taskCount: this.taskCount,
      isActive: this.isActive,
      // Manager 特有
      activeGoals: goals.length,
      goalCount: this.goalCount,
      totalTasksDispatched: this.totalTasksDispatched,
      pendingTasks: goals.reduce((sum, g) => {
        return sum + g.getAllTasks().filter(t => t.status === TaskStatus.PENDING).length;
      }, 0),
      runningTasks: goals.reduce((sum, g) => {
        return sum + g.getAllTasks().filter(t => t.status === TaskStatus.RUNNING).length;
      }, 0),
      completedTasks: goals.reduce((sum, g) => {
        return sum + g.getAllTasks().filter(t => t.status === TaskStatus.SUCCESS).length;
      }, 0),
      failedTasks: goals.reduce((sum, g) => {
        return sum + g.getAllTasks().filter(t => t.status === TaskStatus.FAILED).length;
      }, 0),
    };
  }

  /**
   * 获取 Manager 详细信息
   * 包含继承自 Member 的信息和 Manager 特有的信息
   * @returns {object}
   */
  getInfo() {
    return {
      // 继承自 Member
      ...super.getInfo(),
      // Manager 特有
      type: 'Manager',
      workspace: this.workspace ? this.workspace.id : null,
      activeGoals: this._activeGoals.size,
      goalCount: this.goalCount,
      totalTasksDispatched: this.totalTasksDispatched,
    };
  }
}

// ─────────────────────────────────────────────
//  向后兼容：工厂函数（可选）
// ─────────────────────────────────────────────

/**
 * 创建 Manager 实例（向后兼容的工厂函数）
 *
 * @deprecated 使用 new Manager({ id, config, workspace }) 方式
 * @param {object} options - 构造函数选项
 * @returns {Manager}
 */
export function createManager(options) {
  console.warn('[Manager] createManager() 已弃用，请使用 new Manager({ id, config, workspace })');
  return new Manager(options);
}
