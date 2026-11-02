import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createCore } from './core';
import { fileStorage, postgresStorage } from './storage';

const PORT = Number(process.env.PORT) || 3000;
const APP_ENV = process.env.APP_ENV || 'local';
const DIST = resolve(process.env.STATIC_DIR || 'dist');
const MAX_BODY = 8 * 1024 * 1024; // photos travel as data URLs

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const storage = process.env.DATABASE_URL ? await postgresStorage(process.env.DATABASE_URL) : fileStorage(process.env.DATA_FILE || 'data/state.json');
// Testing shortcuts (reset, demo approvals, moving dates) are never allowed in production.
const core = await createCore(storage, { allowDemoActions: APP_ENV !== 'production' });

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        fail(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

async function serveStatic(pathname: string, res: ServerResponse) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, safe);
  if (!file.startsWith(DIST + sep)) return send(res, 404, { error: 'Not found' });
  try {
    if (!(await stat(file)).isFile()) throw new Error('dir');
  } catch {
    file = join(DIST, 'index.html'); // single-page app: unknown paths load the app
  }
  const ext = extname(file);
  const headers: Record<string, string> = { 'content-type': MIME[ext] || 'application/octet-stream' };
  headers['cache-control'] = file.includes(`${join(DIST, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, headers);
  res.end(await readFile(file));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  try {
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, env: APP_ENV, rev: core.snapshot().rev });
    if (url.pathname === '/api/state' && req.method === 'GET') {
      const { rev, state } = core.snapshot();
      if (url.searchParams.get('since') === String(rev)) {
        res.writeHead(204, { 'cache-control': 'no-store' });
        return res.end();
      }
      return send(res, 200, { rev, env: APP_ENV, state });
    }
    if (url.pathname === '/api/action' && req.method === 'POST') {
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return send(res, 413, { error: 'That upload is too large. Try a smaller photo.' });
      }
      const r = await core.apply(body as Parameters<typeof core.apply>[0]);
      return r.ok ? send(res, 200, { rev: r.rev, state: r.state }) : send(res, r.status, { error: r.error, rev: r.rev, state: r.state });
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
    return await serveStatic(url.pathname, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, () => console.log(`Allyfe (${APP_ENV}) on :${PORT} · storage: ${process.env.DATABASE_URL ? 'postgres' : 'file'}`));
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => server.close(() => process.exit(0)));
