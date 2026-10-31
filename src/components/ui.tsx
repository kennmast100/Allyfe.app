import { useState } from 'react';
import { Avatar, Icon, Logo, type IconName } from './art';
import { useApp, type Route } from '../store/store';
import type { User } from '../domain/types';
import { JOB_STATUS_LABEL, JOB_STATUS_TONE } from '../domain/rules';
import type { Job } from '../domain/types';

export function TopBar() {
  const { user, state, go } = useApp();
  if (!user) return null;
  const unread = (state.alerts[user.id] ?? []).filter((a) => !a.read).length;
  return (
    <div className="topbar">
      <Logo />
      <span className="topbar-r">
        <span className="loc">
          <Icon name="pin" size={15} className="orange" />
          Port Harcourt
        </span>
        <button className="bell" onClick={() => go({ name: 'alerts' })} aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'}>
          <Icon name="bell" size={21} />
          {unread > 0 && <i />}
        </button>
        <button className="me-btn" onClick={() => go({ name: 'me' })} aria-label="Your account">
          <Avatar spec={user.avatar} size={30} />
        </button>
      </span>
    </div>
  );
}

export function BackBar({ label = 'Back', right, onBack }: { label?: string; right?: React.ReactNode; onBack?: () => void }) {
  const { back } = useApp();
  return (
    <div className="topbar">
      <button className="back" onClick={onBack ?? back}>
        <Icon name="back" size={18} />
        {label}
      </button>
      {right}
    </div>
  );
}

export const Stars = ({ rating, count }: { rating: number; count?: number }) => (
  <span className="stars">
    <b>★</b>
    {rating.toFixed(1)}
    {count != null && <span> ({count})</span>}
  </span>
);

export const VTick = () => (
  <span className="vtick" title="Verified by Allyfe" aria-label="Verified">
    ✓
  </span>
);

export const StatusTag = ({ job, artisanView }: { job: Job; artisanView?: boolean }) => (
  <span className={'tag ' + JOB_STATUS_TONE[job.status]}>
    {artisanView && job.status === 'awaiting_client' ? 'Waiting for client' : JOB_STATUS_LABEL[job.status]}
  </span>
);

/** Plays another party's part (supervisor, admin). Dashed so it never looks like a real control. */
export const SimButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button className="btn sim" onClick={onClick}>
    Simulate: {children}
  </button>
);

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card empty">
      <b>{title}</b>
      {children}
    </div>
  );
}

export function Notice({ tone = 'warn', icon = '!', children }: { tone?: 'warn' | 'info'; icon?: string; children: React.ReactNode }) {
  return (
    <div className={'notice ' + tone}>
      <b className="i">{icon}</b>
      <span>{children}</span>
    </div>
  );
}

export function PersonRow({ user, sub, onClick, right }: { user: User; sub?: React.ReactNode; onClick?: () => void; right?: React.ReactNode }) {
  const inner = (
    <>
      <Avatar spec={user.avatar} size={44} />
      <div className="grow">
        <b className="t14">
          {user.name} {user.role !== 'client' && 'verification' in user && user.verification.status === 'verified' && <VTick />}
        </b>
        {sub && <div className="small">{sub}</div>}
      </div>
      {right ?? (onClick ? <Icon name="chev" size={14} /> : null)}
    </>
  );
  return onClick ? (
    <button className="card person-row" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="card person-row">{inner}</div>
  );
}

type NavItem = { label: string; icon: IconName | 'fab'; route: Route; badge?: number };

