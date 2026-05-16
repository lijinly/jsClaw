// ─────────────────────────────────────────────
//  Service —— 应用服务层（Zone 门面）
//
//  职责：
//    1. 初始化 Zone + 默认 WorkSpace（统一入口）
//    2. Session CRUD 委托给当前 Workspace
//    3. chat() —— 统一执行入口
//    4. getMembers() —— 获取 Member 概要
//
//  Zone 持有 Workspace 实例池；
//  Service 持有当前活跃 Workspace 引用，
//  并将 Session CRUD 委托给该 Workspace。
// ─────────────────────────────────────────────
import 'dotenv/config';
import { initLLM } from './Llm.js';
import { WorkSpace } from './WorkSpace.js';
import { Session } from './Session.js';
import { getZone } from './Zone.js';
import { getConfig } from './Config.js';
import './skills/builtins.js';

// ── 内部状态 ─────────────────────────────────
let _workspace = null;   // 当前活跃 Workspace
let _zone = null;        // Zone 单例

// ── 初始化 ────────────────────────────────────

/**
 * 启动服务层
 * 幂等：重复调用返回已有 WorkSpace
 *
 * @param {object} [opts]
 * @param {string}  [opts.workspaceId='default'] - 初始加载的 Workspace
 * @returns {Promise<WorkSpace>}
 */
export async function startService(opts = {}) {
  if (_workspace) return _workspace;

  initLLM();

  const workspaceId = opts.workspaceId || 'default';
  const config = getConfig();

  // ── Zone 单例 ─────────────────────────────
  _zone = getZone();
  _zone.config = config;  // Zone 需要 Config 实例来解析路径

  await _zone.initialize();

  // ── 加载或创建 Workspace ──────────────────
  let ws = _zone.getWorkspace(workspaceId);

  if (!ws) {
    // 从注册表查找（兼容 Zone 初始化失败场景）
    const registry = _zone._loadRegistry
      ? _zone._loadRegistry()
      : { workspaces: {} };
    const meta = registry.workspaces?.[workspaceId];

    if (meta) {
      ws = await _zone.loadWorkspace(workspaceId);
    } else {
      // 未注册，创建（仅在用户显式新建时发生）
      const projectRoot = config.projectRoot;
      ws = await _zone.createWorkspace({
        id: workspaceId,
        name: workspaceId === 'default' ? '默认工作空间' : workspaceId,
        description: '服务层自动创建',
        path: projectRoot,
        configPath: `config/workspaces/${workspaceId}.json`,
      });
    }
  }

  _workspace = ws;
  return _workspace;
}

/**
 * 获取 Zone 单例（需先调用 startService）
 * @returns {import('./Zone.js').Zone}
 */
export function getZoneInstance() {
  if (!_zone) throw new Error('[Service] Zone 未初始化，请先调用 startService()');
  return _zone;
}

/**
 * 获取当前 WorkSpace（需先调用 startService）
 * @returns {WorkSpace}
 */
export function getWorkspace() {
  if (!_workspace) throw new Error('[Service] WorkSpace 未初始化，请先调用 startService()');
  return _workspace;
}

// ── Session 管理（委托给 Workspace）────────────

/**
 * 创建 Session（委托给当前 Workspace）
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.memberId='default']
 * @param {'member'|'team'} [opts.mode='member']
 * @returns {Session}
 */
export function createSession(id, opts = {}) {
  return getWorkspace().startSession({
    sessionId: id,
    memberId: opts.memberId,
    title: opts.title,
    mode: opts.mode,
    contextManager: opts.contextManager,
  });
}

/**
 * 获取 Session（委托给当前 Workspace）
 * @param {string} id
 * @returns {Session|null}
 */
export function getSession(id) {
  return getWorkspace().getSession(id);
}

/**
 * 删除 Session（委托给当前 Workspace）
 * @param {string} id
 * @returns {boolean}
 */
export function deleteSession(id) {
  return getWorkspace().closeSession(id);
}

/**
 * 更新 Session 属性（委托给当前 Workspace）
 * @param {string} id
 * @param {object} patch - { title?, mode?, memberId? }
 * @returns {Session|null}
 */
export function updateSession(id, patch = {}) {
  const session = getWorkspace().getSession(id);
  if (!session) return null;
  if (patch.title)    session.setTitle(patch.title);
  if (patch.mode)     session.setMode(patch.mode);
  if (patch.memberId) session.switchMember(patch.memberId);
  return session;
}

/**
 * 列出 Sessions（委托给当前 Workspace）
 * @param {object} [filters]
 * @param {string} [filters.memberId]
 * @param {string} [filters.mode]
 * @returns {Array<object>} 会话摘要列表
 */
export function listSessions(filters = {}) {
  let list = getWorkspace().listSessions();
  if (filters.memberId) list = list.filter(s => s.memberId === filters.memberId);
  if (filters.mode)      list = list.filter(s => s.mode === filters.mode);
  return list;
}

// ── 核心执行 ──────────────────────────────────

/**
 * 发送消息并执行
 *
 * @param {string} message          - 用户输入
 * @param {object} [opts]
 * @param {string} [opts.sessionId] - 关联 Session ID（不传则无会话上下文，走 REPL 直通模式）
 * @param {string} [opts.memberId]  - 指定 Member（覆盖 Session 现有 Member）
 * @param {boolean} [opts.verbose]  - 详细日志
 * @param {Array}   [opts.history]  - 外部历史记录（REPL 直通模式）
 * @returns {Promise<{result, thinking, actions, session?}>}
 */
export async function chat(message, opts = {}) {
  const { sessionId, memberId, verbose, history } = opts;

  // ── 有 Session 模式（Server / WebUI 用）────
  if (sessionId !== undefined) {
    let session;
    const ws = getWorkspace();

    if (ws.getSession(sessionId)) {
      session = ws.getSession(sessionId);
      if (memberId && memberId !== session.memberId) {
        session.switchMember(memberId);
      }
    } else {
      session = ws.startSession({ sessionId, memberId: memberId || 'default' });
    }

    const result = await session.userMessage(message, { verbose });
    return { ...result, session };
  }

  // ── 无 Session 模式（CLI REPL 直通）────────
  const ws = getWorkspace();
  const result = await ws.submitTask(message, { history, verbose });
  return result;
}

/**
 * 获取所有 Member 概要
 * @returns {Array<object>}
 */
export function getMembers() {
  return getWorkspace().getMemberSummaries();
}
