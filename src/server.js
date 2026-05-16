// ─────────────────────────────────────────────
//  WebUI 服务器 —— 原生 http + SSE
//
//  职责：纯 I/O 界面层
//    - HTTP 路由（REST API）
//    - SSE 流式推送
//    - 静态文件服务
//
//  业务逻辑（WorkSpace / Session / LLM）均在
//  Service.js 中处理，本文件不重复实现。
// ─────────────────────────────────────────────
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  startService,
  chat,
  getMembers,
  createSession,
  getSession,
  deleteSession,
  updateSession,
  listSessions,
} from './Service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

// ── 静态文件 MIME 类型 ───────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.ico':  'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

// ── 工具函数 ─────────────────────────────────
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

// ── 启动服务层 ────────────────────────────────
// startService 内部通过 Zone 加载默认 workspace，恢复已有 sessions
await startService();

// ── 优雅退出 ────────────────────────────────
let _server = null;
let _shuttingDown = false;

async function gracefulShutdown(signal) {
  if (_shuttingDown) return;
  _shuttingDown = true;

  console.log(`\n[Server] 收到 ${signal}，正在保存会话...`);
  try {
    const ws = getWorkspace();
    await ws.save();
    console.log('[Server] ✅ 会话已保存');
  } catch (err) {
    console.error(`[Server] ⚠️ 保存失败: ${err.message}`);
  }

  if (_server) {
    console.log('[Server] 关闭 HTTP 服务器...');
    _server.close(() => {
      console.log('[Server] ✅ HTTP 服务器已关闭');
      process.exit(0);
    });
    // 强制退出（防止 keep-alive 连接阻塞）
    setTimeout(() => process.exit(1), 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ── 主路由 ────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // OPTIONS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── GET /api/members ─────────────────────────
  if (req.method === 'GET' && pathname === '/api/members') {
    json(res, { members: getMembers() });
    return;
  }

  // ── GET /api/sessions ────────────────────────
  if (req.method === 'GET' && pathname === '/api/sessions') {
    const filters = {};
    if (url.searchParams.has('memberId')) filters.memberId = url.searchParams.get('memberId');
    if (url.searchParams.has('mode'))     filters.mode     = url.searchParams.get('mode');
    json(res, { sessions: listSessions(filters) });
    return;
  }

  // ── POST /api/sessions ───────────────────────
  if (req.method === 'POST' && pathname === '/api/sessions') {
    const body = await readBody(req);
    const id = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const session = createSession(id, {
      title:    body.title    || '新会话',
      memberId: body.memberId || 'default',
      mode:     body.mode     || 'member',
    });
    json(res, { session: session.getSummary() }, 201);
    return;
  }

  // ── /api/sessions/:id ────────────────────────
  const sessMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);

  if (req.method === 'GET' && sessMatch) {
    const sid = decodeURIComponent(sessMatch[1]);
    const session = getSession(sid);
    json(res, session.getDetail());
    return;
  }

  if (req.method === 'DELETE' && sessMatch) {
    const sid = decodeURIComponent(sessMatch[1]);
    deleteSession(sid);
    json(res, { success: true });
    return;
  }

  if (req.method === 'PATCH' && sessMatch) {
    const sid = decodeURIComponent(sessMatch[1]);
    const body = await readBody(req);
    const session = updateSession(sid, body);
    if (!session) { json(res, { error: 'Session 不存在' }, 404); return; }
    json(res, { success: true, session: session.getSummary() });
    return;
  }

  // ── POST /api/chat（SSE）─────────────────────
  if (req.method === 'POST' && pathname === '/api/chat') {
    const body = await readBody(req);
    const { message, sessionId, memberId, verbose } = body;

    if (!message) { json(res, { error: '消息不能为空' }, 400); return; }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await chat(message, {
        sessionId: sessionId || 'sess-' + Date.now(),
        memberId,
        verbose,
      });

      if (result.thinking) {
        send('thinking', { text: result.thinking });
      }

      if (result.actions) {
        for (const action of result.actions) {
          for (const call of action.calls || []) {
            send('tool_call', { name: call.function.name, args: call.function.arguments });
          }
        }
      }

      send('result', {
        text: result.result || '',
        executor: result.session?.member?.name || 'Member',
        sessionId: result.session?.id,
      });

      send('done', {
        session: result.session?.getSummary(),
        contextStats: result.session?.getContextStats(),
      });

    } catch (err) {
      console.error('[Server] 执行出错:', err);
      send('error', { text: err.message || '服务器内部错误' });
    }

    res.end();
    return;
  }

  // ── 静态文件服务 ─────────────────────────────
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

_server = server;
server.listen(PORT, () => {
  console.log(`\n🌐 jsClaw WebUI 已启动：http://localhost:${PORT}`);
  console.log(`   Members: ${getMembers().map(m => m.name).join(', ')}\n`);
});
