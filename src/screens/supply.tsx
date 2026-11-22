/**
 * Allyfe Supply: the procurement module connected to the job and quotation workflow.
 * Its central record is the procurement request (job.supply); every material line is
 * tracked on its own from sourcing to delivery.
 */
import { useState } from 'react';
import { Avatar, Icon } from '../components/art';
import { BackBar, Empty, Notice, TopBar, dayLabel, timeAgo } from '../components/ui';
import { vendorServes } from '../domain/actions';
import { MATERIAL_REJECT_REASONS, SUPPLY_STATUS_LABEL, compareOffers, formatNaira, fullAddress, poTotal, serviceName, supplyFunds, supplyNeed } from '../domain/rules';
import { repQueue, vendorQueue, vendorRecord } from '../domain/view';
import type { Job, PurchaseOrder, Rep, Supply, SupplyOffer, Vendor } from '../domain/types';
import { useApp } from '../store/store';

const PO_LABEL: Record<PurchaseOrder['status'], string> = {
  issued: 'Waiting for vendor to confirm stock',
  confirmed: 'Stock reserved · being prepared',
  declined: 'Declined by vendor',
  dispatched: 'On the way',
  received: 'Received and paid',
  refused: 'Refused by client',
  cancelled: 'Cancelled',
};
const PO_TONE: Record<PurchaseOrder['status'], string> = { issued: 'warn', confirmed: 'blue', declined: 'grey', dispatched: 'blue', received: 'good', refused: 'bad', cancelled: 'grey' };
const STAGES = ['Offers', 'Approval', 'Orders', 'Delivery', 'Done'];
const stageIndex = (sp: Supply) => ({ sourcing: 0, approval: 1, ordering: 2, delivering: 3, complete: 5, cancelled: -1 })[sp.status];
const first = (n: string) => n.split(' ')[0];

/* ---------------- shared pieces ---------------- */
export function SupplyStages({ supply }: { supply: Supply }) {
  const at = stageIndex(supply);
  if (at < 0) return null;
  return (
    <div className="stages" aria-label="Supply stage">
      {STAGES.map((st, i) => (
        <span key={st} className={i < at ? 'done' : i === at ? 'now' : ''}>
          <i>{i < at ? '✓' : i + 1}</i>
          {st}
        </span>
      ))}
    </div>
  );
}

