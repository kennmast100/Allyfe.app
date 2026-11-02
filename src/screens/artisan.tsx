import { useState } from 'react';
import { Avatar, Icon, Picture, ToolIcon } from '../components/art';
import { BackBar, Calendar, Empty, Journey, MediaInput, Notice, PersonRow, SimButton, StatusTag, TopBar, dayLabel, timeAgo } from '../components/ui';
import { VERIFICATION_ITEMS } from '../domain/actions';
import {
  CLOSED_STATUSES,
  MATERIALS,
  artisanQualifies,
  billableMaterials,
  completionSplit,
  customKey,
  formatNaira,
  isOnOrAfterDay,
  linesTotal,
  misdescribedSplit,
  rankArtisans,
} from '../domain/rules';
import type { Artisan, Company, Job, QuoteLine } from '../domain/types';
import { useApp } from '../store/store';
import { History, JobDetails, JobHeader, MaterialsStatus, QuoteTable, SplitBox } from './client';

const firstName = (n: string) => n.split(' ')[0];

function useArtisanJobs() {
  const { state, user } = useApp();
  const me = user as Artisan;
  const open = state.jobs.filter(
    (j) =>
      j.status === 'open' &&
      j.city === me.city &&
      (j.invitedArtisanId ? j.invitedArtisanId === me.id : me.categories.includes(j.category)) &&
      !j.noShows.some((x) => x.artisanId === me.id) &&
      !j.bids.some((b) => b.artisanId === me.id && b.status === 'pending'),
  );
  const bids = state.jobs.filter((j) => j.bids.some((b) => b.artisanId === me.id) && j.artisanId !== me.id);
  const mine = state.jobs.filter((j) => j.artisanId === me.id);
  return { me, open, bids, mine };
}

/** Jobs where today is the start day and the artisan hasn't started yet. */
export function useStartDayJobs() {
  const { state, user } = useApp();
  if (!user || user.role !== 'artisan') return [];
  return state.jobs.filter((j) => j.artisanId === user.id && j.status === 'ready' && j.scheduledDay && isOnOrAfterDay(j.scheduledDay, Date.now()));
}

