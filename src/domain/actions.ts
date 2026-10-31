import type { AppState, Artisan, Category, Company, ImageRef, Job, Proposal, ProposalKind, Schedule, Tier, ToolKind, TxnKind, User } from './types';
import { addRating, artisanQualifies, completionSplit, formatNaira, jobToolCost, misdescribedSplit, tierPrices } from './rules';
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
  schedule: Schedule;
  photos: ImageRef[];
  honest: boolean;
  invitedArtisanId?: string;
};

export type Action =
  | { type: 'signIn'; userId: string }
  | { type: 'signOut' }
  | { type: 'reset' }
  | { type: 'toggleFavourite'; artisanId: string }
  | { type: 'topUp'; amount: number }
  | { type: 'withdraw'; amount: number }
  | { type: 'postJob'; draft: JobDraft }
  | { type: 'cancelJob'; jobId: string }
  | { type: 'submitProposal'; jobId: string; kind: ProposalKind; amount: number; message: string; startDay?: string }
  | { type: 'declineInvite'; jobId: string }
  | { type: 'confirmProposal'; jobId: string; proposalId: string }
  | { type: 'startWork'; jobId: string }
  | { type: 'flagMisdescribed'; jobId: string }
  | { type: 'markDone'; jobId: string }
  | { type: 'supervisorApprove'; jobId: string }
  | { type: 'notFinished'; jobId: string }
  | { type: 'raiseConcern'; jobId: string }
  | { type: 'completeJob'; jobId: string }
  | { type: 'submitReview'; jobId: string; stars: number; text: string }
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
    s.wallets[uid] = (s.wallets[uid] ?? 0) + amount;
    txn(uid, label, amount, 'in');
  };
  const debit = (uid: string, amount: number, label: string, kind: TxnKind = 'out') => {
    if ((s.wallets[uid] ?? 0) < amount) fail(`Your wallet needs ${formatNaira(amount - (s.wallets[uid] ?? 0))} more.`);
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
      if (u.role === 'artisan') fail('Artisans are paid through jobs. Top-ups are for clients and tool companies.');
      if (!(action.amount > 0)) fail('Enter an amount.');
      credit(u.id, action.amount, `Top-up from ${u.role === 'client' || u.role === 'company' ? u.bank.split(' ')[0] : 'bank'}`);
      break;
    }
    case 'withdraw': {
      const u = me();
      if (!(action.amount > 0)) fail('Enter an amount.');
      debit(u.id, action.amount, `Withdrawal to ${u.bank}`);
      break;
    }

    /* ---------- jobs ---------- */
    case 'postJob': {
      const c = meAs('client');
      const d = action.draft;
      if (!d.title.trim()) fail('Add a short job title so artisans know what you need.');
      if (!d.desc.trim()) fail('Describe the work so artisans know what to expect.');
      if (!d.addr.trim()) fail('Add the address where the work will happen.');
      if (d.schedule.mode === 'Flexible' && !d.schedule.days.length) fail('Pick at least one day on the calendar.');
      if (!d.honest) fail('Tick the box to confirm your description is truthful.');
      const deposit = tierPrices(d.category)[d.tier];
      const ref = 'PH-' + (4200 + s.seq);
      debit(c.id, deposit, `Held for · ${d.title.trim()}`, 'hold');
      const j: Job = {
        id: id('j'), ref, clientId: c.id, title: d.title.trim(), desc: d.desc.trim(), addr: d.addr.trim(), category: d.category, tier: d.tier,
        deposit, escrow: deposit, schedule: d.schedule, photos: d.photos, status: 'open', proposals: [], invitedArtisanId: d.invitedArtisanId,
        history: [], createdAt: now,
      };
      log(j, `${formatNaira(deposit)} paid into Allyfe`, c.name);
      s.jobs.unshift(j);
      const targets = d.invitedArtisanId
        ? [d.invitedArtisanId]
        : Object.values(s.users).filter((u): u is Artisan => u.role === 'artisan' && u.categories.includes(d.category) && artisanQualifies(u, d.tier)).map((a) => a.id);
      targets.forEach((aid) =>
        alert(aid, d.invitedArtisanId ? `${c.name} wants to book you: ${j.title}. ${formatNaira(deposit)} is held.` : `New ${d.category.toLowerCase()} job near you: ${j.title}.`, j.id),
      );
      break;
    }
    case 'cancelJob': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'open');
      credit(c.id, j.escrow, `Refund · ${j.title}`);
      j.escrow = 0;
      j.status = 'cancelled';
      log(j, 'Cancelled by client · deposit refunded', c.name);
      j.proposals.forEach((p) => p.status === 'pending' && alert(p.artisanId, `${c.name} cancelled “${j.title}”.`, j.id));
      break;
    }
    case 'submitProposal': {
      const a = meAs('artisan');
      const j = job(action.jobId);
      expect(j, 'open');
      if (a.verification.status !== 'verified') fail('Finish verification before applying for jobs.');
      if (j.invitedArtisanId && j.invitedArtisanId !== a.id) fail('This job was sent to a specific artisan.');
      if (!artisanQualifies(a, j.tier)) fail(`${j.tier} jobs need a rating of 4.7★ or more.`);
      if (j.proposals.some((p) => p.artisanId === a.id && p.status !== 'declined')) fail('You have already applied for this job.');
      const amount = action.kind === 'apply' ? j.deposit : Math.round(action.amount);
      if (!(amount > 0)) fail('Enter your price.');
      if (action.kind === 'propose' && !action.message.trim()) fail('Explain your price so the client can compare.');
      const p: Proposal = { id: id('pr'), artisanId: a.id, kind: action.kind, amount, message: action.message.trim(), startDay: action.startDay, status: 'pending', at: now };
      j.proposals.push(p);
      alert(j.clientId, action.kind === 'apply' ? `${a.name} applied for “${j.title}” at your price.` : `${a.name} sent a proposal of ${formatNaira(amount)} for “${j.title}”.`, j.id);
      break;
    }
    case 'declineInvite': {
      const a = meAs('artisan');
      const j = job(action.jobId);
      expect(j, 'open');
      if (j.invitedArtisanId !== a.id) fail('This job was not sent to you.');
      j.invitedArtisanId = undefined;
      log(j, `${a.name} could not take it · now open to all artisans`, a.name);
      alert(j.clientId, `${a.name} could not take “${j.title}”. It is now open to other verified artisans.`, j.id);
      break;
    }
    case 'confirmProposal': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'open');
      const p = j.proposals.find((x) => x.id === action.proposalId) || fail('That proposal was withdrawn.');
      if (p.status !== 'pending') fail('That proposal is no longer available.');
      const diff = p.amount - j.escrow;
      if (diff > 0) debit(c.id, diff, `Extra held for · ${j.title}`, 'hold');
      if (diff < 0) credit(c.id, -diff, `Difference returned · ${j.title}`);
      j.escrow = p.amount;
      j.agreedAmount = p.amount;
      j.agreedDay = p.startDay;
      j.artisanId = p.artisanId;
      j.status = 'confirmed';
      j.proposals.forEach((x) => {
        if (x.id === p.id) x.status = 'accepted';
        else if (x.status === 'pending') {
          x.status = 'declined';
          alert(x.artisanId, `${c.name} chose another artisan for “${j.title}”.`, j.id);
        }
      });
      log(j, `Confirmed ${name(p.artisanId)} at ${formatNaira(p.amount)}`, c.name);
      alert(p.artisanId, `${c.name} confirmed you for “${j.title}”. ${formatNaira(p.amount)} is held for you. Address: ${j.addr}.`, j.id);
      break;
    }
    case 'startWork': {
      const j = job(action.jobId);
      const a = assignedArtisan(j);
      expect(j, 'confirmed');
      j.status = 'in_progress';
      log(j, 'Arrived · job matches · work started', a.name);
      alert(j.clientId, `${a.name} arrived and started work on “${j.title}”.`, j.id);
      break;
    }
    case 'flagMisdescribed': {
      const j = job(action.jobId);
      const a = assignedArtisan(j);
      expect(j, 'confirmed');
      const split = misdescribedSplit(j.escrow);
      credit(a.id, split.artisan, `Visit fee (50%) · ${j.title}`);
      credit(j.clientId, split.clientRefund, `50% refund · ${j.title}`);
      txn(j.clientId, `50% visit fee to ${a.name}`, split.artisan, 'out');
      j.escrow = 0;
      j.status = 'not_as_described';
      log(j, 'Marked not as described', a.name);
      alert(j.clientId, `${a.name} marked “${j.title}” not as described. ${formatNaira(split.artisan)} went to them for the visit and ${formatNaira(split.clientRefund)} came back to you.`, j.id);
      break;
    }
    case 'markDone': {
      const j = job(action.jobId);
      const a = assignedArtisan(j);
      expect(j, 'in_progress');
      j.status = j.tier === 'Premium' ? 'supervisor_check' : 'awaiting_client';
      log(j, j.tier === 'Premium' ? 'Work marked done · supervisor inspecting' : 'Work marked done', a.name);
      alert(j.clientId, `${a.name} says “${j.title}” is done. ${j.tier === 'Premium' ? 'Your Allyfe supervisor is inspecting it.' : 'Please check the work.'}`, j.id);
      break;
    }
    case 'supervisorApprove': {
      const j = job(action.jobId);
      expect(j, 'supervisor_check');
      j.status = 'awaiting_client';
      log(j, 'Supervisor approved the work', 'Allyfe supervisor');
      alert(j.clientId, `Your Allyfe supervisor approved the work on “${j.title}”. Please confirm.`, j.id);
      break;
    }
    case 'notFinished': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'awaiting_client');
      j.status = 'in_progress';
      log(j, 'Client says not finished yet', c.name);
      alert(j.artisanId!, `${c.name} says “${j.title}” is not finished yet.`, j.id);
      break;
    }
    case 'raiseConcern': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'awaiting_client', 'not_as_described', 'in_progress');
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
      // Requests still waiting for the company can no longer be paid from this job.
      s.rentals.filter((r) => r.jobId === j.id && r.status === 'requested').forEach((r) => (r.status = 'declined'));
      const a = s.users[j.artisanId!] as Artisan;
      credit(a.id, split.artisan, `Payment · ${j.title}`);
      a.jobsDone += 1;
      txn(c.id, `Released · ${j.title}`, j.escrow, 'out');
      j.escrow = 0;
      j.status = 'completed';
      log(j, 'Work completed · payment released', c.name);
      alert(a.id, `${c.name} confirmed the work. ${formatNaira(split.artisan)} is in your wallet.`, j.id);
      break;
    }
    case 'submitReview': {
      const j = job(action.jobId);
      const c = ownClient(j);
      expect(j, 'completed');
      if (j.review) fail('You have already rated this job.');
      const a = s.users[j.artisanId!] as Artisan;
      [a.rating, a.ratingCount] = addRating(a.rating, a.ratingCount, action.stars);
      j.review = { stars: action.stars, text: action.text.trim(), at: now };
      alert(a.id, `${c.name} rated you ★ ${action.stars}${action.text.trim() ? `: “${action.text.trim()}”` : '.'}`, j.id);
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
      if (!u || u.role === 'client') fail('Nothing to approve.');
      const v = (u as Artisan | Company).verification;
      if (v.status !== 'review') fail('Submit the documents first.');
      v.status = 'verified';
      alert(u.id, u.role === 'company' ? `${u.name} is verified. Your tools are now in the Tool Store.` : 'You are verified. Clients can now book you.');
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
        if (committed + fee > j.escrow) fail('Tool rentals cannot cost more than the job pays.');
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

export const VERIFICATION_ITEMS: Record<'artisan' | 'company', { key: string; title: string; hint: string }[]> = {
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
};
