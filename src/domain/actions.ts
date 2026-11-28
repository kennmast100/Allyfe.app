import type { AppState, Apprentice, Artisan, BankDetails, Category, City, Client, ImageRef, Job, OfferItem, PurchaseOrder, QuoteLine, Rep, StockItem, Supply, Tier, TxnKind, User, Vendor } from './types';
import {
  CITIES,
  MIN_DESCRIPTION,
  CATEGORIES,
  JOB_ROLES,
  compareOffers,
  serviceName,
  planDue,
  supplyNeed,
  avatarFor,
  displayPhone,
  maskBank,
  normalizePhone,
  validAccountNumber,
  NO_SHOW_STARS,
  addRating,
  artisanQualifies,
  bidCharge,
  catalogItem,
  completionSplit,
  customKey,
  dayKey,
  earliestWorkDay,
  formatNaira,
  isOnOrAfterDay,
  jobStars,
  MATERIAL_REJECT_REASONS,
  misdescribedSplit,
} from './rules';
import { seedState } from './seed';

/** A rule was broken. The message is safe to show to the user. */
export class DomainError extends Error {}
const fail = (msg: string): never => {
  throw new DomainError(msg);
};

export type JobDraft = {
  title: string;
  desc: string;
  addr: string;
  category: Category;
  tier: Tier;
  preferredDays: string[];
  media: ImageRef[];
  honest: boolean;
  invitedArtisanId?: string;
  specialisation?: string;
};

export type BidDraft = { lines: QuoteLine[]; serviceFee: number; day: string; message: string };

/** Everything a new account fills in. The phone number comes from the verified code, never from this form. */
export type SignupProfile =
  | { role: 'client'; name: string; city: City; area: string; photo?: ImageRef }
  | {
      role: 'artisan';
      name: string;
      city: City;
      area: string;
      photo?: ImageRef;
      kind: 'individual' | 'team';
      teamName: string;
      teamMembers: string[];
      trade: Category;
      categories: Category[];
      specialisations: string[];
      years: number;
      bio: string;
      bank: BankDetails;
    }
  | { role: 'vendor'; name: string; ownerName: string; market: string; city: City; area: string; photo?: ImageRef; categories: Category[]; bank: BankDetails };

export type Action =
  | { type: 'signIn'; userId: string }
  | { type: 'registerUser'; phone: string; profile: SignupProfile }
  | { type: 'signOut' }
  | { type: 'reset' }
  | { type: 'toggleFavourite'; artisanId: string }
  | { type: 'topUp'; amount: number }
  | { type: 'withdraw'; amount: number }
  | { type: 'postJob'; draft: JobDraft }
  | { type: 'cancelJob'; jobId: string }
  | { type: 'submitBid'; jobId: string; bid: BidDraft }
  | { type: 'acceptBid'; jobId: string; bidId: string }
  /** `deliveryDays`: how soon the stock is ready for Allyfe to pick up. Vendors no longer charge delivery. */
  | { type: 'submitOffer'; jobId: string; items: OfferItem[]; deliveryFee?: number; deliveryDays: number; note: string }
  | { type: 'withdrawOffer'; jobId: string }
  /** `deliveryFee`: what Allyfe charges to pick the materials up from the vendors and deliver them to site. */
  | { type: 'recommendPlan'; jobId: string; kind: 'single' | 'combined'; vendorId?: string; deliveryFee?: number }
  | { type: 'withdrawPlan'; jobId: string }
  | { type: 'artisanReviewSupply'; jobId: string; ok: boolean; note: string }
  /** `override`: the client approves a substitute themselves instead of waiting for the artisan. */
  | { type: 'clientReviewSupply'; jobId: string; ok: boolean; note: string; override?: boolean }
  | { type: 'confirmPO'; jobId: string; poId: string; confirmed: Record<string, number> }
  | { type: 'declinePO'; jobId: string; poId: string; note: string }
  | { type: 'dispatchPO'; jobId: string; poId: string; waybill: string }
  | { type: 'receivePO'; jobId: string; poId: string; received: Record<string, number> }
  | { type: 'refusePO'; jobId: string; poId: string; reason: string; note: string }
  | { type: 'collectRefusedPO'; jobId: string; poId: string }
  | { type: 'sendSupplyMessage'; jobId: string; thread: string; text: string }
  | { type: 'rateRep'; jobId: string; stars: number; text: string }
  | { type: 'startWork'; jobId: string }
  | { type: 'flagMisdescribed'; jobId: string }
  | { type: 'finishWork'; jobId: string }
  | { type: 'supervisorApprove'; jobId: string }
  | { type: 'notFinished'; jobId: string }
  | { type: 'raiseConcern'; jobId: string }
  | { type: 'completeJob'; jobId: string }
  | { type: 'rateJob'; jobId: string; work: number; attitude: number; text: string }
  | { type: 'reportNoShow'; jobId: string }
  | { type: 'requestRefund'; jobId: string }
  | { type: 'chooseAnotherArtisan'; jobId: string }
  | { type: 'demoStartDay'; jobId: string }
  | { type: 'updateProfile'; kind: 'individual' | 'team'; teamName: string; teamMembers: string[]; bio: string; specialisations?: string[] }
  | { type: 'addApprentice'; name: string; phone: string; photo: ImageRef }
  | { type: 'removeApprentice'; apprenticeId: string }
  | { type: 'addVerificationFile'; key: string; image: ImageRef }
  | { type: 'submitVerification' }
  | { type: 'approveVerification'; userId: string }
  | { type: 'createPost'; image: ImageRef; text: string; stock?: StockItem }
  | { type: 'toggleLike'; postId: string }
  | { type: 'addComment'; postId: string; text: string }
  | { type: 'markAlertsRead' };

/** Actions that only change this device's session and never go to the server. */
export const LOCAL_ONLY_ACTIONS: Action['type'][] = ['signIn', 'signOut'];
/** Only the server's sign-up endpoint may create accounts, after checking the phone code. */
export const AUTH_ONLY_ACTIONS: Action['type'][] = ['registerUser'];
/** Testing shortcuts the production server refuses. */
export const DEMO_ONLY_ACTIONS: Action['type'][] = ['reset', 'demoStartDay', 'supervisorApprove', 'approveVerification'];

/**
 * Applies an action and returns the new state. Throws DomainError if the action is not allowed.
 * Pass the same `now` and `nonce` on the phone and the server and new records get the same ids,
 * so the phone can show the result instantly and the server's copy still matches.
 */
