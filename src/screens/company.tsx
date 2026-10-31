import { useState } from 'react';
import { Avatar, Icon, TOOL_KINDS, ToolIcon } from '../components/art';
import { Empty, Notice, TopBar, timeAgo } from '../components/ui';
import { formatNaira } from '../domain/rules';
import type { Company, ToolKind } from '../domain/types';
import { useApp } from '../store/store';

export function CompanyHome() {
  const { state, user, go } = useApp();
  const co = user as Company;
  const v = co.verification;
  const reqs = state.rentals.filter((r) => r.companyId === co.id);
  const pending = reqs.filter((r) => r.status === 'requested').length;
  const active = reqs.filter((r) => r.status === 'approved').length;
  const tools = state.tools.filter((t) => t.companyId === co.id);
  return (
    <>
      <TopBar />
      <div className="greet">
        <Avatar spec={co.avatar} size={62} />
        <div>
          <div className="hi">Welcome back,</div>
          <div className="nm">{co.name}</div>
          <div className="sl">Rent your tools to verified artisans.</div>
        </div>
        {v.status === 'verified' ? <span className="vbadge">✓ Verified</span> : <span className="vbadge pending">Not verified</span>}
      </div>
      {v.status !== 'verified' && (
        <button className="progcard" onClick={() => go({ name: 'verify' })}>
          <span className="ic">
            <Icon name="shield" size={24} />
          </span>
          <span>
            <b>{v.status === 'review' ? 'Verification in review' : 'Verify your company'}</b>
            <span className="bar">
              <i style={{ width: (v.status === 'review' ? 90 : Object.keys(v.files).length * 20) + '%' }} />
            </span>
            <small>{v.status === 'review' ? 'Allyfe is checking your documents' : 'Your tools stay hidden from artisans until you are verified'}</small>
          </span>
          <span className="go">
            <Icon name="chev" size={14} />
          </span>
        </button>
      )}
      <div className="tiles">
        {(
          [
            ['Tools listed', String(tools.length), '#7C6CF0', 'tools', 'tools'],
            ['Requests', `${pending} new`, '#F97316', 'requests', 'requests'],
            ['On rent', `${active} active`, '#16A34A', 'cal', 'requests'],
            ['Earnings', formatNaira(state.wallets[co.id] ?? 0), '#F59E0B', 'wallet', 'wallet'],
          ] as const
        ).map(([t, s, c, ic, r]) => (
          <button key={t} className="tile" onClick={() => go({ name: r })}>
            <span style={{ background: c }}>
              <Icon name={ic} size={26} />
            </span>
            {t}
            <small>{s}</small>
          </button>
        ))}
      </div>
      <Notice tone="info" icon="i">
        When an artisan's client taps Work completed, your rental fee is credited to your Allyfe wallet. Withdraw to your bank any time.
      </Notice>
      <h3>
        Your tools<button onClick={() => go({ name: 'tools' })}>Manage</button>
      </h3>
      <div className="list">
        {tools.slice(0, 3).map((t) => (
          <div className="card tool" key={t.id}>
            <ToolIcon kind={t.kind} />
            <div>
              <b>{t.name}</b>
              <div className="small">{formatNaira(t.pricePerDay)} per day</div>
              <span className={'tag mt6 ' + (v.status === 'verified' ? 'good' : 'grey')}>{v.status === 'verified' ? 'Visible to artisans' : 'Hidden until verified'}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function Requests() {
  const { state, user, dispatch } = useApp();
  const reqs = state.rentals.filter((r) => r.companyId === user!.id);
  const verified = (user as Company).verification.status === 'verified';
  return (
    <>
      <TopBar />
      <h2>Rental requests</h2>
      <p className="sub">From verified artisans. Approve to reserve the tool.</p>
      {reqs.length ? (
        <div className="list">
          {reqs.map((r) => {
            const t = state.tools.find((x) => x.id === r.toolId)!;
            const a = state.users[r.artisanId];
            return (
              <div className="card tool" key={r.id}>
                <ToolIcon kind={t.kind} />
                <div>
                  <b>{t.name}</b>
                  <div className="small">
                    {a.name} <span className="vtick">✓</span> · {r.days} day{r.days > 1 ? 's' : ''} · {formatNaira(r.fee)} · {timeAgo(r.at)}
                  </div>
                  <div className="small">{r.jobId ? 'Paid from the job when the client confirms' : 'Prepaid from the artisan’s wallet'}</div>
                  {r.status === 'requested' ? (
                    <div className="row mt8">
                      <button className="btn primary sm" onClick={() => dispatch({ type: 'respondRental', rentalId: r.id, approve: true }, 'Rental approved.')}>
                        Approve
                      </button>
                      <button className="btn secondary sm" onClick={() => dispatch({ type: 'respondRental', rentalId: r.id, approve: false }, 'Request declined.')}>
                        Decline
                      </button>
                    </div>
                  ) : (
                    <span className={'tag mt6 ' + (r.status === 'declined' ? 'bad' : 'good')}>
                      {r.status === 'approved' ? 'Approved · awaiting job completion' : r.status === 'paid' ? 'Paid' : 'Declined'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty title="No requests yet">{verified ? 'Requests from artisans will appear here.' : 'Verify your company first so artisans can see your tools.'}</Empty>
      )}
    </>
  );
}

export function Tools() {
  const { state, user, dispatch } = useApp();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [kind, setKind] = useState<ToolKind>('drill');
  const tools = state.tools.filter((t) => t.companyId === user!.id);
  const verified = (user as Company).verification.status === 'verified';
  return (
    <>
      <TopBar />
      <h2>Your tools</h2>
      <h3>Add a tool</h3>
      <div className="card">
        <label className="f mt0" htmlFor="tname">
          Tool name
        </label>
        <input id="tname" type="text" placeholder="e.g. Rotary hammer drill" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="f" htmlFor="tprice">
          Price per day (₦)
        </label>
        <input id="tprice" type="text" inputMode="numeric" placeholder="9000" value={price} onChange={(e) => setPrice(e.target.value)} />
        <label className="f">Type</label>
        <div className="kind-pick">
          {TOOL_KINDS.map((k) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)} aria-pressed={kind === k}>
              <ToolIcon kind={k} />
              <span>{k}</span>
            </button>
          ))}
        </div>
        <button
          className="btn primary mt12"
          onClick={() => {
            if (dispatch({ type: 'addTool', name, pricePerDay: Number(price.replace(/\D/g, '')), kind }, `${name.trim()} added${verified ? ' to the Tool Store.' : '. It shows once you are verified.'}`)) {
              setName('');
              setPrice('');
            }
          }}
        >
          Add tool
        </button>
      </div>
      <h3>Listed ({tools.length})</h3>
      <div className="list">
        {tools.map((t) => (
          <div className="card tool" key={t.id}>
            <ToolIcon kind={t.kind} />
            <div>
              <b>{t.name}</b>
              <div className="small">{formatNaira(t.pricePerDay)} per day</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
