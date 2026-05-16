// ─────────────────────────────────────────────
//  ContextOptimizer —— 上下文自动裁剪与优化器
// ─────────────────────────────────────────────
import { chat } from './Llm.js';

/**
 * 上下文管理器 - 自动管理对话历史，控制token消耗
 *
 * 核心策略：
 * 1. 保留系统提示（不裁剪）
 * 2. 保留最近N轮完整对话（preserveRecent）
 * 3. 旧消息压缩为摘要（summarize）
 * 4. 超过阈值触发自动裁剪（prune）
 */
export class ContextOptimizer {
  /**
   * @param {object} options
   * @param {number}  [options.maxTokens=6000]      - 最大保留token数（估算）
   * @param {number}  [options.preserveRecent=4]   - 保留最近N轮完整对话
   * @param {string}  [options.summaryModel='qwen-plus']  - 摘要模型
   * @param {number}  [options.tokenPerMessage=4]  - 每条消息的基础token开销
   * @param {number}  [options.tokenPerChar=0.25]   - 字符到token的估算比率
   * @param {boolean} [options.autoPrune=true]      - 是否自动裁剪
   */
  constructor(options = {}) {
    this.maxTokens = options.maxTokens ?? 6000;
    this.preserveRecent = options.preserveRecent ?? 4;
    this.summaryModel = options.summaryModel ?? 'qwen-plus';
    this.tokenPerMessage = options.tokenPerMessage ?? 4;
    this.tokenPerChar = options.tokenPerChar ?? 0.25;
    this.autoPrune = options.autoPrune ?? true;

    // 新增配置
    this.priorityKeywords = options.priorityKeywords || [];  // 高优先级关键词
    this.strategy = options.strategy || 'simple';            // 'simple' | 'aggressive' | 'smart'

    // 统计信息
    this.stats = {
      totalPrunes: 0,
      totalSummaries: 0,
      savedTokens: 0,
    };
  }

  /**
   * 估算消息数组的token数
   * @param {Array} messages - 消息数组
   * @returns {number} 估算的token数
   */
  estimateTokens(messages) {
    let total = 0;
    for (const msg of messages) {
      // 基础开销
      total += this.tokenPerMessage;
      // 内容开销
      if (msg.content) {
        total += msg.content.length * this.tokenPerChar;
      }
      // tool_calls 开销
      if (msg.tool_calls) {
        total += msg.tool_calls.length * 50;  // 每个 tool_call 约50 tokens
      }
      // tool 角色开销
      if (msg.role === 'tool') {
        total += 20;
      }
    }
    return Math.ceil(total);
  }

  /**
   * 判断是否需要裁剪
   * @param {Array} messages - 消息数组
   * @returns {boolean}
   */
  needsPrune(messages) {
    return this.estimateTokens(messages) > this.maxTokens;
  }

  /**
   * 自动裁剪消息数组（同步版本，根据策略选择裁剪方式）
   * 如果需要LLM摘要，请使用 pruneAsync()
   * @param {Array} messages - 原始消息数组
   * @returns {Array} 裁剪后的消息数组
   */
  prune(messages) {
    if (!this.autoPrune || messages.length < 6) {
      return messages;
    }

    if (!this.needsPrune(messages)) {
      return messages;
    }

    // 分离消息类型
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // 如果系统消息太多，也需要裁剪
    const systemTokens = this.estimateTokens(systemMessages);
    if (systemTokens > this.maxTokens * 0.3) {
      console.warn(`[ContextOptimizer] ⚠️ 系统提示过长 (${systemTokens} tokens)，建议优化`);
    }

    // 保留最近N轮完整对话
    const recentCount = this.preserveRecent * 2;  // user + assistant
    const recentMessages = nonSystemMessages.slice(-recentCount);
    const oldMessages = nonSystemMessages.slice(0, -recentCount);

    // 如果旧消息不多，直接返回
    if (oldMessages.length < 4) {
      this.stats.totalPrunes++;
      return [...systemMessages, ...recentMessages];
    }

    // 根据策略选择裁剪方式
    switch (this.strategy) {
      case 'aggressive':
        return this._aggressivePrune(systemMessages, oldMessages, recentMessages);
      case 'smart':
        return this._smartPrune(systemMessages, oldMessages, recentMessages);
      default:
        return this._simplePrune(systemMessages, oldMessages, recentMessages);
    }
  }

  /**
   * 激进策略：保留更少的历史
   * @private
   */
  _aggressivePrune(systemMessages, oldMessages, recentMessages) {
    console.log(`[ContextOptimizer] ✂️ 激进裁剪 ${oldMessages.length} 条旧消息...`);
    const removedTokens = this.estimateTokens(oldMessages);
    this.stats.savedTokens += removedTokens;
    this.stats.totalPrunes++;
    // 保留更少：只保留最近的一半
    const aggressiveRecent = recentMessages.slice(-this.preserveRecent);
    return [...systemMessages, ...aggressiveRecent];
  }

