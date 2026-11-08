import { useEffect, useState } from 'react';
import { Avatar, Icon, Logo, Picture, SCENE_KEYS } from '../components/art';
import { BackBar, Empty, MediaInput, Stars, TopBar, VTick, timeAgo } from '../components/ui';
import { formatNaira } from '../domain/rules';
import type { Artisan, User } from '../domain/types';
import { useApp } from '../store/store';

/* ---------------- Feed ---------------- */
export function Feed() {
  const { state, user, dispatch, go } = useApp();
  return (
    <>
      <TopBar />
      <div className="head-row">
        <div>
          <h2>Community</h2>
          <p className="sub m0">Finished work from artisans and materials in stock near you.</p>
        </div>
        {user?.role === 'artisan' && (
          <button className="btn orange sm" onClick={() => go({ name: 'composer' })}>
            Post
          </button>
        )}
      </div>
      <div className="list mt12">
        {state.posts.map((p) => {
          const a = state.users[p.authorId];
          if (!a || a.role === 'client') return null;
          const liked = !!user && p.likes.includes(user.id);
          return (
            <article className={'card post' + (p.stock ? ' stock-post' : '')} key={p.id}>
              <div className="post-hd">
                <Avatar spec={a.avatar} size={40} />
                <div>
                  <b>
                    {a.name} <VTick />
                  </b>
                  <div className="small">
                    {a.role === 'artisan' ? (
                      <>
                        {a.trade} · <Stars rating={a.rating} />
                      </>
                    ) : (
                      <>Market vendor · {a.market}</>
                    )}{' '}
                    · {timeAgo(p.at)}
                  </div>
                </div>
              </div>
              <div className="post-img">
                <Picture src={p.image} alt={p.text} />
                {p.stock && <span className="stock-badge">In stock</span>}
              </div>
              {p.stock && (
                <div className="stock-row">
                  <b>{p.stock.name}</b>
                  <span>
                    {formatNaira(p.stock.price)} / {p.stock.unit}
                  </span>
                </div>
              )}
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
                {p.stock && <span className="small ml-auto">{a.area.split(',')[0]}</span>}
                {user?.role === 'client' && a.role === 'artisan' && (
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
  const { dispatch, go, user } = useApp();
  const vendor = user?.role === 'vendor';
  const [image, setImage] = useState<string>(vendor ? 'tiles' : 'cabinet');
  const [text, setText] = useState('');
  const [stock, setStock] = useState({ name: '', price: '', unit: '' });
  return (
    <>
      <BackBar label="Cancel" />
      <h2>{vendor ? 'Post your stock' : 'Post your work'}</h2>
      <p className="sub">{vendor ? 'Show materials you have in your shop. Artisans and clients in your city see them in the feed.' : 'Show finished jobs. Clients and other artisans can like and comment.'}</p>
      <div className="composer-preview">
        <Picture src={image} />
      </div>
      <label className="f">
        Choose a photo or video <em>(videos up to 20 s)</em>
      </label>
      <div className="pick">
        <MediaInput video label="Upload a photo or video" onMedia={setImage} className="pick-up">
          <Icon name="camera" size={22} />
          <span>Upload</span>
        </MediaInput>
        {SCENE_KEYS.slice(0, 3).map((k) => (
          <button key={k} className={image === k ? 'on' : ''} onClick={() => setImage(k)} aria-label={`Sample photo: ${k}`}>
            <Picture src={k} />
          </button>
        ))}
      </div>
      {vendor && (
        <>
          <label className="f" htmlFor="sname">
            Material
          </label>
          <input id="sname" type="text" placeholder="e.g. Floor tiles 60×60" value={stock.name} onChange={(e) => setStock({ ...stock, name: e.target.value })} />
          <div className="row">
            <div>
              <label className="f" htmlFor="sprice">
                Price (₦)
              </label>
              <input id="sprice" type="text" inputMode="numeric" placeholder="9500" value={stock.price} onChange={(e) => setStock({ ...stock, price: e.target.value })} />
            </div>
            <div>
              <label className="f" htmlFor="sunit">
                Per
              </label>
              <input id="sunit" type="text" placeholder="carton, bag, piece…" value={stock.unit} onChange={(e) => setStock({ ...stock, unit: e.target.value })} />
            </div>
          </div>
        </>
      )}
      <label className="f" htmlFor="ptext">
        {vendor ? 'Description' : 'Caption'}
      </label>
      <textarea id="ptext" placeholder={vendor ? 'Brand, colours, quantity available, delivery areas…' : 'What did you build? Where?'} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
      <button
        className="btn primary mt14"
        onClick={() => {
          const post = vendor ? { type: 'createPost' as const, image, text, stock: { name: stock.name, price: Number(stock.price.replace(/\D/g, '')) || 0, unit: stock.unit } } : { type: 'createPost' as const, image, text };
          if (dispatch(post, 'Posted to Community.')) go({ name: 'feed' });
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
          {user.role === 'client' && (
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
            : `Materials payments land here when the client confirms delivery. Withdraw to ${bank}.`}
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
  const { user, state, dispatch, go, forcedOffline, setForcedOffline, env, auth } = useApp();
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
            {user.role === 'client' ? 'Client' : user.role === 'artisan' ? (user as Artisan).trade : 'Market vendor'} · {user.area}
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
          <button className="card menu-row" onClick={() => go({ name: 'profileEdit' })}>
            <Icon name="user" size={20} />
            <span className="grow">Profile, team & apprentices</span>
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
        <button className="card menu-row" onClick={() => go({ name: 'terms' })}>
          <Icon name="shield" size={20} />
          <span className="grow">Terms & conditions</span>
          <Icon name="chev" size={14} />
        </button>
        <label className="card menu-row">
          <Icon name="wifiOff" size={20} />
          <span className="grow">Simulate offline</span>
          <input type="checkbox" checked={forcedOffline} onChange={(e) => setForcedOffline(e.target.checked)} />
        </label>
      </div>
      <div className="stack mt14">
        <button className="btn secondary" onClick={() => auth.signOut()}>
          Sign out / switch account
        </button>
        <button
          className="btn concern"
          onClick={() => {
            if (confirm(env === 'local' ? 'Reset all demo data on this device?' : `Reset the shared ${env} data for every tester?`)) dispatch({ type: 'reset' }, 'Demo data reset.');
          }}
        >
          Reset demo data
        </button>
      </div>
      <p className="small center mt14">
        {env === 'local' ? 'Data is saved on this device only.' : `Connected to Allyfe ${env}. Everyone testing sees the same data.`}
      </p>
      <p className="small center mt14">
        <Logo size={18} />
        <br />
        Skilled People • Real Work • Brighter Lives
      </p>
    </>
  );
}

/* ---------------- Terms ---------------- */
export function Terms() {
  return (
    <>
      <BackBar />
      <h2>Terms & conditions</h2>
      <p className="sub">The rules that keep Allyfe fair for clients, artisans and vendors. Summary for this test version; the full legal text follows before launch.</p>
      <div className="terms">
        <h4>1. Posting a job</h4>
        <p>Describe the job truthfully and in detail, with clear photos. Blurry photos are not accepted. Videos can be at most 20 seconds. Work can be booked no sooner than 24 hours after posting, so a vendor has time to buy and deliver materials.</p>
        <h4>2. Quotations and payment</h4>
        <p>Artisans quote materials and a service fee. When you accept a quotation you pay the full amount into Allyfe, which holds it. Nobody is paid at that point.</p>
        <h4>3. Materials</h4>
        <p>The materials list goes to verified market vendors in your city. Only the vendor who accepts your order sees your phone number, so they can confirm delivery and the exact materials (brand, colour, texture) with you. The vendor is paid when you tap “I’ve received the materials”. Check every item before you confirm.</p>
        <h4>Refusing materials</h4>
        <p>If the materials are wrong, damaged, short, substandard or not what was quoted, tap “I’m not happy with the materials” and choose a reason. The vendor is not paid for that delivery and, <b>under the Allyfe vendor contract, must come back and collect the goods</b> at their own cost. The order then goes back out so the right materials can be delivered.</p>
        <h4>4. The work</h4>
        <p>The artisan taps “Work started” on the agreed day and “Work finished” when done. The artisan is paid only when you tap “Job done”. Premium jobs are inspected by an Allyfe supervisor first.</p>
        <h4>Allyfe fee</h4>
        <p>Allyfe keeps a company fee from the artisan’s service fee when a job is done: <b>5% on Basic and Pro jobs, 10% on Premium jobs</b>. Clients pay the quoted price and nothing extra. Materials carry no fee.</p>
        <h4>5. Not as described</h4>
        <p>If the artisan arrives and the job is not what you described, they may mark it “Not as described”. You then forfeit 50% of the service fee for their visit; the other 50% is refunded. Materials already delivered stay with you.</p>
        <h4>6. If the artisan doesn’t show up</h4>
        <p>From the scheduled day you can report a no-show. The artisan receives a 1★ rating for that job, which counts in their average. You then choose:</p>
        <ul>
          <li><b>Refund:</b> everything Allyfe still holds is returned to your wallet. <b>Money for materials already delivered is not refunded</b>; the materials stay with you.</li>
          <li><b>Another artisan:</b> new artisans bid. Materials already at your home are taken off the new quotation, and the money still held counts toward it. You pay any extra or get the difference back.</li>
        </ul>
        <h4>7. Cancelling before delivery</h4>
        <p>If no materials have been delivered yet, you can cancel and get a full refund.</p>
        <h4>8. Ratings</h4>
        <p>After the job you answer two questions: how well the work was done, and the artisan’s attitude. Each answer is scored 1 to 5; the job’s rating is the average of the two.</p>
        <h4>9. Location</h4>
        <p>Jobs are only sent to artisans and vendors in the same city as the client.</p>
      </div>
    </>
  );
}
