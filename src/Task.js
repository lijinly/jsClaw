// ─────────────────────────────────────────────
//  Task —— 最小执行单元
// ─────────────────────────────────────────────
import { randomUUID } from 'crypto';

/**
 * Task 状态
 */
export const TaskStatus = {
  PENDING: 'pending',     // 待执行
  RUNNING: 'running',     // 执行中
  SUCCESS: 'success',     // 成功
  FAILED: 'failed',       // 失败
  RETRY: 'retry',        // 重试中
};

/**
 * Task 类 —— 最小执行单元
 *
 * 包含：
 * - tool + args：调用的工具和参数
 * - subGoalId：所属的 SubGoal
 * - acceptanceCriteria：验收标准
 */
export class Task {
  /**
   * @param {object} options
   * @param {string}  options.taskId              - Task ID
   * @param {string}  options.description         - Task 描述
   * @param {string}  options.tool                - 工具名称
   * @param {object}  options.args                - 工具参数
   * @param {string}  [options.subGoalId]         - 所属 SubGoal ID
   * @param {object}  [options.acceptanceCriteria] - 验收标准
   */
  constructor(options) {
    this.id = options.taskId || randomUUID().substring(0, 8);
    this.description = options.description || '';
    this.tool = options.tool;
    this.args = options.args || {};

    // 所属 SubGoal
    this.subGoalId = options.subGoalId || null;

    // 验收标准
    this.acceptanceCriteria = options.acceptanceCriteria || null;

    // 执行状态
    this.status = TaskStatus.PENDING;
    this.result = null;
    this.error = null;
    this.attempts = 0;
    this.maxAttempts = options.maxAttempts || 3;

    // 执行信息
    this.memberId = null;      // 执行者
    this.startedAt = null;
    this.completedAt = null;
    this.duration = null;

    // 验收结果
    this.accepted = null;       // 是否通过验收
    this.acceptanceResult = null; // 验收详情
  }

  // ═══════════════════════════════════════════
  //  验收标准
  // ═══════════════════════════════════════════

  /**
   * 验收标准类型
   *
   * 支持三种形式：
   * 1. 函数式：{ type: 'function', fn: (result) => boolean }
   * 2. 规则式：{ type: 'rules', checks: [{ field, operator, value }] }
   * 3. 描述式：{ type: 'description', description: '描述验收标准' }（人工验收）
   *
   * 示例：
   * ```javascript
   * // 函数式
   * { type: 'function', fn: (result) => result.code === 0 }
   *
   * // 规则式
   * {
   *   type: 'rules',
   *   checks: [
   *     { field: 'status', operator: 'equals', value: 'success' },
   *     { field: 'data.length', operator: 'greaterThan', value: 0 },
   *     { field: 'error', operator: 'isNull', value: null }
   *   ]
   * }
   *
   * // 描述式（人工验收）
   * { type: 'description', description: '输出内容包含关键结论' }
   * ```
   */
  static AcceptanceCriteriaType = {
    FUNCTION: 'function',     // 函数式验收
    RULES: 'rules',          // 规则式验收
    DESCRIPTION: 'description', // 描述式（人工验收）
  };

  /**
   * 验收执行结果
   * @param {object} result - 执行结果
   * @returns {object} { passed: boolean, details: string }
   */
  validate(result) {
    if (!this.acceptanceCriteria) {
      // 无验收标准，默认通过
      return { passed: true, details: '无验收标准，默认通过' };
    }

    const criteria = this.acceptanceCriteria;

    switch (criteria.type) {
      case Task.AcceptanceCriteriaType.FUNCTION:
        return this._validateByFunction(result, criteria);

      case Task.AcceptanceCriteriaType.RULES:
        return this._validateByRules(result, criteria);

      case Task.AcceptanceCriteriaType.DESCRIPTION:
        return this._validateByDescription(result, criteria);

      default:
        return { passed: true, details: `未知验收类型: ${criteria.type}` };
    }
  }