  /**
   * 智能策略：优先保留高优先级消息
   * @private
   */
  _smartPrune(systemMessages, oldMessages, recentMessages) {
    console.log(`[ContextOptimizer] 🧠 智能裁剪 ${oldMessages.length} 条旧消息...`);

    // 从旧消息中识别高优先级消息
    const priorityMessages = oldMessages.filter(m => this._containsPriorityKeyword(m.content));
    const removedTokens = this.estimateTokens(oldMessages) - this.estimateTokens(priorityMessages);
    this.stats.savedTokens += removedTokens;
    this.stats.totalPrunes++;

    // 合并：系统消息 + 高优先级 + 最近消息
    return [...systemMessages, ...priorityMessages, ...recentMessages];
  }

  /**
   * 检查消息是否包含高优先级关键词
   * @private
   */
  _containsPriorityKeyword(content) {
    if (!this.priorityKeywords.length) return false;
    return this.priorityKeywords.some(kw =>
      content?.toLowerCase().includes(kw.toLowerCase())
    );
  }

  /**
   * 简单裁剪（不使用LLM）
   * @private
   */
  _simplePrune(systemMessages, oldMessages, recentMessages) {
    console.log(`[ContextOptimizer] ✂️ 简单裁剪 ${oldMessages.length} 条旧消息...`);

    // 统计被裁剪的信息
    const removedTokens = this.estimateTokens(oldMessages);
    this.stats.savedTokens += removedTokens;
    this.stats.totalPrunes++;

    return [...systemMessages, ...recentMessages];
  }

  /**
   * 使用LLM生成摘要并重组消息
   * @private
   */
  async _compressWithSummary(systemMessages, oldMessages, recentMessages) {
    console.log(`[ContextOptimizer] 📝 压缩 ${oldMessages.length} 条旧消息为摘要...`);

    try {
      // 构建摘要提示
      const summaryPrompt = `你是一个对话摘要专家。请将以下对话历史压缩成一个简洁的摘要。

要求：
1. 保留关键信息（用户意图、已完成的任务、重要决策）
2. 移除重复内容和中间过程
3. 格式：保持为一段连贯的摘要文字
4. 长度：尽量控制在200字以内

对话历史：
${this._formatMessagesForSummary(oldMessages)}

摘要格式：
[摘要] <你的摘要内容> [/摘要]`;

      const summaryResponse = await chat(
        [
          {
            role: 'system',
            content: '你是一个专业的对话摘要助手。请简洁准确地总结对话内容。'
          },
          { role: 'user', content: summaryPrompt }
        ],
        { model: this.summaryModel, tools: [] }
      );

      const summary = summaryResponse.content.replace(/\[摘要\]|\[\/摘要\]/g, '').trim();

      // 计算节省的token
      const oldTokens = this.estimateTokens(oldMessages);
      const newTokens = summary.length * this.tokenPerChar + this.tokenPerMessage;
      this.stats.savedTokens += (oldTokens - newTokens);
      this.stats.totalSummaries++;

      console.log(`[ContextOptimizer] ✅ 摘要生成成功，节省约 ${Math.round(oldTokens - newTokens)} tokens`);

      // 返回压缩后的消息
      return [
        ...systemMessages,
        {
          role: 'system',
          content: `[历史摘要 - ${new Date().toLocaleDateString()}] ${summary}`,
        },
        ...recentMessages,
      ];
    } catch (error) {
      console.error(`[ContextOptimizer] ❌ 摘要生成失败: ${error.message}`);
      // 摘要失败时，使用简单裁剪
      this.stats.totalPrunes++;
      return [...systemMessages, ...recentMessages];
    }
  }

  /**
   * 格式化消息用于摘要
   * @private
   */
  _formatMessagesForSummary(messages) {
    return messages.map(m => {
      const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : m.role;
      const content = m.content?.substring(0, 500) || (m.tool_calls ? '[使用了工具]' : '');
      return `${role}：${content}${m.content?.length > 500 ? '...' : ''}`;
    }).join('\n');
  }

  /**
   * 手动触发裁剪（异步版本）
   * @param {Array} messages - 消息数组
   * @returns {Promise<Array>} 裁剪后的消息数组
   */
  async pruneAsync(messages) {
    if (!this.needsPrune(messages)) {
      return messages;
    }

    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const recentCount = this.preserveRecent * 2;
    const recentMessages = nonSystemMessages.slice(-recentCount);
    const oldMessages = nonSystemMessages.slice(0, -recentCount);

    if (oldMessages.length < 4) {
      this.stats.totalPrunes++;
      return [...systemMessages, ...recentMessages];
    }

    return this._compressWithSummary(systemMessages, oldMessages, recentMessages);
  }

  /**
   * 获取统计信息
   * @returns {object}
   */
  getStats() {
    return {
      ...this.stats,
      config: {
        maxTokens: this.maxTokens,
        preserveRecent: this.preserveRecent,
        strategy: this.strategy,
        priorityKeywords: this.priorityKeywords,
      },
    };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      totalPrunes: 0,
      totalSummaries: 0,
      savedTokens: 0,
    };
  }

  /**
   * 打印当前状态
   */
  logStatus(messages) {
    const tokens = this.estimateTokens(messages);
    const status = tokens > this.maxTokens ? '⚠️ 需要裁剪' : '✅ 正常';
    console.log(`[ContextOptimizer] 📊 状态: ${status} | Token: ${tokens}/${this.maxTokens} | 消息: ${messages.length}`);
  }
}

/**
 * 便捷函数：创建默认配置的 ContextOptimizer
 */
export function createContextOptimizer(options = {}) {
  return new ContextOptimizer(options);
}
