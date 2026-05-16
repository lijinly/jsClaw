// ─────────────────────────────────────────────
//  Zone —— Workspace 实例管理器（单例）
//
//  职责：
//    1. 持有 Workspace 实例池（懒加载）
//    2. 管理 system.json 注册表（workspace id → path）
//    3. Workspace 的 CRUD（创建/加载/关闭/删除）
//
//  不负责：
//    - Workspace 运行时状态（由 Workspace 自己管理）
//    - Session 管理（由 Workspace 自己管理）
// ─────────────────────────────────────────────
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, isAbsolute, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════
//  单例
// ═══════════════════════════════════════════
let _zoneInstance = null;

export function getZone() {
  if (!_zoneInstance) {
    _zoneInstance = new Zone();
  }
  return _zoneInstance;
}

export function resetZone() {
  _zoneInstance = null;
}

// ═══════════════════════════════════════════
//  Zone 类
// ═══════════════════════════════════════════

export class Zone {
  /**
   * @param {object} options
   * @param {string}  [options.id='default']         - Zone ID
   * @param {string}  [options.name='默认Zone']     - Zone 名称
   * @param {object}  [options.config]              - Config 实例
   * @param {string}  [options.projectRoot]          - 项目根目录
   */
  constructor(options = {}) {
    this.id = options.id || 'default';
    this.name = options.name || '默认Zone';
    this.config = options.config || null;  // Config 实例，初始化时注入

    // 项目根目录
    const srcDir = dirname(fileURLToPath(import.meta.url));
    this.projectRoot = options.projectRoot
      || resolve(srcDir, '..');

    // Workspace 实例池（懒加载：仅在 loadWorkspace 时实例化）
    this._workspaces = new Map();

    // system.json 注册表路径
    this.registryPath = join(this.projectRoot, 'config', 'system.json');

    // Zone 元信息
    this._meta = {
      id: this.id,
      name: this.name,
      loadedCount: 0,
      totalCount: 0,
    };
  }

  // ═══════════════════════════════════════════
  //  初始化
  // ═══════════════════════════════════════════

  /**
   * 初始化 Zone
   * 读取 system.json 注册表，扫描所有 Workspace 概要
   */
  async initialize() {
    console.log(`\n🌐 Zone 初始化: ${this.name} (${this.id})`);

    // 确保 config 目录存在
    const configDir = join(this.projectRoot, 'config');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // 读取注册表
    const registry = this._loadRegistry();

    // 统计
    const workspaceIds = Object.keys(registry.workspaces || {});
    this._meta.totalCount = workspaceIds.length;

    console.log(`✓ Zone 初始化完成: ${workspaceIds.length} 个 Workspace 已注册`);

    return this;
  }

