import { useEffect, useState } from 'react';
import { Avatar, Icon, Logo, MARK_SVG, Picture, SCENE_KEYS } from '../components/art';
import { BackBar, Empty, PhotoInput, Stars, TopBar, VTick, timeAgo } from '../components/ui';
import { DEMO_ACCOUNTS } from '../domain/seed';
import { formatNaira } from '../domain/rules';
import type { Artisan, User } from '../domain/types';
import { useApp } from '../store/store';

/* ---------------- Sign in ---------------- */
export function SignIn() {
  const { state, dispatch } = useApp();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const norm = (p: string) => p.replace(/\D/g, '');
  const match = Object.values(state.users).find((u) => norm(u.phone) === norm(phone));

  return (
    <div className="signin">
      <div className="signin-hero">
        <span className="signin-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
        <h1>
          Ally<span>fe</span>
        </h1>
        <p className="tagline">
          Skilled People <i>•</i> Real Work <i>•</i> Brighter Lives
        </p>
      </div>
      <div className="card signin-card">
        <h2>Sign in</h2>
        <p className="sub">We'll text you a 6-digit code.</p>
        <label className="f" htmlFor="phone">
          Phone number
        </label>
        <input id="phone" type="tel" inputMode="tel" placeholder="0803 000 1111" value={phone} onChange={(e) => (setPhone(e.target.value), setErr(''))} autoComplete="tel" />
        {sent && (
          <>
            <label className="f" htmlFor="code">
              Code <em>(demo: any 6 digits)</em>
            </label>
            <input id="code" type="text" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" />
          </>
        )}
        {err && <div className="err">{err}</div>}
        <button
          className="btn primary mt14"
          onClick={() => {
            if (!match) return setErr('No Allyfe account uses that number. Pick a demo account below.');
            if (!sent) return setSent(true);
            if (code.length !== 6) return setErr('Enter the 6-digit code.');
            dispatch({ type: 'signIn', userId: match.id }, `Welcome back, ${match.name.split(' ')[0]}.`);
          }}
        >
          {sent ? 'Verify and sign in' : 'Send code'}
        </button>
      </div>
      <h3>Demo accounts</h3>
      <div className="list">
        {DEMO_ACCOUNTS.map((d) => {
          const u = state.users[d.id];
          return (
            <button key={d.id} className="card person-row" onClick={() => dispatch({ type: 'signIn', userId: u.id }, `Signed in as ${u.name}.`)}>
              <Avatar spec={u.avatar} size={40} />
              <div className="grow">
                <b className="t14">{u.name}</b>
                <div className="small">{d.note}</div>
              </div>
              <Icon name="chev" size={14} />
            </button>
          );
        })}
      </div>
      <p className="small center mt14">Demo build: payments are simulated and data stays on this device.</p>
    </div>
  );
}