export function reduce(prev: AppState, action: Action, now = Date.now(), nonce?: string): AppState {
  if (action.type === 'reset') return seedState(now);
  const s: AppState = structuredClone(prev);
  let n = 0;
  const id = (p: string) => (nonce ? `${p}-${nonce}-${n++}` : `${p}-${now.toString(36)}-${s.seq++}`);
  if (nonce) s.seq++;
  const today = dayKey(new Date(now));
  const me = (): User => (s.sessionUserId && s.users[s.sessionUserId]) || fail('Please sign in first.');
  const meAs = <R extends User['role']>(role: R) => {
    const u = me();
    if (u.role !== role) fail(`Only ${role}s can do that.`);
    return u as Extract<User, { role: R }>;
  };
  const name = (uid: string) => s.users[uid]?.name ?? 'Someone';
  const first = (uid: string) => name(uid).split(' ')[0];
  const job = (jobId: string) => s.jobs.find((j) => j.id === jobId) || fail('That job no longer exists.');
  const txn = (uid: string, label: string, amount: number, kind: TxnKind) => {
    (s.txns[uid] ??= []).unshift({ id: id('x'), label, amount, kind, at: now });
  };
  const credit = (uid: string, amount: number, label: string) => {
    if (amount <= 0) return;
    s.wallets[uid] = (s.wallets[uid] ?? 0) + amount;
    txn(uid, label, amount, 'in');
  };
  const debit = (uid: string, amount: number, label: string, kind: TxnKind = 'out') => {
    if (amount <= 0) return;
    if ((s.wallets[uid] ?? 0) < amount) fail(`Your wallet needs ${formatNaira(amount - (s.wallets[uid] ?? 0))} more. Top up and try again.`);
    s.wallets[uid] -= amount;
    txn(uid, label, amount, kind);
  };
  const alert = (uid: string, text: string, jobId?: string) => {
    (s.alerts[uid] ??= []).unshift({ id: id('al'), text, at: now, read: false, jobId });
  };
  const log = (j: Job, label: string, by: string) => j.history.push({ label, by, at: now });
  const expect = (j: Job, ...st: Job['status'][]) => {
    if (!st.includes(j.status)) fail('This job has moved on. Refresh to see its latest status.');
  };
  const assignedArtisan = (j: Job) => {
    const a = meAs('artisan');
    if (j.artisanId !== a.id) fail('This job is assigned to another artisan.');
    return a;
  };
  const ownClient = (j: Job) => {
    const c = meAs('client');
    if (j.clientId !== c.id) fail('Only the client who posted this job can do that.');
    return c;
  };
  const artisansFor = (j: Job) =>
    Object.values(s.users).filter((u): u is Artisan => u.role === 'artisan' && artisanQualifies(u, j) && !j.noShows.some((x) => x.artisanId === u.id));
  /** Verified vendors in the job's city who sell that kind of material. */
  const vendorsFor = (j: Job) => Object.values(s.users).filter((u): u is Vendor => u.role === 'vendor' && vendorServes(u, j));
  const supplyOf = (j: Job) => j.supply || fail('This job has no materials to source.');
  const po = (j: Job, poId: string) => supplyOf(j).orders.find((o) => o.id === poId) || fail('Purchase order not found.');
  /** The representative coordinating this job's supply (or any rep in the city if none is assigned yet). */
  const repFor = (j: Job) => {
    const r = meAs('rep');
    if (r.city !== j.city) fail(`This request is in ${j.city}. You cover ${r.city}.`);
    const sp = supplyOf(j);
    if (sp.repId && sp.repId !== r.id) fail('Another representative is coordinating this request.');
    sp.repId ??= r.id;
    return r;
  };
  const alertRep = (j: Job, text: string) => j.supply?.repId && alert(j.supply.repId, text, j.id);
  const pickRep = (city: City) => {
    const reps = Object.values(s.users).filter((u): u is Rep => u.role === 'rep' && u.city === city);
    const load = (r: Rep) => s.jobs.filter((x) => x.supply?.repId === r.id && !['complete', 'cancelled'].includes(x.supply.status)).length;
    return reps.sort((a, b) => load(a) - load(b))[0];
  };
  /** Keeps the supply and job status in step with the lines and orders; settles up when everything has arrived. */
  const syncSupply = (j: Job) => {
    const sp = j.supply;
    if (!sp || sp.status === 'cancelled' || sp.status === 'complete') return;
    if (sp.lines.every((l) => l.delivered >= l.qty)) {
      sp.status = 'complete';
      sp.plan = undefined;
      // Delivery was arranged by Allyfe: the delivery money goes to Allyfe's logistics account.
      if (sp.deliveryHeld) {
        credit(ALLYFE_ACCOUNT, sp.deliveryHeld, `Delivery (Allyfe logistics) · ${sp.ref}`);
        j.escrow -= sp.deliveryHeld;
      }
      // Reconciliation: whatever is left of the materials money goes back to the client.
      const leftover = j.escrow - (j.serviceFee ?? 0);
      if (leftover > 0) {
        credit(j.clientId, leftover, `Materials savings returned · ${j.title}`);
        j.escrow -= leftover;
        sp.refunded = leftover;
      }
      j.deliveredMaterials.push(
        ...sp.lines.map((l) => {
          // What was actually paid per unit, from the received purchase orders.
          const got = sp.orders.flatMap((o) => (o.status === 'received' ? o.lines.filter((x) => x.lineId === l.id && x.received) : []));
          const paid = got.reduce((t, x) => t + x.received! * x.unitPrice, 0);
          const qty = got.reduce((t, x) => t + x.received!, 0);
          return { key: l.key, name: l.name, unit: l.unit, unitPrice: qty ? Math.round(paid / qty) : 0, qty: l.delivered, spec: l.spec };
        }),
      );
      j.status = 'ready';
      log(j, `All materials delivered and reconciled${leftover > 0 ? ` · ${formatNaira(leftover)} savings returned to client` : ''}`, 'Allyfe Supply');
      alert(j.artisanId!, `All materials for “${j.title}” are at the client's home. Go and start work on ${j.scheduledDay}. Address: ${j.addr}.`, j.id);
      if (leftover > 0) alert(j.clientId, `All materials for “${j.title}” have arrived. ${formatNaira(leftover)} you didn't need was returned to your wallet.`, j.id);
      alertRep(j, `Supply ${sp.ref} for “${j.title}” is complete.`);
      return;
    }
    const need = supplyNeed(sp);
    const anyNeed = Object.values(need).some((q) => q > 0);
    sp.status = sp.plan ? 'approval' : anyNeed ? 'sourcing' : sp.orders.some((o) => o.status === 'dispatched') ? 'delivering' : 'ordering';
    j.status = sp.orders.some((o) => o.status === 'dispatched') ? 'materials_on_the_way' : 'awarded';
  };
  const withdrawVendorOffer = (sp: Supply, vendorId: string) => sp.offers.filter((o) => o.vendorId === vendorId && o.status === 'active').forEach((o) => (o.status = 'withdrawn'));
  const refundEscrow = (j: Job, label: string) => {
    credit(j.clientId, j.escrow, label);
    j.escrow = 0;
  };

  switch (action.type) {
    case 'signIn':
      if (!s.users[action.userId]) fail('Account not found.');
      s.sessionUserId = action.userId;
      break;
    case 'signOut':
      s.sessionUserId = null;
      break;
    case 'registerUser': {
      const phone = normalizePhone(action.phone) || fail('Enter a valid Nigerian mobile number.');
      if (Object.values(s.users).some((u) => normalizePhone(u.phone) === phone)) fail('This number already has an Allyfe account. Sign in instead.');
      const p = action.profile;
      const name = p.name.trim().replace(/\s+/g, ' ');
      if (name.length < 3) fail(p.role === 'vendor' ? "Enter your shop's name." : 'Enter your full name.');
      if (!CITIES.includes(p.city)) fail('Choose your city.');
      if (!p.area.trim()) fail('Enter your area or estate, e.g. GRA Phase 2.');
      const base = { name, phone: displayPhone(phone), city: p.city, area: `${p.area.trim()}, ${p.city}`, avatar: avatarFor(name, p.photo) };
      const checkBank = (b: BankDetails) => {
        if (!b.bankName) fail('Choose your bank.');
        if (!validAccountNumber(b.accountNumber)) fail('Account numbers are 10 digits.');
        if (b.accountName.trim().length < 3) fail('Enter the name on the bank account.');
        return maskBank(b.bankName, b.accountNumber);
      };
      const none = { status: 'none' as const, files: {} };
      let user: User;
      if (p.role === 'client') {
        user = { id: 'c-' + id('u'), role: 'client', ...base, bank: '' } satisfies Client;
      } else if (p.role === 'artisan') {
        if (!CATEGORIES.includes(p.trade)) fail('Choose your main job role.');
        const cats = [...new Set([p.trade, ...p.categories.filter((c) => CATEGORIES.includes(c))])];
        const allowed = new Set(JOB_ROLES.filter((r) => cats.includes(r.role)).flatMap((r) => r.specialisations));
        const specs = [...new Set(p.specialisations ?? [])].filter((x) => allowed.has(x));
        if (!(p.years >= 0 && p.years <= 60)) fail('Enter your years of experience.');
        const members = p.teamMembers.map((m) => m.trim()).filter(Boolean);
        if (p.kind === 'team' && !p.teamName.trim()) fail('Give your team a name.');
        if (p.kind === 'team' && members.length < 2) fail('A team needs at least 2 members.');
        user = {
          id: 'a-' + id('u'), role: 'artisan', ...base, trade: p.trade, categories: cats, specialisations: specs, rating: 0, ratingCount: 0, jobsDone: 0,
          years: Math.round(p.years), bio: p.bio.trim(), work: [], bank: checkBank(p.bank), verification: none,
          kind: p.kind, teamName: p.kind === 'team' ? p.teamName.trim() : undefined, teamMembers: p.kind === 'team' ? members : [], apprentices: [],
        } satisfies Artisan;
      } else {
        if (!p.market.trim()) fail('Enter the market or street where your shop is.');
        if (p.ownerName.trim().length < 3) fail("Enter the owner's full name.");
        if (!p.categories.length || !p.categories.every((c) => CATEGORIES.includes(c))) fail('Choose at least one kind of material you sell.');
        user = {
          id: 'v-' + id('u'), role: 'vendor', ...base, market: p.market.trim(), ownerName: p.ownerName.trim(), categories: p.categories,
          bank: checkBank(p.bank), verification: none,
        } satisfies Vendor;
      }
      s.users[user.id] = user;
      s.wallets[user.id] = 0;
      s.sessionUserId = user.id;
      alert(user.id, user.role === 'client' ? 'Welcome to Allyfe! Post your first job to get quotations.' : 'Welcome to Allyfe! Verify your account so you can start getting work.');
      break;
    }
    case 'toggleFavourite': {
      const u = me();
      const fav = (s.favourites[u.id] ??= []);
      const i = fav.indexOf(action.artisanId);
      if (i >= 0) fav.splice(i, 1);
      else fav.push(action.artisanId);
      break;
    }
    case 'topUp': {
      const u = me();
      if (u.role === 'artisan' || u.role === 'vendor') fail('Top-ups are for clients. You are paid through jobs.');
      if (!(action.amount > 0)) fail('Enter an amount.');
      credit(u.id, action.amount, `Top-up from ${u.bank.split(' ')[0]}`);
      break;
    }
    case 'withdraw': {
      const u = me();
      if (!(action.amount > 0)) fail('Enter an amount.');
      debit(u.id, action.amount, `Withdrawal to ${u.bank}`);
      break;
    }

    /* ---------- posting & bidding ---------- */
    case 'postJob': {
      const c = meAs('client');
      const d = action.draft;
      if (!CATEGORIES.includes(d.category)) fail('Choose the kind of job.');
      if (!d.title.trim()) fail('Add a short job title so artisans know what you need.');
      if (d.desc.trim().length < MIN_DESCRIPTION) fail(`Describe the job in more detail (at least ${MIN_DESCRIPTION} characters): sizes, quantities, what is broken and what you want.`);
      if (!d.addr.trim()) fail('Add the address where the work will happen.');
      if (!d.preferredDays.length) fail('Pick at least one day for the work.');
      const earliest = earliestWorkDay(now);
      if (d.preferredDays.some((x) => x < earliest)) fail('Work can only be booked at least 24 hours after you post, so vendors can buy and deliver the materials.');
      if (!d.honest) fail('Tick the box to confirm your description is truthful.');
      const j: Job = {
        id: id('j'), ref: CITY_CODE[c.city] + '-' + (4200 + s.seq), clientId: c.id, city: c.city, title: d.title.trim(), desc: d.desc.trim(), addr: d.addr.trim(), category: d.category, tier: d.tier,
        preferredDays: d.preferredDays.slice().sort(), media: d.media, status: 'open', bids: [], invitedArtisanId: d.invitedArtisanId,
        ...(d.specialisation && JOB_ROLES.find((r) => r.role === d.category)?.specialisations.includes(d.specialisation) ? { specialisation: d.specialisation } : {}),
        escrow: 0, deliveredMaterials: [], noShows: [], history: [], createdAt: now,
      };
      log(j, 'Job posted', c.name);
      s.jobs.unshift(j);
      const targets = d.invitedArtisanId ? [d.invitedArtisanId] : artisansFor(j).map((a) => a.id);
      targets.forEach((aid) => alert(aid, d.invitedArtisanId ? `${c.name} wants you for “${j.title}”. Send your quotation.` : `New ${serviceName(d.category).toLowerCase()} job in ${c.city}: “${j.title}”. Read it and send your quotation.`, j.id));
      break;
    }
    case 'cancelJob': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'open');
      if (j.escrow) refundEscrow(j, `Refund · ${j.title}`);
      j.status = 'cancelled';
      log(j, 'Cancelled by client', c.name);
      j.bids.forEach((b) => b.status === 'pending' && alert(b.artisanId, `${c.name} cancelled “${j.title}”.`, j.id));
      break;
    }
    case 'submitBid': {
      const a = meAs('artisan');
      const j = job(action.jobId);
      expect(j, 'open');
      if (a.verification.status !== 'verified') fail('Finish verification before bidding on jobs.');
      if (j.invitedArtisanId && j.invitedArtisanId !== a.id) fail('This job was sent to a specific artisan.');
      if (j.noShows.some((x) => x.artisanId === a.id)) fail('You missed this job before, so you cannot bid on it again.');
      if (!artisanQualifies(a, j)) fail(a.city !== j.city ? `This job is in ${j.city}. You can only bid in ${a.city}.` : `${j.tier} jobs need a rating of 4.7★ or more.`);
      if (j.bids.some((b) => b.artisanId === a.id && b.status === 'pending')) fail('You have already bid on this job.');
      const b = action.bid;
      const lines: QuoteLine[] = b.lines.map((l) => {
        const qty = Math.round(l.qty);
        if (!(qty >= 1 && qty <= 9999)) fail('Each material needs a quantity of at least 1.');
        if (l.key.startsWith('custom:')) {
          if (!l.name.trim()) fail('Give each extra material a name.');
          return { key: customKey(l.name), name: l.name.trim(), unit: l.unit.trim() || 'item', unitPrice: 0, qty, ...(l.spec?.trim() ? { spec: l.spec.trim().slice(0, 120) } : {}) };
        }
        const item = catalogItem(j.category, l.key) || fail('One of the materials is not on the list for this job type.');
        return { key: item.key, name: item.name, unit: item.unit, unitPrice: 0, qty, ...(l.spec?.trim() ? { spec: l.spec.trim().slice(0, 120) } : {}) };
      });
      if (!(b.serviceFee > 0)) fail('Set your service fee.');
      if (!j.preferredDays.includes(b.day)) fail('Pick one of the days the client chose.');
      if (b.day < today) fail('That day has passed. Pick another.');
      j.bids.push({ id: id('b'), artisanId: a.id, lines, serviceFee: Math.round(b.serviceFee), day: b.day, message: b.message.trim(), status: 'pending', at: now });
      alert(j.clientId, `${a.name} sent a quotation for “${j.title}”: ${formatNaira(b.serviceFee)} workmanship${lines.length ? ` and ${lines.length} material${lines.length > 1 ? 's' : ''} for market vendors to price` : ''}.`, j.id);
      break;
    }
    case 'acceptBid': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'open');
      const b = j.bids.find((x) => x.id === action.bidId) || fail('That bid was withdrawn.');
      if (b.status !== 'pending') fail('That bid is no longer available.');
      if (b.day < today) fail('The day in this bid has passed. Ask for a new bid.');
      const charge = bidCharge(j, b);
      if (charge.due > 0) debit(c.id, charge.due, `Paid into Allyfe · ${j.title}`, 'hold');
      if (charge.due < 0) credit(c.id, -charge.due, `Difference returned · ${j.title}`);
      j.escrow += charge.due;
      j.serviceFee = b.serviceFee;
      j.artisanId = b.artisanId;
      j.acceptedBidId = b.id;
      j.scheduledDay = b.day;
      j.bids.forEach((x) => {
        if (x.id === b.id) x.status = 'accepted';
        else if (x.status === 'pending') {
          x.status = 'declined';
          alert(x.artisanId, `${c.name} chose another artisan for “${j.title}”.`, j.id);
        }
      });
      log(j, `Accepted ${name(b.artisanId)}'s quotation · ${formatNaira(b.serviceFee)} workmanship${charge.payNow ? ' · paid into Allyfe' : ' · materials to be priced by market vendors'}`, c.name);
      if (charge.billable.length) {
        const supplyId = id('s');
        const rep = pickRep(j.city);
        j.supply = {
          id: supplyId, ref: 'SR-' + j.ref.replace(/^[A-Z]+-/, ''), repId: rep?.id, offers: [], orders: [], status: 'sourcing', at: now,
          messages: [],
          lines: charge.billable.map((l, i) => ({ id: `${supplyId}-L${i + 1}`, key: l.key, name: l.name, unit: l.unit, spec: l.spec ?? '', qty: l.qty, delivered: 0 })),
        };
        j.status = 'awarded';
        log(j, `Allyfe Supply request ${j.supply.ref} created: ${j.supply.lines.length} material line${j.supply.lines.length > 1 ? 's' : ''}${rep ? ` · coordinated by ${rep.name}` : ''}`, 'Allyfe Supply');
        vendorsFor(j).forEach((v) => alert(v.id, `New supply request in ${j.city}: ${j.supply!.lines.length} items for “${j.title}”. Add your unit prices for what you have in stock.`, j.id));
        if (rep) alert(rep.id, `New supply request ${j.supply.ref} for “${j.title}”. Vendors have been asked to price ${j.supply.lines.length} items.`, j.id);
        alert(c.id, `Market vendors are now pricing the materials for “${j.title}”. ${rep ? rep.name + ', your Allyfe representative,' : 'Your Allyfe representative'} will send you the best quotation to pay.`, j.id);
        alert(b.artisanId, `${c.name} accepted your quotation for “${j.title}”. Allyfe Supply is sourcing the materials; you start on ${b.day}.`, j.id);
      } else {
        j.supply = undefined;
        j.status = 'ready';
        log(j, 'All materials already at the client’s home', 'Allyfe');
        alert(b.artisanId, `${c.name} accepted your bid for “${j.title}”. Materials are already on site. Start on ${b.day}. Address: ${j.addr}.`, j.id);
      }
      break;
    }

    /* ---------- Allyfe Supply ---------- */
    case 'submitOffer': {
      const v = meAs('vendor');
      const j = job(action.jobId);
      expect(j, 'awarded', 'materials_on_the_way');
      const sp = supplyOf(j);
      if (v.verification.status !== 'verified') fail('Finish verification before sending offers.');
      if (!vendorServes(v, j)) fail(v.city !== j.city ? `This request is in ${j.city}. You supply ${v.city}.` : `You don't sell ${serviceName(j.category).toLowerCase()} materials. Add it to your profile first.`);
      if (sp.plan?.allocations.some((a) => a.vendorId === v.id)) fail('Your current offer is in a plan waiting for approval. You can change it if the plan is not approved.');
      const need = supplyNeed(sp);
      const items: OfferItem[] = [];
      for (const it of action.items) {
        const line = sp.lines.find((l) => l.id === it.lineId) || fail('One of the items is not on this request.');
        const qty = Math.round(it.qty);
        if (!(qty >= 1)) continue;
        if (!need[line.id]) fail(`${line.name} is already sourced.`);
        if (qty > need[line.id]) fail(`Only ${need[line.id]} ${line.unit}${need[line.id] > 1 ? 's' : ''} of ${line.name} are still needed.`);
        if (!(it.unitPrice > 0)) fail(`Add your price for ${line.name}.`);
        const substitute = it.substitute?.trim().slice(0, 120);
        if (items.some((x) => x.lineId === line.id)) fail(`${line.name} is listed twice.`);
        items.push({ lineId: line.id, qty, unitPrice: Math.round(it.unitPrice), ...(substitute ? { substitute } : {}) });
      }
      if (!items.length) fail('Offer at least one item: tick it and add a quantity and price.');
      if (!(action.deliveryDays >= 0 && action.deliveryDays <= 14)) fail('Stock must be ready for pickup within 14 days.');
      withdrawVendorOffer(sp, v.id);
      sp.offers.push({ id: id('of'), vendorId: v.id, items, deliveryFee: 0, deliveryDays: Math.round(action.deliveryDays), note: action.note.trim().slice(0, 300), status: 'active', at: now });
      const full = items.length === Object.values(need).filter((q) => q > 0).length && items.every((i) => i.qty === need[i.lineId]);
      log(j, `${v.name} offered ${full ? 'the full list' : `${items.length} of ${sp.lines.length} items`}`, v.name);
      alertRep(j, `${v.name} sent a ${full ? 'full' : 'partial'} offer for ${sp.ref} (“${j.title}”).`);
      break;
    }
    case 'withdrawOffer': {
      const v = meAs('vendor');
      const sp = supplyOf(job(action.jobId));
      if (sp.plan?.allocations.some((a) => a.vendorId === v.id)) fail('Your offer is in a plan waiting for approval.');
      if (!sp.offers.some((o) => o.vendorId === v.id && o.status === 'active')) fail('You have no active offer here.');
      withdrawVendorOffer(sp, v.id);
      break;
    }
    case 'recommendPlan': {
      const j = job(action.jobId);
      const r = repFor(j);
      expect(j, 'awarded', 'materials_on_the_way');
      const sp = supplyOf(j);
      if (sp.plan) fail('A quotation is already with the client.');
      const opt = compareOffers(sp).find((o) => o.kind === action.kind && (action.kind === 'combined' || o.vendorId === action.vendorId)) || fail('That option is no longer available. Refresh the comparison.');
      const needsArtisan = opt.substitutions > 0;
      const delivery = Math.round(action.deliveryFee ?? 0);
      if (!(delivery >= 0 && delivery <= 500000)) fail('Enter the delivery fee (0 if Allyfe delivers free).');
      const total = opt.materials + delivery;
      sp.plan = {
        kind: opt.kind, allocations: opt.allocations, materials: opt.materials, delivery, total, due: planDue(j, total),
        substitutions: opt.substitutions, needsArtisan, recommendedAt: now,
      };
      syncSupply(j);
      const who = opt.vendorIds.map(name).join(' + ');
      log(j, `${r.name} picked ${opt.kind === 'single' ? 'one vendor' : 'a combination of vendors'} (${who}): materials ${formatNaira(opt.materials)} + delivery ${formatNaira(delivery)}${opt.complete ? '' : ' · partial, the rest stays in sourcing'}`, r.name);
      if (needsArtisan) {
        const subs = opt.allocations.filter((a) => a.substitute).map((a) => `${a.substitute} instead of ${sp.lines.find((l) => l.id === a.lineId)!.name}`);
        alert(j.artisanId!, `Substitute in the vendor list for “${j.title}”: ${subs.join('; ')}. Please check it is technically suitable.`, j.id);
      }
      alert(j.clientId, `${r.name} sent the materials quotation for “${j.title}”: pay ${formatNaira(sp.plan.due)} to start delivery.${needsArtisan ? ' It includes a substitute; the artisan has been asked to check it, or you can approve it yourself.' : ''}`, j.id);
      break;
    }
    case 'withdrawPlan': {
      const j = job(action.jobId);
      const r = repFor(j);
      const sp = supplyOf(j);
      if (!sp.plan) fail('There is no quotation to withdraw.');
      sp.plan = undefined;
      syncSupply(j);
      log(j, 'Materials quotation withdrawn', r.name);
      break;
    }
    case 'artisanReviewSupply': {
      const j = job(action.jobId);
      const a = assignedArtisan(j);
      const sp = supplyOf(j);
      const plan = sp.plan || fail('There is no materials plan to review.');
      if (!plan.needsArtisan) fail('This plan has no substitutes to check.');
      if (plan.artisanOkAt) fail('You have already confirmed this plan.');
      if (!action.ok) {
        if (!action.note.trim()) fail('Tell the representative what is wrong with the materials.');
        sp.plan = undefined;
        syncSupply(j);
        log(j, `Artisan rejected the substitutes: ${action.note.trim()}`, a.name);
        alertRep(j, `${a.name} rejected the substitutes for ${sp.ref}: “${action.note.trim()}”. Please re-source.`);
        break;
      }
      plan.artisanOkAt = now;
      log(j, 'Artisan confirmed the substitutes are technically suitable', a.name);
      alert(j.clientId, `The materials quotation for “${j.title}” is ready. Pay ${formatNaira(plan.due)} to start delivery.`, j.id);
      alertRep(j, `${a.name} confirmed the substitutes for ${sp.ref}. The quotation is with the client.`);
      break;
    }
    case 'clientReviewSupply': {
      const j = job(action.jobId);
      const c = ownClient(j);
      const sp = supplyOf(j);
      const plan = sp.plan || fail('There is no materials quotation to approve.');
      if (action.ok && plan.needsArtisan && !plan.artisanOkAt && !action.override) fail('The artisan has to confirm the substitutes first, or approve them yourself.');
      if (!action.ok) {
        sp.plan = undefined;
        syncSupply(j);
        log(j, `Client declined the materials quotation${action.note.trim() ? `: ${action.note.trim()}` : ''}`, c.name);
        alertRep(j, `${c.name} declined the quotation for ${sp.ref}${action.note.trim() ? `: “${action.note.trim()}”` : ''}. Please look for another option.`);
        break;
      }
      // Re-check nothing is allocated twice and every offer still stands, before taking money.
      const need = supplyNeed(sp);
      const usedFromOffer = new Map<string, number>();
      for (const al of plan.allocations) {
        const offer = sp.offers.find((o) => o.id === al.offerId && o.status === 'active') || fail('A vendor withdrew their offer. Your representative will send a new quotation.');
        const it = offer.items.find((i) => i.lineId === al.lineId)!;
        const k = offer.id + '|' + al.lineId;
        usedFromOffer.set(k, (usedFromOffer.get(k) ?? 0) + al.qty);
        if ((usedFromOffer.get(k) ?? 0) > it.qty) fail('An allocation exceeds what the vendor offered.');
        need[al.lineId] -= al.qty;
        if (need[al.lineId] < 0) fail('An item would be allocated twice. Your representative will send a new quotation.');
      }
      const due = planDue(j, plan.total);
      if (due > 0) {
        debit(c.id, due, `Materials${j.escrow < (j.serviceFee ?? 0) ? ' and workmanship' : ''} paid into Allyfe · ${j.title}`, 'hold');
        j.escrow += due;
      }
      plan.clientOkAt = now;
      sp.deliveryHeld = (sp.deliveryHeld ?? 0) + plan.delivery;
      if (plan.needsArtisan && !plan.artisanOkAt) {
        plan.clientOverrode = true;
        log(j, 'Client approved the substitutes without waiting for the artisan', c.name);
        alert(j.artisanId!, `${c.name} approved the substitute for “${j.title}” without waiting for your check. Please look at the materials when they arrive.`, j.id);
      }
      log(j, `Client approved the quotation and paid ${formatNaira(due)} into Allyfe`, c.name);
      // Payment made: one purchase order per vendor goes out straight away.
      const byVendor = new Map<string, PurchaseOrder['lines']>();
      for (const al of plan.allocations) {
        const line = sp.lines.find((l) => l.id === al.lineId)!;
        const list = byVendor.get(al.vendorId) ?? [];
        list.push({ lineId: al.lineId, name: al.substitute ? `${al.substitute} (instead of ${line.name})` : line.name, unit: line.unit, qty: al.qty, unitPrice: al.unitPrice, ...(al.substitute ? { substitute: al.substitute } : {}) });
        byVendor.set(al.vendorId, list);
      }
      for (const [vendorId, lines] of byVendor) {
        const fee = 0; // Allyfe collects from the vendor; the vendor charges no delivery.
        const order: PurchaseOrder = { id: id('po'), ref: `PO-${sp.ref.replace('SR-', '')}-${sp.orders.length + 1}`, vendorId, lines, deliveryFee: fee, status: 'issued', at: now };
        sp.orders.push(order);
        // The offered stock now lives in the purchase order.
        withdrawVendorOffer(sp, vendorId);
        alert(vendorId, `Purchase order ${order.ref}: ${formatNaira(lines.reduce((t, l) => t + l.qty * l.unitPrice, 0) + fee)}. Confirm your stock to reserve it; Allyfe will pick it up.`, j.id);
      }
      sp.plan = undefined;
      log(j, `${byVendor.size} purchase order${byVendor.size > 1 ? 's' : ''} issued by Allyfe Supply`, 'Allyfe Supply');
      syncSupply(j);
      alertRep(j, `${c.name} paid for ${sp.ref}. Purchase orders went to ${[...byVendor.keys()].map(name).join(' and ')}.`);
      if (j.artisanId) alert(j.artisanId, `${c.name} paid for the materials for “${j.title}”. Delivery is being arranged.`, j.id);
      break;
    }
    case 'confirmPO': {
      const v = meAs('vendor');
      const j = job(action.jobId);
      const o = po(j, action.poId);
      if (o.vendorId !== v.id) fail('This purchase order is for another vendor.');
      if (o.status !== 'issued') fail('You have already answered this purchase order.');
      let total = 0;
      for (const l of o.lines) {
        const q = Math.round(action.confirmed[l.lineId] ?? l.qty);
        if (!(q >= 0 && q <= l.qty)) fail(`Confirm between 0 and ${l.qty} for ${l.name}.`);
        l.confirmed = q;
        total += q;
      }
      if (!total) fail('You confirmed nothing. Use Decline instead.');
      o.status = 'confirmed';
      const short = o.lines.filter((l) => (l.confirmed ?? 0) < l.qty);
      log(j, `${v.name} confirmed ${o.ref} · stock reserved${short.length ? ` · ${short.map((l) => `${l.qty - (l.confirmed ?? 0)} ${l.name}`).join(', ')} returned to sourcing` : ''}`, v.name);
      if (short.length) alertRep(j, `${v.name} could only confirm part of ${o.ref}. ${short.length} item${short.length > 1 ? 's' : ''} returned to sourcing for ${supplyOf(j).ref}.`);
      syncSupply(j);
      break;
    }
    case 'declinePO': {
      const v = meAs('vendor');
      const j = job(action.jobId);
      const o = po(j, action.poId);
      if (o.vendorId !== v.id) fail('This purchase order is for another vendor.');
      if (o.status !== 'issued') fail('You have already answered this purchase order.');
      o.status = 'declined';
      log(j, `${v.name} declined ${o.ref}${action.note.trim() ? `: ${action.note.trim()}` : ''} · items returned to sourcing`, v.name);
      alertRep(j, `${v.name} declined ${o.ref}. The items are back in sourcing for ${supplyOf(j).ref}.`);
      syncSupply(j);
      break;
    }
    case 'dispatchPO': {
      // The representative arranges pickup from the vendor and delivery to site.
      const j = job(action.jobId);
      const r = repFor(j);
      const o = po(j, action.poId);
      if (o.status !== 'confirmed') fail('The vendor has to confirm the stock before it can be picked up.');
      if (!action.waybill.trim()) fail('Add the delivery details (rider, vehicle, phone, time) so the client knows what to expect.');
      o.status = 'dispatched';
      o.waybill = action.waybill.trim();
      log(j, `${o.ref} picked up from ${name(o.vendorId)} · ${o.waybill}`, r.name);
      syncSupply(j);
      alert(o.vendorId, `Allyfe is collecting ${o.ref}: ${o.waybill}. Hand over the reserved stock.`, j.id);
      alert(j.clientId, `Your materials for “${j.title}” are on the way (${o.ref}): ${o.waybill}. Check each item when it arrives.`, j.id);
      break;
    }
    case 'receivePO': {
      const j = job(action.jobId);
      const c = ownClient(j);
      const sp = supplyOf(j);
      const o = po(j, action.poId);
      if (o.status !== 'dispatched') fail('This delivery is not on its way yet.');
      let paid = o.deliveryFee;
      const short: string[] = [];
      for (const l of o.lines) {
        const max = l.confirmed ?? l.qty;
        const q = Math.round(action.received[l.lineId] ?? max);
        if (!(q >= 0 && q <= max)) fail(`Enter between 0 and ${max} for ${l.name}.`);
        l.received = q;
        paid += q * l.unitPrice;
        sp.lines.find((x) => x.id === l.lineId)!.delivered += q;
        if (q < max) short.push(`${max - q} ${l.name}`);
      }
      if (paid - o.deliveryFee <= 0) fail('Nothing received. If the delivery is wrong, refuse it instead.');
      o.status = 'received';
      o.paid = paid;
      j.escrow -= paid;
      credit(o.vendorId, paid, `Materials · ${o.ref} · ${j.title}`);
      txn(c.id, `Materials paid to ${name(o.vendorId)} (${o.ref})`, paid, 'out');
      log(j, `Client received ${o.ref} · ${formatNaira(paid)} paid to ${name(o.vendorId)}${short.length ? ` · short: ${short.join(', ')} (returned to sourcing)` : ''}`, c.name);
      alert(o.vendorId, `${c.name} received ${o.ref}. ${formatNaira(paid)} is in your wallet.${short.length ? ` Short: ${short.join(', ')}.` : ''}`, j.id);
      if (short.length) alertRep(j, `${o.ref} arrived short (${short.join(', ')}). Those items are back in sourcing for ${sp.ref}.`);
      syncSupply(j);
      break;
    }
    case 'refusePO': {
      const j = job(action.jobId);
      const c = ownClient(j);
      const sp = supplyOf(j);
      const o = po(j, action.poId);
      if (o.status !== 'dispatched') fail('You can refuse a delivery once it is on its way.');
      if (!(MATERIAL_REJECT_REASONS as readonly string[]).includes(action.reason)) fail('Choose a reason from the list.');
      if (action.reason === 'Other' && !action.note.trim()) fail('Tell the vendor what is wrong with the materials.');
      o.status = 'refused';
      o.refusal = { reason: action.reason, note: action.note.trim(), at: now };
      withdrawVendorOffer(sp, o.vendorId);
      log(j, `Client refused ${o.ref}: ${action.reason} · items returned to sourcing`, c.name);
      alert(o.vendorId, `${c.name} did NOT accept ${o.ref} for “${j.title}”: ${action.reason}${action.note.trim() ? ` (“${action.note.trim()}”)` : ''}. Under your vendor contract you take the goods back: Allyfe's rider will return them to your shop. Confirm when you have them. This delivery is not paid.`, j.id);
      alertRep(j, `${c.name} refused ${o.ref} (${action.reason}). The items are back in sourcing for ${sp.ref}.`);
      alert(j.artisanId!, `${c.name} refused a materials delivery for “${j.title}” (${action.reason}). Allyfe Supply is re-sourcing it.`, j.id);
      syncSupply(j);
      break;
    }
    case 'collectRefusedPO': {
      const v = meAs('vendor');
      const j = job(action.jobId);
      const o = po(j, action.poId);
      if (o.vendorId !== v.id || o.status !== 'refused' || !o.refusal) fail('There is nothing to collect for this order.');
      if (o.refusal!.pickedUpAt) fail('Already marked as collected.');
      o.refusal!.pickedUpAt = now;
      log(j, `${v.name} got the refused goods of ${o.ref} back`, v.name);
      alert(j.clientId, `The materials you refused (${o.ref}) are back with the vendor.`, j.id);
      alertRep(j, `${v.name} confirmed the refused goods of ${o.ref} are back in their shop.`);
      break;
    }

    case 'sendSupplyMessage': {
      const j = job(action.jobId);
      const sp = supplyOf(j);
      const u = me();
      const text = action.text.trim().slice(0, 500);
      if (!text) fail('Type a message.');
      let thread = action.thread;
      if (u.role === 'client') {
        ownClient(j);
        thread = 'client';
      } else if (u.role === 'vendor') {
        const v = u;
        if (!sp.orders.some((o) => o.vendorId === v.id) && !sp.offers.some((o) => o.vendorId === v.id) && !vendorServes(v, j)) fail('This request is not for your shop.');
        thread = v.id;
      } else if (u.role === 'rep') {
        repFor(j);
        if (thread !== 'client' && s.users[thread]?.role !== 'vendor') fail('Choose the client or a vendor to message.');
      } else fail('Artisans talk to the client about the work. Materials go through the Allyfe representative.');
      const repId = sp.repId || fail('No representative has picked up this request yet.');
      sp.messages.push({ id: id('m'), thread, from: u.id, text, at: now });
      const to = u.role === 'rep' ? (thread === 'client' ? j.clientId : thread) : repId;
      alert(to, `${u.role === 'rep' ? `${u.name} (Allyfe representative)` : u.role === 'vendor' ? u.name : `${u.name} (client)`} · ${sp.ref}: “${text.length > 80 ? text.slice(0, 77) + '…' : text}”`, j.id);
      break;
    }
    case 'rateRep': {
      const j = job(action.jobId);
      const c = ownClient(j);
      const sp = supplyOf(j);
      if (sp.status !== 'complete') fail('You can review your representative once all the materials have arrived.');
      if (sp.repRating) fail('You have already reviewed your representative for this job.');
      const repId = sp.repId || fail('No representative handled this job.');
      const stars = Math.round(action.stars);
      if (!(stars >= 1 && stars <= 5)) fail('Choose 1 to 5 stars.');
      const r = s.users[repId] as Rep;
      [r.rating, r.ratingCount] = addRating(r.rating ?? 0, r.ratingCount ?? 0, stars);
      sp.repRating = { stars, text: action.text.trim().slice(0, 300), at: now };
      log(j, `Client rated the representative ★ ${stars}`, c.name);
      alert(r.id, `${c.name} rated how you handled ${sp.ref} ★ ${stars}${sp.repRating.text ? `: “${sp.repRating.text}”` : '.'}`, j.id);
      break;
    }

    /* ---------- the work ---------- */
    case 'startWork': {
      const j = job(action.jobId);
      const a = assignedArtisan(j);
      expect(j, 'ready');
      if (!isOnOrAfterDay(j.scheduledDay!, now)) fail(`You can start on the scheduled day, ${j.scheduledDay}.`);
      j.status = 'in_progress';
      log(j, 'Work started', a.name);
      alert(j.clientId, `${a.name} has started work on “${j.title}”.`, j.id);
      break;
    }
    case 'flagMisdescribed': {
      const j = job(action.jobId);
      const a = assignedArtisan(j);
      expect(j, 'ready');
      const split = misdescribedSplit(j.serviceFee!);
      credit(a.id, split.artisan, `Visit fee (10% of service fee) · ${j.title}`);
      txn(j.clientId, `10% of service fee to ${a.name} for the visit`, split.artisan, 'out');
      j.escrow -= split.artisan;
      refundEscrow(j, `Refund · ${j.title}`);
      j.status = 'not_as_described';
      log(j, 'Artisan found the job not as described', a.name);
      alert(j.clientId, `${a.name} found “${j.title}” different from your description. ${formatNaira(split.artisan)} went to them for the visit and ${formatNaira(split.clientRefund)} came back to you. The materials stay with you.`, j.id);
      break;
    }
    case 'finishWork': {
      const j = job(action.jobId);
      const a = assignedArtisan(j);
      expect(j, 'in_progress');
      j.status = j.tier === 'Premium' ? 'supervisor_check' : 'awaiting_client';
      log(j, j.tier === 'Premium' ? 'Work finished · supervisor inspecting' : 'Work finished', a.name);
      alert(j.clientId, `${a.name} has finished “${j.title}”. ${j.tier === 'Premium' ? 'Your Allyfe supervisor is inspecting it.' : 'Check the work and tap Job done to pay them.'}`, j.id);
      break;
    }
    case 'supervisorApprove': {
      const j = job(action.jobId);
      expect(j, 'supervisor_check');
      j.status = 'awaiting_client';
      log(j, 'Supervisor approved the work', 'Allyfe supervisor');
      alert(j.clientId, `Your Allyfe supervisor approved the work on “${j.title}”. Tap Job done to pay the artisan.`, j.id);
      break;
    }
    case 'notFinished': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'awaiting_client');
      j.status = 'in_progress';
      log(j, 'Client says the work is not finished', c.name);
      alert(j.artisanId!, `${c.name} says “${j.title}” is not finished yet.`, j.id);
      break;
    }
    case 'raiseConcern': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'awaiting_client', 'not_as_described', 'in_progress', 'no_show');
      j.status = 'disputed';
      log(j, 'Concern raised · Allyfe is reviewing', c.name);
      if (j.artisanId) alert(j.artisanId, `${c.name} raised a concern on “${j.title}”. An Allyfe admin will contact you.`, j.id);
      break;
    }
    case 'completeJob': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'awaiting_client');
      const split = completionSplit(j);
      const a = s.users[j.artisanId!] as Artisan;
      credit(a.id, split.artisan, `Service fee · ${j.title} (after ${split.rate} Allyfe fee)`);
      credit(ALLYFE_ACCOUNT, split.platform, `${split.rate} fee · ${j.tier} job ${j.ref}`);
      a.jobsDone += 1;
      txn(c.id, `Service fee released · ${j.title}`, j.escrow, 'out');
      j.escrow = 0;
      j.status = 'completed';
      log(j, 'Job done · artisan paid', c.name);
      alert(a.id, `${c.name} confirmed the work. ${formatNaira(split.artisan)} is in your wallet (${formatNaira(split.serviceFee)} service fee minus the ${split.rate} Allyfe fee).`, j.id);
      break;
    }
    case 'rateJob': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'completed');
      if (j.rating) fail('You have already rated this job.');
      const stars = jobStars(action.work, action.attitude);
      const a = s.users[j.artisanId!] as Artisan;
      [a.rating, a.ratingCount] = addRating(a.rating, a.ratingCount, stars);
      j.rating = { work: action.work, attitude: action.attitude, stars, text: action.text.trim(), at: now };
      log(j, `Rated ★ ${stars}`, c.name);
      alert(a.id, `${c.name} rated you ★ ${stars} for “${j.title}”${action.text.trim() ? `: “${action.text.trim()}”` : '.'}`, j.id);
      break;
    }

    /* ---------- no-shows, refunds and replacements ---------- */
    case 'reportNoShow': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'ready');
      if (!isOnOrAfterDay(j.scheduledDay!, now)) fail(`The artisan is due on ${j.scheduledDay}. You can report a no-show from that day.`);
      const a = s.users[j.artisanId!] as Artisan;
      [a.rating, a.ratingCount] = addRating(a.rating, a.ratingCount, NO_SHOW_STARS);
      j.noShows.push({ artisanId: a.id, at: now });
      j.status = 'no_show';
      log(j, `${a.name} didn't show up · rated ★ ${NO_SHOW_STARS}`, c.name);
      alert(a.id, `${c.name} reported that you didn't show up for “${j.title}”. A 1★ rating was added to your profile.`, j.id);
      break;
    }
    case 'requestRefund': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'no_show', 'awarded');
      const sp = j.supply;
      if (sp && j.status === 'awarded') {
        if (sp.orders.some((o) => o.status === 'dispatched')) fail('Some materials are already on the way. Receive or refuse them first.');
        for (const o of sp.orders.filter((x) => ['issued', 'confirmed'].includes(x.status))) {
          o.status = 'cancelled';
          alert(o.vendorId, `${c.name} cancelled “${j.title}”. Purchase order ${o.ref} is cancelled; please don't send the materials.`, j.id);
        }
        if (sp.plan?.clientOkAt) sp.plan = undefined;
        sp.plan = undefined;
        sp.offers.forEach((o) => (o.status = 'withdrawn'));
        sp.status = 'cancelled';
        alertRep(j, `${c.name} cancelled “${j.title}”. Supply ${sp.ref} is closed.`);
      }
      const amount = j.escrow;
      refundEscrow(j, `Refund · ${j.title}`);
      j.status = 'refunded';
      log(j, `Refund of ${formatNaira(amount)}${j.deliveredMaterials.length ? ' · delivered materials are not refundable' : ''}`, c.name);
      if (j.artisanId && j.noShows.every((x) => x.artisanId !== j.artisanId)) alert(j.artisanId, `${c.name} cancelled “${j.title}”.`, j.id);
      break;
    }
    case 'chooseAnotherArtisan': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'no_show');
      j.status = 'open';
      j.artisanId = undefined;
      j.acceptedBidId = undefined;
      j.scheduledDay = undefined;
      j.serviceFee = undefined;
      j.supply = undefined;
      j.invitedArtisanId = undefined;
      const earliest = earliestWorkDay(now);
      j.preferredDays = j.preferredDays.filter((x) => x >= earliest);
      if (!j.preferredDays.length) j.preferredDays = [earliest];
      log(j, `Looking for another artisan · ${formatNaira(j.escrow)} still held`, c.name);
      artisansFor(j).forEach((a) => alert(a.id, `A ${serviceName(j.category).toLowerCase()} job in ${j.city} needs a new artisan: “${j.title}”. Some materials are already on site.`, j.id));
      break;
    }
    case 'demoStartDay': {
      const j = job(action.jobId);
      if (!j.scheduledDay) fail('This job has no scheduled day yet.');
      j.scheduledDay = today;
      log(j, 'Demo: moved the scheduled day to today', 'Allyfe');
      break;
    }

    /* ---------- profile, team & apprentices ---------- */
    case 'updateProfile': {
      const a = meAs('artisan');
      a.kind = action.kind;
      if (action.kind === 'team') {
        if (!action.teamName.trim()) fail('Give your team a name.');
        const members = action.teamMembers.map((m) => m.trim()).filter(Boolean);
        if (members.length < 2) fail('A team needs at least 2 members.');
        a.teamName = action.teamName.trim();
        a.teamMembers = members;
      } else {
        a.teamName = undefined;
        a.teamMembers = [];
      }
      a.bio = action.bio.trim() || a.bio;
      if (action.specialisations) {
        const allowed = new Set(JOB_ROLES.filter((r) => a.categories.includes(r.role)).flatMap((r) => r.specialisations));
        a.specialisations = [...new Set(action.specialisations)].filter((x) => allowed.has(x));
      }
      break;
    }
    case 'addApprentice': {
      const a = meAs('artisan');
      if (!action.name.trim()) fail("Add your apprentice's name.");
      const phone = action.phone.replace(/\D/g, '');
      if (phone.length < 10) fail("Add your apprentice's phone number. It links your work to their profile later.");
      if (!action.photo) fail('Add a photo of your apprentice.');
      if (a.apprentices.some((x) => x.phone.replace(/\D/g, '') === phone)) fail('That apprentice is already on your list.');
      const ap: Apprentice = { id: id('ap'), name: action.name.trim(), phone: action.phone.trim(), photo: action.photo, addedAt: now };
      a.apprentices.push(ap);
      break;
    }
    case 'removeApprentice': {
      const a = meAs('artisan');
      a.apprentices = a.apprentices.filter((x) => x.id !== action.apprenticeId);
      break;
    }

    /* ---------- verification ---------- */
    case 'addVerificationFile': {
      const u = me();
      if (u.role === 'client' || u.role === 'rep') return fail('This account does not need verification.');
      if (u.verification.status === 'review' || u.verification.status === 'verified') fail('Your documents are already submitted.');
      u.verification.files[action.key] = action.image;
      u.verification.status = 'partial';
      break;
    }
    case 'submitVerification': {
      const u = me();
      if (u.role === 'client' || u.role === 'rep') return fail('This account does not need verification.');
      const needed = VERIFICATION_ITEMS[u.role].map((i) => i.key);
      if (!needed.every((k) => u.verification.files[k])) fail('Add every photo before submitting.');
      u.verification.status = 'review';
      break;
    }
    case 'approveVerification': {
      const u = s.users[action.userId];
      if (!u || u.role === 'client' || u.role === 'rep') return fail('Nothing to approve.');
      if (u.verification.status !== 'review') fail('Submit the documents first.');
      u.verification.status = 'verified';
      alert(u.id, u.role === 'artisan' ? 'You are verified. Clients can now find you and you can bid on jobs.' : `${u.name} is verified.`);
      break;
    }

    /* ---------- feed ---------- */
    case 'createPost': {
      const u = me();
      if (u.role !== 'artisan' && u.role !== 'vendor') fail('Only artisans and vendors can post to the feed.');
      if (!action.text.trim()) fail('Add a caption first.');
      let stock: StockItem | undefined;
      if (action.stock) {
        if (u.role !== 'vendor') fail('Only vendors can list materials for sale.');
        if (!action.stock.name.trim()) fail('Name the material.');
        if (!(action.stock.price > 0)) fail('Add a price.');
        stock = { name: action.stock.name.trim(), price: Math.round(action.stock.price), unit: action.stock.unit.trim() || 'piece' };
      }
      s.posts.unshift({ id: id('p'), authorId: u.id, image: action.image, text: action.text.trim(), likes: [], comments: [], at: now, ...(stock ? { stock } : {}) });
      break;
    }
    case 'toggleLike': {
      const u = me();
      const p = s.posts.find((x) => x.id === action.postId) || fail('Post not found.');
      const i = p.likes.indexOf(u.id);
      if (i >= 0) p.likes.splice(i, 1);
      else {
        p.likes.push(u.id);
        if (p.authorId !== u.id) alert(p.authorId, `${u.name} liked your post.`);
      }
      break;
    }
    case 'addComment': {
      const u = me();
      const p = s.posts.find((x) => x.id === action.postId) || fail('Post not found.');
      if (!action.text.trim()) fail('Write a comment first.');
      p.comments.push({ id: id('cm'), authorId: u.id, text: action.text.trim(), at: now });
      if (p.authorId !== u.id) alert(p.authorId, `${first(u.id)} commented: “${action.text.trim()}”`);
      break;
    }
    case 'markAlertsRead': {
      const u = me();
      (s.alerts[u.id] ?? []).forEach((a) => (a.read = true));
      break;
    }
  }
  return s;
}