/* ---------------- Artisan home ---------------- */
export function ArtisanHome() {
  const { state, go } = useApp();
  const { me, open, bids, mine } = useArtisanJobs();
  const v = me.verification;
  const ongoing = mine.filter((j) => !CLOSED_STATUSES.includes(j.status));
  const sameTrade = rankArtisans(Object.values(state.users).filter((u): u is Artisan => u.role === 'artisan' && u.trade === me.trade && u.city === me.city));
  const rank = sameTrade.findIndex((a) => a.id === me.id) + 1;
  const pct = v.status === 'verified' ? 100 : v.status === 'review' ? 90 : Math.round((Object.keys(v.files).length / VERIFICATION_ITEMS.artisan.length) * 80);
  const startToday = useStartDayJobs();
  const hour = new Date().getHours();
  return (
    <>
      <TopBar />
      <div className="greet">
        <Avatar spec={me.avatar} size={62} />
        <div>
          <div className="hi">{hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,'}</div>
          <div className="nm">{firstName(me.name)}!</div>
          <div className="sl">{me.kind === 'team' ? `${me.teamName} · team of ${me.teamMembers.length}` : 'More work. Greater opportunities.'}</div>
        </div>
        {v.status === 'verified' ? <span className="vbadge">✓ Verified</span> : <span className="vbadge pending">Not verified</span>}
      </div>
      {startToday.map((j) => (
        <button key={j.id} className="startday" onClick={() => go({ name: 'job', jobId: j.id })}>
          <span className="ic">
            <Icon name="cal" size={22} />
          </span>
          <span>
            <b>Today: {j.title}</b>
            <small>Materials are at the client's home. Tap to start work.</small>
          </span>
          <Icon name="chev" size={14} />
        </button>
      ))}
      {v.status !== 'verified' && (
        <button className="progcard" onClick={() => go({ name: 'verify' })}>
          <span className="ic">
            <Icon name="user" size={24} />
          </span>
          <span>
            <b>{v.status === 'review' ? 'Profile in review' : 'Complete your verification'}</b>
            <span className="bar">
              <i style={{ width: pct + '%' }} />
            </span>
            <small>{v.status === 'review' ? 'Allyfe is checking your photos' : 'Only verified artisans can bid'} · {pct}%</small>
          </span>
          <span className="go">
            <Icon name="chev" size={14} />
          </span>
        </button>
      )}
      <div className="tiles">
        {(
          [
            ['New Jobs', `${open.length} in ${me.city === 'Port Harcourt' ? 'PH' : me.city}`, '#16A34A', 'brief', () => go({ name: 'jobs', tab: 'new' })],
            ['My Bids', `${bids.filter((j) => j.status === 'open').length} waiting`, '#F97316', 'chart', () => go({ name: 'jobs', tab: 'bids' })],
            ['Projects', `${ongoing.length} ongoing`, '#7C6CF0', 'cal', () => go({ name: 'jobs', tab: 'mine' })],
            ['Earnings', formatNaira(state.wallets[me.id] ?? 0), '#F59E0B', 'wallet', () => go({ name: 'wallet' })],
          ] as const
        ).map(([t, s, c, ic, fn]) => (
          <button key={t} className="tile" onClick={fn}>
            <span style={{ background: c }}>
              <Icon name={ic} size={26} />
            </span>
            {t}
            <small>{s}</small>
          </button>
        ))}
      </div>
      {ongoing.length > 0 && (
        <>
          <h3>Your projects</h3>
          <div className="list">{ongoing.map((j) => <MyJobCard key={j.id} job={j} />)}</div>
        </>
      )}
      <button className="rep mt14" onClick={() => go({ name: 'profileEdit' })}>
        <span className="ic">
          <Icon name="trophy" size={20} />
        </span>
        <span>
          <b>Your reputation</b>
          <small>
            ★ {me.rating.toFixed(2)} from {me.ratingCount} ratings · #{rank} {me.trade.toLowerCase()} in {me.city}. Manage your team and apprentices.
          </small>
        </span>
        <span className="go">
          <Icon name="chev" size={14} />
        </span>
      </button>
      <button className="rep teal mt10" onClick={() => go({ name: 'store' })}>
        <span className="ic">
          <Icon name="tools" size={20} />
        </span>
        <span>
          <b>Tool Store</b>
          <small>Rent tools from verified companies for your next job.</small>
        </span>
        <span className="go">
          <Icon name="chev" size={14} />
        </span>
      </button>
      <h3>
        New jobs near you
        <button onClick={() => go({ name: 'jobs', tab: 'new' })}>See all</button>
      </h3>
      <div className="list">
        {open.slice(0, 3).map((j) => (
          <JobRec key={j.id} job={j} />
        ))}
        {!open.length && <Empty title="No new jobs right now">We'll alert you when a client in {me.city} posts a job in your trade.</Empty>}
      </div>
    </>
  );
}

function JobRec({ job: j }: { job: Job }) {
  const { go, state } = useApp();
  const client = state.users[j.clientId];
  return (
    <button className="card jobrec" onClick={() => go({ name: 'job', jobId: j.id })}>
      <div className="ph">
        <Picture src={j.media.find((m) => !m.startsWith('data:video/')) ?? 'room'} />
      </div>
      <div className="grow">
        <div className="tt">
          <b>{j.title}</b>
          <span className="small">{timeAgo(j.createdAt)}</span>
        </div>
        <div className="pin">
          <Icon name="pin" size={12} className="orange" />
          {client.area.split(',')[0]} · {j.tier}
        </div>
        <p className="small m0 clamp2">{j.desc}</p>
        <div className="chips mt4">
          <span className="chip">{j.category}</span>
          {j.invitedArtisanId && <span className="chip hot">Requested you</span>}
          {j.deliveredMaterials.length > 0 && <span className="chip hot">Replacement · materials on site</span>}
          <span className="chip">
            {j.bids.filter((b) => b.status === 'pending').length} bid{j.bids.filter((b) => b.status === 'pending').length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </button>
  );
}

function MyJobCard({ job: j }: { job: Job }) {
  const { state, go } = useApp();
  const c = state.users[j.clientId];
  return (
    <button className="card job-card" onClick={() => go({ name: 'job', jobId: j.id })}>
      <div className="ph">
        <Avatar spec={c.avatar} size={44} />
      </div>
      <div className="grow">
        <b className="t14">{j.title}</b>
        <div className="small">
          {firstName(c.name)} · {j.scheduledDay ? dayLabel(j.scheduledDay) : ''} · fee {formatNaira(j.serviceFee ?? 0)}
        </div>
        <StatusTag job={j} artisanView />
      </div>
      <Icon name="chev" size={14} />
    </button>
  );
}

/* ---------------- Jobs board ---------------- */
export function ArtisanJobs({ tab = 'new' }: { tab?: 'new' | 'bids' | 'mine' }) {
  const { go } = useApp();
  const { me, open, bids, mine } = useArtisanJobs();
  const [t, setT] = useState(tab);
  return (
    <>
      <TopBar />
      <h2>Jobs</h2>
      <div className="tabs" role="tablist">
        {(
          [
            ['new', 'New jobs'],
            ['bids', 'My bids'],
            ['mine', 'My projects'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={t === k} className={t === k ? 'on' : ''} onClick={() => setT(k)}>
            {l}
          </button>
        ))}
      </div>
      {t === 'new' && (
        <>
          <p className="sub">
            {me.trade} jobs in {me.city}. Read each one carefully, then send your quotation.
          </p>
          {me.verification.status !== 'verified' && (
            <Notice>
              Finish{' '}
              <button className="link" onClick={() => go({ name: 'verify' })}>
                verification
              </button>{' '}
              to bid on jobs.
            </Notice>
          )}
          <div className="list">
            {open.map((j) => (
              <JobRec key={j.id} job={j} />
            ))}
            {!open.length && <Empty title="No new jobs">We'll alert you when a client posts in your trade.</Empty>}
          </div>
        </>
      )}
      {t === 'bids' && (
        <div className="list">
          {bids.map((j) => {
            const b = j.bids.filter((x) => x.artisanId === me.id).slice(-1)[0];
            const waiting = b.status === 'pending' && j.status === 'open';
            return (
              <button key={j.id} className="card jobrec" onClick={() => go({ name: 'applied', jobId: j.id })}>
                <div className="ph">
                  <Picture src={j.media[0] ?? 'room'} />
                </div>
                <div className="grow">
                  <b className="t13">{j.title}</b>
                  <div className="small">
                    Your bid {formatNaira(linesTotal(b.lines) + b.serviceFee)} · {timeAgo(b.at)}
                  </div>
                  <span className={'tag mt6 ' + (waiting ? 'blue' : 'grey')}>{waiting ? 'Waiting for client' : j.status === 'cancelled' ? 'Job cancelled' : 'Client chose someone else'}</span>
                </div>
              </button>
            );
          })}
          {!bids.length && <Empty title="No bids yet">Open a job and send your quotation.</Empty>}
        </div>
      )}
      {t === 'mine' && (
        <div className="list">
          {mine.map((j) => (
            <MyJobCard key={j.id} job={j} />
          ))}
          {!mine.length && <Empty title="No projects yet">When a client accepts your bid, the job appears here.</Empty>}
        </div>
      )}
    </>
  );
}

/* ---------------- Job detail (artisan) ---------------- */
export function ArtisanJob({ job: j }: { job: Job }) {
  const { state, user, dispatch, go } = useApp();
  const me = user as Artisan;
  const client = state.users[j.clientId];
  const cf = firstName(client.name);
  const mine = j.artisanId === me.id;
  const myBid = j.bids.filter((b) => b.artisanId === me.id).slice(-1)[0];

  if (!mine) {
    const missed = j.noShows.some((x) => x.artisanId === me.id);
    const can = artisanQualifies(me, j) && !missed;
    return (
      <>
        <BackBar label="Jobs" />
        <JobHeader job={j} />
        <PersonRow user={client} sub={`Client · ${client.area.split(',')[0]} · posted ${timeAgo(j.createdAt)} ago`} />
        <JobDetails job={j} hideAddress />
        {j.deliveredMaterials.length > 0 && (
          <>
            <h3>Already at the client's home</h3>
            <p className="small m0 mb8">The previous artisan didn't finish. These materials are on site and are taken off your quotation automatically.</p>
            <div className="card">
              <QuoteTable lines={j.deliveredMaterials} showTotal={false} />
            </div>
          </>
        )}
        {j.invitedArtisanId === me.id && (
          <Notice tone="info" icon="i">
            {cf} picked you from your profile.
          </Notice>
        )}
        {myBid?.status === 'pending' ? (
          <button className="btn secondary mt14" onClick={() => go({ name: 'applied', jobId: j.id })}>
            View your bid
          </button>
        ) : j.status !== 'open' ? (
          <Notice>This job is no longer taking bids.</Notice>
        ) : !can ? (
          <Notice>{missed ? 'You missed this job before, so you cannot bid on it again.' : me.verification.status !== 'verified' ? 'Finish verification to bid.' : `${j.tier} jobs need a rating of 4.7★ or more.`}</Notice>
        ) : (
          <button className="btn primary mt14" onClick={() => go({ name: 'quote', jobId: j.id })}>
            Make a quotation
          </button>
        )}
      </>
    );
  }

  const dayCame = j.scheduledDay ? isOnOrAfterDay(j.scheduledDay, Date.now()) : false;
  const half = misdescribedSplit(j.serviceFee ?? 0).artisan;
  const jobRentals = state.rentals.filter((r) => r.jobId === j.id);
  let focus: React.ReactNode = null;
  switch (j.status) {
    case 'awarded':
      focus = (
        <div className="focus">
          <h4>{j.materialsOrder?.status === 'accepted' ? `${state.users[j.materialsOrder.vendorId!].name} is buying the materials` : 'Waiting for a vendor to take the materials list'}</h4>
          <p>You start on {dayLabel(j.scheduledDay!)}. We'll tell you when the materials reach the client.</p>
        </div>
      );
      break;
    case 'materials_on_the_way':
      focus = (
        <div className="focus">
          <h4>Materials are on the way</h4>
          <p>
            Waybill: {j.materialsOrder!.waybill}. You start on {dayLabel(j.scheduledDay!)}.
          </p>
        </div>
      );
      break;
    case 'ready':
      focus = dayCame ? (
        <div className="focus warn">
          <h4>Today is the start day</h4>
          <p>
            Go to {j.addr}. Check the job against {cf}'s description and photos, then tap <b>Work started</b>.
          </p>
          <button className="btn primary" onClick={() => dispatch({ type: 'startWork', jobId: j.id }, `${cf} has been told you started.`)}>
            Work started
          </button>
          <button className="btn concern" onClick={() => confirm(`Mark this job not as described? You'll get ${formatNaira(half)} for the visit and the job ends.`) && dispatch({ type: 'flagMisdescribed', jobId: j.id })}>
            Job is not as described
          </button>
          <p className="small">Not as described pays you {formatNaira(half)} (50% of your fee) for the visit.</p>
        </div>
      ) : (
        <div className="focus">
          <h4>Materials are at the client's home</h4>
          <p>
            Your start day is <b>{dayLabel(j.scheduledDay!)}</b>. The Work started button appears that day. Address: {j.addr}.
          </p>
          <SimButton onClick={() => dispatch({ type: 'demoStartDay', jobId: j.id })}>it's the scheduled day</SimButton>
        </div>
      );
      break;
    case 'in_progress':
      focus = (
        <div className="focus">
          <h4>Work in progress</h4>
          <p>Need equipment? Rent it from a verified tool company. The rental comes out of your service fee when {cf} confirms.</p>
          {jobRentals.map((r) => (
            <div className="small" key={r.id}>
              • {state.tools.find((t) => t.id === r.toolId)?.name} from {state.users[r.companyId].name}: <b className="ink">{r.status}</b>
            </div>
          ))}
          <button className="btn secondary" onClick={() => go({ name: 'store', jobId: j.id })}>
            Rent a tool for this job
          </button>
          <button className="btn primary" onClick={() => dispatch({ type: 'finishWork', jobId: j.id }, `${cf} has been asked to check the work.`)}>
            Work finished
          </button>
        </div>
      );
      break;
    case 'supervisor_check':
    case 'awaiting_client':
      focus = (
        <div className="focus warn">
          <h4>Waiting for {j.status === 'supervisor_check' ? 'the supervisor' : `${cf} to tap Job done`}</h4>
          <p>Your wallet is credited when {cf} confirms:</p>
          <SplitBox split={completionSplit(j, state.rentals)} job={j} />
          {j.status === 'supervisor_check' && <SimButton onClick={() => dispatch({ type: 'supervisorApprove', jobId: j.id })}>supervisor approves the work</SimButton>}
        </div>
      );
      break;
    case 'completed':
      focus = (
        <div className="focus good">
          <h4>Paid to your wallet</h4>
          <p>{j.rating ? `${cf} rated you ★ ${j.rating.stars}.` : `${cf} can now rate you.`}</p>
          <button className="btn secondary" onClick={() => go({ name: 'wallet' })}>
            Open wallet
          </button>
        </div>
      );
      break;
    case 'not_as_described':
      focus = (
        <div className="focus bad">
          <h4>Visit paid</h4>
          <p>{formatNaira(half)} (50% of your fee) is in your wallet for the visit.</p>
        </div>
      );
      break;
    default:
      focus = (
        <div className="focus bad">
          <h4>{j.status === 'disputed' ? 'Allyfe is reviewing' : 'This job is closed'}</h4>
          <p>{j.status === 'disputed' ? 'An admin will contact you and the client.' : 'Contact Allyfe support if you have questions.'}</p>
        </div>
      );
  }
  return (
    <>
      <BackBar label="Jobs" />
      <JobHeader job={j} artisanView />
      <Journey job={j} />
      <PersonRow user={client} sub={`Client · ${client.phone}`} />
      <div className="mt14">{focus}</div>
      <MaterialsStatus job={j} />
      {myBid && (
        <>
          <h3>Your accepted quotation</h3>
          <div className="card">
            <QuoteTable lines={myBid.lines} serviceFee={myBid.serviceFee} />
          </div>
        </>
      )}
      <JobDetails job={j} />
      <History job={j} />
    </>
  );
}

/* ---------------- Quotation ---------------- */
export function QuoteForm({ jobId }: { jobId: string }) {
  const { state, dispatch, go } = useApp();
  const j = state.jobs.find((x) => x.id === jobId);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [pick, setPick] = useState('');
  const [pickQty, setPickQty] = useState('1');
  const [custom, setCustom] = useState({ name: '', price: '', qty: '1' });
  const [fee, setFee] = useState('');
  const [day, setDay] = useState<string[]>(j?.preferredDays.slice(0, 1) ?? []);
  const [message, setMessage] = useState('');
  if (!j) return <BackBar />;
  const catalog = MATERIALS[j.category];
  const num = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;
  const add = (l: QuoteLine) => {
    const i = lines.findIndex((x) => x.key === l.key);
    if (i >= 0) setLines(lines.map((x, k) => (k === i ? { ...x, qty: x.qty + l.qty } : x)));
    else setLines([...lines, l]);
  };
  const setQty = (i: number, qty: number) => setLines(qty <= 0 ? lines.filter((_, k) => k !== i) : lines.map((x, k) => (k === i ? { ...x, qty } : x)));
  const { billable, covered } = billableMaterials(lines, j.deliveredMaterials);
  const materials = linesTotal(billable);
  const serviceFee = num(fee);

  return (
    <>
      <BackBar label="Job" />
      <h2>Your quotation</h2>
      <p className="sub">
        {j.title}. List the materials you need, then set your service fee. The client sees every line.
      </p>

      <h3>Materials</h3>
      <div className="card">
        <label className="f mt0" htmlFor="mpick">
          From the {j.category.toLowerCase()} list
        </label>
        <select id="mpick" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Choose a material…</option>
          {catalog.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name} · {formatNaira(c.price)}/{c.unit}
            </option>
          ))}
        </select>
        <div className="row mt8">
          <input type="text" inputMode="numeric" aria-label="Quantity" value={pickQty} onChange={(e) => setPickQty(e.target.value)} />
          <button
            className="btn secondary"
            disabled={!pick}
            onClick={() => {
              const c = catalog.find((x) => x.key === pick)!;
              add({ key: c.key, name: c.name, unit: c.unit, unitPrice: c.price, qty: Math.max(1, num(pickQty)) });
              setPick('');
              setPickQty('1');
            }}
          >
            Add
          </button>
        </div>
        <details className="mt10">
          <summary className="small w600">Material not on the list?</summary>
          <label className="f" htmlFor="cname">
            Material name
          </label>
          <input id="cname" type="text" placeholder="e.g. Silicone sealant" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
          <div className="row">
            <div>
              <label className="f" htmlFor="cprice">
                Cost price (₦ each)
              </label>
              <input id="cprice" type="text" inputMode="numeric" value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} />
            </div>
            <div>
              <label className="f" htmlFor="cqty">
                Quantity
              </label>
              <input id="cqty" type="text" inputMode="numeric" value={custom.qty} onChange={(e) => setCustom({ ...custom, qty: e.target.value })} />
            </div>
          </div>
          <button
            className="btn secondary mt8"
            disabled={!custom.name.trim() || !num(custom.price)}
            onClick={() => {
              add({ key: customKey(custom.name), name: custom.name.trim(), unit: 'item', unitPrice: num(custom.price), qty: Math.max(1, num(custom.qty)) });
              setCustom({ name: '', price: '', qty: '1' });
            }}
          >
            Add this material
          </button>
        </details>
      </div>

      {lines.length > 0 && (
        <div className="card mt10 qlines">
          {lines.map((l, i) => (
            <div className="qline" key={l.key}>
              <div className="grow">
                <b className="t13">{l.name}</b>
                <div className="small">
                  {formatNaira(l.unitPrice)} each{l.key.startsWith('custom:') ? ' · your price' : ''}
                </div>
              </div>
              <div className="stepper">
                <button onClick={() => setQty(i, l.qty - 1)} aria-label={`Less ${l.name}`}>
                  −
                </button>
                <span>{l.qty}</span>
                <button onClick={() => setQty(i, l.qty + 1)} aria-label={`More ${l.name}`}>
                  +
                </button>
              </div>
              <b className="t13 nowrap w72 tr">{formatNaira(l.unitPrice * l.qty)}</b>
            </div>
          ))}
        </div>
      )}
      {covered.length > 0 && (
        <Notice tone="info" icon="i">
          {covered.map((c) => `${c.qty} × ${c.name}`).join(', ')} {covered.length === 1 ? 'is' : 'are'} already at the client's home, so {covered.length === 1 ? "it isn't" : "they aren't"} charged.
        </Notice>
      )}

      <h3>Service fee</h3>
      <input type="text" inputMode="numeric" aria-label="Service fee" placeholder="₦ your labour for the whole job" value={fee} onChange={(e) => setFee(e.target.value)} />

      <label className="f">Which of the client's days?</label>
      <Calendar selected={day} onChange={setDay} max={1} allowed={j.preferredDays} />

      <label className="f" htmlFor="qmsg">
        Message to the client <em>(optional)</em>
      </label>
      <textarea id="qmsg" placeholder="What's included, how long it will take, anything the client should prepare…" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={600} />

      <div className="card money mt14">
        <div>
          <span>Materials{billable.length ? ` (${billable.length} item${billable.length > 1 ? 's' : ''})` : ''}</span>
          <b>{formatNaira(materials)}</b>
        </div>
        <div>
          <span>Service fee</span>
          <b>{formatNaira(serviceFee)}</b>
        </div>
        <div className="tot">
          <span>Your bid</span>
          <span>{formatNaira(materials + serviceFee)}</span>
        </div>
      </div>
      <button
        className="btn primary mt14"
        onClick={() => {
          if (dispatch({ type: 'submitBid', jobId: j.id, bid: { lines, serviceFee, day: day[0] ?? '', message } }, 'Bid sent.')) go({ name: 'applied', jobId: j.id });
        }}
      >
        Bid {formatNaira(materials + serviceFee)}
      </button>
    </>
  );
}

/* ---------------- Bid sent ---------------- */
export function Applied({ jobId }: { jobId: string }) {
  const { state, user, go } = useApp();
  const j = state.jobs.find((x) => x.id === jobId);
  const b = j?.bids.filter((x) => x.artisanId === user!.id).slice(-1)[0];
  if (!j || !b) return <BackBar />;
  const client = state.users[j.clientId];
  const accepted = j.artisanId === user!.id;
  return (
    <div className="success">
      <span className={'success-ic' + (b.status === 'declined' ? ' grey' : '')}>
        <Icon name="check" size={40} />
      </span>
      <h2>{accepted ? 'You got the job!' : b.status === 'declined' ? 'Not this time' : 'Bid sent'}</h2>
      <p className="sub">
        {accepted
          ? `${firstName(client.name)} accepted your bid and paid into Allyfe. A vendor will deliver the materials.`
          : b.status === 'declined'
            ? `${firstName(client.name)} chose another artisan. Keep your rating high and keep bidding.`
            : `${firstName(client.name)} will compare your quotation, rating and day with other bids. We'll alert you when they decide.`}
      </p>
      <div className="card">
        <b>{j.title}</b>
        <div className="small mb8">Start day: {dayLabel(b.day)}</div>
        <QuoteTable lines={b.lines} serviceFee={b.serviceFee} />
        {b.message && <p className="t13 m6">“{b.message}”</p>}
      </div>
      {accepted ? (
        <button className="btn primary mt14" onClick={() => go({ name: 'job', jobId: j.id })}>
          Open project
        </button>
      ) : (
        <button className="btn primary mt14" onClick={() => go({ name: 'jobs', tab: 'new' })}>
          Find more jobs
        </button>
      )}
      <button className="btn secondary mt8" onClick={() => go({ name: 'home' })}>
        Back to home
      </button>
    </div>
  );
}

/* ---------------- Profile, team & apprentices ---------------- */
export function ProfileEdit() {
  const { user, dispatch, go } = useApp();
  const a = user as Artisan;
  const [kind, setKind] = useState(a.kind);
  const [teamName, setTeamName] = useState(a.teamName ?? '');
  const [members, setMembers] = useState<string[]>(a.teamMembers.length ? a.teamMembers : [a.name, '']);
  const [bio, setBio] = useState(a.bio);
  const [ap, setAp] = useState({ name: '', phone: '', photo: '' });
  return (
    <>
      <BackBar />
      <h2>Profile & team</h2>
      <p className="sub">How clients see you.</p>
      <label className="f">I work as</label>
      <div className="seg two">
        <button className={kind === 'individual' ? 'on' : ''} onClick={() => setKind('individual')}>
          An individual
        </button>
        <button className={kind === 'team' ? 'on' : ''} onClick={() => setKind('team')}>
          A construction team
        </button>
      </div>
      {kind === 'team' && (
        <div className="card mt12">
          <label className="f mt0" htmlFor="tname">
            Team name
          </label>
          <input id="tname" type="text" placeholder="e.g. Uche Woodworks" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          <label className="f">Team members</label>
          <div className="stack">
            {members.map((m, i) => (
              <div className="row" key={i}>
                <input type="text" aria-label={`Member ${i + 1}`} placeholder={`Member ${i + 1}`} value={m} onChange={(e) => setMembers(members.map((x, k) => (k === i ? e.target.value : x)))} />
                {members.length > 2 && (
                  <button className="btn secondary sm flex0" onClick={() => setMembers(members.filter((_, k) => k !== i))} aria-label="Remove member">
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button className="btn secondary sm mt8" onClick={() => setMembers([...members, ''])}>
            + Add member
          </button>
        </div>
      )}
      <label className="f" htmlFor="bio">
        About you
      </label>
      <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} />
      <button className="btn primary mt12" onClick={() => dispatch({ type: 'updateProfile', kind, teamName, teamMembers: members, bio }, 'Profile saved.')}>
        Save profile
      </button>

      <h3>Apprentices</h3>
      <p className="small m0 mb8">When an apprentice later joins Allyfe as an artisan with the same phone number, your work shows on their profile as collaborated projects.</p>
      <div className="list">
        {a.apprentices.map((x) => (
          <div className="card up" key={x.id}>
            <span className="th done">
              <Picture src={x.photo} alt={x.name} />
            </span>
            <div>
              <b>{x.name}</b>
              <div className="small">
                {x.phone} · since {new Date(x.addedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </div>
            </div>
            <button className="btn secondary sm" onClick={() => confirm(`Remove ${x.name}?`) && dispatch({ type: 'removeApprentice', apprenticeId: x.id })}>
              Remove
            </button>
          </div>
        ))}
        {!a.apprentices.length && <Empty title="No apprentices yet">Add the people learning the trade under you.</Empty>}
      </div>
      <div className="card mt12">
        <b className="t14">Add an apprentice</b>
        <div className="ap-add mt8">
          <MediaInput label="Apprentice photo" onMedia={(photo) => setAp({ ...ap, photo })} className={'th' + (ap.photo ? ' done' : '')}>
            {ap.photo ? <Picture src={ap.photo} /> : <Icon name="camera" size={20} />}
          </MediaInput>
          <div className="grow stack">
            <input type="text" aria-label="Apprentice name" placeholder="Full name" value={ap.name} onChange={(e) => setAp({ ...ap, name: e.target.value })} />
            <input type="tel" aria-label="Apprentice phone" placeholder="Phone number" value={ap.phone} onChange={(e) => setAp({ ...ap, phone: e.target.value })} />
          </div>
        </div>
        <button
          className="btn primary mt10"
          onClick={() => {
            if (dispatch({ type: 'addApprentice', name: ap.name, phone: ap.phone, photo: ap.photo }, `${ap.name.trim()} added.`)) setAp({ name: '', phone: '', photo: '' });
          }}
        >
          Add apprentice
        </button>
      </div>
      <button className="btn secondary mt14" onClick={() => go({ name: 'pro', id: a.id })}>
        See my public profile
      </button>
    </>
  );
}

/* ---------------- Verification (artisan, tool company, vendor) ---------------- */
export function Verify() {
  const { user, dispatch } = useApp();
  if (!user || user.role === 'client') return null;
  const v = user.verification;
  const items = VERIFICATION_ITEMS[user.role];
  const locked = v.status === 'review' || v.status === 'verified';
  const SAMPLE = ['room', 'room', 'cabinet', 'wardrobe', 'ceiling'];
  return (
    <>
      <BackBar />
      <h2>{user.role === 'artisan' ? 'Photo verification' : `Verify ${user.name}`}</h2>
      <p className="sub">
        {user.role === 'artisan'
          ? 'Only verified artisans can bid. Upload clear photos; blurry ones are rejected. Allyfe checks them within 24 hours.'
          : user.role === 'vendor'
            ? 'Only verified vendors receive materials requests. Upload clear pictures of each document.'
            : 'Artisans only rent from verified companies. Upload clear pictures of each document.'}
      </p>
      <div className="uploads">
        {items.map((it) => {
          const f = v.files[it.key];
          const thumb = f ? <Picture src={f} /> : <span>+</span>;
          return (
            <div className="card up" key={it.key}>
              {locked ? (
                <span className={'th' + (f ? ' done' : '')}>{thumb}</span>
              ) : (
                <MediaInput label={`Upload ${it.title}`} onMedia={(img) => dispatch({ type: 'addVerificationFile', key: it.key, image: img }, 'Photo added.')} className={'th' + (f ? ' done' : '')}>
                  {thumb}
                </MediaInput>
              )}
              <div>
                <b>{it.title}</b>
                <div className="small">{it.hint}</div>
              </div>
              <span className={'tag ' + (f ? 'good' : 'grey')}>{f ? (v.status === 'verified' ? 'Approved' : 'Added') : 'Needed'}</span>
            </div>
          );
        })}
      </div>
      {v.status === 'verified' ? (
        <Notice tone="info" icon="✓">
          You are verified.
        </Notice>
      ) : v.status === 'review' ? (
        <>
          <Notice tone="info" icon="i">
            Submitted. Allyfe is checking your photos.
          </Notice>
          <SimButton onClick={() => dispatch({ type: 'approveVerification', userId: user.id }, 'Approved. You are verified.')}>Allyfe approves</SimButton>
        </>
      ) : (
        <>
          <button className="btn primary mt14" disabled={!items.every((i) => v.files[i.key])} onClick={() => dispatch({ type: 'submitVerification' }, 'Submitted for review.')}>
            Submit for review
          </button>
          <button className="btn sim mt8" onClick={() => items.forEach((it, i) => !v.files[it.key] && dispatch({ type: 'addVerificationFile', key: it.key, image: SAMPLE[i] ?? 'room' }))}>
            Fill with sample photos
          </button>
        </>
      )}
    </>
  );
}

/* ---------------- Tool store ---------------- */
export function Store({ jobId }: { jobId?: string }) {
  const { state, user, go } = useApp();
  const mine = state.rentals.filter((r) => r.artisanId === user!.id);
  const tools = state.tools.filter((t) => (state.users[t.companyId] as Company).verification.status === 'verified');
  const job = jobId ? state.jobs.find((j) => j.id === jobId) : undefined;
  return (
    <>
      <BackBar />
      <h2>Tool Store</h2>
      <p className="sub">Tools from verified companies.{job && ` Rentals come out of your fee for “${job.title}”.`}</p>
      {mine.length > 0 && (
        <>
          <h3>Your rentals</h3>
          <div className="list">
            {mine.map((r) => {
              const t = state.tools.find((x) => x.id === r.toolId)!;
              return (
                <div className="card tool" key={r.id}>
                  <ToolIcon kind={t.kind} />
                  <div>
                    <b>{t.name}</b>
                    <div className="small">
                      {state.users[r.companyId].name} · {r.days} day{r.days > 1 ? 's' : ''} · {formatNaira(r.fee)}
                      {r.jobId ? ' · from job fee' : ''}
                    </div>
                    <span className={'tag mt6 ' + (r.status === 'declined' ? 'bad' : r.status === 'requested' ? 'warn' : 'good')}>
                      {r.status === 'approved' ? 'Approved · ready for pickup' : r.status === 'paid' ? 'Paid' : r.status === 'requested' ? 'Waiting for company' : 'Declined'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <h3>Available</h3>
        </>
      )}
      <div className="list">
        {tools.map((t) => (
          <div className="card tool" key={t.id}>
            <ToolIcon kind={t.kind} />
            <div>
              <div className="between">
                <b>{t.name}</b>
                <b className="t13 nowrap">{formatNaira(t.pricePerDay)}/day</b>
              </div>
              <div className="small">
                {state.users[t.companyId].name} <span className="vtick">✓</span>
              </div>
              <button className="btn secondary sm mt8" onClick={() => go({ name: 'rent', toolId: t.id, jobId })}>
                Rent
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function Rent({ toolId, jobId }: { toolId: string; jobId?: string }) {
  const { state, user, dispatch, back } = useApp();
  const [days, setDays] = useState(2);
  const t = state.tools.find((x) => x.id === toolId);
  if (!t) return <BackBar />;
  const co = state.users[t.companyId];
  const job = jobId ? state.jobs.find((j) => j.id === jobId) : undefined;
  const fee = t.pricePerDay * days;
  return (
    <>
      <BackBar label="Tool Store" />
      <div className="card tool">
        <ToolIcon kind={t.kind} />
        <div>
          <b>{t.name}</b>
          <div className="small">
            {co.name} <span className="vtick">✓</span> · {formatNaira(t.pricePerDay)} per day
          </div>
        </div>
      </div>
      <label className="f">How many days?</label>
      <div className="seg">
        {[1, 2, 3].map((d) => (
          <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
            {d} day{d > 1 ? 's' : ''}
          </button>
        ))}
      </div>
      <div className="card money mt14">
        <div>
          <span>Rental</span>
          <b>{formatNaira(fee)}</b>
        </div>
        <div>
          <span>Paid from</span>
          <span>{job ? `Your fee for job ${job.ref}` : `Your wallet (${formatNaira(state.wallets[user!.id] ?? 0)})`}</span>
        </div>
      </div>
      <Notice tone="info" icon="i">
        Pick up from {co.name} with your Allyfe ID. Return it on time and in good condition, or the company can raise a claim.
      </Notice>
      <button className="btn primary" onClick={() => dispatch({ type: 'requestRental', toolId: t.id, days, jobId }, `Request sent to ${co.name}.`) && back()}>
        Request rental
      </button>
    </>
  );
}