  /**
   * 函数式验收
   * @private
   */
  _validateByFunction(result, criteria) {
    try {
      const passed = criteria.fn(result);
      return {
        passed: !!passed,
        details: passed ? '函数验收通过' : '函数验收未通过',
      };
    } catch (error) {
      return { passed: false, details: `验收函数执行失败: ${error.message}` };
    }
  }

  /**
   * 规则式验收
   * @private
   */
  _validateByRules(result, criteria) {
    const checks = criteria.checks || [];
    const results = [];

    for (const check of checks) {
      const fieldValue = this._getNestedValue(result, check.field);
      const passed = this._checkRule(fieldValue, check.operator, check.value);
      results.push({
        field: check.field,
        expected: check.value,
        actual: fieldValue,
        operator: check.operator,
        passed,
      });
    }

    const allPassed = results.every(r => r.passed);
    const details = results.map(r =>
      `${r.passed ? '✅' : '❌'} ${r.field} ${r.operator} ${JSON.stringify(r.expected)} (实际: ${JSON.stringify(r.actual)})`
    ).join('\n');

    return { passed: allPassed, details };
  }

  /**
   * 描述式验收（人工验收）
   * @private
   */
  _validateByDescription(result, criteria) {
    return {
      passed: null,  // 需要人工判断
      details: `人工验收: ${criteria.description}`,
      requiresManualReview: true,
      reviewPrompt: criteria.description,
    };
  }

