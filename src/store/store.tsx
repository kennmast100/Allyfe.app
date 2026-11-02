import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DomainError, LOCAL_ONLY_ACTIONS, reduce, type Action } from '../domain/actions';
import { seedState, STATE_VERSION } from '../domain/seed';
import type { AppState, User } from '../domain/types';

/** Every screen in the app. Params travel with the route so screens stay pure. */
export type Route =
  | { name: 'home' }
  | { name: 'discover'; category?: string }
  | { name: 'pro'; id: string }
  | { name: 'postJob'; artisanId?: string; category?: string }
  | { name: 'jobPosted'; jobId: string }
  | { name: 'projects' }
  | { name: 'job'; jobId: string }
  | { name: 'bid'; jobId: string; bidId: string }
  | { name: 'rate'; jobId: string }
  | { name: 'jobs'; tab?: 'new' | 'bids' | 'mine' }
  | { name: 'quote'; jobId: string }
  | { name: 'applied'; jobId: string }
  | { name: 'verify' }
  | { name: 'profileEdit' }
  | { name: 'store'; jobId?: string }
  | { name: 'rent'; toolId: string; jobId?: string }
  | { name: 'requests' }
  | { name: 'tools' }
  | { name: 'orders'; tab?: 'new' | 'mine' }
  | { name: 'order'; jobId: string }
  | { name: 'feed' }
  | { name: 'composer' }
  | { name: 'comments'; postId: string }
  | { name: 'wallet' }
  | { name: 'alerts' }
  | { name: 'terms' }
  | { name: 'me' };

export type RouteName = Route['name'];

const STORAGE_KEY = 'allyfe-state';

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s.version === STATE_VERSION) return s;
    }
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return seedState();
}

type Ctx = {
  state: AppState;
  user: User | null;
  /** Runs an action. Returns the new state, or null (and shows the rule as a toast) if it was refused. */
  dispatch: (a: Action, success?: string) => AppState | null;
  route: Route;
  go: (r: Route) => void;
  back: () => void;
  canGoBack: boolean;
  toast: (msg: string) => void;
  toastMsg: string | null;
  online: boolean;
  /** 'local' when no server answered (data stays on this device); otherwise the server's APP_ENV, e.g. 'staging'. */
  env: string;
  forcedOffline: boolean;
  setForcedOffline: (v: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(load);
  const stateRef = useRef(state);
  const [env, setEnv] = useState('local');
  const server = useRef<{ rev: number; pending: number } | null>(null);
  /** Session is per device; shared state from the server never carries one. */
  const setState = useCallback((next: AppState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);
  const adopt = useCallback(
    (serverState: AppState, rev: number) => {
      if (server.current) server.current.rev = rev;
      const session = stateRef.current.sessionUserId;
      setState({ ...serverState, sessionUserId: session && serverState.users[session] ? session : null });
    },
    [setState],
  );
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [netOnline, setNetOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [forcedOffline, setForcedOffline] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota or blocked storage: the app still works for this session */
    }
  }, [state]);

  useEffect(() => {
    const on = () => setNetOnline(true);
    const off = () => setNetOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const online = netOnline && !forcedOffline;

  /* ---------- server sync ---------- */
  const pull = useCallback(async () => {
    const sv = server.current;
    if (!sv || sv.pending) return;
    try {
      const r = await fetch(`/api/state?since=${sv.rev}`, { cache: 'no-store' });
      if (r.status === 200 && !sv.pending) {
        const body = (await r.json()) as { rev: number; state: AppState };
        adopt(body.state, body.rev);
      }
    } catch {
      /* network blip: try again on the next tick */
    }
  }, [adopt]);

  const sendToServer = useCallback(
    async (body: { userId: string; action: Action; now: number; nonce: string }) => {
      const sv = server.current!;
      sv.pending++;
      try {
        const r = await fetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const res = (await r.json()) as { rev: number; state: AppState; error?: string };
        sv.pending--;
        if (res.error) toast(res.error);
        // The server's copy wins. While other requests are in flight, wait for the last one.
        if (!sv.pending && res.state) adopt(res.state, res.rev);
      } catch {
        sv.pending--;
        toast("Couldn't reach Allyfe. Your last change may not be saved.");
        if (!sv.pending) pull();
      }
    },
    [adopt, pull, toast],
  );

  // Find out whether a server is running. If not, the app keeps working on this device only.
  useEffect(() => {
    let alive = true;
    fetch('/api/state', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: { rev: number; env: string; state: AppState }) => {
        if (!alive || !body?.state) return;
        server.current = { rev: body.rev, pending: 0 };
        setEnv(body.env || 'server');
        adopt(body.state, body.rev);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [adopt]);

  useEffect(() => {
    if (env === 'local' || !online) return;
    const t = window.setInterval(pull, 3000);
    const onFocus = () => pull();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [env, online, pull]);

  const dispatch = useCallback(
    (a: Action, success?: string) => {
      if (!online && !['signOut', 'markAlertsRead'].includes(a.type)) {
        toast("You're offline. Reconnect and try again.");
        return null;
      }
      try {
        const now = Date.now();
        const nonce = Math.random().toString(36).slice(2, 10) + now.toString(36).slice(-4);
        const userId = stateRef.current.sessionUserId;
        const next = reduce(stateRef.current, a, now, nonce);
        setState(next);
        if (a.type === 'signIn' || a.type === 'signOut' || a.type === 'reset') setStack([{ name: 'home' }]);
        if (success) toast(success);
        if (server.current && !LOCAL_ONLY_ACTIONS.includes(a.type)) sendToServer({ userId: userId ?? '', action: a, now, nonce });
        return next;
      } catch (e) {
        if (e instanceof DomainError) {
          toast(e.message);
          return null;
        }
        throw e;
      }
    },
    [online, toast, setState, sendToServer],
  );

  const go = useCallback((r: Route) => {
    setStack((st) => (TAB_ROOTS.includes(r.name) ? [r] : [...st, r]));
    document.querySelector('.content')?.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)), []);

  const user = state.sessionUserId ? state.users[state.sessionUserId] ?? null : null;
  const value = useMemo<Ctx>(
    () => ({ state, user, dispatch, route: stack[stack.length - 1], go, back, canGoBack: stack.length > 1, toast, toastMsg, online, env, forcedOffline, setForcedOffline }),
    [state, user, dispatch, stack, go, back, toast, toastMsg, online, env, forcedOffline],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Tab roots reset the back stack. */
export const TAB_ROOTS: RouteName[] = ['home', 'discover', 'projects', 'jobs', 'feed', 'wallet', 'requests', 'tools', 'orders', 'me'];

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