/** Every material line with its specification and how much has arrived. */
export function SupplyLines({ supply, showBudget }: { supply: Supply; showBudget?: boolean }) {
  const need = supplyNeed(supply);
  return (
    <div className="sl-list">
      {supply.lines.map((l) => {
        const pct = Math.round((l.delivered / l.qty) * 100);
        return (
          <div className="sl" key={l.id}>
            <div className="between">
              <b className="t13">{l.name}</b>
              <span className="small nowrap">
                {l.delivered}/{l.qty} {l.unit}
                {l.qty > 1 ? 's' : ''}
              </span>
            </div>
            {l.spec && <div className="small">Spec: {l.spec}</div>}
            <div className="sl-bar">
              <i style={{ width: pct + '%' }} />
            </div>
            <div className="small">
              {l.delivered >= l.qty ? '✓ Delivered' : need[l.id] > 0 ? `${need[l.id]} still to source` : 'Ordered'}
              {showBudget ? ` · budget ${formatNaira(l.budgetPrice)} each` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlanSummary({ supply, job }: { supply: Supply; job: Job }) {
  const { state } = useApp();
  const p = supply.plan!;
  const vendors = [...new Set(p.allocations.map((a) => a.vendorId))];
  return (
    <div className="card plan">
      <div className="between">
        <b className="t14">{p.kind === 'single' ? 'Complete supply' : 'Combined supply'}</b>
        <span className="tag blue xs">{vendors.map((v) => state.users[v]?.name).join(' + ')}</span>
      </div>
      <div className="quote mt6">
        {p.allocations.map((a, i) => {
          const l = supply.lines.find((x) => x.id === a.lineId)!;
          return (
            <div className="q-row" key={i}>
              <span>
                {a.substitute ? (
                  <>
                    <b className="warn-ink">Substitute:</b> {a.substitute}
                    <small>instead of {l.name}</small>
                  </>
                ) : (
                  l.name
                )}
                <small>
                  {a.qty} × {formatNaira(a.unitPrice)} · {state.users[a.vendorId]?.name}
                </small>
              </span>
              <b>{formatNaira(a.qty * a.unitPrice)}</b>
            </div>
          );
        })}
        <div className="q-row sub">
          <span>Delivery</span>
          <b>{formatNaira(p.delivery)}</b>
        </div>
        <div className="q-row tot">
          <span>Plan total</span>
          <b>{formatNaira(p.total)}</b>
        </div>
      </div>
      <div className="small mt6">
        {p.extra > 0 ? (
          <span className="warn-ink">
            <b>{formatNaira(p.extra)} more</b> than the money held for materials ({formatNaira(supplyFunds(job))}).
          </span>
        ) : (
          `Within the materials budget held by Allyfe (${formatNaira(supplyFunds(job))}). Any saving is returned to the client at the end.`
        )}
      </div>
      <div className="approvals">
        <span className={p.artisanOkAt ? 'ok' : ''}>{p.artisanOkAt ? '✓' : '○'} Artisan: technically suitable</span>
        {p.needsClient && <span className={p.clientOkAt ? 'ok' : ''}>{p.clientOkAt ? '✓' : '○'} Client: {p.extra > 0 && p.substitutions ? 'extra cost and substitution' : p.extra > 0 ? 'extra cost' : 'substitution'}</span>}
        <span>○ Allyfe representative: authorize</span>
      </div>
    </div>
  );
}

function OrderCard({ job, order, viewer }: { job: Job; order: PurchaseOrder; viewer: 'client' | 'artisan' | 'rep' | 'vendor' }) {
  const { state } = useApp();
  const v = state.users[order.vendorId];
  return (
    <div className="card po">
      <div className="between">
        <b className="t13">
          {order.ref} · {viewer === 'vendor' ? 'Your purchase order' : v?.name}
        </b>
        <span className={'tag xs ' + PO_TONE[order.status]}>{PO_LABEL[order.status]}</span>
      </div>
      <div className="quote mt6">
        {order.lines.map((l) => (
          <div className="q-row" key={l.lineId}>
            <span>
              {l.name}
              <small>
                {l.qty} ordered{l.confirmed != null ? ` · ${l.confirmed} confirmed` : ''}
                {l.received != null ? ` · ${l.received} received` : ''} · {formatNaira(l.unitPrice)} each
              </small>
            </span>
            <b>{formatNaira((l.received ?? l.confirmed ?? l.qty) * l.unitPrice)}</b>
          </div>
        ))}
        <div className="q-row sub">
          <span>Delivery</span>
          <b>{formatNaira(order.deliveryFee)}</b>
        </div>
        <div className="q-row tot">
          <span>{order.paid != null ? 'Paid to vendor' : 'Order total'}</span>
          <b>{formatNaira(order.paid ?? poTotal(order))}</b>
        </div>
      </div>
      {order.waybill && <div className="small mt6">Waybill: {order.waybill}</div>}
      {order.refusal && (
        <div className="small reject-line">
          ✕ Refused: {order.refusal.reason}
          {order.refusal.note ? ` (“${order.refusal.note}”)` : ''} · {order.refusal.pickedUpAt ? 'collected by vendor' : 'vendor must collect'}
        </div>
      )}
      {viewer === 'client' && order.status === 'dispatched' && <ReceiveOrder job={job} order={order} />}
      {viewer === 'vendor' && <VendorOrderActions job={job} order={order} />}
    </div>
  );
}

/* ---------------- client: receive or refuse a delivery ---------------- */
function ReceiveOrder({ job, order }: { job: Job; order: PurchaseOrder }) {
  const { dispatch } = useApp();
  const [mode, setMode] = useState<'idle' | 'receive' | 'refuse'>('idle');
  const [got, setGot] = useState<Record<string, string>>(() => Object.fromEntries(order.lines.map((l) => [l.lineId, String(l.confirmed ?? l.qty)])));
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  if (mode === 'idle')
    return (
      <div className="row mt10">
        <button className="btn primary" onClick={() => setMode('receive')}>
          I've received it
        </button>
        <button className="btn concern" onClick={() => setMode('refuse')}>
          Refuse
        </button>
      </div>
    );
  if (mode === 'receive')
    return (
      <div className="card inset mt10">
        <b className="t13">Check each item, then confirm what arrived</b>
        {order.lines.map((l) => (
          <div className="recv" key={l.lineId}>
            <span className="grow small">
              <b className="ink">{l.name}</b> · {l.confirmed ?? l.qty} sent
            </span>
            <input type="text" inputMode="numeric" aria-label={`Received ${l.name}`} value={got[l.lineId]} onChange={(e) => setGot({ ...got, [l.lineId]: e.target.value.replace(/\D/g, '') })} />
          </div>
        ))}
        <p className="small m0">The vendor is paid for what you confirm. Anything short goes back to Allyfe Supply to be sourced again.</p>
        <button
          className="btn primary mt8"
          onClick={() => {
            const received = Object.fromEntries(Object.entries(got).map(([k, v]) => [k, Number(v) || 0]));
            if (dispatch({ type: 'receivePO', jobId: job.id, poId: order.id, received }, 'Delivery confirmed. The vendor has been paid.')) setMode('idle');
          }}
        >
          Confirm and pay vendor
        </button>
        <button className="link small mt8" onClick={() => setMode('idle')}>
          Cancel
        </button>
      </div>
    );
  return (
    <div className="card reject-box mt10">
      <b className="t14">Refuse this delivery</b>
      <p className="small m0">The vendor is not paid and must come back to collect the goods (vendor contract). The items go back to Allyfe Supply to be sourced again.</p>
      <label className="f" htmlFor={'rr-' + order.id}>
        What's wrong?
      </label>
      <select id={'rr-' + order.id} value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">Choose a reason…</option>
        {MATERIAL_REJECT_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <textarea className="mt8" placeholder="Details (required for “Other”)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      <button className="btn concern mt8" disabled={!reason} onClick={() => dispatch({ type: 'refusePO', jobId: job.id, poId: order.id, reason, note }, 'Refused. The vendor has been told to collect it.') && setMode('idle')}>
        Refuse and notify vendor
      </button>
      <button className="link small mt8" onClick={() => setMode('idle')}>
        Cancel
      </button>
    </div>
  );
}

/* ---------------- client & artisan: the supply panel on the job page ---------------- */
export function SupplyPanel({ job, viewer }: { job: Job; viewer: 'client' | 'artisan' }) {
  const { state, dispatch } = useApp();
  const [reject, setReject] = useState(false);
  const [note, setNote] = useState('');
  const sp = job.supply;
  if (!sp) return null;
  const rep = sp.repId ? (state.users[sp.repId] as Rep | undefined) : undefined;
  const p = sp.plan;
  const artisanTurn = viewer === 'artisan' && p && !p.artisanOkAt;
  const clientTurn = viewer === 'client' && p && p.needsClient && p.artisanOkAt && !p.clientOkAt;
  const live = sp.orders.filter((o) => o.status !== 'cancelled');
  return (
    <div className="supply mt12">
      <div className="supply-hd">
        <span className="supply-logo">
          <Icon name="requests" size={16} />
        </span>
        <div className="grow">
          <b className="t14">Allyfe Supply · {sp.ref}</b>
          <div className="small">{SUPPLY_STATUS_LABEL[sp.status]}</div>
        </div>
        {rep && (
          <span className="rep-chip" title="Allyfe market representative">
            <Avatar spec={rep.avatar} size={22} /> {first(rep.name)}
          </span>
        )}
      </div>
      <SupplyStages supply={sp} />
      {sp.status === 'sourcing' && (
        <p className="small m0">
          {viewer === 'client' ? 'Registered vendors in your city are sending offers. ' : 'Vendors are sending offers. '}
          {rep ? `${rep.name}, your Allyfe representative,` : 'An Allyfe representative'} compares complete and combined supply and recommends the best plan.
        </p>
      )}
      {p && (
        <>
          <h4 className="mt10 mb0">Recommended materials plan</h4>
          <PlanSummary supply={sp} job={job} />
          {artisanTurn && (
            <div className="focus mt8">
              <h4>Are these materials technically right?</h4>
              <p>Check every item and any substitution against your specification.</p>
              {!reject ? (
                <>
                  <button className="btn primary" onClick={() => dispatch({ type: 'artisanReviewSupply', jobId: job.id, ok: true, note: '' }, 'Confirmed.')}>
                    Yes, they're suitable
                  </button>
                  <button className="btn concern" onClick={() => setReject(true)}>
                    No, something is wrong
                  </button>
                </>
              ) : (
                <>
                  <textarea placeholder="What's wrong? e.g. 1.2 mm pipe is too thin for burglary proofs." value={note} onChange={(e) => setNote(e.target.value)} />
                  <button className="btn concern" onClick={() => dispatch({ type: 'artisanReviewSupply', jobId: job.id, ok: false, note }, 'Sent back to the representative.') && setReject(false)}>
                    Send back to the representative
                  </button>
                </>
              )}
            </div>
          )}
          {clientTurn && (
            <div className="focus warn mt8">
              <h4>Your approval is needed</h4>
              <p>
                {p.extra > 0 && (
                  <>
                    This plan costs <b>{formatNaira(p.extra)} more</b> than the materials money already held.{' '}
                  </>
                )}
                {p.substitutions > 0 && (
                  <>
                    It includes <b>{p.substitutions} substitution{p.substitutions > 1 ? 's' : ''}</b>, which the artisan has confirmed are suitable.
                  </>
                )}
              </p>
              <button className="btn primary" onClick={() => dispatch({ type: 'clientReviewSupply', jobId: job.id, ok: true, note: '' }, p.extra > 0 ? `${formatNaira(p.extra)} paid into Allyfe.` : 'Approved.')}>
                Approve{p.extra > 0 ? ` and pay ${formatNaira(p.extra)}` : ''}
              </button>
              <button className="btn secondary" onClick={() => dispatch({ type: 'clientReviewSupply', jobId: job.id, ok: false, note: '' }, 'Declined. The representative will look for another option.')}>
                Decline this plan
              </button>
            </div>
          )}
          {!artisanTurn && !clientTurn && (
            <p className="small mt6">
              {!p.artisanOkAt
                ? 'Waiting for the artisan to confirm the materials.'
                : p.needsClient && !p.clientOkAt
                  ? 'Waiting for the client to approve.'
                  : 'Approved. Waiting for the Allyfe representative to issue purchase orders.'}
            </p>
          )}
        </>
      )}
      <h4 className="mt10 mb0">Materials ({sp.lines.length})</h4>
      <SupplyLines supply={sp} />
      {live.length > 0 && (
        <>
          <h4 className="mt10 mb0">Purchase orders</h4>
          <div className="list mt6">
            {live.map((o) => (
              <OrderCard key={o.id} job={job} order={o} viewer={viewer} />
            ))}
          </div>
        </>
      )}
      {sp.status === 'complete' && sp.refunded ? <Notice tone="info" icon="✓">{formatNaira(sp.refunded)} of unused materials money was returned to the client.</Notice> : null}
    </div>
  );
}

/* ================= VENDOR ================= */
function VendorJobCard({ job: j, label, tone }: { job: Job; label: string; tone: string }) {
  const { state, go } = useApp();
  const sp = j.supply!;
  const client = state.users[j.clientId];
  return (
    <button className="card job-card" onClick={() => go({ name: 'order', jobId: j.id })}>
      <div className="ph order-ic">
        <Icon name="brief" size={22} />
      </div>
      <div className="grow">
        <b className="t14">
          {sp.ref} · {sp.lines.length} item{sp.lines.length === 1 ? '' : 's'}
        </b>
        <div className="small">
          {serviceName(j.category)} · {client.area.split(',')[0]} · needed by {dayLabel(j.scheduledDay!)}
        </div>
        <span className={'tag ' + tone}>{label}</span>
      </div>
      <Icon name="chev" size={14} />
    </button>
  );
}

export function VendorHome() {
  const { state, user, go } = useApp();
  const v = user as Vendor;
  const q = vendorQueue(state, v.id);
  const rec = vendorRecord(state, v.id);
  return (
    <>
      <TopBar />
      <div className="greet">
        <Avatar spec={v.avatar} size={62} />
        <div>
          <div className="hi">{v.market}</div>
          <div className="nm">{v.name}</div>
          <div className="sl">Allyfe Supply vendor · {v.city}</div>
        </div>
        {v.verification.status === 'verified' ? <span className="vbadge">✓ Verified</span> : <span className="vbadge pending">Not verified</span>}
      </div>
      {v.verification.status !== 'verified' && (
        <button className="progcard" onClick={() => go({ name: 'verify' })}>
          <span className="ic">
            <Icon name="shield" size={24} />
          </span>
          <span>
            <b>Verify your shop</b>
            <small>Only verified vendors receive supply requests.</small>
          </span>
          <span className="go">
            <Icon name="chev" size={14} />
          </span>
        </button>
      )}
      <div className="tiles">
        {(
          [
            ['Requests', `${q.requests.length} to offer`, '#F97316', 'requests', 'new'],
            ['To confirm', `${q.toConfirm.length} orders`, '#DC2626', 'check', 'mine'],
            ['To send', `${q.toSend.length} orders`, '#7C6CF0', 'jobs', 'mine'],
            ['Earnings', formatNaira(state.wallets[v.id] ?? 0), '#F59E0B', 'wallet', ''],
          ] as const
        ).map(([t, s, c, ic, tab]) => (
          <button key={t} className="tile" onClick={() => (tab ? go({ name: 'orders', tab }) : go({ name: 'wallet' }))}>
            <span style={{ background: c }}>
              <Icon name={ic} size={26} />
            </span>
            {t}
            <small>{s}</small>
          </button>
        ))}
      </div>
      <Notice tone="info" icon="i">
        Offer for the whole list or only the items you have. Allyfe's representative compares offers on price, stock and delivery, not on who answered first. Stock is reserved only when you confirm a purchase order.
      </Notice>
      {q.toCollect.length > 0 && (
        <>
          <h3>To collect ({q.toCollect.length})</h3>
          <div className="list">
            {q.toCollect.map((j) => (
              <VendorJobCard key={j.id} job={j} label="Refused · collect the goods" tone="bad" />
            ))}
          </div>
        </>
      )}
      {(q.toConfirm.length > 0 || q.toSend.length > 0) && (
        <>
          <h3>Purchase orders</h3>
          <div className="list">
            {q.toConfirm.map((j) => (
              <VendorJobCard key={j.id} job={j} label="Confirm your stock" tone="warn" />
            ))}
            {q.toSend.map((j) => (
              <VendorJobCard key={j.id} job={j} label="Stock reserved · send it" tone="blue" />
            ))}
          </div>
        </>
      )}
      <h3>New supply requests in {v.city}</h3>
      <div className="list">
        {q.requests.map((j) => (
          <VendorJobCard key={j.id} job={j} label="Send an offer" tone="orange" />
        ))}
        {!q.requests.length && <Empty title="No new requests">{v.verification.status === 'verified' ? `We'll alert you when a job in ${v.city} needs materials you sell.` : 'Requests appear once Allyfe verifies your shop.'}</Empty>}
      </div>
      <h3>Your Allyfe Supply record</h3>
      <div className="row tc">
        {[
          [String(rec.offers), 'offers sent'],
          [String(rec.received), 'orders delivered'],
          [rec.fulfilment == null ? '–' : rec.fulfilment + '%', 'fulfilment'],
        ].map(([a, b]) => (
          <div className="card stat" key={b}>
            <b>{a}</b>
            <span className="small">{b}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function Orders({ tab = 'new' }: { tab?: 'new' | 'mine' }) {
  const { state, user } = useApp();
  const q = vendorQueue(state, user!.id);
  const [t, setT] = useState(tab);
  const mine: [Job, string, string][] = [
    ...q.toCollect.map((j) => [j, 'Refused · collect the goods', 'bad'] as [Job, string, string]),
    ...q.toConfirm.map((j) => [j, 'Confirm your stock', 'warn'] as [Job, string, string]),
    ...q.toSend.map((j) => [j, 'Stock reserved · send it', 'blue'] as [Job, string, string]),
    ...q.awaiting.map((j) => [j, 'Sent · waiting for client', 'blue'] as [Job, string, string]),
    ...q.done.map((j) => [j, 'Delivered and paid', 'good'] as [Job, string, string]),
  ];
  return (
    <>
      <TopBar />
      <h2>Allyfe Supply</h2>
      <div className="tabs" role="tablist">
        {(
          [
            ['new', `Requests (${q.requests.length + q.offered.length})`],
            ['mine', `My orders (${new Set(mine.map(([j]) => j.id)).size})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={t === k} className={t === k ? 'on' : ''} onClick={() => setT(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="list">
        {t === 'new' && (
          <>
            {q.requests.map((j) => (
              <VendorJobCard key={j.id} job={j} label="Send an offer" tone="orange" />
            ))}
            {q.offered.map((j) => (
              <VendorJobCard key={j.id} job={j} label="Offer sent · being compared" tone="blue" />
            ))}
            {!q.requests.length && !q.offered.length && <Empty title="No requests">New supply requests in your city appear here.</Empty>}
          </>
        )}
        {t === 'mine' && (
          <>
            {mine.map(([j, label, tone]) => (
              <VendorJobCard key={j.id + label} job={j} label={label} tone={tone} />
            ))}
            {!mine.length && <Empty title="No purchase orders yet">When Allyfe allocates items to you, the purchase order appears here.</Empty>}
          </>
        )}
      </div>
    </>
  );
}

/** A vendor's view of one supply request: send an offer, then handle purchase orders. */
export function OrderDetail({ jobId }: { jobId: string }) {
  const { state, user, dispatch } = useApp();
  const j = state.jobs.find((x) => x.id === jobId);
  const v = user as Vendor;
  if (!j?.supply) return <BackBar label="Supply" />;
  const sp = j.supply;
  const need = supplyNeed(sp);
  const myOffer = sp.offers.find((o) => o.vendorId === v.id && o.status === 'active');
  const myOrders = sp.orders.filter((o) => o.vendorId === v.id);
  const delivering = myOrders.some((o) => !['cancelled', 'declined'].includes(o.status));
  const client = state.users[j.clientId];
  const rep = sp.repId ? state.users[sp.repId] : undefined;
  const canOffer = Object.values(need).some((n) => n > 0) && vendorServes(v, j) && !sp.plan?.allocations.some((a) => a.vendorId === v.id);
  return (
    <>
      <BackBar label="Supply" />
      <h2>Supply request {sp.ref}</h2>
      <p className="sub">
        {serviceName(j.category)} job · {client.area} · needed by {dayLabel(j.scheduledDay!)}
      </p>
      <div className="card">
        <dl className="summary m0">
          <dt>Deliver to</dt>
          <dd>{delivering ? fullAddress(j) : `${client.area} (full address with a purchase order)`}</dd>
          {delivering && (
            <>
              <dt>Client</dt>
              <dd>
                {client.name} · {client.phone}
              </dd>
            </>
          )}
          {rep && (
            <>
              <dt>Allyfe representative</dt>
              <dd>
                {rep.name}
                {rep.phone ? ` · ${rep.phone}` : ''}
              </dd>
            </>
          )}
        </dl>
      </div>
      {myOrders.length > 0 && (
        <>
          <h3>Your purchase orders</h3>
          <div className="list">
            {myOrders.map((o) => (
              <OrderCard key={o.id} job={j} order={o} viewer="vendor" />
            ))}
          </div>
        </>
      )}
      {myOffer && <MyOffer job={j} offer={myOffer} />}
      {canOffer && <OfferForm key={myOffer?.id ?? 'new'} job={j} existing={myOffer} />}
      {!canOffer && !myOffer && !myOrders.length && <Notice>This request is fully sourced.</Notice>}
      {!myOrders.length && !canOffer && myOffer && <p className="small mt8">Your offer is in a plan waiting for approval.</p>}
      {!delivering && <p className="small mt10">🔒 The client's phone number and full address appear once Allyfe sends you a purchase order.</p>}
      {canOffer && myOffer && (
        <button className="btn secondary mt8" onClick={() => dispatch({ type: 'withdrawOffer', jobId: j.id }, 'Offer withdrawn.')}>
          Withdraw my offer
        </button>
      )}
    </>
  );
}

function MyOffer({ job, offer }: { job: Job; offer: SupplyOffer }) {
  const sp = job.supply!;
  const total = offer.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + offer.deliveryFee;
  return (
    <>
      <h3>Your offer</h3>
      <div className="card">
        <div className="quote">
          {offer.items.map((i) => {
            const l = sp.lines.find((x) => x.id === i.lineId)!;
            return (
              <div className="q-row" key={i.lineId}>
                <span>
                  {i.substitute ? `${i.substitute} (instead of ${l.name})` : l.name}
                  <small>
                    {i.qty} × {formatNaira(i.unitPrice)}
                  </small>
                </span>
                <b>{formatNaira(i.qty * i.unitPrice)}</b>
              </div>
            );
          })}
          <div className="q-row sub">
            <span>Delivery ({offer.deliveryDays === 0 ? 'same day' : `${offer.deliveryDays} day${offer.deliveryDays > 1 ? 's' : ''}`})</span>
            <b>{formatNaira(offer.deliveryFee)}</b>
          </div>
          <div className="q-row tot">
            <span>{offer.items.length === sp.lines.length ? 'Full offer' : `Partial offer · ${offer.items.length} of ${sp.lines.length} items`}</span>
            <b>{formatNaira(total)}</b>
          </div>
        </div>
        <div className="small mt6">Sent {timeAgo(offer.at)} ago. The representative is comparing offers.</div>
      </div>
    </>
  );
}

function OfferForm({ job, existing }: { job: Job; existing?: SupplyOffer }) {
  const { dispatch } = useApp();
  const sp = job.supply!;
  const need = supplyNeed(sp);
  const open = sp.lines.filter((l) => need[l.id] > 0);
  const [rows, setRows] = useState(() =>
    Object.fromEntries(
      open.map((l) => {
        const it = existing?.items.find((i) => i.lineId === l.id);
        return [l.id, { on: !!it || !existing, qty: String(it?.qty ?? need[l.id]), price: it ? String(it.unitPrice) : '', sub: it?.substitute ?? '', subOn: !!it?.substitute }];
      }),
    ),
  );
  const [fee, setFee] = useState(existing ? String(existing.deliveryFee) : '');
  const [days, setDays] = useState(existing ? String(existing.deliveryDays) : '1');
  const [note, setNote] = useState(existing?.note ?? '');
  const num = (x: string) => Number(x.replace(/\D/g, '')) || 0;
  const total = open.reduce((s, l) => (rows[l.id].on ? s + num(rows[l.id].qty) * num(rows[l.id].price) : s), 0) + num(fee);
  return (
    <>
      <h3>{existing ? 'Update your offer' : 'Send your offer'}</h3>
      <p className="small m0 mb8">Tick the items you can supply. You can offer part of a quantity. If you can't match the spec, offer a substitute; the artisan and client must approve it.</p>
      <div className="list">
        {open.map((l) => {
          const r = rows[l.id];
          const set = (p: Partial<typeof r>) => setRows({ ...rows, [l.id]: { ...r, ...p } });
          return (
            <div className={'card offer-line' + (r.on ? ' on' : '')} key={l.id}>
              <label className="check m0">
                <input type="checkbox" checked={r.on} onChange={(e) => set({ on: e.target.checked })} />
                <span>
                  <b className="ink">{l.name}</b> · {need[l.id]} {l.unit}
                  {need[l.id] > 1 ? 's' : ''} needed
                  {l.spec && <span className="small block">Spec: {l.spec}</span>}
                </span>
              </label>
              {r.on && (
                <>
                  <div className="row mt8">
                    <div>
                      <span className="small">Quantity</span>
                      <input type="text" inputMode="numeric" aria-label={`Quantity of ${l.name}`} value={r.qty} onChange={(e) => set({ qty: e.target.value })} />
                    </div>
                    <div>
                      <span className="small">Your price each (₦)</span>
                      <input type="text" inputMode="numeric" aria-label={`Price of ${l.name}`} placeholder={String(l.budgetPrice)} value={r.price} onChange={(e) => set({ price: e.target.value })} />
                    </div>
                  </div>
                  {r.subOn ? (
                    <input className="mt6" type="text" aria-label={`Substitute for ${l.name}`} placeholder="What you'll supply instead, e.g. brand and size" value={r.sub} onChange={(e) => set({ sub: e.target.value })} />
                  ) : (
                    <button className="link small mt6" onClick={() => set({ subOn: true })}>
                      Offer a substitute instead
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="row mt10">
        <div>
          <label className="f" htmlFor="ofee">
            Delivery fee (₦)
          </label>
          <input id="ofee" type="text" inputMode="numeric" placeholder="0 if free" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
        <div>
          <label className="f" htmlFor="odays">
            Delivery within (days)
          </label>
          <input id="odays" type="text" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
      </div>
      <label className="f" htmlFor="onote">
        Note for the representative <em>(optional)</em>
      </label>
      <textarea id="onote" placeholder="Brand, stock condition, delivery time…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      <button
        className="btn primary mt12"
        onClick={() =>
          dispatch(
            {
              type: 'submitOffer',
              jobId: job.id,
              deliveryFee: num(fee),
              deliveryDays: num(days),
              note,
              items: open.filter((l) => rows[l.id].on).map((l) => ({ lineId: l.id, qty: num(rows[l.id].qty), unitPrice: num(rows[l.id].price), ...(rows[l.id].subOn && rows[l.id].sub.trim() ? { substitute: rows[l.id].sub } : {}) })),
            },
            'Offer sent to the Allyfe representative.',
          )
        }
      >
        {existing ? 'Update offer' : 'Send offer'} · {formatNaira(total)}
      </button>
    </>
  );
}

function VendorOrderActions({ job, order }: { job: Job; order: PurchaseOrder }) {
  const { dispatch } = useApp();
  const [conf, setConf] = useState<Record<string, string>>(() => Object.fromEntries(order.lines.map((l) => [l.lineId, String(l.qty)])));
  const [waybill, setWaybill] = useState('');
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  if (order.status === 'issued')
    return (
      <div className="card inset mt10">
        <b className="t13">Confirm your stock</b>
        <p className="small m0">Confirm how much you can supply now. Stock is reserved when you confirm; anything you can't supply goes back to sourcing.</p>
        {order.lines.map((l) => (
          <div className="recv" key={l.lineId}>
            <span className="grow small">
              <b className="ink">{l.name}</b> · {l.qty} ordered
            </span>
            <input type="text" inputMode="numeric" aria-label={`Confirm ${l.name}`} value={conf[l.lineId]} onChange={(e) => setConf({ ...conf, [l.lineId]: e.target.value.replace(/\D/g, '') })} />
          </div>
        ))}
        <button className="btn primary mt8" onClick={() => dispatch({ type: 'confirmPO', jobId: job.id, poId: order.id, confirmed: Object.fromEntries(Object.entries(conf).map(([k, v]) => [k, Number(v) || 0])) }, 'Confirmed. Stock reserved.')}>
          Confirm and reserve stock
        </button>
        {declining ? (
          <>
            <textarea className="mt8" placeholder="Why can't you supply it?" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn concern mt8" onClick={() => dispatch({ type: 'declinePO', jobId: job.id, poId: order.id, note }, 'Declined. The items go back to sourcing.')}>
              Decline purchase order
            </button>
          </>
        ) : (
          <button className="link small mt8" onClick={() => setDeclining(true)}>
            I can't supply this
          </button>
        )}
      </div>
    );
  if (order.status === 'confirmed')
    return (
      <div className="card inset mt10">
        <b className="t13">Send the materials</b>
        <p className="small m0">Waybill them to the client and add the rider or waybill details.</p>
        <input className="mt6" type="text" aria-label="Waybill details" placeholder="e.g. GIG waybill 4471 or rider Musa, 0803 555 0101" value={waybill} onChange={(e) => setWaybill(e.target.value)} />
        <button className="btn primary mt8" onClick={() => dispatch({ type: 'dispatchPO', jobId: job.id, poId: order.id, waybill }, 'Marked as sent. The client has been notified.')}>
          Mark as sent
        </button>
      </div>
    );
  if (order.status === 'refused' && !order.refusal?.pickedUpAt)
    return (
      <div className="card collect mt10">
        <b className="t13">Collect the refused goods</b>
        <div className="small">Under your Allyfe vendor contract, collect them from {fullAddress(job)}. This delivery is not paid.</div>
        <button className="btn primary mt8" onClick={() => dispatch({ type: 'collectRefusedPO', jobId: job.id, poId: order.id }, 'Marked as collected.')}>
          I've collected the goods
        </button>
      </div>
    );
  if (order.status === 'dispatched') return <p className="small mt8">Waiting for the client to check and confirm. You're paid for what they accept.</p>;
  return null;
}

/* ================= REPRESENTATIVE ================= */
function RepJobCard({ job: j }: { job: Job }) {
  const { state, go } = useApp();
  const sp = j.supply!;
  const offers = sp.offers.filter((o) => o.status === 'active').length;
  const need = Object.values(supplyNeed(sp)).filter((q) => q > 0).length;
  const p = sp.plan;
  const next =
    sp.status === 'complete'
      ? 'Complete'
      : sp.status === 'cancelled'
        ? 'Cancelled'
        : p
          ? p.artisanOkAt && (!p.needsClient || p.clientOkAt)
            ? 'Ready to authorize'
            : !p.artisanOkAt
              ? 'Waiting for artisan'
              : 'Waiting for client'
          : need
            ? offers
              ? `${offers} offer${offers > 1 ? 's' : ''} to compare`
              : 'Waiting for offers'
            : SUPPLY_STATUS_LABEL[sp.status];
  const tone = next === 'Ready to authorize' || next.includes('to compare') ? 'orange' : sp.status === 'complete' ? 'good' : 'blue';
  return (
    <button className="card job-card" onClick={() => go({ name: 'job', jobId: j.id })}>
      <div className="ph order-ic">
        <Icon name="requests" size={22} />
      </div>
      <div className="grow">
        <b className="t14">
          {sp.ref} · {j.title}
        </b>
        <div className="small">
          {state.users[j.clientId].name} · {serviceName(j.category)} · start {dayLabel(j.scheduledDay!)}
        </div>
        <span className={'tag ' + tone}>{next}</span>
      </div>
      <Icon name="chev" size={14} />
    </button>
  );
}

export function RepHome() {
  const { state, user, go } = useApp();
  const r = user as Rep;
  const q = repQueue(state, r.id);
  const inDelivery = q.active.filter((j) => j.supply!.orders.some((o) => ['issued', 'confirmed', 'dispatched'].includes(o.status)));
  const hour = new Date().getHours();
  return (
    <>
      <TopBar />
      <div className="greet">
        <Avatar spec={r.avatar} size={62} />
        <div>
          <div className="hi">{hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,'}</div>
          <div className="nm">{first(r.name)}!</div>
          <div className="sl">Allyfe market representative · {r.city}</div>
        </div>
        <span className="vbadge">Allyfe staff</span>
      </div>
      <div className="tiles">
        {(
          [
            ['Act now', String(q.action.length), '#F97316', 'requests', 'action'],
            ['Active', String(q.active.length), '#7C6CF0', 'jobs', 'active'],
            ['In delivery', String(inDelivery.length), '#0284C7', 'cal', 'active'],
            ['Completed', String(q.done.length), '#16A34A', 'check', 'done'],
          ] as const
        ).map(([t, s, c, ic, tab]) => (
          <button key={t} className="tile" onClick={() => go({ name: 'supply', tab })}>
            <span style={{ background: c }}>
              <Icon name={ic} size={26} />
            </span>
            {t}
            <small>{s}</small>
          </button>
        ))}
      </div>
      <Notice tone="info" icon="i">
        Compare complete and combined supply on cost, stock and delivery. The artisan confirms suitability, the client approves extra cost or substitutions, then you authorize and Allyfe issues the purchase orders.
      </Notice>
      <h3>
        Needs you now
        <button onClick={() => go({ name: 'supply', tab: 'action' })}>See all</button>
      </h3>
      <div className="list">
        {q.action.map((j) => (
          <RepJobCard key={j.id} job={j} />
        ))}
        {!q.action.length && <Empty title="Nothing waiting">New offers and approvals will show up here.</Empty>}
      </div>
      <h3>Markets you cover</h3>
      <div className="chips">
        {r.markets.map((m) => (
          <span className="chip lg" key={m}>
            {m}
          </span>
        ))}
      </div>
    </>
  );
}

export function RepRequests({ tab = 'action' }: { tab?: 'action' | 'active' | 'done' }) {
  const { state, user } = useApp();
  const q = repQueue(state, user!.id);
  const [t, setT] = useState(tab);
  const list = t === 'action' ? q.action : t === 'active' ? q.active : q.done;
  return (
    <>
      <TopBar />
      <h2>Supply requests</h2>
      <div className="tabs" role="tablist">
        {(
          [
            ['action', `Act now (${q.action.length})`],
            ['active', `Active (${q.active.length})`],
            ['done', `Done (${q.done.length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={t === k} className={t === k ? 'on' : ''} onClick={() => setT(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="list">
        {list.map((j) => (
          <RepJobCard key={j.id} job={j} />
        ))}
        {!list.length && <Empty title="Nothing here" />}
      </div>
    </>
  );
}

/** The representative's workspace for one procurement request. */
export function RepRequest({ job: j }: { job: Job }) {
  const { state, dispatch, go } = useApp();
  const sp = j.supply!;
  const options = compareOffers(sp);
  const offers = sp.offers.filter((o) => o.status === 'active');
  const need = supplyNeed(sp);
  const client = state.users[j.clientId];
  const artisan = j.artisanId ? state.users[j.artisanId] : undefined;
  const funds = supplyFunds(j);
  const p = sp.plan;
  const readyToAuthorize = p && p.artisanOkAt && (!p.needsClient || p.clientOkAt);
  return (
    <>
      <BackBar label="Requests" />
      <h2>{sp.ref}</h2>
      <p className="sub">
        {j.title} · {serviceName(j.category)} · start {dayLabel(j.scheduledDay!)}
      </p>
      <SupplyStages supply={sp} />
      <div className="card">
        <dl className="summary m0">
          <dt>Client</dt>
          <dd>
            {client.name} · {client.phone} · {fullAddress(j)}
          </dd>
          {artisan && (
            <>
              <dt>Artisan</dt>
              <dd>
                {artisan.name} · {artisan.phone}
              </dd>
            </>
          )}
          <dt>Materials money held</dt>
          <dd>{formatNaira(funds)}</dd>
        </dl>
      </div>

      <h3>Material schedule</h3>
      <SupplyLines supply={sp} showBudget />

      {p && (
        <>
          <h3>Recommended plan</h3>
          <PlanSummary supply={sp} job={j} />
          {readyToAuthorize ? (
            <button className="btn primary mt10" onClick={() => dispatch({ type: 'authorizeSupply', jobId: j.id }, 'Purchase orders issued.')}>
              Authorize and issue purchase orders
            </button>
          ) : (
            <p className="small mt6">{!p.artisanOkAt ? `Waiting for ${artisan?.name ?? 'the artisan'} to confirm the materials.` : `Waiting for ${client.name} to approve.`}</p>
          )}
          <button className="btn secondary mt8" onClick={() => dispatch({ type: 'withdrawPlan', jobId: j.id }, 'Plan withdrawn.')}>
            Withdraw plan
          </button>
        </>
      )}

      {!p && Object.values(need).some((q) => q > 0) && (
        <>
          <h3>Offers ({offers.length})</h3>
          {!offers.length && <Empty title="No offers yet">Matching vendors in {j.city} have been notified.</Empty>}
          <div className="list">
            {offers.map((o) => (
              <OfferCard key={o.id} supply={sp} offer={o} />
            ))}
          </div>
          {options.length > 0 && (
            <>
              <h3>Compare options</h3>
              <p className="small m0 mb8">Complete suppliers are compared with the best combination of vendors. Nothing is allocated twice.</p>
              <div className="list">
                {options.map((o, i) => (
                  <div className={'card option-card' + (i === 0 ? ' best' : '')} key={o.kind + (o.vendorId ?? '')}>
                    <div className="between">
                      <b className="t14">{o.kind === 'single' ? `Complete supply · ${state.users[o.vendorId!]?.name}` : `Combined · ${o.vendorIds.map((v) => state.users[v]?.name).join(' + ')}`}</b>
                      {i === 0 && <span className="tag good xs">Best value</span>}
                    </div>
                    <div className="money mt6">
                      <div>
                        <span>Materials</span>
                        <b>{formatNaira(o.materials)}</b>
                      </div>
                      <div>
                        <span>Delivery ({o.vendorIds.length} vendor{o.vendorIds.length > 1 ? 's' : ''})</span>
                        <b>{formatNaira(o.delivery)}</b>
                      </div>
                      <div className="tot">
                        <span>Total</span>
                        <span>{formatNaira(o.total)}</span>
                      </div>
                    </div>
                    <div className="small mt6">
                      {o.total > funds ? <span className="warn-ink">{formatNaira(o.total - funds)} over the money held · client approval needed</span> : `${formatNaira(funds - o.total)} under budget`}
                      {o.substitutions ? ` · ${o.substitutions} substitution${o.substitutions > 1 ? 's' : ''}` : ''}
                      {!o.complete ? ` · partial: ${o.uncovered.length} item${o.uncovered.length > 1 ? 's' : ''} stay in sourcing` : ''}
                    </div>
                    <button className="btn primary sm mt8" onClick={() => dispatch({ type: 'recommendPlan', jobId: j.id, kind: o.kind, vendorId: o.vendorId }, 'Plan sent to the artisan to confirm.')}>
                      Recommend this plan
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {sp.orders.length > 0 && (
        <>
          <h3>Purchase orders</h3>
          <div className="list">
            {sp.orders.map((o) => (
              <OrderCard key={o.id} job={j} order={o} viewer="rep" />
            ))}
          </div>
        </>
      )}
      <h3>Audit trail</h3>
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
      <button className="btn secondary mt8" onClick={() => go({ name: 'vendors' })}>
        Vendor records
      </button>
    </>
  );
}

function OfferCard({ supply, offer }: { supply: Supply; offer: SupplyOffer }) {
  const { state, go } = useApp();
  const v = state.users[offer.vendorId] as Vendor;
  const rec = vendorRecord(state, v.id);
  const total = offer.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + offer.deliveryFee;
  const full = offer.items.length === supply.lines.length;
  return (
    <div className="card">
      <button className="vendor-hd" onClick={() => go({ name: 'vendor', id: v.id })}>
        <Avatar spec={v.avatar} size={34} />
        <span className="grow">
          <b className="t13">{v.name}</b>
          <span className="small block">
            {v.market} · {rec.fulfilment == null ? 'new on Allyfe Supply' : `${rec.fulfilment}% fulfilment (${rec.received} delivered)`}
          </span>
        </span>
        <span className={'tag xs ' + (full ? 'good' : 'blue')}>{full ? 'Full' : `Partial ${offer.items.length}/${supply.lines.length}`}</span>
      </button>
      <div className="quote mt6">
        {offer.items.map((i) => {
          const l = supply.lines.find((x) => x.id === i.lineId)!;
          const diff = i.unitPrice - l.budgetPrice;
          return (
            <div className="q-row" key={i.lineId}>
              <span>
                {i.substitute ? (
                  <>
                    <b className="warn-ink">Sub:</b> {i.substitute}
                  </>
                ) : (
                  l.name
                )}
                <small>
                  {i.qty} × {formatNaira(i.unitPrice)} · {diff === 0 ? 'at budget' : diff < 0 ? `${formatNaira(-diff)} under budget` : `${formatNaira(diff)} over budget`}
                </small>
              </span>
              <b>{formatNaira(i.qty * i.unitPrice)}</b>
            </div>
          );
        })}
        <div className="q-row sub">
          <span>Delivery · {offer.deliveryDays === 0 ? 'same day' : `${offer.deliveryDays} day${offer.deliveryDays > 1 ? 's' : ''}`}</span>
          <b>{formatNaira(offer.deliveryFee)}</b>
        </div>
        <div className="q-row tot">
          <span>Offer total</span>
          <b>{formatNaira(total)}</b>
        </div>
      </div>
      {offer.note && <p className="small m6">“{offer.note}”</p>}
    </div>
  );
}

export function VendorRecords() {
  const { state, user, go } = useApp();
  const vendors = Object.values(state.users).filter((u): u is Vendor => u.role === 'vendor' && u.city === user!.city);
  return (
    <>
      <TopBar />
      <h2>Vendor records</h2>
      <p className="sub">Reliability, pricing and fulfilment of registered vendors in {user!.city}.</p>
      <div className="list">
        {vendors.map((v) => {
          const r = vendorRecord(state, v.id);
          return (
            <button key={v.id} className="card person-row" onClick={() => go({ name: 'vendor', id: v.id })}>
              <Avatar spec={v.avatar} size={44} />
              <div className="grow">
                <b className="t14">{v.name}</b>
                <div className="small">
                  {v.market} · {v.categories.map(serviceName).join(', ')}
                </div>
                <div className="small">
                  {r.offers} offers · {r.received} delivered · {r.refused} refused · {r.declined} declined
                </div>
              </div>
              <span className={'tag xs ' + (r.fulfilment == null ? 'grey' : r.fulfilment >= 80 ? 'good' : 'warn')}>{r.fulfilment == null ? 'New' : r.fulfilment + '%'}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function VendorProfile({ id }: { id: string }) {
  const { state } = useApp();
  const v = state.users[id] as Vendor;
  if (!v) return <BackBar />;
  const r = vendorRecord(state, id);
  return (
    <>
      <BackBar />
      <div className="profile-hd">
        <Avatar spec={v.avatar} size={76} />
        <div>
          <div className="t19 w800">{v.name}</div>
          <div className="t13">
            {v.market} · {v.city}
          </div>
          <div className="small">Owner: {v.ownerName}</div>
        </div>
      </div>
      <div className="row tc mt14">
        {[
          [r.fulfilment == null ? '–' : r.fulfilment + '%', 'fulfilment'],
          [String(r.received), 'delivered'],
          [String(r.refused + r.declined), 'refused or declined'],
        ].map(([a, b]) => (
          <div className="card stat" key={b}>
            <b>{a}</b>
            <span className="small">{b}</span>
          </div>
        ))}
      </div>
      <h3>Sells materials for</h3>
      <div className="chips">
        {v.categories.map((c) => (
          <span className="chip lg" key={c}>
            {serviceName(c)}
          </span>
        ))}
      </div>
      <h3>Recent prices offered</h3>
      {r.prices.length ? (
        <div className="card quote">
          {r.prices.map((p, i) => (
            <div className="q-row" key={i}>
              <span>
                {p.name}
                <small>{timeAgo(p.at)} ago</small>
              </span>
              <b>{formatNaira(p.unitPrice)}</b>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No offers yet" />
      )}
    </>
  );
}
