import { useState } from 'react';
import { Avatar, CategoryIcon, HouseArt, Icon, Picture } from '../components/art';
import { BackBar, Calendar, Empty, Notice, PersonRow, PhotoInput, SimButton, Stars, StatusTag, TopBar, VTick, dayLabel, timeAgo } from '../components/ui';
import type { JobDraft } from '../domain/actions';
import { CATEGORIES, PRO_MIN_RATING, TIERS, TIER_FEATURES, completionSplit, formatNaira, misdescribedSplit, rankArtisans, tierPrices } from '../domain/rules';
import type { Artisan, Category, Job, Proposal, ScheduleMode, Tier } from '../domain/types';
import { useApp } from '../store/store';

const useArtisans = () => {
  const { state } = useApp();
  return rankArtisans(Object.values(state.users).filter((u): u is Artisan => u.role === 'artisan' && u.verification.status === 'verified'));
};

/* ---------------- Home ---------------- */
export function ClientHome() {
  const { user, state, go } = useApp();
  const ranked = useArtisans();
  const active = state.jobs.filter((j) => j.clientId === user!.id && !['completed', 'cancelled', 'not_as_described'].includes(j.status));
  const hour = new Date().getHours();
  return (
    <>
      <TopBar />
      <div className="greet">
        <Avatar spec={user!.avatar} size={62} />
        <div>
          <div className="hi">{hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,'}</div>
          <div className="nm">{user!.name.split(' ')[0]}!</div>
          <div className="sl">Let's bring your ideas to life.</div>
        </div>
        <span />
      </div>
      <button className="search" onClick={() => go({ name: 'discover' })}>
        <Icon name="search" size={19} />
        <span className="grow placeholder">What service do you need?</span>
        <Icon name="filter" size={19} />
      </button>
      <div className="cats">
        {CATEGORIES.map((c) => (
          <button key={c} className="cat" onClick={() => go({ name: 'discover', category: c })}>
            <CategoryIcon cat={c} />
            {c}
          </button>
        ))}
      </div>
      <div className="promo">
        <div className="art">
          <HouseArt />
        </div>
        <div className="txt">
          <h4>Find trusted professionals for any project</h4>
          <p>Skilled people. Real work. Brighter lives.</p>
          <button className="btn orange" onClick={() => go({ name: 'postJob' })}>
            Post a Job <Icon name="arrow" size={15} />
          </button>
        </div>
        <div className="promo-stack">
          {ranked.slice(0, 3).map((p) => (
            <Avatar key={p.id} spec={p.avatar} size={24} />
          ))}
          <span>{ranked.length} verified pros nearby</span>
        </div>
      </div>
      {active.length > 0 && (
        <>
          <h3>Active projects</h3>
          <div className="list">{active.slice(0, 2).map((j) => <JobCard key={j.id} job={j} />)}</div>
        </>
      )}
      <h3>
        Top rated professionals
        <button onClick={() => go({ name: 'discover' })}>See all</button>
      </h3>
      <div className="hscroll">
        {ranked.map((p, i) => (
          <ProCard key={p.id} pro={p} rank={i} />
        ))}
      </div>
      <p className="small mt4">Ranked by client ratings on completed Allyfe jobs. Artisans who keep their work on Allyfe stay at the top.</p>
    </>
  );
}

function ProCard({ pro, rank }: { pro: Artisan; rank: number }) {
  const { go, state, user } = useApp();
  const fav = (state.favourites[user!.id] ?? []).includes(pro.id);
  return (
    <button className="pro" onClick={() => go({ name: 'pro', id: pro.id })}>
      <div className="ph">
        <Avatar spec={pro.avatar} size={132} />
        <span className="tk">
          <VTick />
        </span>
        <span className={'hrt' + (fav ? ' on' : '')}>
          <Icon name={fav ? 'heartF' : 'heart'} size={13} />
        </span>
        {rank === 0 && <span className="rk">#1 in PH</span>}
      </div>
      <div className="bd">
        <Stars rating={pro.rating} count={pro.ratingCount} />
        <span className="n">{pro.name}</span>
        <span className="t">{pro.trade}</span>
      </div>
    </button>
  );
}

/* ---------------- Discover ---------------- */
export function Discover({ category }: { category?: string }) {
  const { go, state, user } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | null>((category as Category) ?? null);
  const [savedOnly, setSavedOnly] = useState(false);
  const ranked = useArtisans();
  const favs = state.favourites[user!.id] ?? [];
  const list = ranked.filter(
    (p) => (!cat || p.categories.includes(cat)) && (!q || `${p.name} ${p.trade} ${p.bio} ${p.area}`.toLowerCase().includes(q.toLowerCase())) && (!savedOnly || favs.includes(p.id)),
  );
  return (
    <>
      <TopBar />
      <h2>Discover</h2>
      <label className="search">
        <Icon name="search" size={19} />
        <span className="sr">Search artisans</span>
        <input type="search" placeholder="Search trade, name or area" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </label>
      <div className="chip-row">
        <button className={'chip-btn' + (!cat ? ' on' : '')} onClick={() => setCat(null)}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} className={'chip-btn' + (cat === c ? ' on' : '')} onClick={() => setCat(c)} aria-pressed={cat === c}>
            {c}
          </button>
        ))}
        <button className={'chip-btn' + (savedOnly ? ' on' : '')} onClick={() => setSavedOnly(!savedOnly)} aria-pressed={savedOnly}>
          ♥ Saved
        </button>
      </div>
      <p className="small">
        {list.length} verified artisan{list.length === 1 ? '' : 's'} · ranked by rating and loyalty
      </p>
      <div className="list">
        {list.map((p) => (
          <PersonRow
            key={p.id}
            user={p}
            onClick={() => go({ name: 'pro', id: p.id })}
            sub={
              <>
                <Stars rating={p.rating} count={p.ratingCount} /> · {p.trade} · #{ranked.indexOf(p) + 1}
                <br />
                {p.area}
              </>
            }
          />
        ))}
        {!list.length && <Empty title="No artisans match">Try another service or clear your search.</Empty>}
      </div>
    </>
  );
}

