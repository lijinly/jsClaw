// ─────────────────────────────────────────────
//  SystemConfig —— 系统配置加载器
// ─────────────────────────────────────────────
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 默认项目根目录
const DEFAULT_PROJECT_ROOT = resolve(__dirname, '..');

/**
 * SystemConfig 类 —— 统一的系统配置管理
 *
 * 功能：
 * 1. 加载系统配置（config/system.json）
 * 2. 加载 workspace 配置（config/workspaces/*.json）
 * 3. 解析 member 定义（身份、性格、技能）
 * 4. 管理路径解析（支持相对路径和绝对路径）
 */
export class SystemConfig {
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
    this.config = this.loadSystemConfig();

    // 解析后的 workspaces 和 members
    this.workspaces = {};
    this.members = {};

    // 初始化
    this._initialize();
  }

  /**
   * 加载系统配置文件
   * @private
   */
  loadSystemConfig() {
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
        workspaces: 'workspaces/',
        members: 'members/',
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
      members: {
        default: {
          id: 'default',
          name: '管理者',
          role: '工作空间管理者',
          skills: []
        }
      },
      system: {
        defaultMemberId: 'default',
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
    // 加载全局 members 定义
    this._loadGlobalMembers();

    // 加载所有 workspace 配置
    this._loadWorkspaces();
  }

  /**
   * 加载全局成员定义
   * @private
   */
  _loadGlobalMembers() {
    const globalMembers = this.config.members || {};
    
    for (const [id, memberConfig] of Object.entries(globalMembers)) {
      // 解析路径（相对于项目根目录）
      const resolvedConfig = this._resolveMemberPaths(id, memberConfig);
      this.members[id] = resolvedConfig;
    }
  }

  /**
   * 加载所有 workspace 配置
   * @private
   */
  _loadWorkspaces() {
    const workspacesConfig = this.config.workspaces || {};
    const workspaceConfigsDir = join(this.projectRoot, 'config', 'workspaces');

    for (const [id, workspaceMeta] of Object.entries(workspacesConfig)) {
      const workspace = {
        id: workspaceMeta.id || id,
        name: workspaceMeta.name || id,
        description: workspaceMeta.description || '',
        configPath: workspaceMeta.configPath || null,
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
              for (const [memberId, memberConfig] of Object.entries(workspaceConfig.members)) {
                workspace.members[memberId] = this._resolveMemberPaths(memberId, memberConfig);
              }
            }
            console.log(`✓ Workspace 配置加载: ${workspace.name}`);
          } catch (error) {
            console.warn(`⚠️ Workspace 配置加载失败: ${error.message}`);
          }
        }
      }

      this.workspaces[id] = workspace;
    }
  }

  /**
   * 解析 member 的路径
   * @private
   */
  _resolveMemberPaths(memberId, memberConfig) {
    const paths = this.config.paths || {};
    const membersBasePath = paths.members || 'members/';

    // identity.md 路径
    let identityPath = memberConfig.identityPath;
    if (!identityPath) {
      identityPath = join(membersBasePath, memberId, 'identity.md');
    } else if (!isAbsolute(identityPath)) {
      identityPath = join(this.projectRoot, identityPath);
    }

    // soul.md 路径
    let soulPath = memberConfig.soulPath;
    if (!soulPath) {
      soulPath = join(membersBasePath, memberId, 'soul.md');
    } else if (!isAbsolute(soulPath)) {
      soulPath = join(this.projectRoot, soulPath);
    }

    return {
      ...memberConfig,
      identityPath: this._normalizePath(identityPath),
      soulPath: this._normalizePath(soulPath),
    };
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
   * 规范化路径（转为正斜杠）
   * @private
   */
  _normalizePath(path) {
    return path.replace(/\\/g, '/');
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

    // 如果 workspace 没有独立的 members，使用全局 members
    if (Object.keys(workspace.members).length === 0) {
      return Object.values(this.members);
    }

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
   * 获取默认 member
   * @param {string} [workspaceId] - workspace ID（可选）
   * @returns {object|null} 默认 member 配置
   */
  getDefaultMember(workspaceId) {
    const defaultId = this.config.system?.defaultMemberId || 'default';

    if (workspaceId) {
      const workspace = this.workspaces[workspaceId];
      if (workspace?.members?.[defaultId]) {
        return workspace.members[defaultId];
      }
    }

    return this.members[defaultId] || null;
  }

  /**
   * 获取 member 配置
   * @param {string} memberId - member ID
   * @param {string} [workspaceId] - workspace ID（可选）
   * @returns {object|null} member 配置
   */
  getMember(memberId, workspaceId) {
    // 先在 workspace 中查找
    if (workspaceId) {
      const workspace = this.workspaces[workspaceId];
      if (workspace?.members?.[memberId]) {
        return workspace.members[memberId];
      }
    }

    // 再在全局 members 中查找
    return this.members[memberId] || null;
  }

  /**
   * 获取系统配置
   * @returns {object} 系统配置
   */
  getSystemConfig() {
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
      memberCount: Object.keys(this.members).length,
      system: this.getSystemConfig()
    };
  }
}

// 导出单例（延迟初始化）
let _instance = null;

export function getSystemConfig(options = {}) {
  if (!_instance) {
    _instance = new SystemConfig(options);
  }
  return _instance;
}

export function resetSystemConfig() {
  _instance = null;
}