  /**
   * 加载并解析 system.json 注册表
   * @private
   */
  _loadRegistry() {
    try {
      if (existsSync(this.registryPath)) {
        const data = readFileSync(this.registryPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn(`⚠️ 注册表加载失败: ${error.message}`);
    }
    return { version: '2.0.0', zone: { id: this.id, name: this.name }, workspaces: {} };
  }

  /**
   * 保存注册表到 system.json
   * @private
   */
  _saveRegistry(registry) {
    try {
      writeFileSync(this.registryPath, JSON.stringify(registry, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`注册表保存失败: ${error.message}`);
    }
  }

  // ═══════════════════════════════════════════
  //  Workspace 注册表 CRUD
  // ═══════════════════════════════════════════

  /**
   * 列出所有 Workspace 概要（仅读配置，不实例化）
   * @returns {Array<object>} Workspace 概要列表
   */
  listWorkspaces() {
    const registry = this._loadRegistry();
    const workspaces = registry.workspaces || {};

    return Object.entries(workspaces).map(([id, meta]) => ({
      id: meta.id || id,
      name: meta.name || id,
      description: meta.description || '',
      path: meta.path || '',
      configPath: meta.configPath || null,
      createdAt: meta.createdAt || null,
      isLoaded: this._workspaces.has(id),
    }));
  }

  /**
   * 获取 Workspace 实例（已在内存中）
   * @param {string} workspaceId
   * @returns {import('./Workspace.js').Workspace|null}
   */
  getWorkspace(workspaceId) {
    return this._workspaces.get(workspaceId) || null;
  }

  /**
   * 创建 Workspace
   *
   * @param {object} options
   * @param {string}  options.id          - Workspace ID（必填，全局唯一）
   * @param {string}  options.path        - 物理路径（必填，用户指定）
   * @param {string}  [options.name]     - 显示名称
   * @param {string}  [options.description]
   * @param {string}  [options.configPath] - Workspace 专属配置文件路径
   * @returns {Promise<Workspace>} 创建的 Workspace 实例
   */
  async createWorkspace(options) {
    const { id, path, name, description = '', configPath = null } = options;

    if (!id) throw new Error('workspace id 是必填项');
    if (!path) throw new Error('workspace path 是必填项（用户必须指定物理路径）');

    // 检查是否已存在
    if (this._workspaces.has(id)) {
      throw new Error(`Workspace 已加载: ${id}`);
    }
    const registry = this._loadRegistry();
    if (registry.workspaces?.[id]) {
      throw new Error(`Workspace 已注册: ${id}`);
    }

    // 解析路径
    const absolutePath = isAbsolute(path) ? path : resolve(this.projectRoot, path);

    console.log(`\n📦 创建 Workspace: ${id}`);
    console.log(`   路径: ${absolutePath}`);

    // 确保目录存在
    if (!existsSync(absolutePath)) {
      mkdirSync(absolutePath, { recursive: true });
    }

    // 创建 .workspace/sessions/ 目录
    const sessionsDir = join(absolutePath, '.workspace', 'sessions');
    if (!existsSync(sessionsDir)) {
      mkdirSync(sessionsDir, { recursive: true });
    }

    // 更新注册表
    registry.workspaces[id] = {
      id,
      name: name || id,
      description,
      path: absolutePath,
      configPath: configPath || null,
      createdAt: new Date().toISOString(),
    };
    this._saveRegistry(registry);

    // 实例化 Workspace
    const WorkSpace = (await import('./Workspace.js')).WorkSpace;
    const workspace = new WorkSpace({
      id,
      name: name || id,
      path: absolutePath,
      configPath: configPath || null,
      config: this.config,
    });

    this._workspaces.set(id, workspace);
    this._meta.loadedCount++;
    this._meta.totalCount = Object.keys(registry.workspaces).length;

    console.log(`✓ Workspace 创建成功: ${id}`);

    return workspace;
  }

  /**
   * 加载 Workspace（懒加载：实例化并初始化）
   * @param {string} workspaceId
   * @returns {Promise<Workspace>} Workspace 实例
   */
  async loadWorkspace(workspaceId) {
    // 已在内存中
    if (this._workspaces.has(workspaceId)) {
      return this._workspaces.get(workspaceId);
    }

    // 读取注册表
    const registry = this._loadRegistry();
    const meta = registry.workspaces?.[workspaceId];

    if (!meta) {
      throw new Error(`Workspace 未注册: ${workspaceId}`);
    }

    const absolutePath = meta.path;

    // 检查物理路径是否存在
    if (!existsSync(absolutePath)) {
      throw new Error(`Workspace 物理路径不存在: ${absolutePath}`);
    }

    console.log(`\n📂 加载 Workspace: ${workspaceId}`);
    console.log(`   路径: ${absolutePath}`);

    // 实例化
    const WorkSpace = (await import('./Workspace.js')).WorkSpace;
    const workspace = new WorkSpace({
      id: workspaceId,
      name: meta.name || workspaceId,
      path: absolutePath,
      configPath: meta.configPath || null,
      config: this.config,
    });

    // 初始化（自建 Manager + 恢复 Session）
    await workspace.initialize();

    this._workspaces.set(workspaceId, workspace);
    this._meta.loadedCount++;

    console.log(`✓ Workspace 加载成功: ${workspaceId}`);

    return workspace;
  }

  /**
   * 关闭 Workspace（从内存卸载，不删除文件）
   * @param {string} workspaceId
   * @returns {Promise<void>}
   */
  async closeWorkspace(workspaceId) {
    const workspace = this._workspaces.get(workspaceId);
    if (!workspace) {
      console.warn(`⚠️ Workspace 未加载: ${workspaceId}`);
      return;
    }

    // 保存状态
    await workspace.save();

    this._workspaces.delete(workspaceId);
    this._meta.loadedCount--;

    console.log(`✓ Workspace 已关闭: ${workspaceId}`);
  }

  /**
   * 删除 Workspace（从注册表移除，不删除物理文件）
   * @param {string} workspaceId
   * @param {boolean} [force=false] - 是否强制删除（即使在内存中）
   * @returns {Promise<void>}
   */
  async deleteWorkspace(workspaceId, force = false) {
    // 从内存移除
    if (this._workspaces.has(workspaceId)) {
      if (!force) {
        throw new Error(`Workspace 在内存中，请先 closeWorkspace 或使用 force`);
      }
      await this.closeWorkspace(workspaceId);
    }

    // 从注册表移除
    const registry = this._loadRegistry();
    if (!registry.workspaces?.[workspaceId]) {
      throw new Error(`Workspace 未注册: ${workspaceId}`);
    }

    delete registry.workspaces[workspaceId];
    this._saveRegistry(registry);

    this._meta.totalCount--;

    console.log(`✓ Workspace 已删除: ${workspaceId}`);
  }

  /**
   * 获取 Zone 信息
   * @returns {object}
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      projectRoot: this.projectRoot,
      loadedCount: this._meta.loadedCount,
      totalCount: this._meta.totalCount,
      workspaces: this.listWorkspaces(),
    };
  }
}

// ═══════════════════════════════════════════
//  向后兼容：保留 ZoneManager 相关导出
// ═══════════════════════════════════════════

/**
 * @deprecated 使用 getZone() 替代
 */
export class ZoneManager {
  constructor() {
    console.warn('[ZoneManager] 已弃用，请使用 getZone() 单例');
  }

  async createZone() {
    return getZone();
  }

  async getZone(id) {
    return getZone();
  }

  async getDefaultZone() {
    return getZone();
  }

  listZones() {
    return [{ id: getZone().id, name: getZone().name, workspaceCount: getZone()._meta.totalCount }];
  }
}

export function getZoneManager() {
  return new ZoneManager();
}
