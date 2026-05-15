// ─────────────────────────────────────────────
//  Config —— 系统配置加载器
// ─────────────────────────────────────────────
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 默认项目根目录
const DEFAULT_PROJECT_ROOT = resolve(__dirname, '..');

/**
 * Config 类 —— 统一的系统配置管理
 *
 * 功能：
 * 1. 加载系统配置（config/system.json）
 * 2. 加载 workspace 配置（config/workspaces/*.json）
 * 3. 解析 member 定义（身份、性格、技能）
 */
export class Config {
  /**
   * @param {object} options - 配置选项
   * @param {string} [options.configPath] - 系统配置文件路径
   * @param {string} [options.projectRoot] - 项目根目录
   */
  constructor(options = {}) {
    // 项目根目录（默认为 src 的上级目录）
    this.projectRoot = options.projectRoot || DEFAULT_PROJECT_ROOT;

    // 系统配置文件路径
    this.systemConfigPath = options.configPath 
      || join(this.projectRoot, 'config', 'system.json');

    // 加载配置
    this.config = this.loadConfig();

    // 解析后的 workspaces
    this.workspaces = {};

    // 初始化
    this._initialize();
  }

  /**
   * 加载系统配置文件
   * @private
   */
  loadConfig() {
    try {
      if (existsSync(this.systemConfigPath)) {
        const data = readFileSync(this.systemConfigPath, 'utf-8');
        console.log(`✓ 系统配置加载: ${this.systemConfigPath}`);
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn(`⚠️ 系统配置加载失败: ${error.message}`);
    }
    return this._getDefaultConfig();
  }

  /**
   * 获取默认配置
   * @private
   */
  _getDefaultConfig() {
    return {
      version: '1.0.0',
      paths: {
        workspaces: 'config/workspaces/',
        data: 'data/',
        logs: 'logs/'
      },
      workspaces: {
        default: {
          id: 'default',
          name: '默认工作空间',
          description: '系统启动时自动创建'
        }
      },
      system: {
        defaultWorkspaceId: 'default',
        maxRounds: 10,
        verbose: false
      }
    };
  }

  /**
   * 初始化配置
   * @private
   */
  _initialize() {
    // 加载所有 workspace 配置
    this._loadWorkspaces();
  }

  /**
   * 加载所有 workspace 配置
   * @private
   */
  _loadWorkspaces() {
    const workspacesConfig = this.config.workspaces || {};

    for (const [id, workspaceMeta] of Object.entries(workspacesConfig)) {
      const workspace = {
        id: workspaceMeta.id || id,
        name: workspaceMeta.name || id,
        description: workspaceMeta.description || '',
        configPath: workspaceMeta.configPath || null,
        path: workspaceMeta.path || null,
        members: {}
      };

      // 如果有独立的配置文件，加载它
      if (workspaceMeta.configPath) {
        const fullPath = this._resolvePath(workspaceMeta.configPath);
        if (existsSync(fullPath)) {
          try {
            const workspaceConfig = JSON.parse(readFileSync(fullPath, 'utf-8'));
            // 合并 workspace 配置中的 members
            if (workspaceConfig.members) {
              workspace.members = workspaceConfig.members;
            }
            // 使用配置文件中的 path（如果存在）
            if (workspaceConfig.path) {
              workspace.path = workspaceConfig.path;
            }
            console.log(`✓ Workspace 配置加载: ${workspace.name}`);
          } catch (error) {
            console.warn(`⚠️ Workspace 配置加载失败: ${error.message}`);
          }
        }
      }

      // 确保 workspace 目录和 .memory 文件夹存在
      this._ensureWorkspaceDirs(workspace);

      this.workspaces[id] = workspace;
    }
  }

  /**
   * 确保 workspace 目录和 .memory 文件夹存在
   * @private
   */
  _ensureWorkspaceDirs(workspace) {
    if (!workspace.path) return;

    const workspacePath = this._resolvePath(workspace.path);
    const memoryPath = join(workspacePath, '.memory');

    try {
      // 创建 workspace 目录
      if (!existsSync(workspacePath)) {
        mkdirSync(workspacePath, { recursive: true });
        console.log(`✓ 创建 workspace 目录: ${workspace.path}`);
      }

      // 创建 .memory 目录
      if (!existsSync(memoryPath)) {
        mkdirSync(memoryPath, { recursive: true });
        console.log(`✓ 创建 workspace 记忆目录: ${workspace.path}/.memory/`);
      }
    } catch (error) {
      console.warn(`⚠️ 创建 workspace 目录失败: ${error.message}`);
    }
  }

  /**
   * 获取 workspace 的记忆目录路径
   * @param {string} workspaceId - workspace ID
   * @returns {string|null} 记忆目录的绝对路径
   */
  getWorkspaceMemoryPath(workspaceId) {
    const workspace = this.workspaces[workspaceId];
    if (!workspace?.path) return null;
    return join(this.projectRoot, workspace.path, '.memory');
  }

  /**
   * 获取 workspace 的数据目录路径
   * @param {string} workspaceId - workspace ID
   * @returns {string|null} 数据目录的绝对路径
   */
  getWorkspaceDataPath(workspaceId) {
    const workspace = this.workspaces[workspaceId];
    if (!workspace?.path) return null;
    return join(this.projectRoot, workspace.path);
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
   * 获取 workspace 列表
   * @returns {Array<object>} workspace 概要列表
   */
  listWorkspaces() {
    return Object.values(this.workspaces).map(ws => ({
      id: ws.id,
      name: ws.name,
      description: ws.description,
      memberCount: Object.keys(ws.members).length
    }));
  }

  /**
   * 获取 workspace 配置
   * @param {string} workspaceId - workspace ID
   * @returns {object|null} workspace 配置
   */
  getWorkspace(workspaceId) {
    return this.workspaces[workspaceId] || null;
  }

  /**
   * 获取 workspace 的 members
   * @param {string} workspaceId - workspace ID
   * @returns {Array<object>} member 列表
   */
  getWorkspaceMembers(workspaceId) {
    const workspace = this.workspaces[workspaceId];
    if (!workspace) return [];
    return Object.values(workspace.members);
  }

  /**
   * 获取默认 workspace
   * @returns {object} 默认 workspace 配置
   */
  getDefaultWorkspace() {
    const defaultId = this.config.system?.defaultWorkspaceId || 'default';
    return this.getWorkspace(defaultId);
  }

  /**
   * 获取系统配置
   * @returns {object} 系统配置
   */
  getConfig() {
    return {
      ...this.config.system,
      paths: this.config.paths,
      projectRoot: this.projectRoot
    };
  }

  /**
   * 获取完整配置信息
   * @returns {object} 完整配置
   */
  getInfo() {
    return {
      version: this.config.version,
      projectRoot: this.projectRoot,
      systemConfigPath: this.systemConfigPath,
      workspaces: this.listWorkspaces(),
      system: this.getConfig()
    };
  }
}

// 导出单例（延迟初始化）
let _instance = null;

export function getConfig(options = {}) {
  if (!_instance) {
    _instance = new Config(options);
  }
  return _instance;
}

export function resetConfig() {
  _instance = null;
}
