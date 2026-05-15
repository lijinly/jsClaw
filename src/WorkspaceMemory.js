// ─────────────────────────────────────────────
//  WorkspaceMemory —— 工作空间记忆管理
// ─────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * WorkspaceMemory 类 —— 工作空间记忆管理
 *
 * 功能：
 * 1. 从 .memory 目录读取历史记忆
 * 2. 提炼新内容为记忆条目
 * 3. 保存记忆到 .memory 目录
 * 4. 生成记忆摘要供 system prompt 使用
 */
export class WorkspaceMemory {
  /**
   * @param {string} memoryDir - 记忆目录路径
   */
  constructor(memoryDir) {
    this.memoryDir = memoryDir;
    this.memories = [];
    this.lastUpdated = null;
  }

  /**
   * 从 .memory 目录加载所有记忆
   */
  load() {
    if (!this.memoryDir || !existsSync(this.memoryDir)) {
      console.log(`⚠️ 记忆目录不存在: ${this.memoryDir}`);
      return;
    }

    try {
      const files = readdirSync(this.memoryDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      this.memories = [];
      for (const file of mdFiles) {
        const filePath = join(this.memoryDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const stats = statSync(filePath);
        
        this.memories.push({
          file,
          content,
          updatedAt: stats.mtime,
        });
      }

      this.lastUpdated = new Date();
      console.log(`✓ 加载 ${this.memories.length} 条记忆`);
    } catch (error) {
      console.warn(`⚠️ 记忆加载失败: ${error.message}`);
    }
  }

  /**
   * 保存记忆到文件
   * @param {string} content - 记忆内容
   * @param {string} [filename] - 文件名（不含扩展名）
   * @returns {string} 保存的文件路径
   */
  save(content, filename = null) {
    if (!this.memoryDir) {
      console.warn('⚠️ 未设置记忆目录');
      return null;
    }

    // 生成文件名
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `memory-${timestamp}`;
    }

    const filePath = join(this.memoryDir, `${filename}.md`);

    try {
      // 添加时间戳头
      const header = `---\nupdated: ${new Date().toISOString()}\n---\n\n`;
      writeFileSync(filePath, header + content, 'utf-8');
      
      // 更新内存中的记录
      const existing = this.memories.findIndex(m => m.file === `${filename}.md`);
      if (existing >= 0) {
        this.memories[existing] = {
          file: `${filename}.md`,
          content,
          updatedAt: new Date(),
        };
      } else {
        this.memories.push({
          file: `${filename}.md`,
          content,
          updatedAt: new Date(),
        });
      }

      this.lastUpdated = new Date();
      console.log(`✓ 记忆已保存: ${filename}.md`);
      return filePath;
    } catch (error) {
      console.warn(`⚠️ 记忆保存失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 提炼内容为结构化记忆
   * @param {string} content - 原始内容
   * @param {object} options - 选项
   * @param {string} [options.category='general'] - 分类
   * @param {string} [options.filename] - 指定文件名
   * @returns {string} 保存的文件路径
   */
  distill(content, options = {}) {
    const { category = 'general', filename = null } = options;
    
    // 提炼为结构化格式
    const distilled = this._formatAsMemory(content, category);
    
    return this.save(distilled, filename || `distilled-${category}-${Date.now()}`);
  }

  /**
   * 格式化内容为记忆格式
   * @private
   */
  _formatAsMemory(content, category) {
    return `# 工作空间记忆 [${category}]\n\n` +
           `**提炼时间**: ${new Date().toLocaleString('zh-CN')}\n\n` +
           `## 内容\n\n${content}\n\n` +
           `## 标签\n\n- ${category}\n`;
  }

  /**
   * 更新现有记忆文件
   * @param {string} filename - 文件名（不含扩展名）
   * @param {string} newContent - 新内容
   */
  update(filename, newContent) {
    const filePath = join(this.memoryDir, `${filename}.md`);
    
    if (!existsSync(filePath)) {
      return this.save(newContent, filename);
    }

    try {
      // 读取现有内容
      const existing = readFileSync(filePath, 'utf-8');
      
      // 保留头部元信息
      let header = '';
      let body = existing;
      if (existing.startsWith('---')) {
        const endIdx = existing.indexOf('---', 3);
        if (endIdx > 0) {
          header = existing.substring(0, endIdx + 3);
          body = existing.substring(endIdx + 3);
        }
      }

      // 更新元信息中的时间
      const timestamp = `\nupdated: ${new Date().toISOString()}`;
      header = header.replace(/\nupdated:.*$/, timestamp);

      // 合并内容
      const merged = header + '\n' + newContent;
      writeFileSync(filePath, merged, 'utf-8');

      // 更新内存记录
      const idx = this.memories.findIndex(m => m.file === `${filename}.md`);
      if (idx >= 0) {
        this.memories[idx] = {
          file: `${filename}.md`,
          content: merged,
          updatedAt: new Date(),
        };
      }

      console.log(`✓ 记忆已更新: ${filename}.md`);
    } catch (error) {
      console.warn(`⚠️ 记忆更新失败: ${error.message}`);
    }
  }

  /**
   * 获取所有记忆的摘要
   * @param {object} options - 选项
   * @param {number} [options.maxLength=2000] - 最大长度
   * @returns {string} 记忆摘要
   */
  getSummary(options = {}) {
    const { maxLength = 2000 } = options;

    if (this.memories.length === 0) {
      return '';
    }

    let summary = `# 工作空间记忆摘要\n\n`;
    summary += `共 ${this.memories.length} 条记忆，最后更新: ${this.lastUpdated?.toLocaleString('zh-CN') || '未知'}\n\n`;

    // 按更新时间排序
    const sorted = [...this.memories].sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );

    for (const mem of sorted) {
      // 提取标题（第一个 # 开头的行）
      const titleMatch = mem.content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : mem.file.replace('.md', '');
      const updated = new Date(mem.updatedAt).toLocaleDateString('zh-CN');
      
      summary += `- **[${title}]** (${updated})\n`;
    }

    // 截断
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength) + '\n\n...';
    }

    return summary;
  }

