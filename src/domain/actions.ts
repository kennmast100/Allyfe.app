import type { AppState, Apprentice, Artisan, Category, City, Company, ImageRef, Job, QuoteLine, Tier, ToolKind, TxnKind, User, Vendor } from './types';
import {
  MIN_DESCRIPTION,
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
  jobToolCost,
  linesTotal,
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
};

export type BidDraft = { lines: QuoteLine[]; serviceFee: number; day: string; message: string };

export type Action =
  | { type: 'signIn'; userId: string }
  | { type: 'signOut' }
  | { type: 'reset' }
  | { type: 'toggleFavourite'; artisanId: string }
  | { type: 'topUp'; amount: number }
  | { type: 'withdraw'; amount: number }
  | { type: 'postJob'; draft: JobDraft }
  | { type: 'cancelJob'; jobId: string }
  | { type: 'submitBid'; jobId: string; bid: BidDraft }
  | { type: 'acceptBid'; jobId: string; bidId: string }
  | { type: 'vendorAcceptOrder'; jobId: string }
  | { type: 'vendorDispatch'; jobId: string; waybill: string }
  | { type: 'confirmMaterials'; jobId: string }
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
  | { type: 'updateProfile'; kind: 'individual' | 'team'; teamName: string; teamMembers: string[]; bio: string }
  | { type: 'addApprentice'; name: string; phone: string; photo: ImageRef }
  | { type: 'removeApprentice'; apprenticeId: string }
  | { type: 'addVerificationFile'; key: string; image: ImageRef }
  | { type: 'submitVerification' }
  | { type: 'approveVerification'; userId: string }
  | { type: 'requestRental'; toolId: string; days: number; jobId?: string }
  | { type: 'respondRental'; rentalId: string; approve: boolean }
  | { type: 'addTool'; name: string; pricePerDay: number; kind: ToolKind }
  | { type: 'createPost'; image: ImageRef; text: string }
  | { type: 'toggleLike'; postId: string }
  | { type: 'addComment'; postId: string; text: string }
  | { type: 'markAlertsRead' };

