import { useState } from 'react';
import { Avatar, Icon } from '../components/art';
import { BackBar, Empty, Notice, TopBar, dayLabel, timeAgo } from '../components/ui';
import { formatNaira, fullAddress } from '../domain/rules';
import type { Job, Vendor } from '../domain/types';
import { useApp } from '../store/store';
import { QuoteTable } from './client';

function useOrders() {
  const { state, user } = useApp();
  const v = user as Vendor;
  const inCity = state.jobs.filter((j) => j.city === v.city && j.materialsOrder);
  const open = inCity.filter((j) => j.status === 'awarded' && j.materialsOrder!.status === 'open');
  const mine = inCity.filter((j) => j.materialsOrder!.vendorId === v.id);
  /** Deliveries the client refused that this vendor still has to collect. */
  const toCollect = inCity.filter((j) => j.materialsOrder!.rejections.some((r) => r.vendorId === v.id && !r.pickedUpAt));
  return { v, open, mine, toCollect };
}

const ORDER_LABEL = { open: 'New request', accepted: 'Buy and send', dispatched: 'Waiting for client to confirm', delivered: 'Delivered · paid', cancelled: 'Cancelled by client' } as const;

function OrderCard({ job: j }: { job: Job }) {
  const { state, go } = useApp();
  const o = j.materialsOrder!;
  const client = state.users[j.clientId];
  return (
    <button className="card job-card" onClick={() => go({ name: 'order', jobId: j.id })}>
      <div className="ph order-ic">
        <Icon name="brief" size={22} />
      </div>
      <div className="grow">
        <b className="t14">{formatNaira(o.total)} · {o.lines.length} item{o.lines.length === 1 ? '' : 's'}</b>
        <div className="small">
          {j.title} · {client.area.split(',')[0]} · needed by {dayLabel(j.scheduledDay!)}
        </div>
        <span className={'tag ' + (o.status === 'open' ? 'orange' : o.status === 'delivered' ? 'good' : o.status === 'cancelled' ? 'grey' : 'blue')}>{ORDER_LABEL[o.status]}</span>
      </div>
      <Icon name="chev" size={14} />
    </button>
  );
}

/** Nigerian numbers in international form for tel: and WhatsApp links. */
const intl = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.startsWith('0') ? '234' + d.slice(1) : d;
};
export function ContactClient({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="contact">
      <div>
        <div className="small">Client</div>
        <b className="t14">{name}</b>
        <div className="t13">{phone}</div>
      </div>
      <a className="btn secondary sm" href={`tel:+${intl(phone)}`}>
        Call
      </a>
      <a className="btn secondary sm" href={`https://wa.me/${intl(phone)}`} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
    </div>
  );
}

function CollectCard({ job: j }: { job: Job }) {
  const { state, user, dispatch } = useApp();
  const r = j.materialsOrder!.rejections.find((x) => x.vendorId === user!.id && !x.pickedUpAt)!;
  const client = state.users[j.clientId];
  return (
    <div className="card collect">
      <div className="between">
        <b className="t14">Collect refused materials</b>
        <span className="tag bad xs">Not accepted</span>
      </div>
      <p className="t13 m6">
        {client.name} refused your delivery for “{j.title}”: <b>{r.reason}</b>
        {r.note ? ` (“${r.note}”)` : ''}.
      </p>
      <div className="small">
        Under your Allyfe vendor contract, collect the goods from <b className="ink">{fullAddress(j)}</b>. This delivery is not paid.
      </div>
      <ContactClient name={client.name} phone={client.phone} />
      <button className="btn primary mt8" onClick={() => dispatch({ type: 'vendorPickedUp', jobId: j.id }, 'Marked as collected. The client has been told.')}>
        I've collected the materials
      </button>
    </div>
  );
}

