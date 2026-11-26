import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'public');

const port = Number.parseInt(process.env.PORT ?? '8085', 10);
const startedAt = Date.now();
const apiLatencyMs = readLatency('API_LATENCY_MS', 8);
const slowLatencyMs = readLatency('SLOW_LATENCY_MS', 25);

function readLatency(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function send(res, status, body, contentType, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-System-Under-Test': 'opsboard-local',
    ...extraHeaders,
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), 'application/json; charset=utf-8');
}

async function sendFile(res, relativePath) {
  const target = path.resolve(publicDir, `.${path.sep}${relativePath}`);
  if (!target.startsWith(publicDir + path.sep)) {
    sendJson(res, 403, { error: 'forbidden_path' });
    return;
  }

  try {
    const body = await readFile(target);
    const extension = path.extname(target);
    const contentType =
      extension === '.html'
        ? 'text/html; charset=utf-8'
        : extension === '.css'
          ? 'text/css; charset=utf-8'
          : extension === '.js'
            ? 'text/javascript; charset=utf-8'
            : 'application/octet-stream';
    send(res, 200, body, contentType);
  } catch {
    sendJson(res, 404, { error: 'not_found', path: relativePath });
  }
}

const projects = [
  { id: 1, name: 'Payments platform', status: 'healthy', owner: 'platform-team', updatedAt: '2026-11-20T09:00:00Z' },
  { id: 2, name: 'Customer portal', status: 'healthy', owner: 'web-team', updatedAt: '2026-11-20T09:05:00Z' },
  { id: 3, name: 'Identity service', status: 'degraded', owner: 'security-team', updatedAt: '2026-11-20T09:10:00Z' },
  { id: 4, name: 'Reporting pipeline', status: 'healthy', owner: 'data-team', updatedAt: '2026-11-20T09:15:00Z' },
  { id: 5, name: 'Notification hub', status: 'healthy', owner: 'platform-team', updatedAt: '2026-11-20T09:20:00Z' },
  { id: 6, name: 'Audit archive', status: 'maintenance', owner: 'security-team', updatedAt: '2026-11-20T09:25:00Z' },
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  switch (url.pathname) {
    case '/':
      await sendFile(res, 'index.html');
      return;
    case '/assets/app.css':
      await sendFile(res, 'assets/app.css');
      return;
    case '/assets/app.js':
      await sendFile(res, 'assets/app.js');
      return;
    case '/api/health': {
      await delay(Math.min(apiLatencyMs, 5));
      sendJson(res, 200, {
        status: 'ok',
        service: 'opsboard',
        version: '1.0.0',
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      });
      return;
    }
    case '/api/projects': {
      await delay(apiLatencyMs);
      sendJson(res, 200, { total: projects.length, items: projects });
      return;
    }
    case '/api/slow': {
      await delay(slowLatencyMs);
      sendJson(res, 200, { status: 'ok', latencyMs: slowLatencyMs, source: 'local-lab' });
      return;
    }
    case '/api/fault': {
      sendJson(res, 503, { status: 'planned_failure', message: 'Used by the smoke profile to verify negative-path checks.' });
      return;
    }
    default: {
      const match = url.pathname.match(/^\/api\/projects\/(\d+)$/);
      if (match) {
        await delay(apiLatencyMs);
        const project = projects.find((item) => item.id === Number(match[1]));
        if (!project) {
          sendJson(res, 404, { error: 'project_not_found', id: Number(match[1]) });
          return;
        }
        sendJson(res, 200, project);
        return;
      }
      sendJson(res, 404, { error: 'not_found', path: url.pathname });
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`opsboard listening on http://127.0.0.1:${port}`);
  console.log(`API_LATENCY_MS=${apiLatencyMs} SLOW_LATENCY_MS=${slowLatencyMs}`);
});
