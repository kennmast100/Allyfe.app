import { vendorServes } from './actions';
import { normalizePhone, supplyNeed } from './rules';
import type { AppState, Artisan, Bid, Job, Supply, User } from './types';

/**
 * Artisans an artisan trained under (matched by the apprentice's phone number).
 * Computed on the server so apprentices' phone numbers never leave it.
 */
export function mentorsOf(state: AppState, artisan: Artisan): string[] {
  const me = normalizePhone(artisan.phone);
  if (!me) return [];
  return Object.values(state.users)
    .filter((u): u is Artisan => u.role === 'artisan' && u.id !== artisan.id && u.apprentices.some((a) => normalizePhone(a.phone) === me))
    .map((u) => u.id);
}

const hiddenBid = (b: Bid): Bid => ({ id: b.id, artisanId: '', lines: [], serviceFee: 0, day: '', message: '', status: b.status, at: b.at });

/** A finished, rated job reduced to what a public review needs. */
const reviewStub = (j: Job): Job => ({
  id: j.id, ref: j.ref, clientId: j.clientId, city: j.city, title: j.title, desc: '', addr: '', category: j.category, tier: j.tier,
  preferredDays: [], media: [], status: j.status, bids: [], artisanId: j.artisanId, escrow: 0, deliveredMaterials: [], noShows: [],
  history: [], rating: j.rating, createdAt: j.createdAt,
});

/**
 * Clients and artisans see the representative's quotation and the orders, not every vendor's offer.
 * Clients see only their own conversation with the representative; artisans see none.
 */
const withoutOffers = (sp: Supply | undefined, thread?: string): Supply | undefined =>
  sp && {
    ...sp,
    // Only what the quotation already shows: the chosen items of the offers in the representative's plan
    // (so the client's phone can check and pay it), never other offers or unchosen items.
    offers: sp.plan
      ? sp.offers
          .filter((o) => sp.plan!.allocations.some((a) => a.offerId === o.id))
          .map((o) => ({ ...o, note: '', items: o.items.filter((i) => sp.plan!.allocations.some((a) => a.offerId === o.id && a.lineId === i.lineId)) }))
      : [],
    messages: thread ? sp.messages.filter((m) => m.thread === thread) : [],
  };

/** A live supply request a vendor could still offer on. */
const openForOffers = (j: Job) => {
  const sp = j.supply;
  return !!sp && ['awarded', 'materials_on_the_way'].includes(j.status) && !['complete', 'cancelled'].includes(sp.status) && Object.values(supplyNeed(sp)).some((q) => q > 0);
};

/**
 * What one signed-in person is allowed to see. Everything else stays on the server:
 * other people's phone numbers, bank details, verification documents, wallets,
 * transactions, alerts, addresses of jobs they aren't part of, competitors' bids
 * and competitors' supply offers.
 * `userId` null is the signed-out welcome screen: public profiles and posts only.
 */
