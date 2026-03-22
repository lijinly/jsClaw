// ─────────────────────────────────────────────
//  WebUI 服务器 —— 原生 http + SSE
// ─────────────────────────────────────────────
import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initLLM } from './llm.js';
import { Agent } from './agent.js';
import { WorkSpace } from './WorkSpace.js';
import './skills/builtins.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

// ── 初始化 LLM 和 WorkSpace ──────────────────
initLLM();
const workspace = new WorkSpace('./src/Config.json');
await workspace.initialize();

// ── 会话存储 ──────────────────────────────────
// sessions: Map<sessionId, SessionData>
// SessionData: {
//   id, title, createdAt, updatedAt,
//   mode, teamId,
//   messages: [{ role, content, thinking?, toolCalls?, executor?, ts }],
//   history: [{ role, content }],   // LLM 对话历史（不含 thinking/tool 元数据）
//   agent: Agent
// }
const sessions = new Map();

function createSession(id, opts = {}) {
  const now = Date.now();
  const session = {
    id,
    title: opts.title || '新会话',
    createdAt: now,
    updatedAt: now,
    mode: opts.mode || 'agent',
    teamId: opts.teamId || null,
    messages: [],
    history: [],
    agent: new Agent({ name: '助手', role: '智能助手' }),
  };
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  if (!sessions.has(id)) return createSession(id);
  return sessions.get(id);
}

// 根据第一条用户消息自动生成标题（截取前 20 字）
function autoTitle(text) {
  return text.length > 20 ? text.slice(0, 20) + '…' : text;
}

// 会话列表（按更新时间降序），支持按 mode 和 teamId 过滤
function listSessions(filters = {}) {
  let list = Array.from(sessions.values());
  
  // 过滤
  if (filters.mode) {
    list = list.filter(s => s.mode === filters.mode);
  }
  if (filters.teamId) {
    list = list.filter(s => s.teamId === filters.teamId);
  }
  
  return list
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(s => ({
      id: s.id,
      title: s.title,
      mode: s.mode,
      teamId: s.teamId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s.messages.length,
      preview: s.messages.findLast(m => m.role === 'assistant')?.content?.slice(0, 60) || '',
    }));
}

// ── 静态文件 MIME 类型 ───────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.ico':  'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

