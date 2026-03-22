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
// WorkSpace 的 configPath 参数是传给 readFileSync(join(process.cwd(), configPath)) 的
// 因此需要传相对于 cwd 的路径
const workspace = new WorkSpace('./src/Config.json');
await workspace.initialize();

// 全局对话历史（按 sessionId 存储）
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { history: [], agent: new Agent({ name: '助手', role: '智能助手' }) });
  }
  return sessions.get(sessionId);
}

// ── 静态文件 MIME 类型 ───────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.ico':  'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

// ── 解析请求体 ───────────────────────────────
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

// ── 主路由处理 ───────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // ── GET /api/teams —— 获取所有 Team 列表 ──
  if (req.method === 'GET' && pathname === '/api/teams') {
    const teams = workspace.getAllTeams().map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      memberCount: t.members?.length ?? 0,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ teams }));
    return;
  }

  // ── POST /api/chat —— 对话（SSE 流式响应）──
  if (req.method === 'POST' && pathname === '/api/chat') {
    const body = await readBody(req);
    const { message, mode, teamId, sessionId = 'default' } = body;

    if (!message) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '消息不能为空' }));
      return;
    }

    // 设置 SSE 响应头
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
      const session = getSession(sessionId);

      if (mode === 'team' && teamId) {
        // ── Team 模式 ─────────────────────────
        send('status', { text: `正在提交任务到 Team...` });

        const taskResult = await workspace.submitTask({ description: message, teamId });

        if (taskResult.success) {
          const result = taskResult.result;

          // 推送思考过程（如果有）
          if (result?.thinking) {
            send('thinking', { text: result.thinking });
          }

          // 推送工具调用记录（如果有）
          if (result?.actions?.length) {
            for (const action of result.actions) {
              for (const call of action.calls) {
                send('tool_call', {
                  name: call.function.name,
                  args: call.function.arguments,
                });
              }
            }
          }

          // 推送最终结果
          const finalText = typeof result === 'string'
            ? result
            : result?.result ?? result?.summary ?? JSON.stringify(result, null, 2);

          send('result', { text: finalText, executor: taskResult.executorName });
        } else {
          send('error', { text: taskResult.error || '任务执行失败' });
        }
      } else {
        // ── Agent 模式 ────────────────────────
        send('status', { text: 'Agent 思考中...' });

        const { thinking, actions, result } = await session.agent.run(message, {
          history: session.history,
        });

        // 推送思考过程
        if (thinking) {
          send('thinking', { text: thinking });
        }

        // 推送工具调用记录
        if (actions?.length) {
          for (const action of actions) {
            for (const call of action.calls) {
              send('tool_call', {
                name: call.function.name,
                args: call.function.arguments,
              });
            }
          }
        }

        // 推送最终结果
        send('result', { text: result, executor: 'Agent' });

        // 保存历史
        session.history.push({ role: 'user', content: message });
        session.history.push({ role: 'assistant', content: result });
      }
    } catch (err) {
      console.error('执行出错:', err);
      send('error', { text: err.message || '服务器内部错误' });
    }

    send('done', {});
    res.end();
    return;
  }

  // ── POST /api/clear —— 清除会话历史 ─────────
  if (req.method === 'POST' && pathname === '/api/clear') {
    const body = await readBody(req);
    const { sessionId = 'default' } = body;
    sessions.delete(sessionId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // ── OPTIONS 预检 ─────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── 静态文件服务 ──────────────────────────────
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // 回退到 index.html（SPA 路由）
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n🌐 jsClaw WebUI 已启动：http://localhost:${PORT}\n`);
});