export function viewFor(state: AppState, userId: string | null): AppState {
  const me: User | undefined = userId ? state.users[userId] : undefined;
  const phoneOk = new Set<string>(me ? [me.id] : []);
  const jobs: Job[] = [];
  const supplyPeople = (sp?: Supply) => {
    if (!sp) return;
    // Clients and artisans reach the representative, never the vendors directly.
    if (sp.repId) phoneOk.add(sp.repId);
  };

  for (const j of state.jobs) {
    const sp = j.supply;
    if (me?.role === 'client' && j.clientId === me.id) {
      jobs.push({ ...j, supply: withoutOffers(sp, 'client') });
      if (j.artisanId) phoneOk.add(j.artisanId);
      supplyPeople(sp);
      continue;
    }
    if (me?.role === 'artisan') {
      if (j.artisanId === me.id) {
        jobs.push({ ...j, bids: j.bids.map((b) => (b.artisanId === me.id ? b : hiddenBid(b))), supply: withoutOffers(sp) });
        phoneOk.add(j.clientId);
        supplyPeople(sp);
        continue;
      }
      const bidOn = j.bids.some((b) => b.artisanId === me.id);
      const canSee = j.status === 'open' && j.city === me.city && (j.invitedArtisanId ? j.invitedArtisanId === me.id : me.categories.includes(j.category));
      if (bidOn || canSee) {
        // A job they might take or have bid on: the work, but not the address, other bids or the money trail.
        jobs.push({ ...j, addr: '', bids: j.bids.map((b) => (b.artisanId === me.id ? b : hiddenBid(b))), history: j.history.slice(0, 1), escrow: 0, supply: undefined });
        continue;
      }
    }
    if (me?.role === 'vendor' && sp) {
      const myOrders = sp.orders.filter((o) => o.vendorId === me.id);
      const myOffer = sp.offers.some((o) => o.vendorId === me.id && o.status === 'active');
      const canOffer = openForOffers(j) && vendorServes(me, j);
      if (myOrders.length || myOffer || canOffer) {
        jobs.push({
          ...j, desc: '', media: [], bids: [], history: [], escrow: 0, deliveredMaterials: [], serviceFee: undefined,
          // Allyfe collects from the vendor and delivers, so vendors never get the client's address.
          addr: '',
          // Other vendors' orders stay in (so quantities already ordered aren't shown as still needed) but without who, prices or delivery details.
          supply: {
            ...sp,
            offers: sp.offers.filter((o) => o.vendorId === me.id),
            messages: sp.messages.filter((m) => m.thread === me.id),
            repRating: undefined,
            orders: sp.orders.map((o) => (o.vendorId === me.id ? o : { id: o.id, ref: '', vendorId: '', status: o.status, at: o.at, deliveryFee: 0, lines: o.lines.map((l) => ({ ...l, name: '', unitPrice: 0, substitute: undefined })) })),
            plan: undefined,
          },
        });
        // Vendors deal only with the representative: no client phone number, ever.
        if (sp.repId) phoneOk.add(sp.repId);
        continue;
      }
    }
    if (me?.role === 'rep' && sp && (sp.repId === me.id || (!sp.repId && j.city === me.city))) {
      // The representative coordinates sourcing, so sees every offer and order for their requests.
      jobs.push({ ...j, bids: j.bids.filter((b) => b.id === j.acceptedBidId) });
      phoneOk.add(j.clientId);
      if (j.artisanId) phoneOk.add(j.artisanId);
      sp.offers.forEach((o) => phoneOk.add(o.vendorId));
      sp.orders.forEach((o) => phoneOk.add(o.vendorId));
      continue;
    }
    if (j.status === 'completed' && j.rating) jobs.push(reviewStub(j));
  }

  const users: AppState['users'] = {};
  for (const u of Object.values(state.users)) {
    if (u.id === me?.id) {
      users[u.id] = u.role === 'artisan' ? { ...u, mentors: mentorsOf(state, u) } : u;
      continue;
    }
    const phone = phoneOk.has(u.id) ? u.phone : '';
    if (u.role === 'client' || u.role === 'rep') users[u.id] = { ...u, phone, bank: '' };
    else if (u.role === 'artisan')
      users[u.id] = { ...u, phone, bank: '', verification: { status: u.verification.status, files: {} }, apprentices: u.apprentices.map((a) => ({ ...a, phone: '' })), mentors: mentorsOf(state, u) };
    else users[u.id] = { ...u, phone, bank: '', verification: { status: u.verification.status, files: {} } };
  }

  const own = <T,>(rec: Record<string, T>): Record<string, T> => (me && rec[me.id] !== undefined ? { [me.id]: rec[me.id] } : {});
  return {
    ...state,
    sessionUserId: null,
    users,
    jobs,
    wallets: own(state.wallets),
    txns: own(state.txns),
    alerts: own(state.alerts),
    favourites: own(state.favourites),
  };
}

