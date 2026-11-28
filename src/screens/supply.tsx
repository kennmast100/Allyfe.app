/**
 * Allyfe Supply: the procurement module connected to the job and quotation workflow.
 * Its central record is the procurement request (job.supply); every material line is
 * tracked on its own from sourcing to delivery.
 */
import { useState } from 'react';
import { Avatar, Icon } from '../components/art';
import { BackBar, Empty, Notice, TopBar, dayLabel, timeAgo } from '../components/ui';
import { vendorServes } from '../domain/actions';
import { MATERIAL_REJECT_REASONS, SUPPLY_STATUS_LABEL, compareOffers, formatNaira, fullAddress, planDue, poTotal, serviceName, supplyFunds, supplyNeed } from '../domain/rules';
import { repQueue, vendorQueue, vendorRecord } from '../domain/view';
import type { Job, PurchaseOrder, Rep, Supply, SupplyOffer, Vendor } from '../domain/types';
import { useApp } from '../store/store';

const PO_LABEL: Record<PurchaseOrder['status'], string> = {
  issued: 'Waiting for vendor to confirm stock',
  confirmed: 'Stock reserved · awaiting Allyfe pickup',
  declined: 'Declined by vendor',
  dispatched: 'Picked up · on the way',
  received: 'Received and paid',
  refused: 'Refused by client',
  cancelled: 'Cancelled',
};
const PO_TONE: Record<PurchaseOrder['status'], string> = { issued: 'warn', confirmed: 'blue', declined: 'grey', dispatched: 'blue', received: 'good', refused: 'bad', cancelled: 'grey' };
const STAGES = ['Vendor prices', 'Client pays', 'Orders', 'Delivery', 'Done'];
/** Once part of the list is ordered, a request still being sourced for the rest shows at the Orders stage. */
const partOrdered = (sp: Supply) => sp.status === 'sourcing' && sp.orders.some((o) => ['issued', 'confirmed', 'dispatched', 'received'].includes(o.status));
const stageIndex = (sp: Supply) => (partOrdered(sp) ? 2 : { sourcing: 0, approval: 1, ordering: 2, delivering: 3, complete: 5, cancelled: -1 }[sp.status]);
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
export function SupplyLines({ supply }: { supply: Supply }) {
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
              
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The representative's materials quotation. Clients and artisans see the items and the total, not which vendor supplies what. */
function PlanSummary({ supply, job, viewer }: { supply: Supply; job: Job; viewer: 'client' | 'artisan' | 'rep' }) {
  const { state } = useApp();
  const p = supply.plan!;
  const vendors = [...new Set(p.allocations.map((a) => a.vendorId))];
  const showVendors = viewer === 'rep';
  const feeUnpaid = Math.max(0, (job.serviceFee ?? 0) - job.escrow);
  const held = p.total + feeUnpaid - p.due;
  return (
    <div className="card plan">
      <div className="between">
        <b className="t14">Materials quotation</b>
        <span className="tag blue xs">{showVendors ? vendors.map((v) => state.users[v]?.name).join(' + ') : `${vendors.length} market vendor${vendors.length > 1 ? 's' : ''}`}</span>
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
                  {a.qty} × {formatNaira(a.unitPrice)}
                  {showVendors ? ` · ${state.users[a.vendorId]?.name}` : ''}
                </small>
              </span>
              <b>{formatNaira(a.qty * a.unitPrice)}</b>
            </div>
          );
        })}
        <div className="q-row sub">
          <span>Delivery to site (by Allyfe)</span>
          <b>{formatNaira(p.delivery)}</b>
        </div>
        <div className="q-row tot">
          <span>Materials total</span>
          <b>{formatNaira(p.total)}</b>
        </div>
        {viewer !== 'artisan' && (
          <>
            {feeUnpaid > 0 && (
              <div className="q-row sub">
                <span>Workmanship (artisan's service fee)</span>
                <b>{formatNaira(feeUnpaid)}</b>
              </div>
            )}
            {held > 0 && (
              <div className="q-row sub">
                <span>Already held by Allyfe for this job</span>
                <b>−{formatNaira(held)}</b>
              </div>
            )}
            <div className="q-row tot pay">
              <span>{p.clientOkAt ? 'Paid' : viewer === 'client' ? 'To pay now' : 'Client pays'}</span>
              <b>{formatNaira(p.due)}</b>
            </div>
          </>
        )}
      </div>
      <div className="approvals">
        {p.needsArtisan && <span className={p.artisanOkAt ? 'ok' : ''}>{p.artisanOkAt ? '✓' : '○'} Artisan: substitute is technically suitable</span>}
        <span className={p.clientOkAt ? 'ok' : ''}>{p.clientOkAt ? '✓' : '○'} Client: approve and pay</span>
      </div>
    </div>
  );
}

