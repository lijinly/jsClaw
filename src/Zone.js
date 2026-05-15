// ─────────────────────────────────────────────
//  Zone —— Workspace 的生命周期管理器
// ─────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 默认 zones 目录
const DEFAULT_ZONES_PATH = 'data/zones';

/**
 * Zone 类 —— Workspace 的生命周期管理器
 *
 * 职责：
 * 1. 创建新的 Workspace
 * 2. 加载已存在的 Workspace
 * 3. 保存 Workspace 状态（持久化）
 * 4. 卸载/销毁 Workspace
 * 5. Zone 间的 Workspace 迁移
 *
 * 目录结构：
 * data/zones/<zoneId>/
 * ├── meta.json          ← Zone 元信息
 * ├── workspaces/
 * │   ├── <workspaceId>/
 * │   │   ├── state.json  ← Workspace 运行时状态
 * │   │   ├── config.json ← Workspace 配置
 * │   │   └── .memory/   ← Workspace 记忆
 * │   └── ...
 * └── cache/             ← Zone 缓存
 */
export class Zone {
  /**
   * @param {object} options
   * @param {string}  [options.zoneId]        - Zone ID（默认自动生成）
   * @param {string}  [options.name]          - Zone 名称
   * @param {string}  [options.zonesRoot]      - Zones 根目录（默认 data/zones）
   * @param {string}  [options.projectRoot]    - 项目根目录
   */
  constructor(options = {}) {
    this.zoneId = options.zoneId || this._generateId();
    this.name = options.name || `Zone-${this.zoneId}`;
    this.projectRoot = options.projectRoot || resolve(__dirname, '..');

    // Zones 根目录
    this.zonesRoot = options.zonesRoot
      ? this._resolvePath(options.zonesRoot)
      : join(this.projectRoot, DEFAULT_ZONES_PATH);

    // Zone 目录
    this.zonePath = join(this.zonesRoot, this.zoneId);

    // Workspace 目录
    this.workspacesPath = join(this.zonePath, 'workspaces');

    // 缓存的 workspace 实例
    this._workspaces = new Map();

    // Zone 元信息
    this.meta = {
      id: this.zoneId,
      name: this.name,
      createdAt: null,
      updatedAt: null,
      workspaceCount: 0,
    };
  }

  // ═══════════════════════════════════════════
  //  生命周期
  // ═══════════════════════════════════════════

  /**
   * 初始化 Zone（创建目录结构，加载元信息）
   * @returns {Promise<Zone>} this
   */
  async initialize() {
    console.log(`\n🌐 初始化 Zone: ${this.name} (${this.zoneId})`);

    // 确保目录存在
    this._ensureDirectories();

    // 加载元信息
    await this._loadMeta();

    // 加载已存在的 workspace 概要
    await this._loadWorkspaceList();

    console.log(`✓ Zone 初始化完成: ${this.meta.workspaceCount} 个 Workspace`);
    return this;
  }

  /**
   * 销毁 Zone（删除所有文件和目录）
   * @param {boolean} [force=false] - 是否强制销毁（有 workspace 时也删除）
   * @returns {Promise<boolean>} 是否成功销毁
   */
  async destroy(force = false) {
    const workspaces = this.listWorkspaces();

    if (workspaces.length > 0 && !force) {
      console.warn(`⚠️ Zone 包含 ${workspaces.length} 个 Workspace，请先卸载或使用 force`);
      return false;
    }

    try {
      if (existsSync(this.zonePath)) {
        rmSync(this.zonePath, { recursive: true, force: true });
        console.log(`✓ Zone 已销毁: ${this.zoneId}`);
      }
      return true;
    } catch (error) {
      console.error(`❌ Zone 销毁失败: ${error.message}`);
      return false;
    }
  }

  // ═══════════════════════════════════════════
  //  Workspace CRUD
  // ═══════════════════════════════════════════

