import { useState } from 'react';
import { Avatar, Icon, Picture, ToolIcon } from '../components/art';
import { BackBar, Calendar, Empty, Notice, PersonRow, PhotoInput, SimButton, StatusTag, TopBar, dayLabel, timeAgo } from '../components/ui';
import { VERIFICATION_ITEMS } from '../domain/actions';
import { artisanQualifies, completionSplit, formatNaira, misdescribedSplit, rankArtisans } from '../domain/rules';
import type { Artisan, Company, Job } from '../domain/types';
import { useApp } from '../store/store';
import { History, JobDetails, JobHeader, SplitBox } from './client';

const ONGOING: Job['status'][] = ['confirmed', 'in_progress', 'supervisor_check', 'awaiting_client', 'disputed'];

function useArtisanJobs() {
  const { state, user } = useApp();
  const me = user as Artisan;
  const open = state.jobs.filter(
    (j) => j.status === 'open' && (j.invitedArtisanId ? j.invitedArtisanId === me.id : me.categories.includes(j.category)) && !j.proposals.some((p) => p.artisanId === me.id),
  );
  const applied = state.jobs.filter((j) => j.proposals.some((p) => p.artisanId === me.id) && j.artisanId !== me.id);
  const mine = state.jobs.filter((j) => j.artisanId === me.id);
  return { me, open, applied, mine };
}

