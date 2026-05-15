// ─────────────────────────────────────────────
//  全局工作空间 —— 系统默认工作空间
// ─────────────────────────────────────────────
import { WorkSpace } from './WorkSpace.js';
import { getSystemConfig } from './SystemConfig.js';

/**
 * 全局默认工作空间
 * 系统启动时自动创建，拥有一个 defaultMember 作为默认执行者
 */
let _defaultWorkspace = null;
let _systemConfig = null;

/**
 * 获取系统配置实例
 * @returns {SystemConfig}
 */
export function getGlobalSystemConfig() {
  if (!_systemConfig) {
    _systemConfig = getSystemConfig();
  }
  return _systemConfig;
}

/**
 * 获取全局默认工作空间
 * 如果不存在则创建
 *
 * @returns {WorkSpace} 全局工作空间实例
 */
export function getDefaultWorkspace() {
  if (!_defaultWorkspace) {
    _defaultWorkspace = new WorkSpace({
      id: 'default',
      name: '默认工作空间',
      description: '系统启动时自动创建的默认工作空间',
      systemConfig: getGlobalSystemConfig(),
    });
  }
  return _defaultWorkspace;
}

/**
 * 初始化全局工作空间
 * 在系统启动时调用
 *
 * @returns {Promise<WorkSpace>} 已初始化的全局工作空间
 */
export async function initDefaultWorkspace() {
  const workspace = getDefaultWorkspace();
  await workspace.initialize();
  return workspace;
}

/**
 * 检查全局工作空间是否已初始化
 * @returns {boolean}
 */
export function isDefaultWorkspaceReady() {
  return _defaultWorkspace !== null && _defaultWorkspace.members.size > 0;
}

/**
 * 在默认工作空间执行任务（快捷方法）
 *
 * @param {string|object} task - 任务描述或任务对象
 * @param {object} options - 执行选项
 * @returns {Promise<object>} 执行结果
 */
export async function executeInDefaultWorkspace(task, options = {}) {
  const workspace = getDefaultWorkspace();

  if (!isDefaultWorkspaceReady()) {
    await workspace.initialize();
  }

  return await workspace.submitTask(task, options);
}
