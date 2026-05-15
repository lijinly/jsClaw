// ─────────────────────────────────────────────
//  Manager —— Goal 执行协调器（管理者）
// ─────────────────────────────────────────────
import { Goal, GoalStatus } from './Goal.js';
import { Task, TaskStatus } from './Task.js';
import { executeToolCalls } from './SkillRegistry.js';

/**
 * Manager 类 —— Goal 执行协调器（管理者）
 *
 * 核心职责：
 * 1. 接受任务 → 解析为 Goal（DAG 树）
 * 2. 分派 Task 给 Member 执行
 * 3. 判断执行是否达标
 * 4. 协调多个 Member 并行/顺序执行
 * 5. 处理 Task 完成通知
 *
 * 执行流程：
 * 用户提交任务 → Manager 解析为 Goal（DAG）
 *   → 获取可执行 Task → 分派给 Member
 *   → Member 执行 → 通知 Manager → 判断达标
 *   → 继续分派其他 Task → Goal 完成
 *
 * 使用示例：
 * ```javascript
 * const manager = new Manager({ workspace });
 * await manager.submit('分析市场趋势', {
 *   dagSpec: [
 *     { id: 'gather', tasks: [{ id: 't1', tool: 'web_search', args: {...} }] },
 *     { id: 'analyze', dependsOn: ['gather'], tasks: [{ id: 't2', tool: 'exec', args: {...} }] },
 *   ]
 * });
 *
 * // 或者更简单的形式：让 Manager 自动分解任务
 * const result = await manager.execute('帮我搜索最新新闻并总结');
 * ```
 */
export class Manager {
  /**
   * @param {object} options
   * @param {WorkSpace} options.workspace - 关联的工作空间
   * @param {object} [options.config] - 配置
   */
  constructor(options) {
    this.workspace = options.workspace;

    // 配置
    this.config = {
      maxParallelTasks: options.config?.maxParallelTasks || 3,
      autoResolve: options.config?.autoResolve || false,  // 自动解析任务为 DAG
      enableRetry: options.config?.enableRetry ?? true,    // 启用自动重试
      ...options.config,
    };

    // 活跃的 Goals
    this._activeGoals = new Map();

    // Member 任务分配映射: taskId -> memberId
    this._taskAssignments = new Map();

    // 回调函数
    this._onTaskAssigned = null;     // Task 分派回调 (task, memberId)
    this._onTaskComplete = null;     // Task 完成回调 (task, success)
    this._onGoalComplete = null;    // Goal 完成回调 (goal)
    this._onGoalFailed = null;      // Goal 失败回调 (goal, reason)
  }

  // ═══════════════════════════════════════════
  //  核心 API
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
   * @returns {Promise<object>} 执行结果
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
   * 同步执行（等待完成）
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
        console.warn(`[Manager] Member 不存在: ${memberId}`);
        goal.onTaskComplete(task.id, false, null, `Member 不存在: ${memberId}`);
        continue;
      }

      // 分配 Task
      this._taskAssignments.set(task.id, memberId);
      task.start(memberId);

      // 通知回调
      if (this._onTaskAssigned) {
        this._onTaskAssigned(task, memberId);
      }

      // 执行 Task
      this._executeTask(goal, task, member);
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
   * 执行单个 Task
   * @param {Goal} goal - Goal 实例
   * @param {Task} task - Task 实例
   * @param {Member} member - Member 实例
   * @private
   */
  async _executeTask(goal, task, member) {
    console.log(`[Manager] 执行 Task: ${task.id} (${task.tool}) by ${member.name}`);

    try {
      let result;

      switch (task.tool) {
        case 'agent_chat':
          // 通用聊天任务
          result = await member.execute(task.args.message || task.description, {
            verbose: true,
          });
          break;

        case 'web_search':
          // 搜索任务（使用 SkillRegistry）
          result = await this._executeTool(task.tool, task.args);
          break;

        case 'web_fetch':
          // 抓取任务
          result = await this._executeTool(task.tool, task.args);
          break;

        case 'exec':
          // 执行命令
          result = await this._executeTool(task.tool, task.args);
          break;

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
      console.error(`[Manager] Task 执行失败: ${task.id} - ${error.message}`);

      // 标记失败
      goal.onTaskComplete(task.id, false, null, error.message);

      if (this._onTaskComplete) {
        this._onTaskComplete(task, false, null, error);
      }

      // 自动重试
      if (this.config.enableRetry && task.canRetry()) {
        console.log(`[Manager] 重试 Task: ${task.id} (${task.attempts}/${task.maxAttempts})`);
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
        console.warn(`[Manager] Goal 超时: ${goal.id}`);
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
    console.log(`[Manager] Goal 完成: ${goal.id} - ${goal.description}`);

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
    console.error(`[Manager] Goal 失败: ${goal.id} - ${goal.description}`);
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
    // 提示词模板：
    // "将以下任务分解为可执行的步骤 DAG：
    //  {description}
    //
    //  每个步骤包含：
    //  - id: 唯一标识
    //  - description: 步骤描述
    //  - dependsOn: 依赖的其他步骤（可选）
    //  - tasks: 该步骤包含的具体任务
    //    - tool: 使用的工具
    //    - args: 工具参数
    //
    //  请以 JSON 数组格式返回。"

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
   */
  getStatus() {
    return {
      activeGoals: this._activeGoals.size,
      taskAssignments: this._taskAssignments.size,
      config: this.config,
    };
  }

  /**
   * 获取执行统计
   */
  getStats() {
    const goals = this.getActiveGoals();
    const totalTasks = goals.reduce((sum, g) => sum + g.getAllTasks().length, 0);

    return {
      activeGoals: goals.length,
      totalTasks,
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
}
