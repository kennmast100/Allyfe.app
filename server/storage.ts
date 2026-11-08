import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import pg from 'pg';
import type { Storage } from './core';
import type { AuthStore } from './auth';
import type { AppState } from '../src/domain/types';
import { STATE_VERSION } from '../src/domain/seed';

/** Postgres storage: one row holding the whole demo state. Fine for staging; split into tables before production. */
export async function postgresStorage(url: string): Promise<Storage & { auth: AuthStore }> {
  const pool = new pg.Pool({ connectionString: url, max: 3, ssl: /localhost|127\.0\.0\.1|\.railway\.internal/.test(url) ? false : { rejectUnauthorized: false } });
  await pool.query('create table if not exists allyfe_state (id int primary key, rev int not null, data jsonb not null, updated_at timestamptz not null default now())');
  await pool.query('create table if not exists allyfe_auth (id int primary key, data jsonb not null, updated_at timestamptz not null default now())');
  const auth: AuthStore = {
    async load() {
      const r = await pool.query('select data from allyfe_auth where id = 1');
      return r.rowCount ? r.rows[0].data : null;
    },
    async save(d) {
      await pool.query('insert into allyfe_auth (id, data, updated_at) values (1, $1, now()) on conflict (id) do update set data = excluded.data, updated_at = now()', [JSON.stringify(d)]);
    },
  };
  return {
    auth,
    async load() {
      const r = await pool.query('select rev, data from allyfe_state where id = 1');
      if (!r.rowCount) return null;
      const state = r.rows[0].data as AppState;
      return state.version === STATE_VERSION ? { state, rev: r.rows[0].rev } : null;
    },
    async save(state, rev) {
      await pool.query(
        'insert into allyfe_state (id, rev, data, updated_at) values (1, $1, $2, now()) on conflict (id) do update set rev = excluded.rev, data = excluded.data, updated_at = now()',
        [rev, JSON.stringify(state)],
      );
    },
  };
}

/** File storage for local runs. Writes to a temp file first so a crash can't leave half a file. */
export function fileStorage(path: string): Storage & { auth: AuthStore } {
  const authPath = path.replace(/\.json$/, '') + '.auth.json';
  return {
    auth: {
      async load() {
        try {
          return JSON.parse(await readFile(authPath, 'utf8'));
        } catch {
          return null;
        }
      },
      async save(d) {
        await mkdir(dirname(authPath), { recursive: true });
        await writeFile(authPath + '.tmp', JSON.stringify(d));
        await rename(authPath + '.tmp', authPath);
      },
    },
    async load() {
      try {
        const saved = JSON.parse(await readFile(path, 'utf8')) as { state: AppState; rev: number };
        return saved.state?.version === STATE_VERSION ? saved : null;
      } catch {
        return null;
      }
    },
    async save(state, rev) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path + '.tmp', JSON.stringify({ state, rev }));
      await rename(path + '.tmp', path);
    },
  };
}
