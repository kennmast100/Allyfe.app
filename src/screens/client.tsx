import { useState } from 'react';
import { Avatar, CategoryIcon, HouseArt, Icon, Picture } from '../components/art';
import { BackBar, Calendar, Empty, Journey, MediaInput, Notice, PersonRow, SimButton, Stars, StatusTag, TopBar, VTick, dayLabel, timeAgo } from '../components/ui';
import { isVideo } from '../components/media';
import type { JobDraft } from '../domain/actions';
import {
  ATTITUDE_OPTIONS,
  CATEGORIES,
  CLOSED_STATUSES,
  MIN_DESCRIPTION,
  TIERS,
  TIER_FEATURES,
  WORK_OPTIONS,
  bidCharge,
  completionSplit,
  earliestWorkDay,
  formatNaira,
  isOnOrAfterDay,
  lineTotal,
  linesTotal,
  misdescribedSplit,
  optionStars,
  rankArtisans,
} from '../domain/rules';
import type { Artisan, Bid, Category, Job, QuoteLine, Tier } from '../domain/types';
import { useApp } from '../store/store';

const useArtisans = () => {
  const { state, user } = useApp();
  return rankArtisans(Object.values(state.users).filter((u): u is Artisan => u.role === 'artisan' && u.verification.status === 'verified' && u.city === user!.city));
};
const firstName = (n: string) => n.split(' ')[0];