  /**
   * 生成供 system prompt 使用的记忆内容
   * @param {object} options - 选项
   * @param {number} [options.maxLength=3000] - 最大长度
   * @param {string} [options.category] - 只包含指定分类
   * @returns {string} 用于 system prompt 的记忆内容
   */
  getForSystemPrompt(options = {}) {
    const { maxLength = 3000, category = null } = options;

    if (this.memories.length === 0) {
      return '';
    }

    let parts = ['## 工作空间记忆\n'];

    // 过滤指定分类
    let relevant = this.memories;
    if (category) {
      relevant = this.memories.filter(m => 
        m.content.includes(`[${category}]`)
      );
    }

    if (relevant.length === 0) {
      return '';
    }

    // 按更新时间排序，取最新的
    const sorted = [...relevant].sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );

    // 添加记忆内容
    for (const mem of sorted) {
      // 去掉头部元信息
      let content = mem.content;
      if (content.startsWith('---')) {
        const endIdx = content.indexOf('---', 3);
        if (endIdx > 0) {
          content = content.substring(endIdx + 3).trim();
        }
      }

      parts.push(`\n### ${mem.file.replace('.md', '')}\n${content}`);
    }

    const result = parts.join('\n');

    // 截断
    if (result.length > maxLength) {
      return result.substring(0, maxLength) + '\n\n...(记忆过长已截断)';
    }

    return result;
  }

  /**
   * 搜索记忆
   * @param {string} keyword - 关键词
   * @returns {Array} 匹配的记忆
   */
  search(keyword) {
    return this.memories.filter(m => 
      m.content.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * 获取记忆数量
   * @returns {number}
   */
  getCount() {
    return this.memories.length;
  }

  /**
   * 删除记忆文件
   * @param {string} filename - 文件名（不含扩展名）
   * @returns {boolean} 是否成功
   */
  delete(filename) {
    const filePath = join(this.memoryDir, `${filename}.md`);
    
    if (!existsSync(filePath)) {
      console.warn(`⚠️ 记忆文件不存在: ${filename}.md`);
      return false;
    }

    try {
      const { unlinkSync } = require('fs');
      unlinkSync(filePath);
      
      // 从内存中移除
      this.memories = this.memories.filter(m => m.file !== `${filename}.md`);
      
      console.log(`✓ 记忆已删除: ${filename}.md`);
      return true;
    } catch (error) {
      console.warn(`⚠️ 记忆删除失败: ${error.message}`);
      return false;
    }
  }
}

/**
 * 创建 WorkspaceMemory 实例
 * @param {string} memoryDir - 记忆目录路径
 * @returns {WorkspaceMemory}
 */
export function createWorkspaceMemory(memoryDir) {
  return new WorkspaceMemory(memoryDir);
}