/* ---------------- Feed ---------------- */
export function Feed() {
  const { state, user, dispatch, go } = useApp();
  return (
    <>
      <TopBar />
      <div className="head-row">
        <div>
          <h2>Community</h2>
          <p className="sub m0">Finished work from artisans near you.</p>
        </div>
        {user?.role === 'artisan' && (
          <button className="btn orange sm" onClick={() => go({ name: 'composer' })}>
            Post
          </button>
        )}
      </div>
      <div className="list mt12">
        {state.posts.map((p) => {
          const a = state.users[p.authorId] as Artisan;
          const liked = !!user && p.likes.includes(user.id);
          return (
            <article className="card post" key={p.id}>
              <div className="post-hd">
                <Avatar spec={a.avatar} size={40} />
                <div>
                  <b>
                    {a.name} <VTick />
                  </b>
                  <div className="small">
                    {a.trade} · <Stars rating={a.rating} /> · {timeAgo(p.at)}
                  </div>
                </div>
              </div>
              <div className="post-img">
                <Picture src={p.image} alt={p.text} />
              </div>
              <p>{p.text}</p>
              <div className="acts">
                <button className={liked ? 'liked' : ''} aria-pressed={liked} onClick={() => dispatch({ type: 'toggleLike', postId: p.id })}>
                  <Icon name={liked ? 'heartF' : 'heart'} size={18} />
                  {p.likes.length}
                </button>
                <button onClick={() => go({ name: 'comments', postId: p.id })}>
                  <Icon name="comment" size={18} />
                  {p.comments.length}
                </button>
                {user?.role === 'client' && (
                  <button className="ml-auto" onClick={() => go({ name: 'pro', id: a.id })}>
                    Book {a.name.split(' ')[0]} <Icon name="chev" size={14} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ---------------- Comments ---------------- */
export function Comments({ postId }: { postId: string }) {
  const { state, user, dispatch } = useApp();
  const [text, setText] = useState('');
  const p = state.posts.find((x) => x.id === postId);
  if (!p || !user) return <BackBar />;
  const a = state.users[p.authorId];
  return (
    <>
      <BackBar label="Community" />
      <div className="card post">
        <div className="post-hd">
          <Avatar spec={a.avatar} size={40} />
          <div>
            <b>{a.name}</b>
            <div className="small">{timeAgo(p.at)}</div>
          </div>
        </div>
        <div className="post-img">
          <Picture src={p.image} alt={p.text} />
        </div>
        <p>{p.text}</p>
        <div className="small">
          {p.likes.length} like{p.likes.length === 1 ? '' : 's'}
        </div>
      </div>
      <h3>
        {p.comments.length} comment{p.comments.length === 1 ? '' : 's'}
      </h3>
      {p.comments.length === 0 && <Empty title="No comments yet">Be the first to say something.</Empty>}
      <div className="comments">
        {p.comments.map((c) => {
          const u: User | undefined = state.users[c.authorId];
          return (
            <div className="comment" key={c.id}>
              {u && <Avatar spec={u.avatar} size={32} />}
              <div className="bubble">
                <b>{u?.name ?? 'Someone'}</b> <span className="small">{timeAgo(c.at)}</span>
                <div>{c.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form
        className="inline sticky-bottom"
        onSubmit={(e) => {
          e.preventDefault();
          if (dispatch({ type: 'addComment', postId: p.id, text })) setText('');
        }}
      >
        <input type="text" placeholder={`Comment as ${user.name.split(' ')[0]}`} value={text} onChange={(e) => setText(e.target.value)} aria-label="Write a comment" />
        <button className="btn primary sm" type="submit">
          Send
        </button>
      </form>
    </>
  );
}

/* ---------------- Composer ---------------- */
export function Composer() {
  const { dispatch, go } = useApp();
  const [image, setImage] = useState<string>('cabinet');
  const [text, setText] = useState('');
  return (
    <>
      <BackBar label="Cancel" />
      <h2>Post your work</h2>
      <p className="sub">Show finished jobs. Clients and other artisans can like and comment.</p>
      <div className="composer-preview">
        <Picture src={image} />
      </div>
      <label className="f">Choose a photo</label>
      <div className="pick">
        <PhotoInput label="Upload a photo" onPhoto={setImage} className="pick-up">
          <Icon name="camera" size={22} />
          <span>Upload</span>
        </PhotoInput>
        {SCENE_KEYS.slice(0, 3).map((k) => (
          <button key={k} className={image === k ? 'on' : ''} onClick={() => setImage(k)} aria-label={`Sample photo: ${k}`}>
            <Picture src={k} />
          </button>
        ))}
      </div>
      <label className="f" htmlFor="ptext">
        Caption
      </label>
      <textarea id="ptext" placeholder="What did you build? Where?" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
      <button
        className="btn primary mt14"
        onClick={() => {
          if (dispatch({ type: 'createPost', image, text }, 'Posted to Community.')) go({ name: 'feed' });
        }}
      >
        Post to Community
      </button>
    </>
  );
}

/* ---------------- Wallet ---------------- */
export function Wallet() {
  const { state, user, dispatch } = useApp();
  const [amount, setAmount] = useState('');
  if (!user) return null;
  const bal = state.wallets[user.id] ?? 0;
  const held =
    user.role === 'client'
      ? state.jobs.filter((j) => j.clientId === user.id).reduce((s, j) => s + j.escrow, 0)
      : user.role === 'artisan'
        ? state.jobs.filter((j) => j.artisanId === user.id).reduce((s, j) => s + j.escrow, 0)
        : 0;
  const txns = state.txns[user.id] ?? [];
  const bank = 'bank' in user ? user.bank : '';
  const amt = Number(amount.replace(/\D/g, '')) || 0;
  return (
    <>
      <TopBar />
      <h2>Wallet</h2>
      <div className="wallet">
        <small>Available balance</small>
        <div className="bal">{formatNaira(bal)}</div>
        {held > 0 && <div className="esc">{user.role === 'client' ? `${formatNaira(held)} held by Allyfe for your active jobs` : `${formatNaira(held)} on the way when clients confirm`}</div>}
        <div className="row mt12">
          {user.role !== 'artisan' && (
            <button className="btn orange sm" onClick={() => dispatch({ type: 'topUp', amount: amt || 100000 }, `${formatNaira(amt || 100000)} added to your wallet.`) && setAmount('')}>
              Top up {amt ? formatNaira(amt) : '₦100,000'}
            </button>
          )}
          <button className="btn sm ghost-light" disabled={!bal} onClick={() => dispatch({ type: 'withdraw', amount: amt || bal }, `${formatNaira(amt || bal)} sent to ${bank}.`) && setAmount('')}>
            Withdraw {amt ? formatNaira(amt) : 'all'} to bank
          </button>
        </div>
      </div>
      <label className="f" htmlFor="amt">
        Amount <em>(optional)</em>
      </label>
      <input id="amt" type="text" inputMode="numeric" placeholder="₦0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <p className="small mt10">
        {user.role === 'client'
          ? 'Money you pay for a job is held by Allyfe and released only when you tap Work completed.'
          : user.role === 'artisan'
            ? `Job payments land here when the client confirms. Withdraw to ${bank}.`
            : `Rental fees land here when the artisan's client confirms. Withdraw to ${bank}.`}
      </p>
      <h3>Transactions</h3>
      {txns.length ? (
        txns.map((x) => (
          <div className="txn" key={x.id}>
            <span className={'txn-ic ' + x.kind}>{x.kind === 'in' ? '+' : x.kind === 'hold' ? '⏸' : '−'}</span>
            <div>
              <div className="t13 w600">{x.label}</div>
              <div className="small">{new Date(x.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
            </div>
            <span className={'txn-a ' + (x.kind === 'in' ? 'in' : '')}>
              {x.kind === 'in' ? '+' : '−'}
              {formatNaira(x.amount)}
            </span>
          </div>
        ))
      ) : (
        <Empty title="No transactions yet">Payments will show here.</Empty>
      )}
    </>
  );
}

/* ---------------- Alerts ---------------- */
export function Alerts() {
  const { state, user, dispatch, go } = useApp();
  // Keep the unread dots visible while the screen is open, but mark everything read.
  const [snapshot] = useState(() => (user ? state.alerts[user.id] ?? [] : []));
  useEffect(() => {
    if (snapshot.some((a) => !a.read)) dispatch({ type: 'markAlertsRead' });
  }, [snapshot, dispatch]);
  return (
    <>
      <BackBar />
      <h2>Alerts</h2>
      {snapshot.length ? (
        snapshot.map((a) => {
          const job = a.jobId ? state.jobs.find((j) => j.id === a.jobId) : undefined;
          const content = (
            <>
              <i />
              <div>
                <div className="t13">{a.text}</div>
                <div className="small">{timeAgo(a.at)}</div>
              </div>
            </>
          );
          return job ? (
            <button key={a.id} className={'alert' + (a.read ? ' read' : '')} onClick={() => go({ name: 'job', jobId: job.id })}>
              {content}
            </button>
          ) : (
            <div key={a.id} className={'alert' + (a.read ? ' read' : '')}>
              {content}
            </div>
          );
        })
      ) : (
        <Empty title="No alerts yet">Updates about your jobs and payments show here.</Empty>
      )}
    </>
  );
}

/* ---------------- Offline ---------------- */
export function Offline() {
  const { forcedOffline, setForcedOffline } = useApp();
  return (
    <div className="offline">
      <span className="offline-ic">
        <Icon name="wifiOff" size={40} />
      </span>
      <h2>You're offline</h2>
      <p className="sub">
        Allyfe needs a connection to post jobs, move money and send messages. Your wallet and jobs are safe. Nothing is lost.
      </p>
      <div className="card offline-list">
        <div>
          <span className="tag good">Works offline</span> Browse your projects, feed and saved artisans
        </div>
        <div>
          <span className="tag grey">Needs internet</span> Payments, proposals, posts and comments
        </div>
      </div>
      <button className="btn primary mt14" onClick={() => (forcedOffline ? setForcedOffline(false) : location.reload())}>
        Try again
      </button>
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div className="offline-banner" role="status">
      <Icon name="wifiOff" size={14} /> Offline. Showing saved data.
    </div>
  );
}

/* ---------------- Me / account ---------------- */
export function Me() {
  const { user, state, dispatch, go, forcedOffline, setForcedOffline } = useApp();
  if (!user) return null;
  const verified = user.role === 'client' ? null : user.verification.status;
  return (
    <>
      <TopBar />
      <div className="greet">
        <Avatar spec={user.avatar} size={62} />
        <div>
          <div className="nm">{user.name}</div>
          <div className="sl">
            {user.role === 'client' ? 'Client' : user.role === 'artisan' ? (user as Artisan).trade : 'Tool company'} · {user.area}
          </div>
          <div className="sl">{user.phone}</div>
        </div>
        <span />
      </div>
      {user.role === 'artisan' && (
        <div className="row tc mb12">
          <div className="card stat">
            <b>★ {(user as Artisan).rating.toFixed(2)}</b>
            <span className="small">{(user as Artisan).ratingCount} ratings</span>
          </div>
          <div className="card stat">
            <b>{(user as Artisan).jobsDone}</b>
            <span className="small">jobs on Allyfe</span>
          </div>
        </div>
      )}
      <div className="list">
        <button className="card menu-row" onClick={() => go({ name: 'wallet' })}>
          <Icon name="wallet" size={20} />
          <span className="grow">Wallet</span>
          <b>{formatNaira(state.wallets[user.id] ?? 0)}</b>
        </button>
        {verified && (
          <button className="card menu-row" onClick={() => go({ name: 'verify' })}>
            <Icon name="shield" size={20} />
            <span className="grow">Verification</span>
            <span className={'tag ' + (verified === 'verified' ? 'good' : verified === 'review' ? 'warn' : 'grey')}>{verified === 'verified' ? 'Verified' : verified === 'review' ? 'In review' : 'Not finished'}</span>
          </button>
        )}
        {user.role === 'artisan' && (
          <button className="card menu-row" onClick={() => go({ name: 'store' })}>
            <Icon name="tools" size={20} />
            <span className="grow">Tool Store</span>
            <Icon name="chev" size={14} />
          </button>
        )}
        {user.role === 'client' && (
          <button className="card menu-row" onClick={() => go({ name: 'projects' })}>
            <Icon name="projects" size={20} />
            <span className="grow">My projects</span>
            <Icon name="chev" size={14} />
          </button>
        )}
        <label className="card menu-row">
          <Icon name="wifiOff" size={20} />
          <span className="grow">Simulate offline</span>
          <input type="checkbox" checked={forcedOffline} onChange={(e) => setForcedOffline(e.target.checked)} />
        </label>
      </div>
      <div className="stack mt14">
        <button className="btn secondary" onClick={() => dispatch({ type: 'signOut' })}>
          Sign out / switch account
        </button>
        <button
          className="btn concern"
          onClick={() => {
            if (confirm('Reset all demo data on this device?')) dispatch({ type: 'reset' }, 'Demo data reset.');
          }}
        >
          Reset demo data
        </button>
      </div>
      <p className="small center mt14">
        <Logo size={18} />
        <br />
        Skilled People • Real Work • Brighter Lives
      </p>
    </>
  );
}