export function VendorHome() {
  const { state, go } = useApp();
  const { v, open, mine, toCollect } = useOrders();
  const active = mine.filter((j) => j.materialsOrder!.status === 'accepted' || j.materialsOrder!.status === 'dispatched');
  const delivered = mine.filter((j) => j.materialsOrder!.status === 'delivered');
  return (
    <>
      <TopBar />
      <div className="greet">
        <Avatar spec={v.avatar} size={62} />
        <div>
          <div className="hi">{v.market}</div>
          <div className="nm">{v.name}</div>
          <div className="sl">Supply materials for Allyfe jobs in {v.city}.</div>
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
            <small>Only verified vendors receive materials requests.</small>
          </span>
          <span className="go">
            <Icon name="chev" size={14} />
          </span>
        </button>
      )}
      <div className="tiles">
        {(
          [
            ['Requests', `${open.length} new`, '#F97316', 'requests', () => go({ name: 'orders', tab: 'new' })],
            ['To deliver', `${active.length} active`, '#7C6CF0', 'jobs', () => go({ name: 'orders', tab: 'mine' })],
            ['Delivered', String(delivered.length), '#16A34A', 'check', () => go({ name: 'orders', tab: 'mine' })],
            ['Earnings', formatNaira(state.wallets[v.id] ?? 0), '#F59E0B', 'wallet', () => go({ name: 'wallet' })],
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
      <Notice tone="info" icon="i">
        The first verified vendor to accept a request supplies it. Once you accept, you get the client's phone number and address: call to confirm the exact materials (brand, colour, texture) and the delivery. You're paid when the client confirms they received everything. If they refuse a delivery, you must collect it.
      </Notice>
      {toCollect.length > 0 && (
        <>
          <h3>To collect ({toCollect.length})</h3>
          <div className="list">
            {toCollect.map((j) => (
              <CollectCard key={j.id} job={j} />
            ))}
          </div>
        </>
      )}
      <h3>New requests in {v.city}</h3>
      <div className="list">
        {open.map((j) => (
          <OrderCard key={j.id} job={j} />
        ))}
        {!open.length && <Empty title="No new requests">We'll alert you when a client accepts a quotation in {v.city}.</Empty>}
      </div>
      {active.length > 0 && (
        <>
          <h3>To deliver</h3>
          <div className="list">
            {active.map((j) => (
              <OrderCard key={j.id} job={j} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function Orders({ tab = 'new' }: { tab?: 'new' | 'mine' }) {
  const { open, mine, toCollect } = useOrders();
  const [t, setT] = useState(tab);
  return (
    <>
      <TopBar />
      <h2>Materials requests</h2>
      <div className="tabs" role="tablist">
        {(
          [
            ['new', `New (${open.length})`],
            ['mine', `My orders (${mine.length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={t === k} className={t === k ? 'on' : ''} onClick={() => setT(k)}>
            {l}
          </button>
        ))}
      </div>
      {toCollect.length > 0 && (
        <div className="list mb12">
          {toCollect.map((j) => (
            <CollectCard key={j.id} job={j} />
          ))}
        </div>
      )}
      <div className="list">
        {(t === 'new' ? open : mine).map((j) => (
          <OrderCard key={j.id} job={j} />
        ))}
        {!(t === 'new' ? open : mine).length && <Empty title={t === 'new' ? 'No new requests' : 'No orders yet'}>{t === 'new' ? 'New requests in your city appear here.' : 'Orders you accept appear here.'}</Empty>}
      </div>
    </>
  );
}

export function OrderDetail({ jobId }: { jobId: string }) {
  const { state, user, dispatch } = useApp();
  const [waybill, setWaybill] = useState('');
  const j = state.jobs.find((x) => x.id === jobId);
  if (!j || !j.materialsOrder) return <BackBar />;
  const o = j.materialsOrder;
  const client = state.users[j.clientId];
  const mine = o.vendorId === user!.id;
  const taken = o.vendorId && !mine;
  return (
    <>
      <BackBar label="Requests" />
      <h2>{formatNaira(o.total)} of materials</h2>
      <p className="sub">
        For “{j.title}” · {j.category} · requested {timeAgo(o.at)} ago
      </p>
      <span className={'tag ' + (o.status === 'open' ? 'orange' : o.status === 'delivered' ? 'good' : 'blue')}>{taken ? 'Taken by another vendor' : ORDER_LABEL[o.status]}</span>
      <div className="card mt12">
        <dl className="summary m0">
          <dt>Deliver to</dt>
          <dd>{mine ? fullAddress(j) : `${client.area} (full address after you accept)`}</dd>
          <dt>Needed by</dt>
          <dd>{dayLabel(j.scheduledDay!)} (the artisan's start day)</dd>
        </dl>
      </div>
      {mine ? (
        <>
          <ContactClient name={client.name} phone={client.phone} />
          <p className="small mt6">Call to confirm the exact materials (brand, colour, texture) and the delivery time.</p>
        </>
      ) : (
        !taken && <p className="small mt10 lock-note">🔒 The client's phone number and full address appear once you accept this order.</p>
      )}
      {o.rejections.length > 0 && (
        <Notice>
          An earlier delivery was refused: {o.rejections.map((r) => r.reason).join('; ')}. Make sure every item matches the list.
        </Notice>
      )}
      <h3>Items</h3>
      <div className="card">
        <QuoteTable lines={o.lines} showTotal={false} />
      </div>
      <p className="small mt6">Prices are the Allyfe list prices the artisan quoted with. Custom items were priced by the artisan.</p>
      {o.status === 'open' && !taken && (
        <button className="btn primary mt14" onClick={() => dispatch({ type: 'vendorAcceptOrder', jobId: j.id }, 'Order accepted. The client and artisan have been told.')}>
          Accept and supply these materials
        </button>
      )}
      {o.status === 'accepted' && mine && (
        <div className="card mt14">
          <b className="t14">Send the materials</b>
          <p className="small">Buy everything on the list, then waybill it to the client. Add the rider or waybill details so the client knows what to expect.</p>
          <input type="text" aria-label="Waybill details" placeholder="e.g. GIG waybill 4471 or rider Musa, 0803 555 0101" value={waybill} onChange={(e) => setWaybill(e.target.value)} />
          <button className="btn primary mt10" onClick={() => dispatch({ type: 'vendorDispatch', jobId: j.id, waybill }, 'Marked as sent. The client has been notified.')}>
            Mark as sent
          </button>
        </div>
      )}
      {o.status === 'dispatched' && mine && (
        <Notice tone="info" icon="i">
          Sent: {o.waybill}. You'll be paid {formatNaira(o.total)} when {client.name.split(' ')[0]} confirms they received everything.
        </Notice>
      )}
      {o.status === 'delivered' && mine && (
        <Notice tone="info" icon="✓">
          Delivered and paid. {formatNaira(o.total)} is in your wallet.
        </Notice>
      )}
      {o.status === 'cancelled' && <Notice>The client cancelled this order before delivery.</Notice>}
    </>
  );
}
