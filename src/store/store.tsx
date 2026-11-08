import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DomainError, LOCAL_ONLY_ACTIONS, reduce, type Action, type SignupProfile } from '../domain/actions';
import { normalizePhone } from '../domain/rules';
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

const TOKEN_KEY = 'allyfe-token';
const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
const writeToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* blocked storage: the session lasts until the tab closes */
  }
};

export type AuthResult = { ok: true; demoCode?: string } | { ok: false; error: string };
export type VerifyResult = { ok: true; signedIn: true } | { ok: true; signedIn: false; ticket: string } | { ok: false; error: string };
export type AuthApi = {
  /** Sends (or, on staging, shows) a 6-digit code. */
  start: (phone: string, purpose: 'signin' | 'signup') => Promise<AuthResult>;
  verify: (phone: string, code: string) => Promise<VerifyResult>;
  register: (ticket: string, profile: SignupProfile) => Promise<AuthResult>;
  /** Staging only: one tap into a demo account. */
  demo: (userId: string) => Promise<AuthResult>;
  signOut: () => void;
};

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
  auth: AuthApi;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(load);
  const stateRef = useRef(state);
  const [env, setEnv] = useState('local');
  const server = useRef<{ rev: number; pending: number } | null>(null);
  const token = useRef<string | null>(readToken());
  /** Codes for local runs with no server (shown on screen, never sent). */
  const localCodes = useRef(new Map<string, string>());
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
        const r = await fetch('/api/action', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token.current ? { authorization: `Bearer ${token.current}` } : {}) },
          body: JSON.stringify(body),
        });
        const res = (await r.json()) as { rev: number; state: AppState; error?: string; signedOut?: boolean };
        sv.pending--;
        if (res.signedOut) {
          token.current = null;
          writeToken(null);
          setState({ ...stateRef.current, sessionUserId: null });
          setStack([{ name: 'home' }]);
          toast('Please sign in again.');
          return;
        }
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
      .then(async (body: { rev: number; env: string; state: AppState }) => {
        if (!alive || !body?.state) return;
        server.current = { rev: body.rev, pending: 0 };
        setEnv(body.env || 'server');
        // With a server, only a valid session signs you in, never a cached user id.
        let userId: string | null = null;
        if (token.current) {
          const me = await fetch('/api/auth/me', { headers: { authorization: `Bearer ${token.current}` } }).catch(() => null);
          if (me?.ok) userId = ((await me.json()) as { userId: string }).userId;
          else if (me?.status === 401) {
            token.current = null;
            writeToken(null);
          }
        }
        if (!alive) return;
        if (server.current) server.current.rev = body.rev;
        setState({ ...body.state, sessionUserId: userId && body.state.users[userId] ? userId : null });
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

  /* ---------- sign in & sign up ---------- */
  const post = async (path: string, body: unknown) => {
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token.current ? { authorization: `Bearer ${token.current}` } : {}) }, body: JSON.stringify(body) });
      return (await r.json()) as Record<string, unknown> & { error?: string };
    } catch {
      return { error: "Couldn't reach Allyfe. Check your connection and try again." };
    }
  };
  const signedIn = useCallback(
    (userId: string, newToken?: string, fresh?: { rev: number; state: AppState }) => {
      if (newToken) {
        token.current = newToken;
        writeToken(newToken);
      }
      if (fresh && server.current) server.current.rev = fresh.rev;
      const base = fresh?.state ?? stateRef.current;
      setState({ ...base, sessionUserId: userId });
      setStack([{ name: 'home' }]);
    },
    [setState],
  );
  const auth = useMemo<AuthApi>(
    () => ({
      async start(phone, purpose) {
        if (!online) return { ok: false, error: "You're offline. Reconnect and try again." };
        if (server.current) {
          const r = await post('/api/auth/start', { phone, purpose });
          return r.error ? { ok: false, error: r.error } : { ok: true, demoCode: r.demoCode as string | undefined };
        }
        // No server (local run): same rules, code shown on screen.
        const p = normalizePhone(phone);
        if (!p) return { ok: false, error: 'Enter a valid Nigerian mobile number, e.g. 0803 123 4567.' };
        const exists = Object.values(stateRef.current.users).some((u) => normalizePhone(u.phone) === p);
        if (purpose === 'signin' && !exists) return { ok: false, error: 'No Allyfe account uses this number. Create an account instead.' };
        if (purpose === 'signup' && exists) return { ok: false, error: 'This number already has an Allyfe account. Sign in instead.' };
        const code = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
        localCodes.current.set(p, code);
        return { ok: true, demoCode: code };
      },
      async verify(phone, code) {
        if (server.current) {
          const r = await post('/api/auth/verify', { phone, code });
          if (r.error) return { ok: false, error: r.error };
          if (r.token) {
            signedIn(r.userId as string, r.token as string);
            return { ok: true, signedIn: true };
          }
          return { ok: true, signedIn: false, ticket: r.ticket as string };
        }
        const p = normalizePhone(phone);
        if (!p || localCodes.current.get(p) !== code) return { ok: false, error: 'Wrong code.' };
        localCodes.current.delete(p);
        const u = Object.values(stateRef.current.users).find((x) => normalizePhone(x.phone) === p);
        if (u) {
          signedIn(u.id);
          return { ok: true, signedIn: true };
        }
        return { ok: true, signedIn: false, ticket: p };
      },
      async register(ticket, profile) {
        if (server.current) {
          const r = await post('/api/auth/register', { ticket, profile });
          if (r.error) return { ok: false, error: r.error };
          signedIn(r.userId as string, r.token as string, { rev: r.rev as number, state: r.state as AppState });
          return { ok: true };
        }
        try {
          const next = reduce({ ...stateRef.current, sessionUserId: null }, { type: 'registerUser', phone: ticket, profile }, Date.now());
          signedIn(next.sessionUserId!, undefined, { rev: 0, state: next });
          return { ok: true };
        } catch (e) {
          if (e instanceof DomainError) return { ok: false, error: e.message };
          throw e;
        }
      },
      async demo(userId) {
        if (server.current) {
          const r = await post('/api/auth/demo', { userId });
          if (r.error) return { ok: false, error: r.error };
          signedIn(userId, r.token as string);
          return { ok: true };
        }
        signedIn(userId);
        return { ok: true };
      },
      signOut() {
        if (server.current && token.current) void post('/api/auth/signout', {});
        token.current = null;
        writeToken(null);
        setState({ ...stateRef.current, sessionUserId: null });
        setStack([{ name: 'home' }]);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [online, signedIn, setState],
  );

  const go = useCallback((r: Route) => {
    setStack((st) => (TAB_ROOTS.includes(r.name) ? [r] : [...st, r]));
    document.querySelector('.content')?.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)), []);

  const user = state.sessionUserId ? state.users[state.sessionUserId] ?? null : null;
  const value = useMemo<Ctx>(
    () => ({ state, user, dispatch, route: stack[stack.length - 1], go, back, canGoBack: stack.length > 1, toast, toastMsg, online, env, forcedOffline, setForcedOffline, auth }),
    [state, user, dispatch, stack, go, back, toast, toastMsg, online, env, forcedOffline, auth],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Tab roots reset the back stack. */
export const TAB_ROOTS: RouteName[] = ['home', 'discover', 'projects', 'jobs', 'feed', 'wallet', 'orders', 'me'];

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