  /**
   * 创建新的 Workspace
   * @param {object} options
   * @param {string}  options.workspaceId     - Workspace ID
   * @param {string}  [options.name]          - Workspace 名称
   * @param {string}  [options.description]   - Workspace 描述
   * @param {object}  [options.config]        - Workspace 配置
   * @param {object}  [options.members]       - Members 配置
   * @returns {Promise<object>} 创建结果
   */
  async createWorkspace(options) {
    const { workspaceId, name, description = '', config = {}, members = [] } = options;

    if (!workspaceId) {
      throw new Error('workspaceId 是必填项');
    }

    if (this._workspaces.has(workspaceId)) {
      return {
        success: false,
        error: `Workspace 已存在: ${workspaceId}`,
        workspace: this._workspaces.get(workspaceId),
      };
    }

    console.log(`\n📦 创建 Workspace: ${workspaceId}`);

    // Workspace 目录
    const workspacePath = join(this.workspacesPath, workspaceId);
    const memoryPath = join(workspacePath, '.memory');

    // 确保目录存在
    try {
      if (!existsSync(workspacePath)) {
        mkdirSync(workspacePath, { recursive: true });
      }
      if (!existsSync(memoryPath)) {
        mkdirSync(memoryPath, { recursive: true });
      }
    } catch (error) {
      return {
        success: false,
        error: `创建目录失败: ${error.message}`,
      };
    }

    // Workspace 状态
    const workspaceState = {
      id: workspaceId,
      name: name || workspaceId,
      description,
      zoneId: this.zoneId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'created',  // created | loaded | running | saved | error
      config,
      members: members.map(m => ({
        id: m.id || this._generateId(),
        name: m.name || m.id,
        identity: m.identity || '',
        soul: m.soul || '',
        skills: m.skills || [],
      })),
    };

    // 保存状态
    const statePath = join(workspacePath, 'state.json');
    try {
      writeFileSync(statePath, JSON.stringify(workspaceState, null, 2), 'utf-8');
    } catch (error) {
      return {
        success: false,
        error: `保存状态失败: ${error.message}`,
      };
    }

    // 缓存
    this._workspaces.set(workspaceId, workspaceState);
    this.meta.workspaceCount++;
    await this._saveMeta();

    console.log(`✓ Workspace 创建成功: ${workspaceId}`);
    console.log(`   路径: ${workspacePath}`);

    return {
      success: true,
      workspace: workspaceState,
      path: workspacePath,
    };
  }

  /**
   * 加载 Workspace（将配置读入内存）
   * @param {string} workspaceId - Workspace ID
   * @returns {Promise<object|null>} Workspace 状态
   */
  async loadWorkspace(workspaceId) {
    if (this._workspaces.has(workspaceId)) {
      const ws = this._workspaces.get(workspaceId);
      ws.status = 'loaded';
      return ws;
    }

    const workspacePath = join(this.workspacesPath, workspaceId);
    const statePath = join(workspacePath, 'state.json');

    if (!existsSync(statePath)) {
      console.warn(`⚠️ Workspace 不存在: ${workspaceId}`);
      return null;
    }

    try {
      const stateData = readFileSync(statePath, 'utf-8');
      const workspaceState = JSON.parse(stateData);
      workspaceState.status = 'loaded';
      workspaceState.zoneId = this.zoneId;

      this._workspaces.set(workspaceId, workspaceState);
      console.log(`✓ Workspace 已加载: ${workspaceId}`);

      return workspaceState;
    } catch (error) {
      console.error(`❌ Workspace 加载失败: ${workspaceId} - ${error.message}`);
      return null;
    }
  }

  /**
   * 卸载 Workspace（从内存移除，不删除文件）
   * @param {string} workspaceId - Workspace ID
   * @param {boolean} [save=true] - 卸载前是否保存状态
   * @returns {Promise<boolean>}
   */
  async unloadWorkspace(workspaceId, save = true) {
    if (!this._workspaces.has(workspaceId)) {
      console.warn(`⚠️ Workspace 未加载: ${workspaceId}`);
      return false;
    }

    const workspace = this._workspaces.get(workspaceId);

    // 保存状态
    if (save) {
      await this.saveWorkspace(workspaceId);
    }

    workspace.status = 'saved';
    this._workspaces.delete(workspaceId);

    console.log(`✓ Workspace 已卸载: ${workspaceId}`);
    return true;
  }