/** Wallet that collects Allyfe's company fees. */
/** Short city code at the start of job numbers, e.g. PH-4201, AB-4202. */
const CITY_CODE: Record<City, string> = { 'Port Harcourt': 'PH', Lagos: 'LA', Abuja: 'AB', Aba: 'AA' };

export const ALLYFE_ACCOUNT = 'allyfe';

/** A vendor gets a materials request only if verified, in the same city, and selling that kind of material. */
export const vendorServes = (v: Vendor, j: Pick<Job, 'city' | 'category'>) => v.verification.status === 'verified' && v.city === j.city && v.categories.includes(j.category);

export const VERIFICATION_ITEMS: Record<'artisan' | 'vendor', { key: string; title: string; hint: string }[]> = {
  artisan: [
    { key: 'id', title: 'Government ID', hint: "NIN slip, driver's licence or voter's card" },
    { key: 'selfie', title: 'Selfie holding your ID', hint: 'So we know the ID is yours' },
    { key: 'w1', title: 'Past work photo 1', hint: 'A job you did yourself' },
    { key: 'w2', title: 'Past work photo 2', hint: 'Another finished job' },
    { key: 'w3', title: 'Past work photo 3', hint: 'Before and after works well' },
  ],
  vendor: [
    { key: 'cac', title: 'CAC or market association certificate', hint: 'Photo or scan of the certificate' },
    { key: 'shop', title: 'Photo of your shop', hint: 'Showing your signboard and market' },
    { key: 'owner', title: 'Owner ID', hint: "NIN slip, driver's licence or passport" },
    { key: 'w1', title: 'Photo of your stock', hint: 'Materials you sell' },
  ],
};