/* ---------------- Home ---------------- */
export function ClientHome() {
  const { user, state, go } = useApp();
  const ranked = useArtisans();
  const active = state.jobs.filter((j) => j.clientId === user!.id && !CLOSED_STATUSES.includes(j.status));
  const hour = new Date().getHours();
  return (
    <>
      <TopBar />
      <div className="greet">
        <Avatar spec={user!.avatar} size={62} />
        <div>
          <div className="hi">{hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,'}</div>
          <div className="nm">{firstName(user!.name)}!</div>
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
          <button key={c} className="cat" onClick={() => go({ name: 'postJob', category: c })}>
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
          <h4>Get quotes from trusted artisans</h4>
          <p>Describe the job. Artisans send their price. Vendors deliver the materials.</p>
          <button className="btn orange" onClick={() => go({ name: 'postJob' })}>
            Post a Job <Icon name="arrow" size={15} />
          </button>
        </div>
        <div className="promo-stack">
          {ranked.slice(0, 3).map((p) => (
            <Avatar key={p.id} spec={p.avatar} size={24} />
          ))}
          <span>
            {ranked.length} verified pros in {user!.city}
          </span>
        </div>
      </div>
      {active.length > 0 && (
        <>
          <h3>Your projects</h3>
          <div className="list">{active.slice(0, 3).map((j) => <JobCard key={j.id} job={j} />)}</div>
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
        {rank === 0 && <span className="rk">#1 in {pro.city === 'Port Harcourt' ? 'PH' : pro.city}</span>}
        {pro.kind === 'team' && <span className="team-chip">Team of {pro.teamMembers.length}</span>}
      </div>
      <div className="bd">
        <Stars rating={pro.rating} count={pro.ratingCount} />
        <span className="n">{pro.kind === 'team' ? pro.teamName : pro.name}</span>
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
    (p) =>
      (!cat || p.categories.includes(cat)) &&
      (!q || `${p.name} ${p.teamName ?? ''} ${p.trade} ${p.bio} ${p.area}`.toLowerCase().includes(q.toLowerCase())) &&
      (!savedOnly || favs.includes(p.id)),
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
        {list.length} verified artisan{list.length === 1 ? '' : 's'} in {user!.city} · ranked by rating and loyalty
      </p>
      <div className="list">
        {list.map((p) => (
          <PersonRow
            key={p.id}
            user={p}
            onClick={() => go({ name: 'pro', id: p.id })}
            sub={
              <>
                <Stars rating={p.rating} count={p.ratingCount} /> · {p.trade}
                {p.kind === 'team' ? ` · Team of ${p.teamMembers.length}` : ''} · #{ranked.indexOf(p) + 1}
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
  const reviews = state.jobs.filter((j) => j.artisanId === id && j.rating).slice(0, 3);
  const gallery = [...new Set([...state.posts.filter((x) => x.authorId === id).map((x) => x.image), ...p.work])].slice(0, 6);
  const digits = (x: string) => x.replace(/\D/g, '');
  // If this artisan trained under someone on Allyfe, show that master's work as collaborated projects.
  const masters = Object.values(state.users).filter((u): u is Artisan => u.role === 'artisan' && u.apprentices.some((a) => digits(a.phone) === digits(p.phone)));
  return (
    <>
      <BackBar />
      <div className="profile-hd">
        <Avatar spec={p.avatar} size={76} />
        <div>
          <div className="t19 w800">
            {p.kind === 'team' ? p.teamName : p.name} <VTick />
          </div>
          <div className="t13">
            {p.trade} · {p.years} year{p.years === 1 ? '' : 's'}
            {p.kind === 'team' ? ` · led by ${p.name}` : ''}
          </div>
          <div className="pin">
            <Icon name="pin" size={12} className="orange" />
            {p.area}
          </div>
        </div>
      </div>
      <div className="row tc mt14">
        {[
          ['★ ' + p.rating.toFixed(2), p.ratingCount + ' ratings'],
          [String(p.jobsDone), 'jobs on Allyfe'],
          ['#' + (ranked.indexOf(p) + 1 || '–'), `in ${p.city}`],
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
            Request a quote
          </button>
          <button className="btn secondary" onClick={() => dispatch({ type: 'toggleFavourite', artisanId: p.id }, fav ? 'Removed from saved.' : 'Saved.')}>
            {fav ? '♥ Saved' : 'Save'}
          </button>
        </div>
      )}
      <h3>About</h3>
      <p className="t13 m0">{p.bio}</p>
      {p.kind === 'team' && (
        <>
          <h3>The team ({p.teamMembers.length})</h3>
          <div className="chips">
            {p.teamMembers.map((m) => (
              <span className="chip lg" key={m}>
                {m}
              </span>
            ))}
          </div>
        </>
      )}
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
      {masters.map((m) => (
        <div key={m.id}>
          <h3>Collaborated projects with {m.name}</h3>
          <p className="small m0 mb8">
            {firstName(p.name)} trained under {m.name}. These are jobs from that time.
          </p>
          <div className="grid3">
            {[...new Set([...state.posts.filter((x) => x.authorId === m.id).map((x) => x.image), ...m.work])].slice(0, 6).map((w, i) => (
              <div className="sq" key={i}>
                <Picture src={w} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {p.apprentices.length > 0 && (
        <>
          <h3>Apprentices</h3>
          <div className="apprentices">
            {p.apprentices.map((a) => (
              <div className="apprentice" key={a.id}>
                <div className="ap-photo">
                  <Picture src={a.photo} alt={a.name} />
                </div>
                <span>{a.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <h3>Reviews</h3>
      {reviews.length ? (
        <div className="list">
          {reviews.map((j) => (
            <div className="card" key={j.id}>
              <div className="between">
                <b className="t13">{firstName(state.users[j.clientId].name)}</b>
                <span className="orange w800">★ {j.rating!.stars}</span>
              </div>
              <div className="small">
                Work: {WORK_OPTIONS[5 - j.rating!.work]} · Attitude: {ATTITUDE_OPTIONS[5 - j.rating!.attitude]}
              </div>
              {j.rating!.text && <p className="t13 m6">“{j.rating!.text}”</p>}
              <div className="small">
                {j.title} · {timeAgo(j.rating!.at)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No written reviews yet">Ratings from earlier jobs count in the stars above.</Empty>
      )}
    </>
  );
}

/* ---------------- Post a job ---------------- */
const PROMPTS: Record<Category, string> = {
  'Home Renovation': 'Sizes (length × height), materials you want (e.g. plywood or MDF), what must be removed first, and the wall type.',
  'Interior Design': 'Room size, ceiling height, the finish you want, number of lights, and anything that must be removed first.',
  Plumbing: 'What is leaking or broken, where it is (kitchen, upstairs bathroom…), pipe size if you know it, and how long it has been happening.',
  Electrical: 'What stopped working, how many sockets or lights, whether the breaker trips, and if you have a generator or inverter.',
  Painting: 'Number of rooms, wall height, inside or outside, colours you want, and whether old paint is peeling.',
};

export function PostJob({ artisanId, category }: { artisanId?: string; category?: string }) {
  const { state, user, dispatch, go, back } = useApp();
  const invited = artisanId ? (state.users[artisanId] as Artisan) : undefined;
  const [step, setStep] = useState(category ? 2 : 1);
  const [err, setErr] = useState('');
  const [d, setD] = useState<JobDraft>({
    title: '',
    desc: '',
    addr: user!.area,
    category: (category as Category) || 'Plumbing',
    tier: 'Basic',
    preferredDays: [],
    media: [],
    honest: false,
    invitedArtisanId: artisanId,
  });
  const set = (p: Partial<JobDraft>) => (setD({ ...d, ...p }), setErr(''));
  const earliest = earliestWorkDay(Date.now());
  const invitedOk = !invited || (invited.categories.includes(d.category) && (d.tier === 'Basic' || invited.rating >= 4.7));
  const descLen = d.desc.trim().length;

  const next = () => {
    if (step === 2 && !d.title.trim()) return setErr('Add a short job title so artisans know what you need.');
    if (step === 2 && descLen < MIN_DESCRIPTION) return setErr(`Add more detail (at least ${MIN_DESCRIPTION} characters) so artisans can quote accurately.`);
    if (step === 2 && !d.addr.trim()) return setErr('Add the address where the work will happen.');
    if (step === 3 && !d.preferredDays.length) return setErr('Pick at least one day.');
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
          <h2>What kind of job is it?</h2>
          <p className="sub">We'll send it to verified artisans in {user!.city} who do this work.</p>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={'card cat-card' + (d.category === c ? ' on' : '')}
                onClick={() => {
                  set({ category: c });
                  setStep(2);
                }}
              >
                <CategoryIcon cat={c} />
                <b>{c}</b>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2>Describe the job</h2>
          <p className="sub">
            {invited && (
              <>
                For <b>{invited.name}</b>.{' '}
              </>
            )}
            Be specific. Artisans price the materials and their fee from what you write here.
          </p>
          <div className="chosen-cat">
            <CategoryIcon cat={d.category} /> <b>{d.category}</b>
            <button className="link ml-auto" onClick={() => setStep(1)}>
              Change
            </button>
          </div>
          <label className="f" htmlFor="ftitle">
            Job title
          </label>
          <input id="ftitle" type="text" placeholder="e.g. Fix leaking shower upstairs" value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} />
          <label className="f" htmlFor="fdesc">
            Details <em>(be very specific)</em>
          </label>
          <div className="hint-box">Include: {PROMPTS[d.category]}</div>
          <textarea id="fdesc" className="tall" value={d.desc} onChange={(e) => set({ desc: e.target.value })} maxLength={1500} placeholder="Write the details here…" />
          <div className={'small tr ' + (descLen >= MIN_DESCRIPTION ? 'good-ink' : '')}>{descLen >= MIN_DESCRIPTION ? '✓ Good detail' : `${MIN_DESCRIPTION - descLen} more characters needed`}</div>
          <label className="f" htmlFor="faddr">
            Address <em>(shared only with the artisan and vendor you accept)</em>
          </label>
          <input id="faddr" type="text" value={d.addr} onChange={(e) => set({ addr: e.target.value })} />
          <label className="f">
            Photos or a short video <em>(clear photos only · videos up to 20 s)</em>
          </label>
          <div className="thumbs">
            {d.media.map((m, i) => (
              <div key={i} className="thumb">
                <Picture src={m} />
                {isVideo(m) && <span className="vid-tag">▶</span>}
                <button className="x" onClick={() => set({ media: d.media.filter((_, j) => j !== i) })} aria-label="Remove">
                  ×
                </button>
              </div>
            ))}
            {d.media.length < 5 && (
              <MediaInput video label="Add a photo or video of the job" onMedia={(m) => set({ media: [...d.media, m] })} className="thumb add">
                <Icon name="camera" size={20} />
              </MediaInput>
            )}
          </div>
          <p className="small mt6">Blurry photos are rejected automatically. Photos are compressed before upload.</p>
        </>
      )}

      {step === 3 && (
        <>
          <h2>When can the work happen?</h2>
          <p className="sub">Pick up to 3 days that suit you. Each artisan chooses one of them in their bid.</p>
          <Notice tone="info" icon="i">
            <b>Why can't I pick sooner?</b> Work can start at least 24 hours after you post, so a market vendor has time to buy your materials and deliver them to your home.
            The earliest day for this job is <b>{dayLabel(earliest)}</b>.
          </Notice>
          <Calendar selected={d.preferredDays} onChange={(days) => set({ preferredDays: days })} max={3} minDay={earliest} />
          <p className="small mt8">{d.preferredDays.length ? `Picked: ${d.preferredDays.map(dayLabel).join(', ')}` : 'No days picked yet.'}</p>
        </>
      )}

      {step === 4 && (
        <>
          <h2>Choose your service level</h2>
          <p className="sub">Artisans send their own price. The level decides who can bid.</p>
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
                <span />
              </button>
            ))}
          </div>
          {!invitedOk && invited && <Notice>{invited.name} can't take a {d.tier} {d.category.toLowerCase()} job. Your job will go to every qualifying artisan instead.</Notice>}
          <div className="card how-pay mt14">
            <b className="t14">How payment works</b>
            <ol className="steps mt8">
              <li>Artisans send a quotation: materials plus their service fee.</li>
              <li>You accept one and pay into Allyfe. Nobody is paid yet.</li>
              <li>A market vendor delivers the materials. They're paid when you tap “I've received the materials”.</li>
              <li>The artisan is paid when you tap “Job done”.</li>
            </ol>
          </div>
          <Notice>
            <b>Describe the job honestly.</b> If the artisan arrives and the work is not what you described, they can mark it <b>Not as described</b>. You would lose <b>50% of the service fee</b> to pay for their visit. The materials stay with you.
          </Notice>
          <label className="check">
            <input type="checkbox" checked={d.honest} onChange={(e) => set({ honest: e.target.checked })} />
            <span>
              I have described the job truthfully and agree to the{' '}
              <button className="link" onClick={() => go({ name: 'terms' })}>
                terms and conditions
              </button>
              .
            </span>
          </label>
          <button
            className="btn primary mt14"
            disabled={!d.honest}
            onClick={() => {
              const next = dispatch({ type: 'postJob', draft: { ...d, invitedArtisanId: invitedOk ? d.invitedArtisanId : undefined } });
              if (next) go({ name: 'jobPosted', jobId: next.jobs[0].id });
            }}
          >
            Post job
          </button>
          <p className="small center mt8">You don't pay anything until you accept a bid.</p>
        </>
      )}
      {err && <div className="err">{err}</div>}
      {(step === 2 || step === 3) && (
        <button className="btn primary mt16" onClick={next}>
          Continue
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
      <p className="sub">{invited ? `We've asked ${invited.name} for a quotation.` : `Verified ${j.category.toLowerCase()} artisans in ${j.city} have been notified.`}</p>
      <div className="card summary-lite">
        <b>{j.title}</b>
        <div className="small">
          Job {j.ref} · {j.category} · {j.tier} · {j.preferredDays.map(dayLabel).join(', ')}
        </div>
      </div>
      <h3>What happens next</h3>
      <ol className="steps">
        <li>Artisans read your job and send a quotation: materials plus their service fee.</li>
        <li>You compare bids and ratings, then accept one and pay into Allyfe.</li>
        <li>A vendor in {j.city} buys the materials and delivers them to your home.</li>
        <li>The artisan comes on the agreed day and does the work.</li>
        <li>
          You tap <b>Job done</b> and Allyfe pays the artisan.
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
  const pending = job.bids.filter((b) => b.status === 'pending').length;
  return (
    <button className="card job-card" onClick={() => go({ name: 'job', jobId: job.id })}>
      <div className="ph">{a ? <Avatar spec={a.avatar} size={44} /> : <Picture src={job.media[0] ?? 'room'} />}</div>
      <div className="grow">
        <b className="t14">{job.title}</b>
        <div className="small">
          {a ? a.name : job.status === 'open' ? (pending ? `${pending} bid${pending > 1 ? 's' : ''} to review` : 'Waiting for bids') : job.category}
          {job.scheduledDay ? ` · ${dayLabel(job.scheduledDay)}` : ''}
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
  const active = mine.filter((j) => !CLOSED_STATUSES.includes(j.status));
  const past = mine.filter((j) => !active.includes(j));
  return (
    <>
      <TopBar />
      <h2>My projects</h2>
      <p className="sub">Every job you've posted, with its journey.</p>
      {active.length ? (
        <div className="list">{active.map((j) => <JobCard key={j.id} job={j} />)}</div>
      ) : (
        <Empty title="No active projects">
          Post a job to get quotations from artisans.
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

/* ---------------- Shared job parts ---------------- */
export function QuoteTable({ lines, serviceFee, covered, showTotal = true }: { lines: QuoteLine[]; serviceFee?: number; covered?: QuoteLine[]; showTotal?: boolean }) {
  const mat = linesTotal(lines);
  return (
    <div className="quote">
      {lines.length === 0 && !covered?.length && <div className="small">No materials needed.</div>}
      {lines.map((l, i) => (
        <div className="q-row" key={i}>
          <span>
            {l.name}
            {l.key.startsWith('custom:') && <span className="tag grey xs ml4">added</span>}
            <small>
              {l.qty} × {formatNaira(l.unitPrice)}
            </small>
          </span>
          <b>{formatNaira(lineTotal(l))}</b>
        </div>
      ))}
      {covered?.map((l, i) => (
        <div className="q-row covered" key={'c' + i}>
          <span>
            {l.name}
            <small>{l.qty} already at your home</small>
          </span>
          <b>₦0</b>
        </div>
      ))}
      <div className="q-row sub">
        <span>Materials</span>
        <b>{formatNaira(mat)}</b>
      </div>
      {serviceFee != null && (
        <div className="q-row sub">
          <span>Service fee</span>
          <b>{formatNaira(serviceFee)}</b>
        </div>
      )}
      {showTotal && serviceFee != null && (
        <div className="q-row tot">
          <span>Total</span>
          <b>{formatNaira(mat + serviceFee)}</b>
        </div>
      )}
    </div>
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
        <p className="t13 m0 pre">{j.desc}</p>
        {j.media.length > 0 && (
          <div className="grid3 mt10">
            {j.media.map((p, i) => (
              <div className="sq" key={i}>
                <Picture src={p} />
              </div>
            ))}
          </div>
        )}
        <dl className="summary">
          <dt>{j.scheduledDay ? 'Scheduled' : "Client's days"}</dt>
          <dd>{j.scheduledDay ? dayLabel(j.scheduledDay) : j.preferredDays.map(dayLabel).join(', ')}</dd>
          <dt>Address</dt>
          <dd>{hideAddress ? `${j.city} · shared once your bid is accepted` : `${j.addr}, ${j.city}`}</dd>
        </dl>
      </div>
    </>
  );
}

export function History({ job: j }: { job: Job }) {
  return (
    <>
      <h3>Activity</h3>
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
        <span>{state.users[job.artisanId!].name} (service fee)</span>
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
        <span>Released when you tap Job done</span>
        <span>{formatNaira(job.escrow)}</span>
      </div>
    </div>
  );
}

export function MaterialsStatus({ job: j }: { job: Job }) {
  const { state } = useApp();
  const o = j.materialsOrder;
  if (!o) return null;
  const v = o.vendorId ? state.users[o.vendorId] : null;
  return (
    <div className="card mt12">
      <div className="between">
        <b className="t13">Materials · {formatNaira(o.total)}</b>
        <span className={'tag xs ' + (o.status === 'delivered' ? 'good' : o.status === 'cancelled' ? 'grey' : 'blue')}>
          {o.status === 'open' ? 'Waiting for a vendor' : o.status === 'accepted' ? 'Vendor buying' : o.status === 'dispatched' ? 'On the way' : o.status === 'delivered' ? 'Delivered' : 'Cancelled'}
        </span>
      </div>
      {v && <div className="small mt4">Supplier: {v.name}</div>}
      {o.waybill && <div className="small">Waybill: {o.waybill}</div>}
      <details className="mt6">
        <summary className="small">See the {o.lines.length} item{o.lines.length === 1 ? '' : 's'}</summary>
        <QuoteTable lines={o.lines} showTotal={false} />
      </details>
    </div>
  );
}

/* ---------------- Client job detail ---------------- */
export function ClientJob({ job: j }: { job: Job }) {
  const { state, dispatch, go } = useApp();
  const a = j.artisanId ? (state.users[j.artisanId] as Artisan) : null;
  const af = a ? firstName(a.name) : '';
  const pending = j.bids.filter((b) => b.status === 'pending');
  const accepted = j.bids.find((b) => b.id === j.acceptedBidId);
  const dayCame = j.scheduledDay ? isOnOrAfterDay(j.scheduledDay, Date.now()) : false;

  let focus: React.ReactNode = null;
  switch (j.status) {
    case 'open':
      focus = (
        <div className="focus">
          <h4>{pending.length ? `${pending.length} quotation${pending.length > 1 ? 's' : ''} to compare` : 'Waiting for quotations'}</h4>
          <p>
            {pending.length
              ? 'Compare the materials, service fees and ratings. You pay only when you accept one.'
              : j.invitedArtisanId
                ? `${state.users[j.invitedArtisanId].name} has been asked for a quotation.`
                : `Verified ${j.category.toLowerCase()} artisans in ${j.city} have been notified.`}
            {j.escrow > 0 && ` ${formatNaira(j.escrow)} from your earlier booking is still held and counts toward the new bid.`}
          </p>
          {pending.map((b) => (
            <BidRow key={b.id} bid={b} job={j} />
          ))}
          {j.escrow === 0 && (
            <button className="btn secondary" onClick={() => confirm('Cancel this job?') && dispatch({ type: 'cancelJob', jobId: j.id }, 'Job cancelled.')}>
              Cancel job
            </button>
          )}
        </div>
      );
      break;
    case 'awarded':
      focus = (
        <div className="focus">
          <h4>{j.materialsOrder?.status === 'accepted' ? `${state.users[j.materialsOrder.vendorId!].name} is buying your materials` : `Finding a vendor in ${j.city}`}</h4>
          <p>
            The materials list has gone to market vendors in {j.city}. They deliver to your home before {af} comes on <b>{dayLabel(j.scheduledDay!)}</b>.
          </p>
          <button className="btn secondary" onClick={() => confirm('Cancel and get a full refund? Nothing has been delivered yet.') && dispatch({ type: 'requestRefund', jobId: j.id }, 'Cancelled. Your money is back in your wallet.')}>
            Cancel and get a full refund
          </button>
        </div>
      );
      break;
    case 'materials_on_the_way':
      focus = (
        <div className="focus warn">
          <h4>Materials are on the way</h4>
          <p>
            {state.users[j.materialsOrder!.vendorId!].name} sent them: <b>{j.materialsOrder!.waybill}</b>. Check every item when they arrive. The vendor is paid when you confirm.
          </p>
          <button className="btn primary" onClick={() => confirm('Have you received and checked all the materials? The vendor will be paid.') && dispatch({ type: 'confirmMaterials', jobId: j.id }, `${af} has been told to come and start work.`)}>
            I've received the materials
          </button>
        </div>
      );
      break;
    case 'ready':
      focus = (
        <div className="focus">
          <h4>{dayCame ? `${af} is due today` : `${af} comes on ${dayLabel(j.scheduledDay!)}`}</h4>
          <p>The materials are at your home. You'll get an alert when {af} taps Work started.</p>
          {dayCame ? (
            <button className="btn concern" onClick={() => confirm(`Report that ${af} didn't show up? They will get a 1★ rating for this job.`) && dispatch({ type: 'reportNoShow', jobId: j.id })}>
              {af} didn't show up
            </button>
          ) : (
            <SimButton onClick={() => dispatch({ type: 'demoStartDay', jobId: j.id })}>it's the scheduled day</SimButton>
          )}
        </div>
      );
      break;
    case 'in_progress':
      focus = (
        <div className="focus">
          <h4>Work in progress</h4>
          <p>
            {af} started work.
            {j.tier === 'Premium' ? ' An Allyfe supervisor will inspect it when it is finished.' : ` You'll be asked to check it when ${af} taps Work finished.`}
          </p>
        </div>
      );
      break;
    case 'supervisor_check':
      focus = (
        <div className="focus warn">
          <h4>Supervisor is inspecting</h4>
          <p>Engr. Nnamdi Eze is checking the work against your description before you pay.</p>
          <SimButton onClick={() => dispatch({ type: 'supervisorApprove', jobId: j.id })}>supervisor approves the work</SimButton>
        </div>
      );
      break;
    case 'awaiting_client':
      focus = (
        <div className="focus warn">
          <h4>{af} says the work is finished</h4>
          <p>Check the work{j.tier === 'Premium' ? ' (the supervisor has approved it)' : ''}. When you tap Job done, Allyfe pays:</p>
          <SplitBox split={completionSplit(j, state.rentals)} job={j} />
          <button
            className="btn primary"
            onClick={() => {
              if (dispatch({ type: 'completeJob', jobId: j.id }, `${af} has been paid.`)) go({ name: 'rate', jobId: j.id });
            }}
          >
            Job done
          </button>
          <div className="row">
            <button className="btn secondary" onClick={() => dispatch({ type: 'notFinished', jobId: j.id }, `${af} has been told the work isn't finished.`)}>
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
          <h4>Job done and paid</h4>
          {j.rating ? (
            <p className="small">
              You rated this job ★ {j.rating.stars}: work “{WORK_OPTIONS[5 - j.rating.work]}”, attitude “{ATTITUDE_OPTIONS[5 - j.rating.attitude]}”.
            </p>
          ) : (
            <button className="btn orange" onClick={() => go({ name: 'rate', jobId: j.id })}>
              Rate {af}
            </button>
          )}
        </div>
      );
      break;
    case 'no_show': {
      const delivered = linesTotal(j.deliveredMaterials);
      focus = (
        <div className="focus bad">
          <h4>{af} didn't show up</h4>
          <p>
            {af} got a 1★ rating for this job. Allyfe still holds <b>{formatNaira(j.escrow)}</b> (the service fee). What would you like to do?
          </p>
          <div className="card option">
            <b className="t14">Choose another artisan</b>
            <p className="small m0">
              Get new bids. {delivered ? `The ${formatNaira(delivered)} of materials already at your home is taken off the new quotation, ` : ''}and the money still held counts toward it. You pay any extra, or get the difference back.
            </p>
            <button className="btn primary mt8" onClick={() => dispatch({ type: 'chooseAnotherArtisan', jobId: j.id }, 'Artisans have been notified.')}>
              Find another artisan
            </button>
          </div>
          <div className="card option">
            <b className="t14">Request a refund</b>
            <p className="small m0">
              Get {formatNaira(j.escrow)} back to your wallet.
              {delivered ? ` The ${formatNaira(delivered)} of delivered materials is not refundable; they stay with you.` : ''}
            </p>
            <button className="btn secondary mt8" onClick={() => confirm(`Refund ${formatNaira(j.escrow)} to your wallet and close this job?`) && dispatch({ type: 'requestRefund', jobId: j.id }, 'Refunded to your wallet.')}>
              Refund {formatNaira(j.escrow)}
            </button>
          </div>
          <button className="link small" onClick={() => go({ name: 'terms' })}>
            Read the refund terms
          </button>
        </div>
      );
      break;
    }
    case 'not_as_described': {
      const ms = misdescribedSplit(j.serviceFee ?? 0);
      focus = (
        <div className="focus bad">
          <h4>Marked “not as described”</h4>
          <p>
            {af} found the job different from your description. Under the 50% rule, {formatNaira(ms.artisan)} of the service fee paid for the visit and {formatNaira(ms.clientRefund)} came back to you. The materials stay with you.
          </p>
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
    case 'refunded':
      focus = (
        <div className="focus">
          <h4>Refunded</h4>
          <p>The money held for this job went back to your wallet{j.deliveredMaterials.length ? ', except the delivered materials, which stay with you' : ''}.</p>
        </div>
      );
      break;
    case 'disputed':
      focus = (
        <div className="focus bad">
          <h4>Allyfe is reviewing</h4>
          <p>Money still held stays with Allyfe until an admin has spoken to you both.</p>
        </div>
      );
      break;
    case 'cancelled':
      focus = (
        <div className="focus">
          <h4>Cancelled</h4>
          <p>This job is closed.</p>
        </div>
      );
      break;
  }

  return (
    <>
      <BackBar label="My projects" />
      <JobHeader job={j} />
      <Journey job={j} />
      {a && <PersonRow user={a} sub={<><Stars rating={a.rating} count={a.ratingCount} /> · {a.trade}</>} onClick={() => go({ name: 'pro', id: a.id })} />}
      <div className="mt14">{focus}</div>
      <MaterialsStatus job={j} />
      {accepted && j.status !== 'open' && (
        <>
          <h3>Accepted quotation</h3>
          <div className="card">
            <QuoteTable lines={accepted.lines} serviceFee={accepted.serviceFee} />
          </div>
        </>
      )}
      <JobDetails job={j} />
      <History job={j} />
    </>
  );
}

function BidRow({ bid: b, job }: { bid: Bid; job: Job }) {
  const { state, go } = useApp();
  const a = state.users[b.artisanId] as Artisan;
  const c = bidCharge(job, b);
  return (
    <button className="card proposal-row" onClick={() => go({ name: 'bid', jobId: job.id, bidId: b.id })}>
      <Avatar spec={a.avatar} size={40} />
      <div className="grow">
        <b className="t13">
          {a.kind === 'team' ? a.teamName : a.name} <VTick />
        </b>
        <div className="small">
          <Stars rating={a.rating} count={a.ratingCount} /> · {dayLabel(b.day)}
        </div>
        <div className="small">
          Materials {formatNaira(c.materials)} · Fee {formatNaira(b.serviceFee)}
        </div>
      </div>
      <span className="tr">
        <b className="t14">{formatNaira(c.total)}</b>
        <div className="small">View</div>
      </span>
    </button>
  );
}

/* ---------------- Bid review (client confirm) ---------------- */
export function BidReview({ jobId, bidId }: { jobId: string; bidId: string }) {
  const { state, user, dispatch, go } = useApp();
  const j = state.jobs.find((x) => x.id === jobId);
  const b = j?.bids.find((x) => x.id === bidId);
  if (!j || !b) return <BackBar />;
  const a = state.users[b.artisanId] as Artisan;
  const c = bidCharge(j, b);
  const bal = state.wallets[user!.id] ?? 0;
  const af = firstName(a.name);
  return (
    <>
      <BackBar label="Back to job" />
      <h2>{af}'s quotation</h2>
      <p className="sub">{j.title}</p>
      <PersonRow user={a} sub={<><Stars rating={a.rating} count={a.ratingCount} /> · {a.trade} · {a.jobsDone} jobs{a.kind === 'team' ? ` · team of ${a.teamMembers.length}` : ''}</>} onClick={() => go({ name: 'pro', id: a.id })} />
      <div className="card mt12">
        <div className="small">
          Comes on <b className="ink">{dayLabel(b.day)}</b>
        </div>
        {b.message && <p className="t13 m6">“{b.message}”</p>}
      </div>
      <h3>Quotation</h3>
      <div className="card">
        <QuoteTable lines={c.billable} covered={c.covered} serviceFee={b.serviceFee} />
      </div>
      <div className="card money mt10">
        <div>
          <span>Quotation total</span>
          <b>{formatNaira(c.total)}</b>
        </div>
        {c.alreadyHeld > 0 && (
          <div>
            <span>Already held by Allyfe</span>
            <span>−{formatNaira(c.alreadyHeld)}</span>
          </div>
        )}
        <div className="tot">
          <span>{c.due >= 0 ? 'To pay now' : 'Returned to your wallet'}</span>
          <span>{formatNaira(Math.abs(c.due))}</span>
        </div>
        <div className="small">Wallet balance: {formatNaira(bal)}</div>
      </div>
      {c.due > bal && <Notice>Your wallet needs {formatNaira(c.due - bal)} more. Top up first.</Notice>}
      <Notice tone="info" icon="i">
        Allyfe holds the money. {c.billable.length ? `The materials list goes to vendors in ${j.city}; the vendor is paid when you confirm delivery. ` : ''}
        {af} is paid only when you tap <b>Job done</b>.
      </Notice>
      {c.due > bal ? (
        <button className="btn orange" onClick={() => dispatch({ type: 'topUp', amount: Math.ceil((c.due - bal) / 10000) * 10000 }, 'Wallet topped up.')}>
          Top up {formatNaira(Math.ceil((c.due - bal) / 10000) * 10000)}
        </button>
      ) : (
        <button
          className="btn primary"
          onClick={() => {
            if (dispatch({ type: 'acceptBid', jobId: j.id, bidId: b.id }, `You accepted ${af}'s bid.`)) go({ name: 'job', jobId: j.id });
          }}
        >
          Accept and pay {formatNaira(Math.max(0, c.due))}
        </button>
      )}
    </>
  );
}

/* ---------------- Rating ---------------- */
export function RateJob({ jobId }: { jobId: string }) {
  const { state, dispatch, go } = useApp();
  const [work, setWork] = useState(0);
  const [attitude, setAttitude] = useState(0);
  const [text, setText] = useState('');
  const j = state.jobs.find((x) => x.id === jobId);
  if (!j || !j.artisanId) return null;
  const a = state.users[j.artisanId] as Artisan;
  const af = firstName(a.name);
  if (j.rating) {
    return (
      <div className="success">
        <span className="success-ic">
          <Icon name="star" size={40} />
        </span>
        <h2>Thanks for rating {af}</h2>
        <p className="sub">
          This job: ★ {j.rating.stars}. {af} is now ★ {a.rating.toFixed(2)} from {a.ratingCount} ratings.
        </p>
        <button className="btn primary mt14" onClick={() => go({ name: 'home' })}>
          Back to home
        </button>
      </div>
    );
  }
  const stars = work && attitude ? (work + attitude) / 2 : 0;
  const Q = ({ label, options, value, onPick }: { label: string; options: readonly string[]; value: number; onPick: (v: number) => void }) => (
    <fieldset className="rate-q">
      <legend>{label}</legend>
      {options.map((o, i) => {
        const v = optionStars(i);
        return (
          <label key={o} className={'rate-opt' + (value === v ? ' on' : '')}>
            <input type="radio" name={label} checked={value === v} onChange={() => onPick(v)} />
            <span>{o}</span>
          </label>
        );
      })}
    </fieldset>
  );
  return (
    <>
      <div className="center mt10">
        <Avatar spec={a.avatar} size={64} />
        <h2 className="mt10">Rate {af}</h2>
        <p className="sub">
          {j.title} · {formatNaira(j.serviceFee ?? 0)} paid
        </p>
      </div>
      <Q label="How well was the work done?" options={WORK_OPTIONS} value={work} onPick={setWork} />
      <Q label={`How was ${af}'s attitude?`} options={ATTITUDE_OPTIONS} value={attitude} onPick={setAttitude} />
      <label className="f" htmlFor="rtext">
        Anything else? <em>(optional)</em>
      </label>
      <textarea id="rtext" placeholder="What went well, or what could be better?" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
      <div className="card center mt12 stars-preview">
        {stars ? (
          <>
            <b>★ {stars}</b> for this job
            <div className="small">
              ({work} + {attitude}) ÷ 2
            </div>
          </>
        ) : (
          <span className="small">Answer both questions to see the rating.</span>
        )}
      </div>
      <button className="btn primary mt14" disabled={!stars} onClick={() => dispatch({ type: 'rateJob', jobId: j.id, work, attitude, text })}>
        Submit rating
      </button>
      <button className="btn secondary mt8" onClick={() => go({ name: 'job', jobId: j.id })}>
        Later
      </button>
    </>
  );
}