/** A conversation on a supply request. Threads: 'client' (client ↔ representative) or a vendor's id (vendor ↔ representative). */
export function MessageThread({ job, thread, title, hint }: { job: Job; thread: string; title: string; hint?: string }) {
  const { state, user, dispatch } = useApp();
  const [text, setText] = useState('');
  const sp = job.supply;
  if (!sp || !sp.repId) return null;
  const msgs = sp.messages.filter((m) => m.thread === thread);
  return (
    <div className="card thread mt8">
      <b className="t13">{title}</b>
      {hint && <p className="small m0">{hint}</p>}
      <div className="msgs">
        {msgs.length === 0 && <div className="small">No messages yet.</div>}
        {msgs.map((m) => {
          const mine = m.from === user!.id;
          const who = state.users[m.from];
          return (
            <div key={m.id} className={'msg' + (mine ? ' me' : '')}>
              {!mine && <span className="who">{who ? (who.role === 'rep' ? `${first(who.name)} · Allyfe rep` : first(who.name)) : ''}</span>}
              {m.text}
              <span className="when">{timeAgo(m.at)}</span>
            </div>
          );
        })}
      </div>
      <div className="msg-in">
        <input type="text" aria-label={`Message: ${title}`} placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
        <button className="btn primary send-btn" disabled={!text.trim()} aria-label="Send message" onClick={() => dispatch({ type: 'sendSupplyMessage', jobId: job.id, thread, text }) && setText('')}>
          <Icon name="arrow" size={18} /> Send
        </button>
      </div>
    </div>
  );
}

function OrderCard({ job, order, viewer, label }: { job: Job; order: PurchaseOrder; viewer: 'client' | 'artisan' | 'rep' | 'vendor'; label?: string }) {
  const { state } = useApp();
  const v = state.users[order.vendorId];
  return (
    <div className="card po">
      <div className="between">
        <b className="t13">
          {viewer === 'vendor' ? `${order.ref} · Your purchase order` : viewer === 'rep' ? `${order.ref} · ${v?.name}` : `${label ?? order.ref} · ${order.ref}`}
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
                {l.received != null ? ` · ${l.received} received` : ''}
                {viewer !== 'artisan' ? ` · ${formatNaira(l.unitPrice)} each` : ''}
              </small>
            </span>
            {viewer !== 'artisan' && <b>{formatNaira((l.received ?? l.confirmed ?? l.qty) * l.unitPrice)}</b>}
          </div>
        ))}
        {viewer !== 'artisan' && (
          <div className="q-row tot">
            <span>{order.paid != null ? 'Paid to vendor' : 'Order total'}</span>
            <b>{formatNaira(order.paid ?? poTotal(order))}</b>
          </div>
        )}
      </div>
      {order.waybill && <div className="small mt6">Delivery: {order.waybill}</div>}
      {viewer === 'rep' && order.status === 'confirmed' && <RepDispatch job={job} order={order} />}
      {order.refusal && (
        <div className="small reject-line">
          ✕ Refused: {order.refusal.reason}
          {order.refusal.note ? ` (“${order.refusal.note}”)` : ''} · {order.refusal.pickedUpAt ? 'returned to vendor' : 'being returned to vendor'}
        </div>
      )}
      {viewer === 'client' && order.status === 'dispatched' && <ReceiveOrder job={job} order={order} />}
      {viewer === 'vendor' && <VendorOrderActions job={job} order={order} />}
    </div>
  );
}

