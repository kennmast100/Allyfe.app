import { vendorServes } from './actions';
import { normalizePhone } from './rules';
import type { AppState, Artisan, Bid, Job, User } from './types';

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
 * What one signed-in person is allowed to see. Everything else stays on the server:
 * other people's phone numbers, bank details, verification documents, wallets,
 * transactions, alerts, addresses of jobs they aren't part of, and competitors' bids.
 * `userId` null is the signed-out welcome screen: public profiles and posts only.
 */
export function viewFor(state: AppState, userId: string | null): AppState {
  const me: User | undefined = userId ? state.users[userId] : undefined;
  const phoneOk = new Set<string>(me ? [me.id] : []);
  const jobs: Job[] = [];

  for (const j of state.jobs) {
    const o = j.materialsOrder;
    if (me?.role === 'client' && j.clientId === me.id) {
      jobs.push(j);
      if (j.artisanId) phoneOk.add(j.artisanId);
      if (o?.vendorId) phoneOk.add(o.vendorId);
      continue;
    }
    if (me?.role === 'artisan') {
      if (j.artisanId === me.id) {
        jobs.push({ ...j, bids: j.bids.map((b) => (b.artisanId === me.id ? b : hiddenBid(b))) });
        phoneOk.add(j.clientId);
        continue;
      }
      const bidOn = j.bids.some((b) => b.artisanId === me.id);
      const canSee = j.status === 'open' && j.city === me.city && (j.invitedArtisanId ? j.invitedArtisanId === me.id : me.categories.includes(j.category));
      if (bidOn || canSee) {
        // A job they might take or have bid on: the work, but not the address, other bids or the money trail.
        jobs.push({ ...j, addr: '', bids: j.bids.map((b) => (b.artisanId === me.id ? b : hiddenBid(b))), history: j.history.slice(0, 1), escrow: 0, materialsOrder: undefined });
        continue;
      }
    }
    if (me?.role === 'vendor' && o) {
      const mine = o.vendorId === me.id;
      const toCollect = o.rejections.some((r) => r.vendorId === me.id && !r.pickedUpAt);
      const canTake = j.status === 'awarded' && o.status === 'open' && vendorServes(me, j);
      if (mine || toCollect || canTake) {
        // Vendors see the order, not the job's description, bids or the client's other details.
        jobs.push({
          ...j, desc: '', media: [], bids: [], history: [], escrow: 0, deliveredMaterials: [],
          addr: mine || toCollect ? j.addr : '',
          materialsOrder: { ...o, rejections: o.rejections.filter((r) => r.vendorId === me.id) },
        });
        if (mine || toCollect) phoneOk.add(j.clientId);
        continue;
      }
    }
    if (j.status === 'completed' && j.rating) jobs.push(reviewStub(j));
  }

  const users: AppState['users'] = {};
  for (const u of Object.values(state.users)) {
    if (u.id === me?.id) {
      users[u.id] = u.role === 'artisan' ? { ...u, mentors: mentorsOf(state, u) } : u;
      continue;
    }
    const pub = { ...u, phone: phoneOk.has(u.id) ? u.phone : '', bank: '' };
    if (pub.role === 'client') users[u.id] = pub;
    else if (pub.role === 'artisan')
      users[u.id] = { ...pub, verification: { status: pub.verification.status, files: {} }, apprentices: pub.apprentices.map((a) => ({ ...a, phone: '' })), mentors: mentorsOf(state, u as Artisan) };
    else users[u.id] = { ...pub, verification: { status: pub.verification.status, files: {} } };
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