/* ---------------- Artisan profile ---------------- */
export function ProProfile({ id }: { id: string }) {
  const { state, user, go, dispatch } = useApp();
  const ranked = useArtisans();
  const p = state.users[id] as Artisan;
  const fav = (state.favourites[user!.id] ?? []).includes(id);
  const reviews = state.jobs.filter((j) => j.artisanId === id && j.review).slice(0, 3);
  const work = state.posts.filter((x) => x.authorId === id).map((x) => x.image);
  const gallery = [...work, ...p.work].slice(0, 6);
  return (
    <>
      <BackBar />
      <div className="profile-hd">
        <Avatar spec={p.avatar} size={76} />
        <div>
          <div className="t19 w800">
            {p.name} <VTick />
          </div>
          <div className="t13">
            {p.trade} · {p.years} years
          </div>
          <div className="pin">
            <Icon name="pin" size={12} className="orange" />
            {p.area}
          </div>
        </div>
      </div>
      <div className="row tc mt14">
        {[
          ['★ ' + p.rating.toFixed(1), p.ratingCount + ' ratings'],
          [String(p.jobsDone), 'jobs on Allyfe'],
          ['#' + (ranked.indexOf(p) + 1), 'in Port Harcourt'],
        ].map(([a, b]) => (
          <div className="card stat" key={b}>
            <b>{a}</b>
            <span className="small">{b}</span>
          </div>
        ))}
      </div>
      {user!.role === 'client' && (
        <div className="row mt12">
          <button className="btn primary grow2" onClick={() => go({ name: 'postJob', artisanId: p.id, category: p.categories[0] })}>
            Book {p.name.split(' ')[0]}
          </button>
          <button className="btn secondary" onClick={() => dispatch({ type: 'toggleFavourite', artisanId: p.id }, fav ? 'Removed from saved.' : 'Saved.')}>
            {fav ? '♥ Saved' : 'Save'}
          </button>
        </div>
      )}
      <h3>About</h3>
      <p className="t13 m0">{p.bio}</p>
      <div className="card verified-box mt12">
        <div className="row-c">
          <VTick />
          <b className="t13">Verified by Allyfe</b>
        </div>
        <div className="small">ID, selfie and past-work photos checked. Pays and gets paid only through Allyfe.</div>
      </div>
      <h3>Recent work</h3>
      <div className="grid3">
        {gallery.map((w, i) => (
          <div className="sq" key={i}>
            <Picture src={w} />
          </div>
        ))}
      </div>
      <h3>Reviews</h3>
      {reviews.length ? (
        <div className="list">
          {reviews.map((j) => (
            <div className="card" key={j.id}>
              <div className="between">
                <b className="t13">{state.users[j.clientId].name.split(' ')[0]}</b>
                <span className="orange ls1">{'★'.repeat(j.review!.stars)}</span>
              </div>
              {j.review!.text && <p className="t13 m6">“{j.review!.text}”</p>}
              <div className="small">
                {j.title} · {timeAgo(j.review!.at)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="between">
            <b className="t13">Adaeze, D-Line</b>
            <span className="orange ls1">★★★★★</span>
          </div>
          <p className="t13 m6">“Came on the agreed day, kept the place clean and finished early.”</p>
        </div>
      )}
    </>
  );
}

/* ---------------- Post a job ---------------- */
const SAMPLE: Record<Category, [string, string]> = {
  'Home Renovation': ['Build kitchen cabinets', 'Replace 6 old kitchen cabinet doors and fit 2 new wall units. The wall is concrete and the space is 3 m wide.'],
  'Interior Design': ['POP ceiling for sitting room', 'POP ceiling with 6 recessed lights in a 5 m by 4 m sitting room.'],
  Plumbing: ['Fix leaking shower', 'The shower mixer drips constantly and the drain is slow.'],
  Electrical: ['Fix kitchen sockets', 'Three sockets in the kitchen stopped working after a power surge.'],
  Painting: ['Repaint two bedrooms', 'Two bedrooms, walls only, about 3 m high. Old paint is peeling in one corner.'],
};

export function PostJob({ artisanId, category }: { artisanId?: string; category?: string }) {
  const { state, user, dispatch, go, back } = useApp();
  const invited = artisanId ? (state.users[artisanId] as Artisan) : undefined;
  const startCat = (category as Category) || 'Home Renovation';
  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const [d, setD] = useState<JobDraft>({
    title: SAMPLE[startCat][0],
    desc: SAMPLE[startCat][1],
    addr: user!.area,
    category: startCat,
    tier: 'Pro',
    schedule: { mode: 'This week', days: [] },
    photos: [],
    honest: false,
    invitedArtisanId: artisanId,
  });
  const set = (p: Partial<JobDraft>) => (setD({ ...d, ...p }), setErr(''));
  const prices = tierPrices(d.category);
  const bal = state.wallets[user!.id] ?? 0;
  const amount = prices[d.tier];
  const invitedOk = !invited || (invited.categories.includes(d.category) && (d.tier === 'Basic' || invited.rating >= PRO_MIN_RATING));

  const next = () => {
    if (step === 1 && !d.title.trim()) return setErr('Add a short job title so artisans know what you need.');
    if (step === 1 && !d.desc.trim()) return setErr('Describe the work so artisans know what to expect.');
    if (step === 1 && !d.addr.trim()) return setErr('Add the address where the work will happen.');
    if (step === 2 && d.schedule.mode === 'Flexible' && !d.schedule.days.length) return setErr('Pick at least one day on the calendar.');
    if (step === 3 && !d.honest) return setErr('Tick the box to confirm your description is truthful.');
    setStep(step + 1);
    document.querySelector('.content')?.scrollTo(0, 0);
  };

  return (
    <>
      <div className="topbar">
        <button className="back" onClick={() => (step === 1 ? back() : setStep(step - 1))}>
          <Icon name="back" size={18} />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        <span className="small">Step {step} of 4</span>
      </div>
      <div className="progress">
        <i style={{ width: `${step * 25}%` }} />
      </div>

      {step === 1 && (
        <>
          <h2>Post a job</h2>
          <p className="sub">
            {invited && (
              <>
                For <b>{invited.name}</b>.{' '}
              </>
            )}
            Describe the work clearly so the artisan knows what to expect.
          </p>
          <label className="f" htmlFor="fcat">
            Service
          </label>
          <select id="fcat" value={d.category} onChange={(e) => set({ category: e.target.value as Category })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="f" htmlFor="ftitle">
            Job title
          </label>
          <input id="ftitle" type="text" value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} />
          <label className="f" htmlFor="fdesc">
            What needs doing?
          </label>
          <textarea id="fdesc" value={d.desc} onChange={(e) => set({ desc: e.target.value })} maxLength={1000} />
          <label className="f" htmlFor="faddr">
            Address <em>(shared only with the artisan you confirm)</em>
          </label>
          <input id="faddr" type="text" value={d.addr} onChange={(e) => set({ addr: e.target.value })} />
          <label className="f">
            Photos of the job <em>(helps avoid surprises)</em>
          </label>
          <div className="thumbs">
            {d.photos.map((p, i) => (
              <button key={i} className="thumb" onClick={() => set({ photos: d.photos.filter((_, j) => j !== i) })} aria-label="Remove photo">
                <Picture src={p} />
                <span className="x">×</span>
              </button>
            ))}
            {d.photos.length < 4 && (
              <PhotoInput label="Add a photo of the job" onPhoto={(p) => set({ photos: [...d.photos, p] })} className="thumb add">
                +
              </PhotoInput>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2>When should it be done?</h2>
          <p className="sub">Pick a timing. Flexible lets you mark the days that suit you.</p>
          <div className="seg">
            {(['This week', 'Next week', 'Flexible'] as ScheduleMode[]).map((m) => (
              <button key={m} className={d.schedule.mode === m ? 'on' : ''} onClick={() => set({ schedule: { mode: m, days: m === 'Flexible' ? d.schedule.days : [] } })}>
                {m}
              </button>
            ))}
          </div>
          {d.schedule.mode === 'Flexible' ? (
            <>
              <Calendar selected={d.schedule.days} onChange={(days) => set({ schedule: { mode: 'Flexible', days } })} />
              <p className="small mt8">
                {d.schedule.days.length
                  ? `${d.schedule.days.length} day${d.schedule.days.length > 1 ? 's' : ''} picked: ${d.schedule.days.map(dayLabel).join(', ')}. The artisan proposes one of them.`
                  : 'Tap up to 5 days that work for you. The artisan proposes one of them.'}
              </p>
            </>
          ) : (
            <Notice tone="info" icon="i">
              {d.schedule.mode === 'This week' ? 'Artisans who can start before Sunday will see your job first.' : 'Your job will be offered for Monday to Saturday next week.'}
            </Notice>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <h2>Choose your service</h2>
          <p className="sub">Suggested deposit for {d.category.toLowerCase()}. Artisans can propose a different price; you confirm before work starts.</p>
          <div className="stack">
            {TIERS.map((t: Tier) => (
              <button key={t} className={'card tier' + (d.tier === t ? ' on' : '')} onClick={() => set({ tier: t })} aria-pressed={d.tier === t}>
                <span className="rd" />
                <span>
                  <b>{t}</b> {t === 'Premium' && <span className="tag orange xs">Supervisor</span>}
                  <ul>
                    {TIER_FEATURES[t].map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </span>
                <span className="pr">{formatNaira(prices[t])}</span>
              </button>
            ))}
          </div>
          {!invitedOk && invited && (
            <Notice>
              {invited.name} can't take a {d.tier} {d.category.toLowerCase()} job. Your job will be open to every qualifying artisan instead.
            </Notice>
          )}
          <Notice>
            <b>Describe the job honestly.</b> If the artisan arrives and finds the work is not what you described, they can mark it <b>Not as described</b>. You would then lose{' '}
            <b>50% of your deposit ({formatNaira(misdescribedSplit(amount).artisan)})</b> to pay for their visit, and get the other half back.
          </Notice>
          <label className="check">
            <input type="checkbox" checked={d.honest} onChange={(e) => set({ honest: e.target.checked })} />
            <span>I have described the job truthfully and understand the 50% rule.</span>
          </label>
        </>
      )}

      {step === 4 && (
        <>
          <h2>Pay into Allyfe</h2>
          <p className="sub">
            Your money is held safely by Allyfe. The artisan is paid only when you tap <b>Work completed</b>.
          </p>
          <dl className="card summary m0">
            <dt>Job</dt>
            <dd>{d.title}</dd>
            <dt>Service</dt>
            <dd>
              {d.category} · {d.tier}
            </dd>
            <dt>When</dt>
            <dd>{d.schedule.mode === 'Flexible' ? d.schedule.days.map(dayLabel).join(', ') : d.schedule.mode}</dd>
            <dt>Artisan</dt>
            <dd>{invited && invitedOk ? invited.name : `Open to verified ${d.category.toLowerCase()} pros`}</dd>
          </dl>
          <div className="card money mt10">
            <div>
              <span>Deposit held by Allyfe</span>
              <b>{formatNaira(amount)}</b>
            </div>
            <div>
              <span>Wallet balance</span>
              <span>{formatNaira(bal)}</span>
            </div>
            <div className="tot">
              <span>Balance after payment</span>
              <span>{bal >= amount ? formatNaira(bal - amount) : 'Not enough'}</span>
            </div>
          </div>
          {bal >= amount ? (
            <button
              className="btn primary mt14"
              onClick={() => {
                const draft = { ...d, invitedArtisanId: invitedOk ? d.invitedArtisanId : undefined };
                const next = dispatch({ type: 'postJob', draft });
                if (next) go({ name: 'jobPosted', jobId: next.jobs[0].id });
              }}
            >
              Pay {formatNaira(amount)} from wallet
            </button>
          ) : (
            <>
              <Notice>Your wallet needs {formatNaira(amount - bal)} more.</Notice>
              <button className="btn orange" onClick={() => dispatch({ type: 'topUp', amount: 100000 }, '₦100,000 added to your wallet.')}>
                Top up ₦100,000
              </button>
            </>
          )}
          <p className="small center mt8">Payments are simulated in this build.</p>
        </>
      )}
      {err && <div className="err">{err}</div>}
      {step < 4 && (
        <button className="btn primary mt16" onClick={next}>
          {step === 3 ? 'Continue to payment' : 'Continue'}
        </button>
      )}
    </>
  );
}

/* ---------------- Job posted ---------------- */
export function JobPosted({ jobId }: { jobId: string }) {
  const { state, go } = useApp();
  const j = state.jobs.find((x) => x.id === jobId);
  if (!j) return null;
  const invited = j.invitedArtisanId ? state.users[j.invitedArtisanId] : null;
  return (
    <div className="success">
      <span className="success-ic">
        <Icon name="check" size={40} />
      </span>
      <h2>Job posted</h2>
      <p className="sub">
        {formatNaira(j.deposit)} is held safely by Allyfe.{' '}
        {invited ? `We've asked ${invited.name} to send a proposal.` : `Verified ${j.category.toLowerCase()} pros nearby have been alerted.`}
      </p>
      <div className="card summary-lite">
        <b>{j.title}</b>
        <div className="small">
          Job {j.ref} · {j.category} · {j.tier}
        </div>
      </div>
      <h3>What happens next</h3>
      <ol className="steps">
        <li>Artisans apply at your price or send a proposal.</li>
        <li>You compare ratings and prices, then confirm one.</li>
        <li>They check the job on arrival and get to work.</li>
        <li>
          You tap <b>Work completed</b> and Allyfe pays them.
        </li>
      </ol>
      <button className="btn primary mt14" onClick={() => go({ name: 'job', jobId: j.id })}>
        View job
      </button>
      <button className="btn secondary mt8" onClick={() => go({ name: 'home' })}>
        Back to home
      </button>
    </div>
  );
}

/* ---------------- Projects ---------------- */
function JobCard({ job }: { job: Job }) {
  const { state, go } = useApp();
  const a = job.artisanId ? (state.users[job.artisanId] as Artisan) : null;
  const pending = job.proposals.filter((p) => p.status === 'pending').length;
  return (
    <button className="card job-card" onClick={() => go({ name: 'job', jobId: job.id })}>
      <div className="ph">{a ? <Avatar spec={a.avatar} size={44} /> : <Picture src={job.photos[0] ?? 'room'} />}</div>
      <div className="grow">
        <b className="t14">{job.title}</b>
        <div className="small">
          {a ? a.name : job.status === 'open' ? (pending ? `${pending} proposal${pending > 1 ? 's' : ''} to review` : 'Waiting for proposals') : '—'} · {job.tier} · {formatNaira(job.agreedAmount ?? job.deposit)}
        </div>
        <StatusTag job={job} />
      </div>
      <Icon name="chev" size={14} />
    </button>
  );
}

export function Projects() {
  const { state, user, go } = useApp();
  const mine = state.jobs.filter((j) => j.clientId === user!.id);
  const active = mine.filter((j) => !['completed', 'cancelled', 'not_as_described'].includes(j.status));
  const past = mine.filter((j) => !active.includes(j));
  return (
    <>
      <TopBar />
      <h2>My projects</h2>
      <p className="sub">Jobs you have posted and paid for.</p>
      {active.length ? (
        <div className="list">{active.map((j) => <JobCard key={j.id} job={j} />)}</div>
      ) : (
        <Empty title="No active projects">
          Post a job to get started.
          <br />
          <br />
          <button className="btn orange" onClick={() => go({ name: 'postJob' })}>
            Post a Job
          </button>
        </Empty>
      )}
      {past.length > 0 && (
        <>
          <h3>Past</h3>
          <div className="list">{past.map((j) => <JobCard key={j.id} job={j} />)}</div>
        </>
      )}
    </>
  );
}

/* ---------------- Client job detail ---------------- */
export function ClientJob({ job: j }: { job: Job }) {
  const { state, dispatch, go } = useApp();
  const a = j.artisanId ? (state.users[j.artisanId] as Artisan) : null;
  const firstName = a?.name.split(' ')[0];
  const pending = j.proposals.filter((p) => p.status === 'pending');
  const split = j.status === 'awaiting_client' ? completionSplit(j, state.rentals) : null;
  const jobRentals = state.rentals.filter((r) => r.jobId === j.id && r.status !== 'declined');

  let focus: React.ReactNode = null;
  switch (j.status) {
    case 'open':
      focus = (
        <div className="focus">
          <h4>{pending.length ? `${pending.length} artisan${pending.length > 1 ? 's' : ''} want this job` : 'Waiting for proposals'}</h4>
          <p>
            {formatNaira(j.escrow)} is held by Allyfe.{' '}
            {j.invitedArtisanId ? `${state.users[j.invitedArtisanId].name} has been asked to respond.` : 'Verified artisans near you have been alerted.'}
          </p>
          {pending.map((p) => (
            <ProposalRow key={p.id} p={p} job={j} />
          ))}
          <button className="btn secondary" onClick={() => confirm('Cancel this job and get your deposit back?') && dispatch({ type: 'cancelJob', jobId: j.id }, 'Job cancelled. Your deposit is back in your wallet.')}>
            Cancel job and refund
          </button>
        </div>
      );
      break;
    case 'confirmed':
      focus = (
        <div className="focus">
          <h4>{firstName} is confirmed</h4>
          <p>
            {j.agreedDay ? `Coming on ${dayLabel(j.agreedDay)}. ` : ''}Your address is now shared. When they arrive, they check the job against your description and photos.
          </p>
        </div>
      );
      break;
    case 'in_progress':
      focus = (
        <div className="focus">
          <h4>Work in progress</h4>
          <p>
            {j.tier === 'Premium' && (
              <>
                An Allyfe supervisor, <b>Engr. Nnamdi Eze</b>, will inspect the work when it is done.{' '}
              </>
            )}
            You'll be asked to check the work when {firstName} finishes.
          </p>
          {jobRentals.length > 0 && <div className="small">Tools rented for this job: {jobRentals.map((r) => state.tools.find((t) => t.id === r.toolId)?.name).join(', ')}. Paid from this job when you confirm.</div>}
        </div>
      );
      break;
    case 'supervisor_check':
      focus = (
        <div className="focus warn">
          <h4>Supervisor is inspecting</h4>
          <p>Engr. Nnamdi Eze is checking the work against your job description before you release payment.</p>
          <SimButton onClick={() => dispatch({ type: 'supervisorApprove', jobId: j.id })}>supervisor approves the work</SimButton>
        </div>
      );
      break;
    case 'awaiting_client':
      focus = (
        <div className="focus warn">
          <h4>{firstName} says the work is done</h4>
          <p>
            Check the work{j.tier === 'Premium' ? ' (the supervisor has approved it)' : ''}. When you tap <b>Work completed</b>, your deposit is paid out like this:
          </p>
          {split && <SplitBox split={split} job={j} />}
          <button
            className="btn primary"
            onClick={() => {
              if (dispatch({ type: 'completeJob', jobId: j.id })) go({ name: 'completed', jobId: j.id });
            }}
          >
            Work completed
          </button>
          <div className="row">
            <button className="btn secondary" onClick={() => dispatch({ type: 'notFinished', jobId: j.id }, `${firstName} has been told the work isn't finished.`)}>
              Not finished yet
            </button>
            <button className="btn concern" onClick={() => dispatch({ type: 'raiseConcern', jobId: j.id }, 'Allyfe will review and contact you both.')}>
              Raise a concern
            </button>
          </div>
        </div>
      );
      break;
    case 'completed':
      focus = (
        <div className="focus good">
          <h4>Completed and paid</h4>
          {j.review ? (
            <p className="small">You rated this job ★ {j.review.stars}. Thanks, that keeps great artisans at the top.</p>
          ) : (
            <button className="btn orange" onClick={() => go({ name: 'review', jobId: j.id })}>
              Rate {firstName}
            </button>
          )}
        </div>
      );
      break;
    case 'not_as_described': {
      const ms = misdescribedSplit(j.agreedAmount ?? j.deposit);
      focus = (
        <div className="focus bad">
          <h4>Marked “not as described”</h4>
          <p>{firstName} found the job different from your description. Under the 50% rule:</p>
          <div className="card money sand">
            <div>
              <span>Paid to {firstName} for the visit</span>
              <b>{formatNaira(ms.artisan)}</b>
            </div>
            <div>
              <span>Returned to your wallet</span>
              <b>{formatNaira(ms.clientRefund)}</b>
            </div>
          </div>
          <button className="btn secondary" onClick={() => go({ name: 'postJob', category: j.category })}>
            Post the job again with the right details
          </button>
          <button className="btn concern" onClick={() => dispatch({ type: 'raiseConcern', jobId: j.id }, 'Allyfe will review and contact you both.')}>
            I disagree, ask Allyfe to review
          </button>
        </div>
      );
      break;
    }
    case 'disputed':
      focus = (
        <div className="focus bad">
          <h4>Allyfe is reviewing</h4>
          <p>Any money still held stays with Allyfe until an admin has spoken to you both.</p>
        </div>
      );
      break;
    case 'cancelled':
      focus = (
        <div className="focus">
          <h4>Cancelled</h4>
          <p>Your deposit went back to your wallet.</p>
        </div>
      );
      break;
  }

  return (
    <>
      <BackBar label="My projects" />
      <JobHeader job={j} />
      {a && <PersonRow user={a} sub={<><Stars rating={a.rating} count={a.ratingCount} /> · {a.trade}</>} onClick={() => go({ name: 'pro', id: a.id })} />}
      <div className="mt14">{focus}</div>
      <JobDetails job={j} />
      <History job={j} />
    </>
  );
}

function ProposalRow({ p, job }: { p: Proposal; job: Job }) {
  const { state, go } = useApp();
  const a = state.users[p.artisanId] as Artisan;
  const diff = p.amount - job.escrow;
  return (
    <button className="card proposal-row" onClick={() => go({ name: 'confirm', jobId: job.id, proposalId: p.id })}>
      <Avatar spec={a.avatar} size={40} />
      <div className="grow">
        <b className="t13">
          {a.name} <VTick />
        </b>
        <div className="small">
          <Stars rating={a.rating} count={a.ratingCount} /> · {p.kind === 'apply' ? 'Applied at your price' : 'Proposal'}
          {p.startDay && ` · ${dayLabel(p.startDay)}`}
        </div>
      </div>
      <span className="tr">
        <b className="t14">{formatNaira(p.amount)}</b>
        {diff !== 0 && <div className={'small ' + (diff > 0 ? 'warn-ink' : 'good-ink')}>{diff > 0 ? '+' : '−'}{formatNaira(Math.abs(diff))}</div>}
      </span>
    </button>
  );
}

export function JobHeader({ job: j, artisanView }: { job: Job; artisanView?: boolean }) {
  return (
    <>
      <h2>{j.title}</h2>
      <p className="sub mb8">
        Job {j.ref} · {j.category} · {j.tier}
        {j.tier === 'Premium' ? ' · supervised' : ''}
      </p>
      <StatusTag job={j} artisanView={artisanView} />
      <div className="mb14" />
    </>
  );
}

export function JobDetails({ job: j, hideAddress }: { job: Job; hideAddress?: boolean }) {
  return (
    <>
      <h3>Job details</h3>
      <div className="card">
        <p className="t13 m0">{j.desc}</p>
        {j.photos.length > 0 && (
          <div className="grid3 mt10">
            {j.photos.map((p, i) => (
              <div className="sq" key={i}>
                <Picture src={p} />
              </div>
            ))}
          </div>
        )}
        <dl className="summary">
          <dt>When</dt>
          <dd>
            {j.agreedDay ? dayLabel(j.agreedDay) : j.schedule.mode === 'Flexible' ? `Flexible: ${j.schedule.days.map(dayLabel).join(', ')}` : j.schedule.mode}
          </dd>
          <dt>Address</dt>
          <dd>{hideAddress ? 'Shared once the client confirms you' : j.addr}</dd>
        </dl>
      </div>
    </>
  );
}

export function History({ job: j }: { job: Job }) {
  return (
    <>
      <h3>Status history</h3>
      <ol className="timeline">
        {j.history
          .slice()
          .reverse()
          .map((e, i) => (
            <li key={i}>
              <i />
              <div>
                <div className="t1">{e.label}</div>
                <div className="small">
                  {e.by} · {timeAgo(e.at)}
                </div>
              </div>
            </li>
          ))}
      </ol>
    </>
  );
}

export function SplitBox({ split, job }: { split: ReturnType<typeof completionSplit>; job: Job }) {
  const { state } = useApp();
  return (
    <div className="card money sand">
      <div>
        <span>{state.users[job.artisanId!].name} (artisan)</span>
        <b>{formatNaira(split.artisan)}</b>
      </div>
      {split.companies.map((c) => (
        <div key={c.rentalId}>
          <span>{state.users[c.companyId].name} (tool rental)</span>
          <b>{formatNaira(c.amount)}</b>
        </div>
      ))}
      {split.platform > 0 && (
        <div>
          <span>Allyfe fee</span>
          <b>{formatNaira(split.platform)}</b>
        </div>
      )}
      <div className="tot">
        <span>Held by Allyfe</span>
        <span>{formatNaira(job.escrow)}</span>
      </div>
    </div>
  );
}

/* ---------------- Client confirm ---------------- */
export function ConfirmProposal({ jobId, proposalId }: { jobId: string; proposalId: string }) {
  const { state, user, dispatch, go } = useApp();
  const j = state.jobs.find((x) => x.id === jobId);
  const p = j?.proposals.find((x) => x.id === proposalId);
  if (!j || !p) return <BackBar />;
  const a = state.users[p.artisanId] as Artisan;
  const diff = p.amount - j.escrow;
  const bal = state.wallets[user!.id] ?? 0;
  return (
    <>
      <BackBar label="Back to job" />
      <h2>Confirm {a.name.split(' ')[0]}?</h2>
      <p className="sub">Check their offer. Once you confirm, they get your address and the job is booked.</p>
      <PersonRow user={a} sub={<><Stars rating={a.rating} count={a.ratingCount} /> · {a.trade} · {a.jobsDone} jobs</>} onClick={() => go({ name: 'pro', id: a.id })} />
      <div className="card mt12">
        <div className="small">{p.kind === 'apply' ? 'Applied at your price' : 'Their proposal'}</div>
        {p.message && <p className="t13 m6">“{p.message}”</p>}
        {p.startDay && (
          <div className="small">
            Can start: <b className="ink">{dayLabel(p.startDay)}</b>
          </div>
        )}
      </div>
      <div className="card money mt10">
        <div>
          <span>Agreed price</span>
          <b>{formatNaira(p.amount)}</b>
        </div>
        <div>
          <span>Already held by Allyfe</span>
          <span>{formatNaira(j.escrow)}</span>
        </div>
        <div className="tot">
          <span>{diff > 0 ? 'Extra to pay from wallet' : diff < 0 ? 'Returned to your wallet' : 'Nothing more to pay'}</span>
          <span>{diff ? formatNaira(Math.abs(diff)) : '—'}</span>
        </div>
      </div>
      {diff > bal && <Notice>Your wallet needs {formatNaira(diff - bal)} more. Top up from your wallet first.</Notice>}
      <Notice tone="info" icon="i">
        Allyfe keeps holding the money. {a.name.split(' ')[0]} is paid only when you tap <b>Work completed</b>.
      </Notice>
      <button
        className="btn primary"
        onClick={() => {
          if (dispatch({ type: 'confirmProposal', jobId: j.id, proposalId: p.id }, `${a.name} is confirmed.`)) go({ name: 'job', jobId: j.id });
        }}
      >
        Confirm {a.name.split(' ')[0]} for {formatNaira(p.amount)}
      </button>
      <button className="btn secondary mt8" onClick={() => go({ name: 'wallet' })}>
        Open wallet
      </button>
    </>
  );
}

/* ---------------- Completed ---------------- */
export function Completed({ jobId }: { jobId: string }) {
  const { state, go } = useApp();
  const j = state.jobs.find((x) => x.id === jobId);
  if (!j || !j.artisanId) return null;
  const a = state.users[j.artisanId] as Artisan;
  const paidTools = state.rentals.filter((r) => r.jobId === j.id && r.status === 'paid');
  const toolTotal = paidTools.reduce((s, r) => s + r.fee, 0);
  const total = j.agreedAmount ?? j.deposit;
  return (
    <div className="success">
      <span className="success-ic">
        <Icon name="check" size={40} />
      </span>
      <h2>Work completed</h2>
      <p className="sub">Payment released. Thanks for using Allyfe.</p>
      <div className="card money">
        <div>
          <span>{a.name}</span>
          <b>{formatNaira(total - toolTotal)}</b>
        </div>
        {paidTools.map((r) => (
          <div key={r.id}>
            <span>{state.users[r.companyId].name} (tools)</span>
            <b>{formatNaira(r.fee)}</b>
          </div>
        ))}
        <div className="tot">
          <span>Total released</span>
          <span>{formatNaira(total)}</span>
        </div>
      </div>
      <div className="card center mt12">
        <Avatar spec={a.avatar} size={56} />
        <p className="t13">How did {a.name.split(' ')[0]} do? Your rating keeps great artisans at the top.</p>
        <button className="btn orange" onClick={() => go({ name: 'review', jobId: j.id })}>
          Rate {a.name.split(' ')[0]}
        </button>
      </div>
      <button className="btn secondary mt8" onClick={() => go({ name: 'home' })}>
        Later
      </button>
    </div>
  );
}

/* ---------------- Review form ---------------- */
export function ReviewForm({ jobId }: { jobId: string }) {
  const { state, dispatch, go, toast } = useApp();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const j = state.jobs.find((x) => x.id === jobId);
  if (!j || !j.artisanId) return null;
  const a = state.users[j.artisanId] as Artisan;
  const words = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  return (
    <>
      <BackBar label="Back" />
      <div className="center">
        <Avatar spec={a.avatar} size={72} />
        <h2 className="mt10">How did {a.name.split(' ')[0]} do?</h2>
        <p className="sub">{j.title}</p>
        <div className="starpick" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} role="radio" aria-checked={stars === n} className={stars >= n ? 'on' : ''} onClick={() => setStars(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
              <Icon name="star" size={36} />
            </button>
          ))}
        </div>
        <div className="small h18">{words[stars]}</div>
      </div>
      <label className="f" htmlFor="rtext">
        Tell others about the job <em>(optional)</em>
      </label>
      <textarea id="rtext" placeholder="What went well?" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
      <p className="small">
        {a.name.split(' ')[0]} is ★ {a.rating.toFixed(2)} from {a.ratingCount} ratings. Your review is added to that average.
      </p>
      <button
        className="btn primary mt14"
        disabled={!stars}
        onClick={() => {
          const next = dispatch({ type: 'submitReview', jobId: j.id, stars, text });
          if (next) {
            const updated = next.users[a.id] as Artisan;
            toast(`Thanks! ${a.name.split(' ')[0]} is now ★ ${updated.rating.toFixed(2)} from ${updated.ratingCount} ratings.`);
            go({ name: 'job', jobId: j.id });
          }
        }}
      >
        Post rating
      </button>
    </>
  );
}