  /**
   * 获取嵌套字段值
   * @private
   */
  _getNestedValue(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * 检查规则
   * @private
   */
  _checkRule(actual, operator, expected) {
    switch (operator) {
      case 'equals':
      case '==':
      case '===':
        return actual === expected;

      case 'notEquals':
      case '!=':
        return actual !== expected;

      case 'greaterThan':
      case '>':
        return actual > expected;

      case 'greaterThanOrEqual':
      case '>=':
        return actual >= expected;

      case 'lessThan':
      case '<':
        return actual < expected;

      case 'lessThanOrEqual':
      case '<=':
        return actual <= expected;

      case 'contains':
        return String(actual).includes(expected);

      case 'notContains':
        return !String(actual).includes(expected);

      case 'startsWith':
        return String(actual).startsWith(expected);

      case 'endsWith':
        return String(actual).endsWith(expected);

      case 'isNull':
        return actual === null || actual === undefined;

      case 'isNotNull':
        return actual !== null && actual !== undefined;

      case 'isEmpty':
        return actual === '' || actual === null || actual === undefined;

      case 'isNotEmpty':
        return actual !== '' && actual !== null && actual !== undefined;

      case 'matches':
        return new RegExp(expected).test(String(actual));

      case 'in':
        return Array.isArray(expected) && expected.includes(actual);

      case 'notIn':
        return Array.isArray(expected) && !expected.includes(actual);

      case 'hasKey':
        return typeof actual === 'object' && actual !== null && expected in actual;

      case 'hasLength':
        return Array.isArray(actual) || typeof actual === 'string'
          ? actual.length === expected
          : false;

      case 'lengthGreaterThan':
        return Array.isArray(actual) || typeof actual === 'string'
          ? actual.length > expected
          : false;

      default:
        console.warn(`未知操作符: ${operator}`);
        return true;
    }
  }

  // ═══════════════════════════════════════════
  //  生命周期
  // ═══════════════════════════════════════════

  /**
   * 开始执行
   * @param {string} memberId - 执行者 ID
   */
  start(memberId) {
    this.status = TaskStatus.RUNNING;
    this.memberId = memberId;
    this.startedAt = new Date().toISOString();
    this.attempts++;
    this.accepted = null;
    this.acceptanceResult = null;
  }

  /**
   * 标记成功（自动验收）
   * @param {object} result - 执行结果
   * @param {boolean} [skipValidation=false] - 是否跳过验收
   */
  succeed(result, skipValidation = false) {
    this.status = TaskStatus.SUCCESS;
    this.result = result;
    this.completedAt = new Date().toISOString();
    this.duration = new Date(this.completedAt) - new Date(this.startedAt);

    // 自动验收
    if (!skipValidation) {
      const validation = this.validate(result);
      this.accepted = validation.passed;
      this.acceptanceResult = validation;

      if (!validation.passed && validation.passed !== null) {
        console.warn(`[Task] 验收未通过: ${this.id}\n${validation.details}`);
      }
    }
  }

  /**
   * 标记失败
   * @param {string} error - 错误信息
   */
  fail(error) {
    this.error = error;
    this.completedAt = new Date().toISOString();
    this.duration = new Date(this.completedAt) - new Date(this.startedAt);

    // 判断是否重试
    if (this.attempts < this.maxAttempts) {
      this.status = TaskStatus.RETRY;
    } else {
      this.status = TaskStatus.FAILED;
      this.accepted = false;
      this.acceptanceResult = { passed: false, details: `执行失败: ${error}` };
    }
  }

  /**
   * 手动确认验收结果（用于人工验收）
   * @param {boolean} accepted - 是否通过
   * @param {string} [notes] - 备注
   */
  confirmAcceptance(accepted, notes = '') {
    this.accepted = accepted;
    this.acceptanceResult = {
      passed: accepted,
      details: notes || (accepted ? '人工确认通过' : '人工确认未通过'),
      confirmedAt: new Date().toISOString(),
    };
  }

  /**
   * 是否可重试
   */
  canRetry() {
    return this.status === TaskStatus.RETRY && this.attempts < this.maxAttempts;
  }

  /**
   * 是否完成（成功或失败）
   */
  isDone() {
    return this.status === TaskStatus.SUCCESS || this.status === TaskStatus.FAILED;
  }

  /**
   * 是否达标（执行成功且验收通过）
   */
  isAccepted() {
    return this.status === TaskStatus.SUCCESS && this.accepted === true;
  }

  /**
   * 是否需要人工验收
   */
  requiresManualReview() {
    return this.acceptanceCriteria?.type === Task.AcceptanceCriteriaType.DESCRIPTION;
  }

  // ═══════════════════════════════════════════
  //  信息
  // ═══════════════════════════════════════════

  /**
   * 获取 Task 概要
   */
  getSummary() {
    return {
      id: this.id,
      description: this.description,
      tool: this.tool,
      subGoalId: this.subGoalId,
      status: this.status,
      accepted: this.accepted,
      attempts: this.attempts,
      duration: this.duration,
      memberId: this.memberId,
      hasAcceptanceCriteria: !!this.acceptanceCriteria,
    };
  }

  /**
   * 获取完整状态
   */
  getFullStatus() {
    return {
      ...this.getSummary(),
      args: this.args,
      acceptanceCriteria: this.acceptanceCriteria,
      acceptanceResult: this.acceptanceResult,
      result: this.result,
      error: this.error,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      requiresManualReview: this.requiresManualReview(),
    };
  }

  // ═══════════════════════════════════════════
  //  持久化
  // ═══════════════════════════════════════════

  /**
   * 导出状态
   */
  export() {
    return {
      id: this.id,
      description: this.description,
      tool: this.tool,
      args: this.args,
      subGoalId: this.subGoalId,
      acceptanceCriteria: this.acceptanceCriteria,
      status: this.status,
      result: this.result,
      error: this.error,
      accepted: this.accepted,
      acceptanceResult: this.acceptanceResult,
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      memberId: this.memberId,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.duration,
    };
  }

  /**
   * 从导出数据恢复
   */
  static fromExport(data) {
    const task = new Task({
      taskId: data.id,
      description: data.description,
      tool: data.tool,
      args: data.args,
      subGoalId: data.subGoalId,
      acceptanceCriteria: data.acceptanceCriteria,
      maxAttempts: data.maxAttempts,
    });
    task.status = data.status;
    task.result = data.result;
    task.error = data.error;
    task.accepted = data.accepted;
    task.acceptanceResult = data.acceptanceResult;
    task.attempts = data.attempts || 0;
    task.memberId = data.memberId;
    task.startedAt = data.startedAt;
    task.completedAt = data.completedAt;
    task.duration = data.duration;
    return task;
  }
}