  /**
   * 保存 Workspace 状态到磁盘
   * @param {string} workspaceId - Workspace ID
   * @returns {Promise<boolean>}
   */
  async saveWorkspace(workspaceId) {
    const workspace = this._workspaces.get(workspaceId);

    if (!workspace) {
      console.warn(`⚠️ Workspace 未加载: ${workspaceId}`);
      return false;
    }

    const workspacePath = join(this.workspacesPath, workspaceId);
    const statePath = join(workspacePath, 'state.json');

    try {
      workspace.updatedAt = new Date().toISOString();
      workspace.status = 'saved';
      writeFileSync(statePath, JSON.stringify(workspace, null, 2), 'utf-8');
      console.log(`✓ Workspace 已保存: ${workspaceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Workspace 保存失败: ${workspaceId} - ${error.message}`);
      return false;
    }
  }

  /**
   * 保存所有已加载的 Workspace
   * @returns {Promise<object>} 保存结果
   */
  async saveAll() {
    const results = { saved: [], failed: [] };

    for (const [workspaceId] of this._workspaces) {
      const ok = await this.saveWorkspace(workspaceId);
      if (ok) {
        results.saved.push(workspaceId);
      } else {
        results.failed.push(workspaceId);
      }
    }

    console.log(`\n💾 保存完成: ${results.saved.length} 成功, ${results.failed.length} 失败`);
    return results;
  }