export function BottomNav() {
  const { user, route, go, state } = useApp();
  if (!user) return null;
  const pending = state.rentals.filter((r) => r.companyId === user.id && r.status === 'requested').length;
  const items: NavItem[] =
    user.role === 'client'
      ? [
          { label: 'Home', icon: 'home', route: { name: 'home' } },
          { label: 'Discover', icon: 'discover', route: { name: 'discover' } },
          { label: 'Post Job', icon: 'fab', route: { name: 'postJob' } },
          { label: 'Projects', icon: 'projects', route: { name: 'projects' } },
          { label: 'Feed', icon: 'feed', route: { name: 'feed' } },
        ]
      : user.role === 'artisan'
        ? [
            { label: 'Home', icon: 'home', route: { name: 'home' } },
            { label: 'Jobs', icon: 'jobs', route: { name: 'jobs' } },
            { label: 'Post Work', icon: 'fab', route: { name: 'composer' } },
            { label: 'Feed', icon: 'feed', route: { name: 'feed' } },
            { label: 'Wallet', icon: 'wallet', route: { name: 'wallet' } },
          ]
        : [
            { label: 'Home', icon: 'home', route: { name: 'home' } },
            { label: 'Requests', icon: 'requests', route: { name: 'requests' }, badge: pending },
            { label: 'Add Tool', icon: 'fab', route: { name: 'tools' } },
            { label: 'Feed', icon: 'feed', route: { name: 'feed' } },
            { label: 'Wallet', icon: 'wallet', route: { name: 'wallet' } },
          ];
  return (
    <nav className="nav" aria-label="Main">
      {items.map((n) => {
        const on = route.name === n.route.name;
        return (
          <button key={n.label} className={(on ? 'on ' : '') + (n.icon === 'fab' ? 'fab' : '')} onClick={() => go(n.route)} aria-current={on ? 'page' : undefined}>
            {n.icon === 'fab' ? (
              <span className="c">
                <Icon name="plus" size={22} />
              </span>
            ) : (
              <Icon name={n.icon} size={21} />
            )}
            {n.badge ? <span className="dot">{n.badge}</span> : null}
            {n.label}
          </button>
        );
      })}
    </nav>
  );
}

/* ---------- calendar ---------- */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dayLabel = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Month calendar. Past days are disabled; up to `max` days can be picked (1 = single choice). */
export function Calendar({ selected, onChange, max = 5, allowed }: { selected: string[]; onChange: (days: string[]) => void; max?: number; allowed?: string[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Open on the month of the first picked or allowed day, so the client's dates are in view.
  const [view, setView] = useState(() => {
    const start = selected[0] ?? allowed?.[0];
    if (start) {
      const [y, m] = start.split('-').map(Number);
      return { y, m: m - 1 };
    }
    return { y: today.getFullYear(), m: today.getMonth() };
  });
  const first = new Date(view.y, view.m, 1);
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const canPrev = view.y > today.getFullYear() || view.m > today.getMonth();
  const canNext = new Date(view.y, view.m + 1, 1) <= new Date(today.getFullYear(), today.getMonth() + 3, 0);
  const shift = (n: number) => {
    let m = view.m + n,
      y = view.y;
    if (m < 0) (m = 11), y--;
    if (m > 11) (m = 0), y++;
    setView({ y, m });
  };
  const toggle = (k: string) => {
    if (max === 1) return onChange([k]);
    if (selected.includes(k)) return onChange(selected.filter((x) => x !== k));
    if (selected.length >= max) return;
    onChange([...selected, k].sort());
  };
  return (
    <div className="card calendar">
      <div className="cal-h">
        <button disabled={!canPrev} onClick={() => shift(-1)} aria-label="Previous month">
          <Icon name="back" size={16} />
        </button>
        <span>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <button disabled={!canNext} onClick={() => shift(1)} aria-label="Next month" className="flip">
          <Icon name="back" size={16} />
        </button>
      </div>
      <div className="cal-g">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span className="dw" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={'o' + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const dt = new Date(view.y, view.m, i + 1);
          const k = dayKey(dt);
          const disabled = dt < today || (allowed ? !allowed.includes(k) : false);
          const cls = [selected.includes(k) ? 'sel' : '', +dt === +today ? 'today' : '', allowed?.includes(k) ? 'avail' : ''].join(' ');
          return (
            <button key={k} disabled={disabled} className={cls} onClick={() => toggle(k)} aria-pressed={selected.includes(k)} aria-label={dt.toDateString()}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- photo input ---------- */
const MAX_DIM = 1024;
/** Reads an image file, scales it down so localStorage stays small, and returns a JPEG data URL. */
export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That photo could not be read.'));
    };
    img.src = url;
  });
}

export function PhotoInput({ onPhoto, label, children, className }: { onPhoto: (dataUrl: string) => void; label: string; children: React.ReactNode; className?: string }) {
  const { toast } = useApp();
  return (
    <label className={'photo-in ' + (className ?? '')}>
      {children}
      <input
        type="file"
        accept="image/*"
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            onPhoto(await readImage(f));
          } catch (err) {
            toast((err as Error).message);
          }
        }}
      />
    </label>
  );
}

export function timeAgo(at: number, now = Date.now()) {
  const m = Math.round((now - at) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