// ── 工具函数 ──────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ── 主路由 ────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // OPTIONS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── GET /api/teams ────────────────────────────
  if (req.method === 'GET' && pathname === '/api/teams') {
    const teams = workspace.getAllTeams().map(t => ({
      id: t.id, name: t.name,
      description: t.description,
      memberCount: t.members?.length ?? 0,
    }));
    json(res, { teams });
    return;
  }

  // ── GET /api/sessions —— 会话列表（支持 ?mode=agent|team&teamId=xxx 过滤）──
  if (req.method === 'GET' && pathname === '/api/sessions') {
    const filters = {};
    if (url.searchParams.has('mode')) filters.mode = url.searchParams.get('mode');
    if (url.searchParams.has('teamId')) filters.teamId = url.searchParams.get('teamId');
    json(res, { sessions: listSessions(filters) });
    return;
  }

  // ── POST /api/sessions —— 创建新会话 ──────────
  if (req.method === 'POST' && pathname === '/api/sessions') {
    const body = await readBody(req);
    const id = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const session = createSession(id, {
      title: body.title || '新会话',
      mode: body.mode || 'agent',
      teamId: body.teamId || null,
    });
    json(res, { session: { id: session.id, title: session.title, mode: session.mode, teamId: session.teamId, createdAt: session.createdAt, updatedAt: session.updatedAt, messageCount: 0 } });
    return;
  }

  // ── GET /api/sessions/:id —— 获取会话详情（含消息记录）──
  const sessionDetailMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (req.method === 'GET' && sessionDetailMatch) {
    const sid = decodeURIComponent(sessionDetailMatch[1]);
    const session = sessions.get(sid);
    if (!session) { json(res, { error: '会话不存在' }, 404); return; }
    json(res, {
      id: session.id,
      title: session.title,
      mode: session.mode,
      teamId: session.teamId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
    });
    return;
  }

  // ── DELETE /api/sessions/:id —— 删除会话 ──────
  if (req.method === 'DELETE' && sessionDetailMatch) {
    const sid = decodeURIComponent(sessionDetailMatch[1]);
    sessions.delete(sid);
    json(res, { success: true });
    return;
  }

  // ── PATCH /api/sessions/:id —— 更新会话标题 ───
  if (req.method === 'PATCH' && sessionDetailMatch) {
    const sid = decodeURIComponent(sessionDetailMatch[1]);
    const session = sessions.get(sid);
    if (!session) { json(res, { error: '会话不存在' }, 404); return; }
    const body = await readBody(req);
    if (body.title) session.title = body.title;
    session.updatedAt = Date.now();
    json(res, { success: true, title: session.title });
    return;
  }

  // ── POST /api/chat —— 对话（SSE）─────────────
  if (req.method === 'POST' && pathname === '/api/chat') {
    const body = await readBody(req);
    const { message, mode, teamId, sessionId } = body;

    if (!message) { json(res, { error: '消息不能为空' }, 400); return; }
    if (!sessionId) { json(res, { error: '缺少 sessionId' }, 400); return; }

    // SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const session = getSession(sessionId);
    // 更新 session 模式
    session.mode = mode || 'agent';
    session.teamId = teamId || null;

    // 记录用户消息
    const userMsg = { role: 'user', content: message, ts: Date.now() };
    session.messages.push(userMsg);

    // 首条消息自动命名会话
    if (session.messages.filter(m => m.role === 'user').length === 1) {
      session.title = autoTitle(message);
    }

    try {
      const assistantMsg = { role: 'assistant', content: '', thinking: null, toolCalls: [], executor: null, ts: Date.now() };

      if (mode === 'team' && teamId) {
        // ── Team 模式 ──────────────────────────
        send('status', { text: '正在提交任务到 Team...' });

        const taskResult = await workspace.submitTask({ description: message, teamId });

        if (taskResult.success) {
          const result = taskResult.result;

          if (result?.thinking) {
            assistantMsg.thinking = result.thinking;
            send('thinking', { text: result.thinking });
          }

          if (result?.actions?.length) {
            for (const action of result.actions) {
              for (const call of action.calls) {
                assistantMsg.toolCalls.push({ name: call.function.name, args: call.function.arguments });
                send('tool_call', { name: call.function.name, args: call.function.arguments });
              }
            }
          }

          const finalText = typeof result === 'string'
            ? result
            : result?.result ?? result?.summary ?? JSON.stringify(result, null, 2);

          assistantMsg.content = finalText;
          assistantMsg.executor = taskResult.executorName;
          send('result', { text: finalText, executor: taskResult.executorName });
        } else {
          assistantMsg.content = taskResult.error || '任务执行失败';
          send('error', { text: assistantMsg.content });
        }
      } else {
        // ── Agent 模式 ─────────────────────────
        send('status', { text: 'Agent 思考中...' });

        const { thinking, actions, result } = await session.agent.run(message, {
          history: session.history,
        });

        if (thinking) {
          assistantMsg.thinking = thinking;
          send('thinking', { text: thinking });
        }

        if (actions?.length) {
          for (const action of actions) {
            for (const call of action.calls) {
              assistantMsg.toolCalls.push({ name: call.function.name, args: call.function.arguments });
              send('tool_call', { name: call.function.name, args: call.function.arguments });
            }
          }
        }

        assistantMsg.content = result;
        assistantMsg.executor = 'Agent';
        send('result', { text: result, executor: 'Agent' });

        // 更新 LLM 对话历史
        session.history.push({ role: 'user', content: message });
        session.history.push({ role: 'assistant', content: result });
      }

      session.messages.push(assistantMsg);
      session.updatedAt = Date.now();

    } catch (err) {
      console.error('执行出错:', err);
      session.messages.push({ role: 'assistant', content: err.message || '内部错误', ts: Date.now() });
      send('error', { text: err.message || '服务器内部错误' });
    }

    send('done', {});
    res.end();
    return;
  }

  // ── 静态文件服务 ──────────────────────────────
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) filePath = path.join(PUBLIC_DIR, 'index.html');
    fs.readFile(filePath, (err2, data) => {
      if (err2) { res.writeHead(404); res.end('Not Found'); return; }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n🌐 jsClaw WebUI 已启动：http://localhost:${PORT}\n`);
});
