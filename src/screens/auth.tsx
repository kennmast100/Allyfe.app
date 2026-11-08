import { useEffect, useState } from 'react';
import { Avatar, CategoryIcon, Icon, MARK_SVG, Picture } from '../components/art';
import { MediaInput, Notice } from '../components/ui';
import type { SignupProfile } from '../domain/actions';
import { BANKS, CATEGORIES, CITIES, TRADES, normalizePhone } from '../domain/rules';
import { DEMO_ACCOUNTS } from '../domain/seed';
import type { BankDetails, Category, City } from '../domain/types';
import { useApp } from '../store/store';

type Role = SignupProfile['role'];
type Mode = { name: 'welcome' } | { name: 'signin' } | { name: 'signup' };

/** Everything a signed-out person sees: welcome, sign in, and sign up. */
export function AuthFlow() {
  const [mode, setMode] = useState<Mode>({ name: 'welcome' });
  if (mode.name === 'signin') return <SignIn onBack={() => setMode({ name: 'welcome' })} onSignup={() => setMode({ name: 'signup' })} />;
  if (mode.name === 'signup') return <SignUp onBack={() => setMode({ name: 'welcome' })} onSignin={() => setMode({ name: 'signin' })} />;
  return <Welcome onSignin={() => setMode({ name: 'signin' })} onSignup={() => setMode({ name: 'signup' })} />;
}

function Brand({ small }: { small?: boolean }) {
  return (
    <div className={'signin-hero' + (small ? ' small' : '')}>
      <span className="signin-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
      <h1>
        Ally<span>fe</span>
      </h1>
      {!small && (
        <p className="tagline">
          Skilled People <i>•</i> Real Work <i>•</i> Brighter Lives
        </p>
      )}
    </div>
  );
}