/** Actions that only change this device's session and never go to the server. */
export const LOCAL_ONLY_ACTIONS: Action['type'][] = ['signIn', 'signOut'];
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
    if (u.role !== role) fail(`Only ${role === 'company' ? 'tool companies' : role + 's'} can do that.`);
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
  const vendorsIn = (city: City) => Object.values(s.users).filter((u): u is Vendor => u.role === 'vendor' && u.city === city && u.verification.status === 'verified');
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
      if (u.role === 'artisan' || u.role === 'vendor') fail('Top-ups are for clients and tool companies. You are paid through jobs.');
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
      if (!d.title.trim()) fail('Add a short job title so artisans know what you need.');
      if (d.desc.trim().length < MIN_DESCRIPTION) fail(`Describe the job in more detail (at least ${MIN_DESCRIPTION} characters): sizes, quantities, what is broken and what you want.`);
      if (!d.addr.trim()) fail('Add the address where the work will happen.');
      if (!d.preferredDays.length) fail('Pick at least one day for the work.');
      const earliest = earliestWorkDay(now);
      if (d.preferredDays.some((x) => x < earliest)) fail('Work can only be booked at least 24 hours after you post, so vendors can buy and deliver the materials.');
      if (!d.honest) fail('Tick the box to confirm your description is truthful.');
      const j: Job = {
        id: id('j'), ref: 'PH-' + (4200 + s.seq), clientId: c.id, city: c.city, title: d.title.trim(), desc: d.desc.trim(), addr: d.addr.trim(), category: d.category, tier: d.tier,
        preferredDays: d.preferredDays.slice().sort(), media: d.media, status: 'open', bids: [], invitedArtisanId: d.invitedArtisanId,
        escrow: 0, deliveredMaterials: [], noShows: [], history: [], createdAt: now,
      };
      log(j, 'Job posted', c.name);
      s.jobs.unshift(j);
      const targets = d.invitedArtisanId ? [d.invitedArtisanId] : artisansFor(j).map((a) => a.id);
      targets.forEach((aid) => alert(aid, d.invitedArtisanId ? `${c.name} wants you for “${j.title}”. Send your quotation.` : `New ${d.category.toLowerCase()} job in ${c.city}: “${j.title}”. Read it and send your quotation.`, j.id));
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
          if (!(l.unitPrice > 0)) fail(`Add a price for ${l.name.trim()}.`);
          return { key: customKey(l.name), name: l.name.trim(), unit: l.unit.trim() || 'item', unitPrice: Math.round(l.unitPrice), qty };
        }
        const item = catalogItem(j.category, l.key) || fail('One of the materials is not on the list for this job type.');
        return { key: item.key, name: item.name, unit: item.unit, unitPrice: item.price, qty };
      });
      if (!(b.serviceFee > 0)) fail('Set your service fee.');
      if (!j.preferredDays.includes(b.day)) fail('Pick one of the days the client chose.');
      if (b.day < today) fail('That day has passed. Pick another.');
      j.bids.push({ id: id('b'), artisanId: a.id, lines, serviceFee: Math.round(b.serviceFee), day: b.day, message: b.message.trim(), status: 'pending', at: now });
      alert(j.clientId, `${a.name} sent a quotation of ${formatNaira(linesTotal(lines) + b.serviceFee)} for “${j.title}”.`, j.id);
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
      j.escrow = charge.total;
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
      log(j, `Accepted ${name(b.artisanId)}'s bid · ${formatNaira(charge.total)} held by Allyfe`, c.name);
      if (charge.billable.length) {
        j.materialsOrder = { id: id('o'), lines: charge.billable, total: charge.materials, status: 'open', at: now };
        j.status = 'awarded';
        vendorsIn(j.city).forEach((v) => alert(v.id, `New materials request in ${j.city}: ${formatNaira(charge.materials)} for “${j.title}”.`, j.id));
        alert(b.artisanId, `${c.name} accepted your bid for “${j.title}”. A vendor will deliver the materials; you start on ${b.day}.`, j.id);
      } else {
        j.materialsOrder = undefined;
        j.status = 'ready';
        log(j, 'All materials already at the client’s home', 'Allyfe');
        alert(b.artisanId, `${c.name} accepted your bid for “${j.title}”. Materials are already on site. Start on ${b.day}. Address: ${j.addr}.`, j.id);
      }
      break;
    }

    /* ---------- vendors ---------- */
    case 'vendorAcceptOrder': {
      const v = meAs('vendor');
      const j = job(action.jobId);
      expect(j, 'awarded');
      const o = j.materialsOrder!;
      if (v.verification.status !== 'verified') fail('Finish verification before taking orders.');
      if (v.city !== j.city) fail(`This order is in ${j.city}. You supply ${v.city}.`);
      if (o.status !== 'open') fail('Another vendor has already taken this order.');
      o.status = 'accepted';
      o.vendorId = v.id;
      log(j, `${v.name} is supplying the materials`, v.name);
      alert(j.clientId, `${v.name} will deliver the materials for “${j.title}” to your home.`, j.id);
      alert(j.artisanId!, `${v.name} is supplying the materials for “${j.title}”.`, j.id);
      vendorsIn(j.city).filter((x) => x.id !== v.id).forEach((x) => alert(x.id, `The materials request for “${j.title}” was taken by another vendor.`, j.id));
      break;
    }
    case 'vendorDispatch': {
      const v = meAs('vendor');
      const j = job(action.jobId);
      expect(j, 'awarded');
      const o = j.materialsOrder!;
      if (o.vendorId !== v.id) fail('This order belongs to another vendor.');
      if (!action.waybill.trim()) fail('Add the waybill or rider details so the client knows what to expect.');
      o.status = 'dispatched';
      o.waybill = action.waybill.trim();
      j.status = 'materials_on_the_way';
      log(j, `Materials dispatched · ${o.waybill}`, v.name);
      alert(j.clientId, `Materials for “${j.title}” are on the way: ${o.waybill}. Tap “I’ve received the materials” when they arrive.`, j.id);
      break;
    }
    case 'confirmMaterials': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'materials_on_the_way');
      const o = j.materialsOrder!;
      o.status = 'delivered';
      j.escrow -= o.total;
      credit(o.vendorId!, o.total, `Materials · ${j.title}`);
      txn(c.id, `Materials paid to ${name(o.vendorId!)}`, o.total, 'out');
      j.deliveredMaterials.push(...o.lines);
      j.status = 'ready';
      log(j, 'Client received the materials', c.name);
      alert(o.vendorId!, `${c.name} received the materials. ${formatNaira(o.total)} is in your wallet.`, j.id);
      alert(j.artisanId!, `Materials for “${j.title}” are at the client's home. Go and start work on ${j.scheduledDay}. Address: ${j.addr}.`, j.id);
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
      credit(a.id, split.artisan, `Visit fee (50% of service fee) · ${j.title}`);
      txn(j.clientId, `50% of service fee to ${a.name} for the visit`, split.artisan, 'out');
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
      const split = completionSplit(j, s.rentals);
      split.companies.forEach((x) => {
        const r = s.rentals.find((y) => y.id === x.rentalId)!;
        const tool = s.tools.find((t) => t.id === r.toolId);
        r.status = 'paid';
        credit(x.companyId, x.amount, `Rental · ${tool?.name ?? 'tool'} · job ${j.ref}`);
        alert(x.companyId, `${formatNaira(x.amount)} credited for the ${tool?.name ?? 'tool'} rental.`);
      });
      s.rentals.filter((r) => r.jobId === j.id && r.status === 'requested').forEach((r) => (r.status = 'declined'));
      const a = s.users[j.artisanId!] as Artisan;
      credit(a.id, split.artisan, `Service fee · ${j.title}`);
      a.jobsDone += 1;
      txn(c.id, `Service fee released · ${j.title}`, j.escrow, 'out');
      j.escrow = 0;
      j.status = 'completed';
      log(j, 'Job done · artisan paid', c.name);
      alert(a.id, `${c.name} confirmed the work. ${formatNaira(split.artisan)} is in your wallet.`, j.id);
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
      const o = j.materialsOrder;
      if (j.status === 'awarded' && o?.status === 'accepted') {
        alert(o.vendorId!, `${c.name} cancelled “${j.title}” before delivery. Please don't send the materials.`, j.id);
      }
      if (o && o.status !== 'delivered') o.status = 'cancelled';
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
      j.materialsOrder = undefined;
      j.invitedArtisanId = undefined;
      const earliest = earliestWorkDay(now);
      j.preferredDays = j.preferredDays.filter((x) => x >= earliest);
      if (!j.preferredDays.length) j.preferredDays = [earliest];
      log(j, `Looking for another artisan · ${formatNaira(j.escrow)} still held`, c.name);
      artisansFor(j).forEach((a) => alert(a.id, `A ${j.category.toLowerCase()} job in ${j.city} needs a new artisan: “${j.title}”. Some materials are already on site.`, j.id));
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
      if (u.role === 'client') return fail('Clients do not need verification.');
      if (u.verification.status === 'review' || u.verification.status === 'verified') fail('Your documents are already submitted.');
      u.verification.files[action.key] = action.image;
      u.verification.status = 'partial';
      break;
    }
    case 'submitVerification': {
      const u = me();
      if (u.role === 'client') return fail('Clients do not need verification.');
      const needed = VERIFICATION_ITEMS[u.role].map((i) => i.key);
      if (!needed.every((k) => u.verification.files[k])) fail('Add every photo before submitting.');
      u.verification.status = 'review';
      break;
    }
    case 'approveVerification': {
      const u = s.users[action.userId];
      if (!u || u.role === 'client') return fail('Nothing to approve.');
      if (u.verification.status !== 'review') fail('Submit the documents first.');
      u.verification.status = 'verified';
      alert(u.id, u.role === 'artisan' ? 'You are verified. Clients can now find you and you can bid on jobs.' : `${u.name} is verified.`);
      break;
    }

    /* ---------- tool store ---------- */
    case 'requestRental': {
      const a = meAs('artisan');
      const tool = s.tools.find((t) => t.id === action.toolId) || fail('That tool is no longer listed.');
      const co = s.users[tool.companyId] as Company;
      if (co.verification.status !== 'verified') fail('This company is not verified yet.');
      if (!(action.days >= 1)) fail('Pick how many days.');
      const fee = tool.pricePerDay * action.days;
      if (action.jobId) {
        const j = job(action.jobId);
        assignedArtisan(j);
        expect(j, 'in_progress');
        const committed = jobToolCost(j.id, s.rentals) + s.rentals.filter((r) => r.jobId === j.id && r.status === 'requested').reduce((t, r) => t + r.fee, 0);
        if (committed + fee > j.escrow) fail('Tool rentals cannot cost more than your service fee.');
      } else {
        debit(a.id, fee, `Rental held · ${tool.name}`, 'hold');
      }
      s.rentals.unshift({ id: id('r'), toolId: tool.id, companyId: co.id, artisanId: a.id, days: action.days, fee, jobId: action.jobId, status: 'requested', at: now });
      alert(co.id, `${a.name} wants to rent your ${tool.name} for ${action.days} day${action.days > 1 ? 's' : ''}.`);
      break;
    }
    case 'respondRental': {
      const co = meAs('company');
      const r = s.rentals.find((x) => x.id === action.rentalId) || fail('Request not found.');
      if (r.companyId !== co.id) fail('This request is for another company.');
      if (r.status !== 'requested') fail('You already answered this request.');
      const tool = s.tools.find((t) => t.id === r.toolId)!;
      if (action.approve) {
        r.status = r.jobId ? 'approved' : 'paid';
        if (!r.jobId) credit(co.id, r.fee, `Rental · ${tool.name}`);
        alert(r.artisanId, `${co.name} approved your ${tool.name} rental. Pick it up with your Allyfe ID.`);
      } else {
        r.status = 'declined';
        if (!r.jobId) credit(r.artisanId, r.fee, `Rental refund · ${tool.name}`);
        alert(r.artisanId, `${co.name} could not rent you the ${tool.name}.${r.jobId ? '' : ' Your money is back in your wallet.'}`);
      }
      break;
    }
    case 'addTool': {
      const co = meAs('company');
      if (!action.name.trim()) fail('Add the tool name.');
      if (!(action.pricePerDay > 0)) fail('Add a daily price.');
      s.tools.push({ id: id('t'), companyId: co.id, name: action.name.trim(), kind: action.kind, pricePerDay: Math.round(action.pricePerDay) });
      break;
    }

    /* ---------- feed ---------- */
    case 'createPost': {
      const a = meAs('artisan');
      if (!action.text.trim()) fail('Add a caption first.');
      s.posts.unshift({ id: id('p'), authorId: a.id, image: action.image, text: action.text.trim(), likes: [], comments: [], at: now });
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

export const VERIFICATION_ITEMS: Record<'artisan' | 'company' | 'vendor', { key: string; title: string; hint: string }[]> = {
  artisan: [
    { key: 'id', title: 'Government ID', hint: "NIN slip, driver's licence or voter's card" },
    { key: 'selfie', title: 'Selfie holding your ID', hint: 'So we know the ID is yours' },
    { key: 'w1', title: 'Past work photo 1', hint: 'A job you did yourself' },
    { key: 'w2', title: 'Past work photo 2', hint: 'Another finished job' },
    { key: 'w3', title: 'Past work photo 3', hint: 'Before and after works well' },
  ],
  company: [
    { key: 'cac', title: 'CAC registration certificate', hint: 'Photo or scan of the certificate' },
    { key: 'shop', title: 'Photo of your shop or yard', hint: 'Showing your signboard' },
    { key: 'owner', title: 'Owner or manager ID', hint: "NIN slip, driver's licence or passport" },
    { key: 'w1', title: 'Photo of your tools', hint: 'With your company name visible' },
  ],
  vendor: [
    { key: 'cac', title: 'CAC or market association certificate', hint: 'Photo or scan of the certificate' },
    { key: 'shop', title: 'Photo of your shop', hint: 'Showing your signboard and market' },
    { key: 'owner', title: 'Owner ID', hint: "NIN slip, driver's licence or passport" },
    { key: 'w1', title: 'Photo of your stock', hint: 'Materials you sell' },
  ],
};
