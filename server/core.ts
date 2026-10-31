import { DomainError, LOCAL_ONLY_ACTIONS, reduce, type Action } from '../src/domain/actions';
import { seedState } from '../src/domain/seed';
import type { AppState } from '../src/domain/types';

/** Where the shared state lives: Postgres on Railway, a JSON file locally. */
export interface Storage {
  load(): Promise<{ state: AppState; rev: number } | null>;
  save(state: AppState, rev: number): Promise<void>;
}

export type ActionRequest = { userId: string; action: Action; now: number; nonce: string };
export type ActionResult = { ok: true; rev: number; state: AppState } | { ok: false; status: number; error: string; rev: number; state: AppState };

const NONCE = /^[a-z0-9]{6,32}$/;

/** Holds the one shared copy of the app state and applies actions to it one at a time. */
export async function createCore(storage: Storage, opts: { allowReset?: boolean } = {}) {
  const loaded = await storage.load();
  let state: AppState = loaded?.state ?? seedState();
  let rev = loaded?.rev ?? 1;
  if (!loaded) await storage.save(state, rev);
  let queue: Promise<unknown> = Promise.resolve();

  const snapshot = () => ({ rev, state });

  function apply(req: ActionRequest): Promise<ActionResult> {
    const run = async (): Promise<ActionResult> => {
      const fail = (status: number, error: string): ActionResult => ({ ok: false, status, error, rev, state });
      if (!req || typeof req !== 'object' || !req.action || typeof req.action.type !== 'string') return fail(400, 'Bad request.');
      if (LOCAL_ONLY_ACTIONS.includes(req.action.type)) return fail(400, 'That action stays on the device.');
      if (typeof req.nonce !== 'string' || !NONCE.test(req.nonce)) return fail(400, 'Bad request.');
      const isReset = req.action.type === 'reset';
      if (isReset && opts.allowReset === false) return fail(403, 'Resetting data is turned off here.');
      if (!isReset && !state.users[req.userId]) return fail(401, 'Please sign in again.');
      // Trust the phone's clock only within a minute of the server's.
      const now = Number.isFinite(req.now) && Math.abs(req.now - Date.now()) < 60_000 ? req.now : Date.now();
      try {
        const next = reduce({ ...state, sessionUserId: isReset ? null : req.userId }, req.action, now, req.nonce);
        next.sessionUserId = null;
        state = next;
        rev += 1;
        await storage.save(state, rev);
        return { ok: true, rev, state };
      } catch (e) {
        if (e instanceof DomainError) return fail(422, e.message);
        console.error('action failed', req.action.type, e);
        return fail(500, 'Something went wrong. Please try again.');
      }
    };
    const p = queue.then(run, run);
    queue = p;
    return p;
  }

  return { snapshot, apply };
}

export function memoryStorage(): Storage {
  let saved: { state: AppState; rev: number } | null = null;
  return {
    async load() {
      return saved && structuredClone(saved);
    },
    async save(state, rev) {
      saved = structuredClone({ state, rev });
    },
  };
}
