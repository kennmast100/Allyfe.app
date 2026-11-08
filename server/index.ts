import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createCore } from './core';
import { createAuth, termiiSender } from './auth';
import { fileStorage, postgresStorage } from './storage';
import { DEMO_ACCOUNTS } from '../src/domain/seed';
import { normalizePhone } from '../src/domain/rules';
import type { SignupProfile } from '../src/domain/actions';
import { viewFor } from '../src/domain/view';

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
const DEMO = APP_ENV !== 'production';
const core = await createCore(storage, { allowDemoActions: DEMO });
// Real texts when Termii is configured; otherwise staging shows the code on screen and production refuses.
const sms = process.env.TERMII_API_KEY ? termiiSender(process.env.TERMII_API_KEY, process.env.TERMII_SENDER_ID || 'Allyfe', process.env.TERMII_BASE_URL) : undefined;
const auth = await createAuth({ store: storage.auth, sms, showCodes: DEMO });

const userIdForPhone = (phone: string) => Object.values(core.snapshot().state.users).find((u) => normalizePhone(u.phone) === phone)?.id;
const bearer = (req: IncomingMessage) => /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
const nonce = () => randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(8, 'x').slice(0, 16);

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
      // Each person gets only what they're allowed to see.
      const userId = auth.userFor(bearer(req));
      return send(res, 200, { rev, env: APP_ENV, state: viewFor(state, userId && state.users[userId] ? userId : null) });
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return send(res, 413, { error: 'That upload is too large. Try a smaller photo.' });
      }
      const users = () => core.snapshot().state.users;
      switch (url.pathname) {
        case '/api/action': {
          // Who is acting comes from the session, never from the request body.
          const userId = auth.userFor(bearer(req));
          const isReset = (body.action as { type?: string })?.type === 'reset';
          if (!isReset && (!userId || !users()[userId])) return send(res, 401, { error: 'Please sign in again.', signedOut: true });
          const r = await core.apply({ ...(body as Parameters<typeof core.apply>[0]), userId: userId ?? '' });
          const view = viewFor(r.state, userId && r.state.users[userId] ? userId : null);
          return r.ok ? send(res, 200, { rev: r.rev, state: view }) : send(res, r.status, { error: r.error, rev: r.rev, state: view });
        }
        case '/api/auth/start': {
          const r = await auth.start(String(body.phone ?? ''), body.purpose === 'signup' ? 'signup' : 'signin', (p) => !!userIdForPhone(p));
          return r.ok ? send(res, 200, r) : send(res, r.status, { error: r.error });
        }
        case '/api/auth/verify': {
          const r = await auth.verify(String(body.phone ?? ''), String(body.code ?? ''), userIdForPhone);
          return r.ok ? send(res, 200, r) : send(res, r.status, { error: r.error });
        }
        case '/api/auth/register': {
          const phone = auth.takeTicket(String(body.ticket ?? ''));
          if (!phone) return send(res, 400, { error: 'Your phone check has expired. Start again.' });
          const r = await core.register(phone, body.profile as SignupProfile, nonce());
          if (!r.ok) return send(res, r.status, { error: r.error });
          const userId = (r as { userId: string }).userId;
          return send(res, 200, { token: await auth.issue(userId), userId, rev: r.rev, state: viewFor(r.state, userId) });
        }
        case '/api/auth/signout':
          await auth.revoke(bearer(req));
          return send(res, 200, { ok: true });
        case '/api/auth/demo': {
          // Staging only: one tap into a demo account.
          if (!DEMO) return send(res, 403, { error: 'Demo accounts are turned off here.' });
          const id = String(body.userId ?? '');
          if (!DEMO_ACCOUNTS.some((d) => d.id === id) || !users()[id]) return send(res, 404, { error: 'Demo account not found.' });
          return send(res, 200, { token: await auth.issue(id), userId: id });
        }
      }
    }
    if (url.pathname === '/api/auth/me' && req.method === 'GET') {
      const userId = auth.userFor(bearer(req));
      return userId && core.snapshot().state.users[userId] ? send(res, 200, { userId }) : send(res, 401, { error: 'Signed out' });
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
    return await serveStatic(url.pathname, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, () => console.log(`Allyfe (${APP_ENV}) on :${PORT} · storage: ${process.env.DATABASE_URL ? 'postgres' : 'file'} · sms: ${sms ? 'termii' : DEMO ? 'codes shown on screen' : 'NOT SET UP'}`));
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => server.close(() => process.exit(0)));