  /**
   * 删除 Workspace（从磁盘删除）
   * @param {string} workspaceId - Workspace ID
   * @param {boolean} [force=false] - 是否强制删除（即使在内存中）
   * @returns {Promise<boolean>}
   */
  async deleteWorkspace(workspaceId, force = false) {
    // 如果在内存中，先卸载
    if (this._workspaces.has(workspaceId)) {
      if (!force) {
        console.warn(`⚠️ Workspace 在内存中，请先 unloadWorkspace 或使用 force`);
        return false;
      }
      this._workspaces.delete(workspaceId);
    }

    const workspacePath = join(this.workspacesPath, workspaceId);

    try {
      if (existsSync(workspacePath)) {
        rmSync(workspacePath, { recursive: true, force: true });
      }

      this.meta.workspaceCount--;
      await this._saveMeta();

      console.log(`✓ Workspace 已删除: ${workspaceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Workspace 删除失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取 Workspace 状态
   * @param {string} workspaceId - Workspace ID
   * @returns {object|null}
   */
  getWorkspace(workspaceId) {
    return this._workspaces.get(workspaceId) || null;
  }

  /**
   * 获取所有已加载的 Workspace
   * @returns {Array<object>}
   */
  getAllWorkspaces() {
    return Array.from(this._workspaces.values());
  }

  /**
   * 列出 Zone 中的所有 Workspace（从磁盘读取）
   * @returns {Array<object>} Workspace 概要列表
   */
  listWorkspaces() {
    if (!existsSync(this.workspacesPath)) {
      return [];
    }

    try {
      const entries = readdirSync(this.workspacesPath);
      return entries
        .filter(entry => {
          const statePath = join(this.workspacesPath, entry, 'state.json');
          return existsSync(statePath);
        })
        .map(workspaceId => {
          const statePath = join(this.workspacesPath, workspaceId, 'state.json');
          try {
            const data = readFileSync(statePath, 'utf-8');
            const state = JSON.parse(data);
            return {
              id: state.id,
              name: state.name,
              description: state.description,
              status: this._workspaces.has(state.id) ? this._workspaces.get(state.id).status : 'unloaded',
              createdAt: state.createdAt,
              updatedAt: state.updatedAt,
            };
          } catch {
            return { id: workspaceId, name: workspaceId, status: 'error' };
          }
        });
    } catch {
      return [];
    }
  }

  // ═══════════════════════════════════════════
  //  内部方法
  // ═══════════════════════════════════════════

  /**
   * 确保目录结构存在
   * @private
   */
  _ensureDirectories() {
    const dirs = [
      this.zonesRoot,
      this.zonePath,
      this.workspacesPath,
      join(this.zonePath, 'cache'),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`✓ 创建目录: ${dir}`);
      }
    }
  }

  /**
   * 加载 Zone 元信息
   * @private
   */
  async _loadMeta() {
    const metaPath = join(this.zonePath, 'meta.json');

    if (existsSync(metaPath)) {
      try {
        const data = readFileSync(metaPath, 'utf-8');
        this.meta = { ...this.meta, ...JSON.parse(data) };
      } catch (error) {
        console.warn(`⚠️ 元信息加载失败: ${error.message}`);
      }
    } else {
      this.meta.createdAt = new Date().toISOString();
      await this._saveMeta();
    }
  }

  /**
   * 保存 Zone 元信息
   * @private
   */
  async _saveMeta() {
    this.meta.updatedAt = new Date().toISOString();
    this.meta.workspaceCount = this._workspaces.size;

    const metaPath = join(this.zonePath, 'meta.json');
    try {
      writeFileSync(metaPath, JSON.stringify(this.meta, null, 2), 'utf-8');
    } catch (error) {
      console.error(`❌ 元信息保存失败: ${error.message}`);
    }
  }

  /**
   * 加载 workspace 列表
   * @private
   */
  async _loadWorkspaceList() {
    const workspaces = this.listWorkspaces();
    this.meta.workspaceCount = workspaces.length;
    await this._saveMeta();
  }

  /**
   * 解析路径
   * @private
   */
  _resolvePath(relativePath) {
    if (isAbsolute(relativePath)) {
      return relativePath;
    }
    return join(this.projectRoot, relativePath);
  }

  /**
   * 生成唯一 ID
   * @private
   */
  _generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${timestamp}-${random}`;
  }

  // ═══════════════════════════════════════════
  //  信息方法
  // ═══════════════════════════════════════════

  /**
   * 获取 Zone 信息
   * @returns {object}
   */
  getInfo() {
    return {
      id: this.zoneId,
      name: this.name,
      path: this.zonePath,
      workspacesPath: this.workspacesPath,
      loadedCount: this._workspaces.size,
      totalCount: this.meta.workspaceCount,
      createdAt: this.meta.createdAt,
      updatedAt: this.meta.updatedAt,
    };
  }

  /**
   * 打印 Zone 状态
   */
  printStatus() {
    console.log(`\n🌐 Zone: ${this.name}`);
    console.log(`   ID: ${this.zoneId}`);
    console.log(`   路径: ${this.zonePath}`);
    console.log(`   Workspace: ${this._workspaces.size}/${this.meta.workspaceCount} (已加载/总计)`);

    const workspaces = this.listWorkspaces();
    if (workspaces.length > 0) {
      console.log(`\n   Workspace 列表:`);
      for (const ws of workspaces) {
        const loaded = this._workspaces.has(ws.id);
        const statusIcon = loaded ? '●' : '○';
        console.log(`     ${statusIcon} ${ws.id} - ${ws.name} [${ws.status}]`);
      }
    }
  }
}

// ═══════════════════════════════════════════
//  ZoneManager —— 多 Zone 管理
// ═══════════════════════════════════════════

const _zones = new Map();

/**
 * ZoneManager - 多 Zone 管理器
 *
 * 功能：
 * 1. 创建/获取 Zone
 * 2. 列出所有 Zone
 * 3. 删除 Zone
 */
export class ZoneManager {
  /**
   * @param {object} options
   * @param {string}  [options.zonesRoot]   - Zones 根目录
   * @param {string}  [options.projectRoot] - 项目根目录
   */
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || resolve(__dirname, '..');
    this.zonesRoot = options.zonesRoot
      ? this._resolvePath(options.zonesRoot)
      : join(this.projectRoot, DEFAULT_ZONES_PATH);

    // 确保根目录存在
    if (!existsSync(this.zonesRoot)) {
      mkdirSync(this.zonesRoot, { recursive: true });
    }
  }

  /**
   * 创建 Zone
   * @param {object} options
   * @param {string}  [options.zoneId] - Zone ID（可选，自动生成）
   * @param {string}  [options.name]   - Zone 名称
   * @returns {Promise<Zone>}
   */
  async createZone(options = {}) {
    const zoneId = options.zoneId || this._generateId();
    const zone = new Zone({
      zoneId,
      name: options.name || `Zone-${zoneId}`,
      zonesRoot: this.zonesRoot,
      projectRoot: this.projectRoot,
    });

    await zone.initialize();
    _zones.set(zoneId, zone);

    console.log(`✓ Zone 创建成功: ${zoneId}`);
    return zone;
  }

  /**
   * 获取 Zone（已存在则返回，否则创建）
   * @param {string} zoneId - Zone ID
   * @returns {Promise<Zone|null>}
   */
  async getZone(zoneId) {
    if (_zones.has(zoneId)) {
      return _zones.get(zoneId);
    }

    // 尝试从磁盘加载
    const zonePath = join(this.zonesRoot, zoneId);
    if (!existsSync(zonePath)) {
      return null;
    }

    const zone = new Zone({
      zoneId,
      zonesRoot: this.zonesRoot,
      projectRoot: this.projectRoot,
    });

    await zone.initialize();
    _zones.set(zoneId, zone);

    return zone;
  }

  /**
   * 获取默认 Zone（名为 'default' 的 Zone）
   * @returns {Promise<Zone>}
   */
  async getDefaultZone() {
    let zone = await this.getZone('default');
    if (!zone) {
      zone = await this.createZone({ zoneId: 'default', name: '默认Zone' });
    }
    return zone;
  }

  /**
   * 删除 Zone
   * @param {string} zoneId - Zone ID
   * @returns {Promise<boolean>}
   */
  async deleteZone(zoneId) {
    const zone = _zones.get(zoneId);
    if (zone) {
      const ok = await zone.destroy(true);
      if (ok) {
        _zones.delete(zoneId);
      }
      return ok;
    }

      // 从磁盘删除
    const zonePath = join(this.zonesRoot, zoneId);
    if (!existsSync(zonePath)) {
      return false;
    }

    try {
      rmSync(zonePath, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`❌ Zone 删除失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 列出所有 Zone
   * @returns {Array<object>}
   */
  listZones() {
    try {
      const entries = readdirSync(this.zonesRoot);
      return entries
        .filter(entry => {
          const metaPath = join(this.zonesRoot, entry, 'meta.json');
          return existsSync(metaPath);
        })
        .map(zoneId => {
          const metaPath = join(this.zonesRoot, zoneId, 'meta.json');
          try {
            const data = readFileSync(metaPath, 'utf-8');
            const meta = JSON.parse(data);
            const isLoaded = _zones.has(zoneId);
            return {
              id: meta.id,
              name: meta.name,
              workspaceCount: meta.workspaceCount,
              isLoaded,
              createdAt: meta.createdAt,
              updatedAt: meta.updatedAt,
            };
          } catch {
            return { id: zoneId, name: zoneId, isLoaded: false };
          }
        });
    } catch {
      return [];
    }
  }

  /**
   * 解析路径
   * @private
   */
  _resolvePath(relativePath) {
    if (isAbsolute(relativePath)) {
      return relativePath;
    }
    return join(this.projectRoot, relativePath);
  }

  /**
   * 生成唯一 ID
   * @private
   */
  _generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${timestamp}-${random}`;
  }
}

// 导出单例
let _manager = null;

export function getZoneManager(options = {}) {
  if (!_manager) {
    _manager = new ZoneManager(options);
  }
  return _manager;
}

export function resetZoneManager() {
  _manager = null;
  _zones.clear();
}