function Welcome({ onSignin, onSignup }: { onSignin: () => void; onSignup: () => void }) {
  const { env, state, auth, toast } = useApp();
  const [showDemo, setShowDemo] = useState(false);
  return (
    <div className="signin">
      <Brand />
      <div className="welcome-points">
        {[
          ['shield', 'Verified artisans and vendors'],
          ['wallet', 'Your money is held safely until the job is done'],
          ['cal', 'Materials delivered before work starts'],
        ].map(([ic, t]) => (
          <div key={t}>
            <Icon name={ic as 'shield'} size={18} />
            <span>{t}</span>
          </div>
        ))}
      </div>
      <button className="btn primary mt16" onClick={onSignup}>
        Create an account
      </button>
      <button className="btn secondary mt8" onClick={onSignin}>
        I already have an account
      </button>
      {env !== 'production' && (
        <>
          <button className="link small mt16 center-block" onClick={() => setShowDemo(!showDemo)}>
            {showDemo ? 'Hide' : 'Use a'} demo account (testing only)
          </button>
          {showDemo && (
            <div className="list mt8">
              {DEMO_ACCOUNTS.filter((d) => state.users[d.id]).map((d) => {
                const u = state.users[d.id];
                return (
                  <button
                    key={d.id}
                    className="card person-row"
                    onClick={async () => {
                      const r = await auth.demo(u.id);
                      if (!r.ok) toast(r.error);
                    }}
                  >
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
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- phone + code ---------------- */
function PhoneStep({ purpose, onSent, footer }: { purpose: 'signin' | 'signup'; onSent: (phone: string, demoCode?: string) => void; footer?: React.ReactNode }) {
  const { auth } = useApp();
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!normalizePhone(phone)) return setErr('Enter a valid Nigerian mobile number, e.g. 0803 123 4567.');
    setBusy(true);
    const r = await auth.start(phone, purpose);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onSent(phone, r.demoCode);
  };
  return (
    <>
      <label className="f" htmlFor="phone">
        Phone number
      </label>
      <div className="phone-in">
        <span>🇳🇬 +234</span>
        <input id="phone" type="tel" inputMode="tel" placeholder="0803 123 4567" value={phone} onChange={(e) => (setPhone(e.target.value), setErr(''))} autoComplete="tel" onKeyDown={(e) => e.key === 'Enter' && send()} />
      </div>
      {err && <div className="err">{err}</div>}
      <p className="small mt8">We'll text you a 6-digit code to confirm it's your number.</p>
      <button className="btn primary mt14" disabled={busy} onClick={send}>
        {busy ? 'Sending…' : 'Send code'}
      </button>
      {footer}
    </>
  );
}

function CodeStep({ phone, purpose, demoCode: firstCode, onVerified, onChangeNumber }: { phone: string; purpose: 'signin' | 'signup'; demoCode?: string; onVerified: (ticket?: string) => void; onChangeNumber: () => void }) {
  const { auth } = useApp();
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState(firstCode);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(30);
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait(wait - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);
  const verify = async (c = code) => {
    if (!/^\d{6}$/.test(c)) return setErr('Enter the 6-digit code.');
    setBusy(true);
    const r = await auth.verify(phone, c);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onVerified(r.signedIn ? undefined : r.ticket);
  };
  return (
    <>
      <p className="sub">
        Enter the code we sent to <b className="ink">{phone}</b>.{' '}
        <button className="link" onClick={onChangeNumber}>
          Change
        </button>
      </p>
      {demoCode && (
        <div className="demo-code">
          <span>Testing: no SMS is sent yet. Your code is</span>
          <b>{demoCode}</b>
        </div>
      )}
      <input
        className="code-in"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        aria-label="6-digit code"
        placeholder="••••••"
        value={code}
        onChange={(e) => {
          const c = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCode(c);
          setErr('');
          if (c.length === 6) verify(c);
        }}
      />
      {err && <div className="err">{err}</div>}
      <button className="btn primary mt14" disabled={busy} onClick={() => verify()}>
        {busy ? 'Checking…' : purpose === 'signin' ? 'Sign in' : 'Continue'}
      </button>
      <button
        className="link small mt10 center-block"
        disabled={wait > 0}
        onClick={async () => {
          const r = await auth.start(phone, purpose);
          if (!r.ok) return setErr(r.error);
          setDemoCode(r.demoCode);
          setWait(30);
        }}
      >
        {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
      </button>
    </>
  );
}

/* ---------------- sign in ---------------- */
function SignIn({ onBack, onSignup }: { onBack: () => void; onSignup: () => void }) {
  const [sent, setSent] = useState<{ phone: string; demoCode?: string } | null>(null);
  return (
    <div className="signin">
      <AuthTop onBack={sent ? () => setSent(null) : onBack} />
      <Brand small />
      <h2>Welcome back</h2>
      {!sent ? (
        <PhoneStep
          purpose="signin"
          onSent={(phone, demoCode) => setSent({ phone, demoCode })}
          footer={
            <p className="small center mt14">
              New to Allyfe?{' '}
              <button className="link" onClick={onSignup}>
                Create an account
              </button>
            </p>
          }
        />
      ) : (
        <CodeStep phone={sent.phone} purpose="signin" demoCode={sent.demoCode} onVerified={() => {}} onChangeNumber={() => setSent(null)} />
      )}
    </div>
  );
}

function AuthTop({ onBack, step, total }: { onBack: () => void; step?: number; total?: number }) {
  return (
    <>
      <div className="topbar">
        <button className="back" onClick={onBack}>
          <Icon name="back" size={18} />
          Back
        </button>
        {step && <span className="small">Step {step} of {total}</span>}
      </div>
      {step && (
        <div className="progress">
          <i style={{ width: `${(step / total!) * 100}%` }} />
        </div>
      )}
    </>
  );
}

/* ---------------- sign up ---------------- */
const ROLES: { role: Role; title: string; sub: string; icon: 'home' | 'tools' | 'requests' }[] = [
  { role: 'client', title: 'I need work done', sub: 'Post jobs, compare quotations and pay safely', icon: 'home' },
  { role: 'artisan', title: "I'm an artisan or a team", sub: 'Get jobs near you and get paid through Allyfe', icon: 'tools' },
  { role: 'vendor', title: "I'm a market vendor", sub: 'Supply materials for jobs in your city', icon: 'requests' },
];

type Draft = {
  name: string;
  city: City;
  area: string;
  photo?: string;
  kind: 'individual' | 'team';
  teamName: string;
  teamMembers: string[];
  trade: string;
  categories: Category[];
  years: string;
  bio: string;
  shopName: string;
  market: string;
  bank: BankDetails;
  agree: boolean;
};

function SignUp({ onBack, onSignin }: { onBack: () => void; onSignin: () => void }) {
  const { auth } = useApp();
  const [role, setRole] = useState<Role | null>(null);
  const [sent, setSent] = useState<{ phone: string; demoCode?: string } | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [detailStep, setDetailStep] = useState(1);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Draft>({
    name: '', city: 'Port Harcourt', area: '', kind: 'individual', teamName: '', teamMembers: ['', ''], trade: '', categories: [], years: '', bio: '',
    shopName: '', market: '', bank: { bankName: '', accountNumber: '', accountName: '' }, agree: false,
  });
  const set = (p: Partial<Draft>) => (setD({ ...d, ...p }), setErr(''));
  const detailSteps = role === 'client' ? 1 : 2;
  const total = 2 + detailSteps; // role, phone, details…
  const step = !role ? 1 : !ticket ? 2 : 2 + detailStep;

  const back = () => {
    setErr('');
    if (ticket && detailStep > 1) return setDetailStep(detailStep - 1);
    if (ticket) return setTicket(null), setSent(null);
    if (sent) return setSent(null);
    if (role) return setRole(null);
    onBack();
  };

  const toggleCat = (c: Category) => set({ categories: d.categories.includes(c) ? d.categories.filter((x) => x !== c) : [...d.categories, c] });

  const validateDetails = (): string => {
    if (role === 'vendor') {
      if (d.shopName.trim().length < 3) return "Enter your shop's name.";
      if (d.name.trim().length < 3) return "Enter the owner's full name.";
      if (!d.market.trim()) return 'Enter the market or street where your shop is.';
      if (!d.categories.length) return 'Choose at least one kind of material you sell.';
    } else {
      if (d.name.trim().split(/\s+/).length < 2) return 'Enter your first and last name.';
    }
    if (!d.area.trim()) return 'Enter your area or estate.';
    if (role === 'artisan') {
      if (!d.trade) return 'Choose your trade.';
      if (!d.categories.length) return 'Choose at least one kind of job you take.';
      if (d.years === '' || !(Number(d.years) >= 0)) return 'Enter your years of experience.';
      if (d.kind === 'team' && !d.teamName.trim()) return 'Give your team a name.';
      if (d.kind === 'team' && d.teamMembers.filter((m) => m.trim()).length < 2) return 'A team needs at least 2 members.';
    }
    return '';
  };

  const submit = async () => {
    if (!d.agree) return setErr('Tick the box to agree to the terms.');
    const bank = { ...d.bank, accountNumber: d.bank.accountNumber.replace(/\s/g, '') };
    const profile: SignupProfile =
      role === 'client'
        ? { role, name: d.name, city: d.city, area: d.area, photo: d.photo }
        : role === 'artisan'
          ? { role, name: d.name, city: d.city, area: d.area, photo: d.photo, kind: d.kind, teamName: d.teamName, teamMembers: d.teamMembers, trade: d.trade, categories: d.categories, years: Number(d.years), bio: d.bio, bank }
          : { role: 'vendor', name: d.shopName, ownerName: d.name, market: d.market, city: d.city, area: d.area, photo: d.photo, categories: d.categories, bank };
    setBusy(true);
    const r = await auth.register(ticket!, profile);
    setBusy(false);
    if (!r.ok) setErr(r.error);
  };

  const terms = (
    <label className="check mt14">
      <input type="checkbox" checked={d.agree} onChange={(e) => set({ agree: e.target.checked })} />
      <span>I agree to the Allyfe terms and conditions{role === 'vendor' ? ', including the vendor contract (collecting refused materials)' : ''}.</span>
    </label>
  );

  return (
    <div className="signin">
      <AuthTop onBack={back} step={step} total={total} />

      {!role && (
        <>
          <h2>Create your account</h2>
          <p className="sub">How will you use Allyfe?</p>
          <div className="stack">
            {ROLES.map((r) => (
              <button key={r.role} className="card role-card" onClick={() => setRole(r.role)}>
                <span className={'role-ic ' + r.role}>
                  <Icon name={r.icon} size={24} />
                </span>
                <span className="grow">
                  <b>{r.title}</b>
                  <small>{r.sub}</small>
                </span>
                <Icon name="chev" size={14} />
              </button>
            ))}
          </div>
          <p className="small center mt16">
            Already on Allyfe?{' '}
            <button className="link" onClick={onSignin}>
              Sign in
            </button>
          </p>
        </>
      )}

      {role && !ticket && (
        <>
          <h2>{sent ? 'Confirm your number' : 'Your phone number'}</h2>
          {!sent && <p className="sub">{role === 'vendor' ? 'Use the number customers and riders can reach your shop on.' : 'You will sign in with this number.'}</p>}
          {!sent ? (
            <PhoneStep purpose="signup" onSent={(phone, demoCode) => setSent({ phone, demoCode })} />
          ) : (
            <CodeStep phone={sent.phone} purpose="signup" demoCode={sent.demoCode} onVerified={(t) => t && setTicket(t)} onChangeNumber={() => setSent(null)} />
          )}
        </>
      )}

      {role && ticket && detailStep === 1 && (
        <>
          <h2>{role === 'client' ? 'About you' : role === 'artisan' ? 'Your work profile' : 'Your shop'}</h2>
          <p className="sub">
            {role === 'client' ? 'So artisans know who they are working for.' : role === 'artisan' ? 'Clients see this when they compare quotations.' : 'Artisans and clients see this on your materials and posts.'}
          </p>
          <div className="photo-row">
            <MediaInput label={role === 'vendor' ? 'Shop photo or logo' : 'Profile photo'} onMedia={(photo) => set({ photo })} className={'avatar-in' + (d.photo ? ' done' : '')}>
              {d.photo ? <Picture src={d.photo} /> : <Icon name="camera" size={24} />}
            </MediaInput>
            <div className="small">
              <b className="ink">{role === 'vendor' ? 'Shop photo or logo' : 'Profile photo'}</b>
              <br />
              {role === 'client' ? 'Optional.' : 'A clear photo builds trust. Blurry photos are refused.'}
            </div>
          </div>

          {role === 'artisan' && (
            <>
              <label className="f">I work as</label>
              <div className="seg two">
                <button className={d.kind === 'individual' ? 'on' : ''} onClick={() => set({ kind: 'individual' })}>
                  An individual
                </button>
                <button className={d.kind === 'team' ? 'on' : ''} onClick={() => set({ kind: 'team' })}>
                  A construction team
                </button>
              </div>
            </>
          )}
          {role === 'vendor' && (
            <>
              <label className="f" htmlFor="shop">
                Shop or business name
              </label>
              <input id="shop" type="text" placeholder="e.g. Mile 3 Building Supplies" value={d.shopName} onChange={(e) => set({ shopName: e.target.value })} />
            </>
          )}
          <label className="f" htmlFor="name">
            {role === 'vendor' ? "Owner's full name" : role === 'artisan' && d.kind === 'team' ? 'Team leader’s full name' : 'Full name'}
          </label>
          <input id="name" type="text" autoComplete="name" placeholder="First and last name" value={d.name} onChange={(e) => set({ name: e.target.value })} />
          {role === 'artisan' && d.kind === 'team' && (
            <div className="card mt12">
              <label className="f mt0" htmlFor="tname">
                Team name
              </label>
              <input id="tname" type="text" placeholder="e.g. Uche Woodworks" value={d.teamName} onChange={(e) => set({ teamName: e.target.value })} />
              <label className="f">Team members</label>
              <div className="stack">
                {d.teamMembers.map((m, i) => (
                  <input key={i} type="text" aria-label={`Member ${i + 1}`} placeholder={`Member ${i + 1}`} value={m} onChange={(e) => set({ teamMembers: d.teamMembers.map((x, k) => (k === i ? e.target.value : x)) })} />
                ))}
              </div>
              <button className="btn secondary sm mt8" onClick={() => set({ teamMembers: [...d.teamMembers, ''] })}>
                + Add member
              </button>
            </div>
          )}

          {role === 'artisan' && (
            <>
              <label className="f" htmlFor="trade">
                Your trade
              </label>
              <select
                id="trade"
                value={d.trade}
                onChange={(e) => {
                  const t = TRADES.find((x) => x.trade === e.target.value);
                  set({ trade: e.target.value, categories: t ? t.categories : d.categories });
                }}
              >
                <option value="">Choose…</option>
                {TRADES.map((t) => (
                  <option key={t.trade}>{t.trade}</option>
                ))}
              </select>
            </>
          )}
          {role !== 'client' && (
            <>
              <label className="f">{role === 'artisan' ? 'Jobs you take' : 'Materials you sell'}</label>
              <div className="cat-pick">
                {CATEGORIES.map((c) => (
                  <button key={c} className={d.categories.includes(c) ? 'on' : ''} onClick={() => toggleCat(c)} aria-pressed={d.categories.includes(c)}>
                    <CategoryIcon cat={c} />
                    <span>{c}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {role === 'artisan' && (
            <>
              <label className="f" htmlFor="years">
                Years of experience
              </label>
              <input id="years" type="text" inputMode="numeric" placeholder="e.g. 6" value={d.years} onChange={(e) => set({ years: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
            </>
          )}
          {role === 'vendor' && (
            <>
              <label className="f" htmlFor="market">
                Market or street
              </label>
              <input id="market" type="text" placeholder="e.g. Mile 3 Market" value={d.market} onChange={(e) => set({ market: e.target.value })} />
            </>
          )}
          <div className="row">
            <div>
              <label className="f" htmlFor="city">
                City
              </label>
              <select id="city" value={d.city} onChange={(e) => set({ city: e.target.value as City })}>
                {CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="f" htmlFor="area">
                Area
              </label>
              <input id="area" type="text" placeholder="e.g. GRA Phase 2" value={d.area} onChange={(e) => set({ area: e.target.value })} />
            </div>
          </div>
          {role === 'artisan' && (
            <>
              <label className="f" htmlFor="bio">
                About your work <em>(optional)</em>
              </label>
              <textarea id="bio" placeholder="What you do best, e.g. Kitchen cabinets, wardrobes and doors." value={d.bio} onChange={(e) => set({ bio: e.target.value })} maxLength={300} />
            </>
          )}
          <p className="small mt8">Jobs and requests only come from your city.</p>
          {role === 'client' && terms}
          {err && <div className="err">{err}</div>}
          <button
            className="btn primary mt14"
            disabled={busy}
            onClick={() => {
              const e = validateDetails();
              if (e) return setErr(e);
              if (role === 'client') return submit();
              setDetailStep(2);
              document.querySelector('.content')?.scrollTo(0, 0);
            }}
          >
            {role === 'client' ? (busy ? 'Creating…' : 'Create my account') : 'Continue'}
          </button>
        </>
      )}

      {role && role !== 'client' && ticket && detailStep === 2 && (
        <>
          <h2>How you get paid</h2>
          <p className="sub">{role === 'artisan' ? 'Your service fees' : 'Payments for materials'} land in your Allyfe wallet. You withdraw to this account.</p>
          <label className="f" htmlFor="bank">
            Bank
          </label>
          <select id="bank" value={d.bank.bankName} onChange={(e) => set({ bank: { ...d.bank, bankName: e.target.value } })}>
            <option value="">Choose your bank…</option>
            {BANKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <label className="f" htmlFor="acct">
            Account number
          </label>
          <input id="acct" type="text" inputMode="numeric" placeholder="10 digits" value={d.bank.accountNumber} onChange={(e) => set({ bank: { ...d.bank, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 10) } })} />
          <label className="f" htmlFor="acctname">
            Account name
          </label>
          <input id="acctname" type="text" placeholder="As it appears at the bank" value={d.bank.accountName} onChange={(e) => set({ bank: { ...d.bank, accountName: e.target.value } })} />
          <p className="small mt8">Only the bank name and the last 4 digits are shown on your profile.</p>
          <Notice tone="info" icon="i">
            <b>Next: verification.</b> {role === 'artisan' ? 'Upload your ID, a selfie and 3 photos of past work. You can bid once Allyfe approves them.' : 'Upload your CAC or market certificate, shop photo, ID and a stock photo. You receive requests once Allyfe approves them.'}
          </Notice>
          {terms}
          {err && <div className="err">{err}</div>}
          <button className="btn primary mt14" disabled={busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create my account'}
          </button>
        </>
      )}
    </div>
  );
}