/** How reliable a vendor has been on Allyfe Supply, from their purchase orders and offers. */
export function vendorRecord(state: AppState, vendorId: string) {
  let offers = 0;
  let orders = 0;
  let confirmed = 0;
  let declined = 0;
  let received = 0;
  let refused = 0;
  let short = 0;
  const prices: { name: string; unitPrice: number; at: number }[] = [];
  for (const j of state.jobs) {
    const sp = j.supply;
    if (!sp) continue;
    for (const o of sp.offers.filter((x) => x.vendorId === vendorId)) {
      offers++;
      for (const it of o.items) {
        const l = sp.lines.find((x) => x.id === it.lineId);
        if (l) prices.push({ name: it.substitute || l.name, unitPrice: it.unitPrice, at: o.at });
      }
    }
    for (const o of sp.orders.filter((x) => x.vendorId === vendorId && x.status !== 'cancelled')) {
      orders++;
      if (['confirmed', 'dispatched', 'received', 'refused'].includes(o.status)) confirmed++;
      if (o.status === 'declined') declined++;
      if (o.status === 'received') received++;
      if (o.status === 'refused') refused++;
      if (o.status === 'received' && o.lines.some((l) => (l.received ?? 0) < (l.confirmed ?? l.qty))) short++;
    }
  }
  const finished = received + refused + declined;
  return {
    offers, orders, confirmed, declined, received, refused, short,
    /** Share of finished purchase orders delivered and accepted; null until there is history. */
    fulfilment: finished ? Math.round((received / finished) * 100) : null,
    prices: prices.sort((a, b) => b.at - a.at).slice(0, 8),
  };
}

/** A vendor's Allyfe Supply work, grouped by what they need to do next. */
export function vendorQueue(state: AppState, vendorId: string) {
  const v = state.users[vendorId];
  const requests: Job[] = [];
  const offered: Job[] = [];
  const toConfirm: Job[] = [];
  const toSend: Job[] = [];
  const awaiting: Job[] = [];
  const done: Job[] = [];
  const toCollect: Job[] = [];
  if (!v || v.role !== 'vendor') return { requests, offered, toConfirm, toSend, awaiting, done, toCollect };
  for (const j of state.jobs) {
    const sp = j.supply;
    if (!sp) continue;
    const mine = sp.orders.filter((o) => o.vendorId === vendorId);
    if (mine.some((o) => o.status === 'issued')) toConfirm.push(j);
    if (mine.some((o) => o.status === 'confirmed')) toSend.push(j);
    if (mine.some((o) => o.status === 'dispatched')) awaiting.push(j);
    if (mine.some((o) => o.status === 'received')) done.push(j);
    if (mine.some((o) => o.status === 'refused' && !o.refusal?.pickedUpAt)) toCollect.push(j);
    const hasOffer = sp.offers.some((o) => o.vendorId === vendorId && o.status === 'active');
    if (hasOffer) offered.push(j);
    else if (openForOffers(j) && vendorServes(v, j)) requests.push(j);
  }
  return { requests, offered, toConfirm, toSend, awaiting, done, toCollect };
}

/** A representative's supply requests, and which need them to act now. */
export function repQueue(state: AppState, repId: string) {
  const r = state.users[repId];
  const all = state.jobs.filter((j) => j.supply && r && (j.supply.repId === repId || (!j.supply.repId && j.city === r.city)));
  const needsRep = (j: Job) => {
    const sp = j.supply!;
    if (sp.status === 'cancelled' || sp.status === 'complete') return false;
    const pending = Object.values(supplyNeed(sp)).some((q) => q > 0);
    const threads = new Map<string, string>();
    for (const m of sp.messages) threads.set(m.thread, m.from);
    const unanswered = [...threads.values()].some((from) => from !== sp.repId);
    const toPickUp = sp.orders.some((o) => o.status === 'confirmed');
    return unanswered || toPickUp || (!sp.plan && pending && sp.offers.some((o) => o.status === 'active'));
  };
  const active = all.filter((j) => !['complete', 'cancelled'].includes(j.supply!.status));
  return { all, active, action: active.filter(needsRep), done: all.filter((j) => j.supply!.status === 'complete') };
}