/* ---------------- Artisan home ---------------- */
export function ArtisanHome() {
  const { state, go } = useApp();
  const { me, open, applied, mine } = useArtisanJobs();
  const v = me.verification;
  const ongoing = mine.filter((j) => ONGOING.includes(j.status));
  const sameTrade = rankArtisans(Object.values(state.users).filter((u): u is Artisan => u.role === 'artisan' && u.trade === me.trade));
  const rank = sameTrade.findIndex((a) => a.id === me.id) + 1;
  const pct = v.status === 'verified' ? 100 : v.status === 'review' ? 90 : Math.round((Object.keys(v.files).length / VERIFICATION_ITEMS.artisan.length) * 80);
  const invites = open.filter((j) => j.invitedArtisanId === me.id);
  const hour = new Date().getHours();
  return (
    <>
      <TopBar />
      <div className="greet">
        <Avatar spec={me.avatar} size={62} />
        <div>
          <div className="hi">{hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,'}</div>
          <div className="nm">{me.name.split(' ')[0]}!</div>
          <div className="sl">More work. Greater opportunities.</div>
        </div>
        {v.status === 'verified' ? <span className="vbadge">✓ Verified</span> : <span className="vbadge pending">Not verified</span>}
      </div>
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
            <small>{v.status === 'review' ? 'Allyfe is checking your photos' : 'Clients only see verified artisans'} · {pct}%</small>
          </span>
          <span className="go">
            <Icon name="chev" size={14} />
          </span>
        </button>
      )}
      <div className="tiles">
        {(
          [
            ['New Jobs', `${open.length} available`, '#16A34A', 'brief', () => go({ name: 'jobs', tab: 'new' })],
            ['Applied', `${applied.filter((j) => j.status === 'open').length} active`, '#F97316', 'chart', () => go({ name: 'jobs', tab: 'applied' })],
            ['My Projects', `${ongoing.length} ongoing`, '#7C6CF0', 'cal', () => go({ name: 'jobs', tab: 'mine' })],
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
      {invites.length > 0 && (
        <>
          <h3>Booked for you</h3>
          <div className="list">{invites.map((j) => <JobRec key={j.id} job={j} />)}</div>
        </>
      )}
      {ongoing.length > 0 && (
        <>
          <h3>Your active jobs</h3>
          <div className="list">{ongoing.map((j) => <MyJobCard key={j.id} job={j} />)}</div>
        </>
      )}
      <button className="rep mt14" onClick={() => go({ name: 'composer' })}>
        <span className="ic">
          <Icon name="trophy" size={20} />
        </span>
        <span>
          <b>Build your reputation</b>
          <small>
            ★ {me.rating.toFixed(1)} from {me.ratingCount} clients · #{rank} {me.trade.toLowerCase()} in Port Harcourt. Post your work to get seen.
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
        Job recommendations
        <button onClick={() => go({ name: 'jobs', tab: 'new' })}>See all</button>
      </h3>
      <div className="list">
        {open.filter((j) => !j.invitedArtisanId).slice(0, 2).map((j) => <JobRec key={j.id} job={j} />)}
        {!open.length && <Empty title="No new jobs right now">We'll alert you when a client posts in your trade.</Empty>}
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
        <Picture src={j.photos[0] ?? 'room'} />
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
        <div className="price">{formatNaira(j.deposit)} held</div>
        <div className="chips">
          <span className="chip">{j.category}</span>
          {j.invitedArtisanId && <span className="chip hot">Booked for you</span>}
          {j.proposals.length > 0 && <span className="chip">{j.proposals.length} proposal{j.proposals.length > 1 ? 's' : ''}</span>}
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
          {c.name.split(' ')[0]} · {j.tier} · {formatNaira(j.agreedAmount ?? j.deposit)}
        </div>
        <StatusTag job={j} artisanView />
      </div>
      <Icon name="chev" size={14} />
    </button>
  );
}

/* ---------------- Jobs board ---------------- */
export function ArtisanJobs({ tab = 'new' }: { tab?: 'new' | 'applied' | 'mine' }) {
  const { go } = useApp();
  const { me, open, applied, mine } = useArtisanJobs();
  const [t, setT] = useState(tab);
  return (
    <>
      <TopBar />
      <h2>Jobs</h2>
      <div className="tabs" role="tablist">
        {(
          [
            ['new', 'New jobs'],
            ['applied', 'Applied'],
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
          <p className="sub">Matched to your trade. Clients have already paid into Allyfe.</p>
          {me.verification.status !== 'verified' && (
            <Notice>
              Finish <button className="link" onClick={() => go({ name: 'verify' })}>verification</button> to apply for jobs.
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
      {t === 'applied' && (
        <div className="list">
          {applied.map((j) => {
            const p = j.proposals.find((x) => x.artisanId === me.id)!;
            return (
              <button key={j.id} className="card jobrec" onClick={() => go({ name: 'applied', jobId: j.id })}>
                <div className="ph">
                  <Picture src={j.photos[0] ?? 'room'} />
                </div>
                <div className="grow">
                  <b className="t13">{j.title}</b>
                  <div className="small">
                    You {p.kind === 'apply' ? 'applied at' : 'proposed'} {formatNaira(p.amount)} · {timeAgo(p.at)}
                  </div>
                  <span className={'tag mt6 ' + (p.status === 'pending' && j.status === 'open' ? 'blue' : 'grey')}>
                    {p.status === 'pending' && j.status === 'open' ? 'Waiting for client' : j.status === 'cancelled' ? 'Job cancelled' : 'Client chose someone else'}
                  </span>
                </div>
              </button>
            );
          })}
          {!applied.length && <Empty title="No applications yet">Open a job and tap Apply or Send proposal.</Empty>}
        </div>
      )}
      {t === 'mine' && (
        <div className="list">
          {mine.map((j) => (
            <MyJobCard key={j.id} job={j} />
          ))}
          {!mine.length && <Empty title="No projects yet">When a client confirms you, the job appears here.</Empty>}
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
  const mine = j.artisanId === me.id;
  const myProposal = j.proposals.find((p) => p.artisanId === me.id);

  if (!mine) {
    const can = me.verification.status === 'verified' && artisanQualifies(me, j.tier);
    return (
      <>
        <BackBar label="Jobs" />
        <JobHeader job={j} />
        <PersonRow user={client} sub={`Client · ${client.area.split(',')[0]} · posted ${timeAgo(j.createdAt)} ago`} />
        <div className="card money mt12">
          <div>
            <span>Client's budget, held by Allyfe</span>
            <b>{formatNaira(j.deposit)}</b>
          </div>
          <div>
            <span>Proposals so far</span>
            <span>{j.proposals.length}</span>
          </div>
        </div>
        <JobDetails job={j} hideAddress />
        {j.invitedArtisanId === me.id && (
          <Notice tone="info" icon="i">
            {client.name.split(' ')[0]} picked you from your profile. Apply at their price or propose your own.
          </Notice>
        )}
        {myProposal ? (
          <button className="btn secondary mt14" onClick={() => go({ name: 'applied', jobId: j.id })}>
            View your application
          </button>
        ) : j.status !== 'open' ? (
          <Notice>This job is no longer taking proposals.</Notice>
        ) : !can ? (
          <Notice>
            {me.verification.status !== 'verified' ? 'Finish verification to apply.' : `${j.tier} jobs need a rating of 4.7★ or more.`}
          </Notice>
        ) : (
          <div className="stack mt14">
            <button className="btn primary" onClick={() => go({ name: 'proposal', jobId: j.id, kind: 'apply' })}>
              Apply at {formatNaira(j.deposit)}
            </button>
            <button className="btn secondary" onClick={() => go({ name: 'proposal', jobId: j.id, kind: 'propose' })}>
              Send a proposal with my price
            </button>
            {j.invitedArtisanId === me.id && (
              <button className="btn concern" onClick={() => dispatch({ type: 'declineInvite', jobId: j.id }, 'Declined. The job is now open to others.') && go({ name: 'jobs' })}>
                I can't take this job
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  const amount = j.agreedAmount ?? j.deposit;
  const half = misdescribedSplit(amount).artisan;
  const jobRentals = state.rentals.filter((r) => r.jobId === j.id);
  let focus: React.ReactNode = null;
  switch (j.status) {
    case 'confirmed':
      focus = (
        <div className="focus">
          <h4>When you arrive, check the job</h4>
          <p>Compare the work with the client's description and photos before you start.</p>
          <button className="btn primary" onClick={() => dispatch({ type: 'startWork', jobId: j.id }, 'Work started.')}>
            Job matches. Start work
          </button>
          <button className="btn concern" onClick={() => confirm(`Mark this job not as described? You'll be paid ${formatNaira(half)} for the visit and the job ends.`) && dispatch({ type: 'flagMisdescribed', jobId: j.id })}>
            Job is not as described
          </button>
          <p className="small">Marking it not as described pays you {formatNaira(half)} (50% of the deposit) for your visit.</p>
        </div>
      );
      break;
    case 'in_progress':
      focus = (
        <div className="focus">
          <h4>Work in progress</h4>
          <p>Need equipment? Rent it from a verified tool company. The rental is paid from this job when the client confirms.</p>
          {jobRentals.map((r) => (
            <div className="small" key={r.id}>
              • {state.tools.find((t) => t.id === r.toolId)?.name} from {state.users[r.companyId].name}: <b className="ink">{r.status}</b>
            </div>
          ))}
          <button className="btn secondary" onClick={() => go({ name: 'store', jobId: j.id })}>
            Rent a tool for this job
          </button>
          <button className="btn primary" onClick={() => dispatch({ type: 'markDone', jobId: j.id }, `${client.name.split(' ')[0]} has been asked to check the work.`)}>
            Mark work as done
          </button>
        </div>
      );
      break;
    case 'supervisor_check':
    case 'awaiting_client':
      focus = (
        <div className="focus warn">
          <h4>Waiting for {j.status === 'supervisor_check' ? 'the supervisor' : `${client.name.split(' ')[0]} to confirm`}</h4>
          <p>When {client.name.split(' ')[0]} taps Work completed, the money is paid out like this:</p>
          <SplitBox split={completionSplit(j, state.rentals)} job={j} />
          {j.status === 'supervisor_check' && <SimButton onClick={() => dispatch({ type: 'supervisorApprove', jobId: j.id })}>supervisor approves the work</SimButton>}
        </div>
      );
      break;
    case 'completed':
      focus = (
        <div className="focus good">
          <h4>Paid to your wallet</h4>
          <p>{j.review ? `${client.name.split(' ')[0]} rated you ★ ${j.review.stars}.` : `${client.name.split(' ')[0]} can now rate you.`}</p>
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
          <p>{formatNaira(half)} (50% of the deposit) is in your wallet for the visit. The rest went back to the client.</p>
        </div>
      );
      break;
    case 'disputed':
      focus = (
        <div className="focus bad">
          <h4>Allyfe is reviewing</h4>
          <p>An admin will contact you and the client.</p>
        </div>
      );
      break;
  }
  return (
    <>
      <BackBar label="Jobs" />
      <JobHeader job={j} artisanView />
      <PersonRow user={client} sub={`Client · ${formatNaira(amount)} agreed`} />
      <div className="mt14">{focus}</div>
      <JobDetails job={j} />
      <History job={j} />
    </>
  );
}

/* ---------------- Proposal ---------------- */
export function ProposalForm({ jobId, kind }: { jobId: string; kind: 'apply' | 'propose' }) {
  const { state, dispatch, go } = useApp();
  const j = state.jobs.find((x) => x.id === jobId);
  const [amount, setAmount] = useState(String(j?.deposit ?? ''));
  const [message, setMessage] = useState('');
  const [day, setDay] = useState<string[]>(j?.schedule.days.slice(0, 1) ?? []);
  if (!j) return <BackBar />;
  const flexible = j.schedule.mode === 'Flexible';
  const amt = kind === 'apply' ? j.deposit : Number(amount.replace(/\D/g, '')) || 0;
  return (
    <>
      <BackBar label="Job" />
      <h2>{kind === 'apply' ? 'Apply for this job' : 'Send a proposal'}</h2>
      <p className="sub">{j.title}</p>
      {kind === 'propose' ? (
        <>
          <label className="f" htmlFor="pamt">
            Your price <em>(client's budget: {formatNaira(j.deposit)})</em>
          </label>
          <input id="pamt" type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {amt > 0 && amt !== j.deposit && (
            <p className="small mt6">{amt > j.deposit ? `${formatNaira(amt - j.deposit)} above` : `${formatNaira(j.deposit - amt)} below`} the client's budget. They'll see the difference before confirming.</p>
          )}
        </>
      ) : (
        <div className="card money">
          <div>
            <span>You'll be paid</span>
            <b>{formatNaira(j.deposit)}</b>
          </div>
          <div className="small">Already held by Allyfe. Paid to your wallet when the client confirms the work.</div>
        </div>
      )}
      <label className="f">{flexible ? 'Pick one of the client’s days' : 'When can you start?'}</label>
      <Calendar selected={day} onChange={setDay} max={1} allowed={flexible ? j.schedule.days : undefined} />
      <label className="f" htmlFor="pmsg">
        Message to the client {kind === 'apply' && <em>(optional)</em>}
      </label>
      <textarea
        id="pmsg"
        placeholder={kind === 'apply' ? 'Say hello and mention similar jobs you have done.' : "What's included in your price? Materials, labour, timeline…"}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={600}
      />
      <button
        className="btn primary mt14"
        onClick={() => {
          if (dispatch({ type: 'submitProposal', jobId: j.id, kind, amount: amt, message, startDay: day[0] })) go({ name: 'applied', jobId: j.id });
        }}
      >
        {kind === 'apply' ? `Apply at ${formatNaira(j.deposit)}` : `Send proposal for ${formatNaira(amt)}`}
      </button>
    </>
  );
}

/* ---------------- Applied ---------------- */
export function Applied({ jobId }: { jobId: string }) {
  const { state, user, go } = useApp();
  const j = state.jobs.find((x) => x.id === jobId);
  const p = j?.proposals.find((x) => x.artisanId === user!.id);
  if (!j || !p) return <BackBar />;
  const client = state.users[j.clientId];
  const accepted = j.artisanId === user!.id;
  return (
    <div className="success">
      <span className={'success-ic' + (p.status === 'declined' ? ' grey' : '')}>
        <Icon name="check" size={40} />
      </span>
      <h2>{accepted ? 'You got the job!' : p.status === 'declined' ? 'Not this time' : p.kind === 'apply' ? 'Application sent' : 'Proposal sent'}</h2>
      <p className="sub">
        {accepted
          ? `${client.name.split(' ')[0]} confirmed you. The address is now in the job.`
          : p.status === 'declined'
            ? `${client.name.split(' ')[0]} chose another artisan. Keep your rating high and keep applying.`
            : `${client.name.split(' ')[0]} will see your profile, rating and ${p.kind === 'apply' ? 'application' : 'price'}. We'll alert you when they decide.`}
      </p>
      <div className="card summary-lite">
        <b>{j.title}</b>
        <div className="small">
          {p.kind === 'apply' ? 'Applied at' : 'Your price'}: <b className="ink">{formatNaira(p.amount)}</b>
          {p.startDay && ` · ${dayLabel(p.startDay)}`}
        </div>
        {p.message && <p className="t13 m6">“{p.message}”</p>}
      </div>
      {accepted ? (
        <button className="btn primary mt14" onClick={() => go({ name: 'job', jobId: j.id })}>
          Open job
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

/* ---------------- Verification (artisan + company) ---------------- */
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
          ? 'Clients only see verified artisans. Upload clear photos. Allyfe checks them within 24 hours.'
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
                <PhotoInput label={`Upload ${it.title}`} onPhoto={(img) => dispatch({ type: 'addVerificationFile', key: it.key, image: img }, 'Photo added.')} className={'th' + (f ? ' done' : '')}>
                  {thumb}
                </PhotoInput>
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
          {user.role === 'artisan' ? 'You are verified. Clients can find and book you.' : 'Your company is verified. Your tools are visible in the Tool Store.'}
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
          <button
            className="btn sim mt8"
            onClick={() => items.forEach((it, i) => !v.files[it.key] && dispatch({ type: 'addVerificationFile', key: it.key, image: SAMPLE[i] ?? 'room' }))}
          >
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
      <p className="sub">Tools from verified companies in Port Harcourt.{job && ` Rentals are paid from “${job.title}” when the client confirms.`}</p>
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
                      {r.jobId ? ' · paid from job' : ''}
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
      <p className="small mt10">Only verified tool companies appear here.</p>
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
          <span>{job ? `Job ${job.ref} (when client confirms)` : `Your wallet (${formatNaira(state.wallets[user!.id] ?? 0)})`}</span>
        </div>
      </div>
      <Notice tone="info" icon="i">
        Pick up from {co.name}'s store with your Allyfe ID. Return it on time and in good condition, or the company can raise a claim.
      </Notice>
      <button className="btn primary" onClick={() => dispatch({ type: 'requestRental', toolId: t.id, days, jobId }, `Request sent to ${co.name}.`) && back()}>
        Request rental
      </button>
    </>
  );
}
