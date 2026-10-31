import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DomainError, reduce, type Action } from '../domain/actions';
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
  | { name: 'confirm'; jobId: string; proposalId: string }
  | { name: 'completed'; jobId: string }
  | { name: 'review'; jobId: string }
  | { name: 'jobs'; tab?: 'new' | 'applied' | 'mine' }
  | { name: 'proposal'; jobId: string; kind: 'apply' | 'propose' }
  | { name: 'applied'; jobId: string }
  | { name: 'verify' }
  | { name: 'store'; jobId?: string }
  | { name: 'rent'; toolId: string; jobId?: string }
  | { name: 'requests' }
  | { name: 'tools' }
  | { name: 'feed' }
  | { name: 'composer' }
  | { name: 'comments'; postId: string }
  | { name: 'wallet' }
  | { name: 'alerts' }
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
  forcedOffline: boolean;
  setForcedOffline: (v: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const stateRef = useRef(state);
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

  const dispatch = useCallback(
    (a: Action, success?: string) => {
      if (!online && !['signOut', 'markAlertsRead'].includes(a.type)) {
        toast("You're offline. Reconnect and try again.");
        return null;
      }
      try {
        const next = reduce(stateRef.current, a);
        stateRef.current = next;
        setState(next);
        if (a.type === 'signIn' || a.type === 'signOut' || a.type === 'reset') setStack([{ name: 'home' }]);
        if (success) toast(success);
        return next;
      } catch (e) {
        if (e instanceof DomainError) {
          toast(e.message);
          return null;
        }
        throw e;
      }
    },
    [online, toast],
  );

  const go = useCallback((r: Route) => {
    setStack((st) => (TAB_ROOTS.includes(r.name) ? [r] : [...st, r]));
    document.querySelector('.content')?.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)), []);

  const user = state.sessionUserId ? state.users[state.sessionUserId] ?? null : null;
  const value = useMemo<Ctx>(
    () => ({ state, user, dispatch, route: stack[stack.length - 1], go, back, canGoBack: stack.length > 1, toast, toastMsg, online, forcedOffline, setForcedOffline }),
    [state, user, dispatch, stack, go, back, toast, toastMsg, online, forcedOffline],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Tab roots reset the back stack. */
export const TAB_ROOTS: RouteName[] = ['home', 'discover', 'projects', 'jobs', 'feed', 'wallet', 'requests', 'tools', 'me'];

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