/* ---------------- representative: arrange pickup and delivery ---------------- */
function RepDispatch({ job, order }: { job: Job; order: PurchaseOrder }) {
  const { state, dispatch } = useApp();
  const [details, setDetails] = useState('');
  const v = state.users[order.vendorId] as Vendor | undefined;
  return (
    <div className="card inset mt10">
      <b className="t13">Arrange pickup and delivery</b>
      <p className="small m0">
        Stock is reserved at {v?.name} ({v?.market}). Send a rider or vehicle, then add the delivery details: the client and the vendor are told.
      </p>
      <input type="text" aria-label="Delivery details" placeholder="e.g. Allyfe rider Musa · 0803 555 0101 · arriving 2pm" value={details} onChange={(e) => setDetails(e.target.value)} />
      <button className="btn primary" onClick={() => dispatch({ type: 'dispatchPO', jobId: job.id, poId: order.id, waybill: details }, 'Picked up. The client has been told it is on the way.') && setDetails('')}>
        Picked up · on the way to the client
      </button>
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
      <p className="small m0">The vendor is not paid and takes the goods back (vendor contract); Allyfe returns them. Your representative sources the right items; the money you paid covers them.</p>
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
  // (state.wallets only holds the signed-in user's own wallet.)
  const [reject, setReject] = useState(false);
  const [note, setNote] = useState('');
  const sp = job.supply;
  if (!sp) return null;
  const rep = sp.repId ? (state.users[sp.repId] as Rep | undefined) : undefined;
  const p = sp.plan;
  const artisanTurn = viewer === 'artisan' && p && p.needsArtisan && !p.artisanOkAt;
  const clientTurn = viewer === 'client' && p && !p.clientOkAt;
  const waitingArtisan = !!p && p.needsArtisan && !p.artisanOkAt;
  const artisanName = job.artisanId ? first(state.users[job.artisanId]?.name ?? 'the artisan') : 'the artisan';
  const live = sp.orders.filter((o) => o.status !== 'cancelled');
  const wallet = state.wallets[job.clientId] ?? 0;
  return (
    <div className="supply mt12">
      <div className="supply-hd">
        <span className="supply-logo">
          <Icon name="requests" size={16} />
        </span>
        <div className="grow">
          <b className="t14">Allyfe Supply · {sp.ref}</b>
          <div className="small">{partOrdered(sp) ? 'Part ordered · rest being sourced' : SUPPLY_STATUS_LABEL[sp.status]}</div>
        </div>
        {rep && (
          <span className="rep-chip" title="Allyfe market representative">
            <Avatar spec={rep.avatar} size={22} /> {first(rep.name)}
          </span>
        )}
      </div>
      <SupplyStages supply={sp} />
      {sp.status === 'sourcing' && !p && live.length > 0 && (
        <p className="small m0">
          Part of the list is already ordered. {rep ? first(rep.name) : 'Your representative'} is finding a vendor for what's left and will send {viewer === 'client' ? 'you' : 'the client'} a quotation for it.
        </p>
      )}
      {sp.status === 'sourcing' && !p && !live.length && (
        <p className="small m0">
          Market vendors are adding today's unit prices for the items in stock. {rep ? `${rep.name}, your Allyfe representative,` : 'Your Allyfe representative'} picks the best vendor and sends {viewer === 'client' ? 'you' : 'the client'} the total to pay. Nothing is bought before {viewer === 'client' ? 'you pay' : 'the client pays'}.
        </p>
      )}
      {p && (
        <>
          <PlanSummary supply={sp} job={job} viewer={viewer} />
          {artisanTurn && (
            <div className="focus mt8">
              <h4>Is the substitute technically right?</h4>
              <p>The vendor can't supply exactly what you specified. Check the substitute before the client is asked to pay.</p>
              {!reject ? (
                <>
                  <button className="btn primary" onClick={() => dispatch({ type: 'artisanReviewSupply', jobId: job.id, ok: true, note: '' }, 'Confirmed. The client has been asked to pay.')}>
                    Yes, it's suitable
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
              <h4>Pay to start delivery</h4>
              <p>
                {rep ? first(rep.name) : 'Your representative'} picked the best price from the market.
                {p.substitutions > 0 && !waitingArtisan && (
                  <>
                    {' '}
                    It includes <b>{p.substitutions} substitute{p.substitutions > 1 ? 's' : ''}</b>, which {artisanName} has confirmed {p.substitutions > 1 ? 'are' : 'is'} suitable.
                  </>
                )}
                {waitingArtisan && (
                  <>
                    {' '}
                    It includes <b>{p.substitutions} substitute{p.substitutions > 1 ? 's' : ''}</b>. {artisanName} has been asked to check {p.substitutions > 1 ? 'them' : 'it'}. To save time you can approve {p.substitutions > 1 ? 'them' : 'it'} yourself and pay now.
                  </>
                )}{' '}
                Allyfe holds the money and pays each vendor only when you confirm their delivery.
              </p>
              <div className="small">Wallet balance: {formatNaira(wallet)}</div>
              {p.due > wallet ? (
                <button className="btn orange" onClick={() => dispatch({ type: 'topUp', amount: Math.ceil((p.due - wallet) / 10000) * 10000 }, 'Wallet topped up.')}>
                  Top up {formatNaira(Math.ceil((p.due - wallet) / 10000) * 10000)}
                </button>
              ) : (
                <button
                  className="btn primary"
                  onClick={() =>
                    dispatch({ type: 'clientReviewSupply', jobId: job.id, ok: true, note: '', override: waitingArtisan }, p.due > 0 ? `${formatNaira(p.due)} paid into Allyfe. The vendors are reserving your materials.` : 'Approved.')
                  }
                >
                  {waitingArtisan ? (p.due > 0 ? `Approve substitute myself and pay ${formatNaira(p.due)}` : 'Approve substitute myself') : p.due > 0 ? `Pay ${formatNaira(p.due)}` : 'Approve'}
                </button>
              )}
              <button className="btn secondary" onClick={() => dispatch({ type: 'clientReviewSupply', jobId: job.id, ok: false, note: '' }, 'Declined. Your representative will look for another option.')}>
                Ask for another option
              </button>
            </div>
          )}
          {!artisanTurn && !clientTurn && (
            <p className="small mt6">{waitingArtisan ? 'Waiting for the artisan to check the substitute (the client may approve it directly).' : 'Waiting for the client to pay.'}</p>
          )}
        </>
      )}
      <h4 className="mt10 mb0">Materials ({sp.lines.length})</h4>
      <SupplyLines supply={sp} />
      {live.length > 0 && (
        <>
          <h4 className="mt10 mb0">Deliveries</h4>
          <div className="list mt6">
            {live.map((o, i) => (
              <OrderCard key={o.id} job={job} order={o} viewer={viewer} label={`Delivery ${i + 1}${live.length > 1 ? ` of ${live.length}` : ''}`} />
            ))}
          </div>
        </>
      )}
      {sp.status === 'complete' && sp.refunded ? <Notice tone="info" icon="✓">{formatNaira(sp.refunded)} of unused materials money was returned to the client.</Notice> : null}
      {viewer === 'client' && <RateRep job={job} />}
      {viewer === 'client' && rep && (
        <MessageThread job={job} thread="client" title={`Messages with ${first(rep.name)}, your Allyfe representative`} hint={`Ask about prices, brands or delivery here, or call ${rep.phone || 'your representative'}. Allyfe talks to the vendors for you.`} />
      )}
    </div>
  );
}

/** Once the materials are in, the client rates how smoothly the representative handled it (the rep's appraisal). */
function RateRep({ job }: { job: Job }) {
  const { state, dispatch } = useApp();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const sp = job.supply!;
  const rep = sp.repId ? state.users[sp.repId] : undefined;
  if (!rep || sp.status !== 'complete') return null;
  if (sp.repRating)
    return (
      <div className="card mt8">
        <b className="t13">You rated {first(rep.name)} ★ {sp.repRating.stars}</b>
        {sp.repRating.text && <p className="small m0">“{sp.repRating.text}”</p>}
      </div>
    );
  return (
    <div className="focus mt8">
      <h4>How smooth was it with {first(rep.name)}?</h4>
      <p>Rate how your Allyfe representative handled prices, updates and delivery. It counts towards their appraisal.</p>
      <div className="star-pick" role="radiogroup" aria-label="Representative rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>
            ★
          </button>
        ))}
      </div>
      <textarea placeholder="Anything to add? (optional)" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
      <button className="btn primary" disabled={!stars} onClick={() => dispatch({ type: 'rateRep', jobId: job.id, stars, text }, 'Thanks for rating your representative.')}>
        Submit rating
      </button>
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
            ['For pickup', `${q.toSend.length} orders`, '#7C6CF0', 'jobs', 'mine'],
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
          <h3>Refused goods coming back ({q.toCollect.length})</h3>
          <div className="list">
            {q.toCollect.map((j) => (
              <VendorJobCard key={j.id} job={j} label="Refused · goods coming back" tone="bad" />
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
    ...q.toCollect.map((j) => [j, 'Refused · goods coming back', 'bad'] as [Job, string, string]),
    ...q.toConfirm.map((j) => [j, 'Confirm your stock', 'warn'] as [Job, string, string]),
    ...q.toSend.map((j) => [j, 'Stock reserved · awaiting Allyfe pickup', 'blue'] as [Job, string, string]),
    ...q.awaiting.map((j) => [j, 'Picked up · with the client', 'blue'] as [Job, string, string]),
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
          <dt>Pickup</dt>
          <dd>Allyfe collects from your shop and delivers to the client ({client.area}).</dd>
          {rep && (
            <>
              <dt>Your contact at Allyfe</dt>
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
      <p className="small mt10">🔒 You deal only with the Allyfe representative, never the client directly. Allyfe picks up the stock you confirm and delivers it.</p>
      {canOffer && myOffer && (
        <button className="btn secondary mt8" onClick={() => dispatch({ type: 'withdrawOffer', jobId: j.id }, 'Offer withdrawn.')}>
          Withdraw my offer
        </button>
      )}
      {rep && <MessageThread job={j} thread={v.id} title={`Messages with ${first(rep.name)} (Allyfe representative)`} hint="Questions about stock, brands, prices or delivery go here." />}
    </>
  );
}

function MyOffer({ job, offer }: { job: Job; offer: SupplyOffer }) {
  const sp = job.supply!;
  const total = offer.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
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
            <span>Ready for Allyfe pickup</span>
            <span>{offer.deliveryDays === 0 ? 'same day' : `within ${offer.deliveryDays} day${offer.deliveryDays > 1 ? 's' : ''}`}</span>
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
  const [days, setDays] = useState(existing ? String(existing.deliveryDays) : '1');
  const [note, setNote] = useState(existing?.note ?? '');
  const fullExisting = !!existing && open.every((l) => existing.items.some((i) => i.lineId === l.id && i.qty === need[l.id]));
  const [mode, setMode] = useState<'all' | 'part' | null>(existing ? (fullExisting ? 'all' : 'part') : null);
  const num = (x: string) => Number(x.replace(/\D/g, '')) || 0;
  const total = open.reduce((s, l) => (rows[l.id].on ? s + num(rows[l.id].qty) * num(rows[l.id].price) : s), 0);
  const pick = (m: 'all' | 'part') => {
    setMode(m);
    // "I have everything": every item, full quantities. "Part": start from everything and untick or lower.
    if (m === 'all') setRows(Object.fromEntries(open.map((l) => [l.id, { ...rows[l.id], on: true, qty: String(need[l.id]) }])));
  };
  return (
    <>
      <h3>{existing ? 'Update your offer' : 'Send your offer'}</h3>
      <p className="small m0 mb8">Do you have everything on this list in stock?</p>
      <div className="supply-choice" role="radiogroup" aria-label="How much can you supply?">
        <button role="radio" aria-checked={mode === 'all'} className={'card' + (mode === 'all' ? ' on' : '')} onClick={() => pick('all')}>
          <b className="t14">I have all the materials</b>
          <span className="small">Every item, full quantity</span>
        </button>
        <button role="radio" aria-checked={mode === 'part'} className={'card' + (mode === 'part' ? ' on' : '')} onClick={() => pick('part')}>
          <b className="t14">I can supply part</b>
          <span className="small">Some items or smaller quantities</span>
        </button>
      </div>
      {mode && (
        <p className="small m0 mb8 mt10">
          Prices change, so the artisan's list has no prices: add today's unit price for each item and the app works out the amount.
          {mode === 'part' ? " Untick what you don't have, or lower the quantity to what's in store." : ''} Can't match the spec? Offer a substitute; the artisan is notified.
        </p>
      )}
      {mode && (
      <>
      <div className="list">
        {open.map((l) => {
          const r = rows[l.id];
          const set = (p: Partial<typeof r>) => setRows({ ...rows, [l.id]: { ...r, ...p } });
          return (
            <div className={'card offer-line' + (r.on ? ' on' : '')} key={l.id}>
              <label className="check m0">
                <input type="checkbox" checked={r.on} disabled={mode === 'all'} onChange={(e) => set({ on: e.target.checked })} />
                <span>
                  <b className="ink">{l.name}</b> · {need[l.id]} {l.unit}
                  {need[l.id] > 1 ? 's' : ''} needed
                  {l.spec && <span className="small block">Spec: {l.spec}</span>}
                </span>
              </label>
              {r.on && (
                <>
                  <div className="price-row mt8">
                    <div>
                      <span className="small">Qty in stock</span>
                      <input type="text" inputMode="numeric" aria-label={`Quantity of ${l.name}`} value={r.qty} readOnly={mode === 'all'} onChange={(e) => set({ qty: e.target.value })} />
                    </div>
                    <div>
                      <span className="small">Unit price (₦)</span>
                      <input type="text" inputMode="numeric" aria-label={`Price of ${l.name}`} placeholder="Add price" value={r.price} onChange={(e) => set({ price: e.target.value })} />
                    </div>
                    <div className="amt">
                      <span className="small">Amount</span>
                      <b>{num(r.price) ? formatNaira(num(r.qty) * num(r.price)) : '–'}</b>
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
      <label className="f" htmlFor="odays">
        Ready for Allyfe pickup within (days)
      </label>
      <input id="odays" type="text" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
      <p className="small mt6">You don't deliver: Allyfe's representative arranges pickup from your shop and delivery to the client.</p>
      <label className="f" htmlFor="onote">
        Note for the representative <em>(optional)</em>
      </label>
      <textarea id="onote" placeholder="Brand, stock condition, when it can be picked up…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      <button
        className="btn primary mt12"
        onClick={() =>
          dispatch(
            {
              type: 'submitOffer',
              jobId: job.id,
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
      )}
    </>
  );
}

function VendorOrderActions({ job, order }: { job: Job; order: PurchaseOrder }) {
  const { dispatch } = useApp();
  const [conf, setConf] = useState<Record<string, string>>(() => Object.fromEntries(order.lines.map((l) => [l.lineId, String(l.qty)])));
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
        <b className="t13">Stock reserved · Allyfe will pick it up</b>
        <p className="small m0">You don't deliver. Keep the items packed; the Allyfe representative sends a rider and you'll get an alert with the pickup details.</p>
      </div>
    );
  if (order.status === 'refused' && !order.refusal?.pickedUpAt)
    return (
      <div className="card collect mt10">
        <b className="t13">Refused goods coming back</b>
        <div className="small">Under your Allyfe vendor contract you take them back. Allyfe's rider is returning them to your shop. This delivery is not paid.</div>
        <button className="btn primary mt8" onClick={() => dispatch({ type: 'collectRefusedPO', jobId: job.id, poId: order.id }, 'Thanks. Marked as returned.')}>
          I've got the goods back
        </button>
      </div>
    );
  if (order.status === 'dispatched') return <p className="small mt8">Picked up by Allyfe. You're paid for what the client accepts on delivery.</p>;
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
          ? p.needsArtisan && !p.artisanOkAt
            ? 'Artisan checking substitute'
            : 'Waiting for client to pay'
          : need
            ? offers
              ? `${offers} offer${offers > 1 ? 's' : ''} to compare`
              : 'Waiting for offers'
            : SUPPLY_STATUS_LABEL[sp.status];
  const unanswered = (() => {
    const last = new Map<string, string>();
    for (const m of sp.messages) last.set(m.thread, m.from);
    return [...last.values()].filter((f) => f !== sp.repId).length;
  })();
  const tone = next.includes('to compare') ? 'orange' : sp.status === 'complete' ? 'good' : 'blue';
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
        {unanswered > 0 && !['complete', 'cancelled'].includes(sp.status) && <span className="tag orange ml6">{unanswered} message{unanswered > 1 ? 's' : ''} to answer</span>}
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
  const reviews = q.all.filter((j) => j.supply!.repRating).sort((a, b) => b.supply!.repRating!.at - a.supply!.repRating!.at);
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
        Vendors add today's unit prices for the artisan's list. You pick the best vendor (or combination) and send the client one total. When the client pays, the purchase orders go out. You are the only contact between clients and vendors.
      </Notice>
      <h3>
        Needs you now
        <button onClick={() => go({ name: 'supply', tab: 'action' })}>See all</button>
      </h3>
      <div className="list">
        {q.action.map((j) => (
          <RepJobCard key={j.id} job={j} />
        ))}
        {!q.action.length && <Empty title="Nothing waiting">New vendor prices and messages will show up here.</Empty>}
      </div>
      <h3>Your appraisal</h3>
      <div className="card appraisal">
        <div className="between">
          <span>
            <b className="t20">★ {r.ratingCount ? r.rating.toFixed(1) : '–'}</b>
            <span className="small"> from {r.ratingCount} client review{r.ratingCount === 1 ? '' : 's'}</span>
          </span>
          <span className="small">“How smooth was it?”</span>
        </div>
        {reviews.slice(0, 3).map((j) => (
          <div className="review-line" key={j.id}>
            <b className="t13">★ {j.supply!.repRating!.stars}</b> <span className="small">{state.users[j.clientId]?.name} · {timeAgo(j.supply!.repRating!.at)}</span>
            {j.supply!.repRating!.text && <p className="small m0">“{j.supply!.repRating!.text}”</p>}
          </div>
        ))}
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
  const p = sp.plan;
  const held = Math.max(0, supplyFunds(j));
  const [delivery, setDelivery] = useState('');
  const deliveryFee = Number(delivery.replace(/\D/g, '')) || 0;
  const vendorThreads = [...new Set([...sp.offers.map((o) => o.vendorId), ...sp.orders.map((o) => o.vendorId), ...sp.messages.filter((m) => m.thread !== 'client').map((m) => m.thread)])];
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
          <dt>Workmanship (artisan)</dt>
          <dd>{formatNaira(j.serviceFee ?? 0)}</dd>
          <dt>Held by Allyfe</dt>
          <dd>{j.escrow ? `${formatNaira(j.escrow)}${held ? ` (${formatNaira(held)} free for materials)` : ''}` : 'Nothing yet: the client pays when you send the quotation'}</dd>
        </dl>
      </div>

      <h3>Material schedule</h3>
      <SupplyLines supply={sp} />

      {p && (
        <>
          <h3>Quotation sent to the client</h3>
          <PlanSummary supply={sp} job={j} viewer="rep" />
          <p className="small mt6">
            {p.needsArtisan && !p.artisanOkAt
              ? `Waiting for ${artisan?.name ?? 'the artisan'} to check the substitute, or for ${client.name} to approve it directly and pay.`
              : `Waiting for ${client.name} to pay. Purchase orders go to the vendors as soon as they do.`}
          </p>
          <button className="btn secondary mt8" onClick={() => dispatch({ type: 'withdrawPlan', jobId: j.id }, 'Quotation withdrawn.')}>
            Withdraw quotation
          </button>
        </>
      )}

      {!p && Object.values(need).some((q) => q > 0) && (
        <>
          <h3>Vendor prices ({offers.length})</h3>
          {!offers.length && <Empty title="No prices yet">Matching vendors in {j.city} have been asked to add their unit prices.</Empty>}
          <div className="list">
            {offers.map((o) => (
              <OfferCard key={o.id} supply={sp} offer={o} />
            ))}
          </div>
          {options.length > 0 && (
            <>
              <h3>Pick the best vendor</h3>
              <p className="small m0 mb8">One vendor for everything is compared with the cheapest combination of vendors. Nothing is allocated twice. The client sees the total and pays; they never deal with the vendor.</p>
              <div className="card inset mb8">
                <label className="f mt0" htmlFor="rdel">
                  Delivery fee (Allyfe pickup and delivery to site)
                </label>
                <input id="rdel" type="text" inputMode="numeric" placeholder="₦ 0 if free" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
                <span className="small">Covers collecting from every vendor in the option you pick and delivering to {fullAddress(j)}.</span>
              </div>
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
                        <span>Delivery by Allyfe ({o.vendorIds.length} pickup{o.vendorIds.length > 1 ? 's' : ''})</span>
                        <b>{formatNaira(deliveryFee)}</b>
                      </div>
                      <div className="tot">
                        <span>Total</span>
                        <span>{formatNaira(o.materials + deliveryFee)}</span>
                      </div>
                    </div>
                    <div className="small mt6">
                      Client pays {formatNaira(planDue(j, o.materials + deliveryFee))}
                      {j.escrow < (j.serviceFee ?? 0) ? ' (with workmanship)' : ''}
                      {o.substitutions ? ` · ${o.substitutions} substitute${o.substitutions > 1 ? 's' : ''} for the artisan to check` : ''}
                      {!o.complete ? ` · partial: ${o.uncovered.length} item${o.uncovered.length > 1 ? 's' : ''} stay in sourcing` : ''}
                    </div>
                    <button className="btn primary sm mt8" onClick={() => dispatch({ type: 'recommendPlan', jobId: j.id, kind: o.kind, vendorId: o.vendorId, deliveryFee }, o.substitutions ? 'Sent to the artisan to check the substitute.' : 'Quotation sent to the client.')}>
                      Send this quotation to the client
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
      <h3>Messages</h3>
      <MessageThread job={j} thread="client" title={`Client · ${client.name}`} />
      {vendorThreads.map((vid) => (
        <MessageThread key={vid} job={j} thread={vid} title={`Vendor · ${state.users[vid]?.name ?? ''}`} />
      ))}
      {sp.repRating && (
        <div className="card mt10">
          <b className="t13">Client's rating of you: ★ {sp.repRating.stars}</b>
          {sp.repRating.text && <p className="small m0">“{sp.repRating.text}”</p>}
        </div>
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
  const total = offer.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
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
                  {i.qty} of {l.qty} × {formatNaira(i.unitPrice)}
                </small>
              </span>
              <b>{formatNaira(i.qty * i.unitPrice)}</b>
            </div>
          );
        })}
        <div className="q-row sub">
          <span>Ready for pickup</span>
          <span>{offer.deliveryDays === 0 ? 'same day' : `within ${offer.deliveryDays} day${offer.deliveryDays > 1 ? 's' : ''}`}</span>
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
