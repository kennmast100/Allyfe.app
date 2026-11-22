import { describe, expect, it } from 'vitest';
import { DomainError, reduce, type Action, type BidDraft, type JobDraft } from './actions';
import { seedState } from './seed';
import { addRating, billableMaterials, compareOffers, dayKey, earliestWorkDay, jobStars, misdescribedSplit, rankArtisans, supplyNeed } from './rules';
import type { AppState, Artisan, Job } from './types';

// Monday 2 Nov 2026, 09:00 local time.
const T0 = new Date(2026, 10, 2, 9, 0, 0).getTime();
let clock = T0;
const at = (t: number) => (clock = t);
const run = (s: AppState, ...actions: Action[]) => actions.reduce((acc, a) => reduce(acc, a, (clock += 1000)), s);
const as = (s: AppState, userId: string, ...actions: Action[]) => run(s, { type: 'signIn', userId }, ...actions);

const WED = '2026-11-04';
const draft = (over: Partial<JobDraft> = {}): JobDraft => ({
  title: 'Fix leaking shower and kitchen tap',
  desc: 'The shower mixer drips constantly and the kitchen sink tap is loose. Bathroom is upstairs, pipes are ½ inch PVC.',
  addr: '12 Woji Road',
  category: 'Plumber',
  tier: 'Basic',
  preferredDays: [WED],
  media: [],
  honest: true,
  ...over,
});
const bid = (over: Partial<BidDraft> = {}): BidDraft => ({
  lines: [
    { key: 'pl-shower', name: '', unit: '', unitPrice: 0, qty: 1 },
    { key: 'pl-ptfe', name: '', unit: '', unitPrice: 0, qty: 2 },
    { key: 'custom:x', name: 'Silicone sealant', unit: 'tube', unitPrice: 2500, qty: 1 },
  ],
  serviceFee: 20000,
  day: WED,
  message: 'Includes removing the old mixer.',
  ...over,
});
// shower 25,000 + 2 × PTFE 300 + sealant 2,500 = 28,100 materials; + 20,000 fee = 48,100

function posted(over: Partial<JobDraft> = {}) {
  at(T0);
  const s = as(seedState(T0), 'c-kenneth', { type: 'postJob', draft: draft(over) });
  return { s, job: s.jobs[0] };
}
function awarded() {
  let { s, job } = posted();
  s = as(s, 'a-ibrahim', { type: 'submitBid', jobId: job.id, bid: bid() });
  s = as(s, 'c-kenneth', { type: 'acceptBid', jobId: job.id, bidId: s.jobs[0].bids[0].id });
  return { s, job };
}
const J = (s: AppState, id: string) => s.jobs.find((j) => j.id === id)!;
const lineOf = (j: Job, key: string) => j.supply!.lines.find((l) => l.key === key)!;
/** A vendor offers every outstanding line at the given unit prices (default: the quoted budget price). */
function offerAll(s: AppState, jobId: string, vendorId: string, prices: Record<string, number> = {}, deliveryFee = 0) {
  const j = J(s, jobId);
  const need = supplyNeed(j.supply!);
  const items = j.supply!.lines.filter((l) => need[l.id] > 0).map((l) => ({ lineId: l.id, qty: need[l.id], unitPrice: prices[l.key] ?? l.budgetPrice }));
  return as(s, vendorId, { type: 'submitOffer', jobId, items, deliveryFee, deliveryDays: 1, note: '' });
}
/** Rep recommends, artisan confirms, (client approves if needed), rep authorizes. */
function approveAndOrder(s: AppState, jobId: string, kind: 'single' | 'combined', vendorId?: string) {
  s = as(s, 'r-ifeoma', { type: 'recommendPlan', jobId, kind, vendorId });
  s = as(s, J(s, jobId).artisanId!, { type: 'artisanReviewSupply', jobId, ok: true, note: '' });
  if (J(s, jobId).supply!.plan!.needsClient) s = as(s, J(s, jobId).clientId, { type: 'clientReviewSupply', jobId, ok: true, note: '' });
  return as(s, 'r-ifeoma', { type: 'authorizeSupply', jobId });
}
/** Oil Mill supplies everything at budget price; Kenneth receives it. */
function delivered() {
  let { s, job } = awarded();
  s = offerAll(s, job.id, 'v-oilmill');
  s = approveAndOrder(s, job.id, 'single', 'v-oilmill');
  const po = J(s, job.id).supply!.orders[0];
  s = as(s, 'v-oilmill', { type: 'confirmPO', jobId: job.id, poId: po.id, confirmed: {} }, { type: 'dispatchPO', jobId: job.id, poId: po.id, waybill: 'Rider Musa, 0803 555 0101' });
  s = as(s, 'c-kenneth', { type: 'receivePO', jobId: job.id, poId: po.id, received: {} });
  return { s, job };
}

describe('rules', () => {
  it('books work no earlier than 24 hours after posting, from 8am', () => {
    expect(earliestWorkDay(new Date(2026, 10, 2, 7, 0).getTime())).toBe('2026-11-03'); // Tue 8am is 25h later
    expect(earliestWorkDay(new Date(2026, 10, 2, 9, 0).getTime())).toBe('2026-11-04'); // Tue 8am is only 23h later
  });
  it('turns the two rating answers into stars out of 5', () => {
    expect(jobStars(5, 5)).toBe(5);
    expect(jobStars(5, 4)).toBe(4.5);
    expect(jobStars(1, 1)).toBe(1);
    expect(() => jobStars(6, 1)).toThrow();
  });
  it('averages job stars, including halves', () => {
    expect(addRating(4, 1, 4.5)).toEqual([4.25, 2]);
  });
  it('ranks a long, strong track record above one lucky review', () => {
    const base = seedState(T0).users['a-emeka'] as Artisan;
    const veteran = { ...base, id: 'v', rating: 4.8, ratingCount: 150, jobsDone: 160 };
    const newcomer = { ...base, id: 'n', rating: 5, ratingCount: 1, jobsDone: 1 };
    expect(rankArtisans([newcomer, veteran]).map((a) => a.id)).toEqual(['v', 'n']);
  });
  it('takes already-delivered materials off a new quotation', () => {
    const line = (key: string, qty: number, unitPrice = 1000) => ({ key, name: key, unit: 'piece', unitPrice, qty });
    const { billable, covered } = billableMaterials([line('a', 3), line('b', 1)], [line('a', 2), line('c', 5)]);
    expect(billable).toEqual([line('a', 1), line('b', 1)]);
    expect(covered).toEqual([line('a', 2)]);
  });
  it('splits the service fee 50/50 when a job is misdescribed', () => {
    expect(misdescribedSplit(20001)).toEqual({ artisan: 10001, clientRefund: 10000 });
  });
});

describe('posting', () => {
  it('posts without payment and alerts only matching artisans in the same city', () => {
    const { s, job } = posted();
    expect(job.status).toBe('open');
    expect(s.wallets['c-kenneth']).toBe(400000);
    expect(s.alerts['a-ibrahim']?.[0].text).toMatch(/New plumbing job in Port Harcourt/);
    expect(s.alerts['a-femi']).toBeUndefined(); // Lagos plumber
    expect((s.alerts['a-emeka'] ?? []).some((a) => a.jobId === job.id)).toBe(false); // woodworker
  });
  it('requires a detailed description', () => {
    at(T0);
    const s = as(seedState(T0), 'c-kenneth');
    expect(() => reduce(s, { type: 'postJob', draft: draft({ desc: 'Tap leaking' }) }, T0)).toThrow(/more detail/);
  });
  it('refuses days less than 24 hours away', () => {
    at(T0);
    const s = as(seedState(T0), 'c-kenneth');
    expect(() => reduce(s, { type: 'postJob', draft: draft({ preferredDays: ['2026-11-03'] }) }, T0)).toThrow(/24 hours/);
  });
});

describe('bidding', () => {
  it('prices catalogue items from the list, not from the phone', () => {
    let { s, job } = posted();
    s = as(s, 'a-ibrahim', { type: 'submitBid', jobId: job.id, bid: bid({ lines: [{ key: 'pl-shower', name: 'x', unit: 'x', unitPrice: 1, qty: 1 }] }) });
    expect(s.jobs[0].bids[0].lines[0]).toMatchObject({ name: 'Shower mixer set', unitPrice: 25000 });
  });
  it('keeps artisans in other cities and trades out', () => {
    const { s, job } = posted();
    expect(() => as(s, 'a-femi', { type: 'submitBid', jobId: job.id, bid: bid() })).toThrow(/Lagos|Port Harcourt/);
    expect(() => as(s, 'a-emeka', { type: 'submitBid', jobId: job.id, bid: bid() })).toThrow(DomainError);
  });
  it('blocks unverified artisans', () => {
    const { s, job } = posted({ category: 'Electrician', title: 'Sockets' });
    expect(() => as(s, 'a-grace', { type: 'submitBid', jobId: job.id, bid: bid({ lines: [] }) })).toThrow(/verification/);
  });
});

describe('the full journey', () => {
  it('accept → Allyfe Supply → delivered → started → finished → job done → rated, with the right payouts', () => {
    let { s, job } = awarded();
    expect(J(s, job.id).status).toBe('awarded');
    expect(J(s, job.id).escrow).toBe(48100);
    expect(s.wallets['c-kenneth']).toBe(400000 - 48100);
    const sp = J(s, job.id).supply!;
    expect(sp).toMatchObject({ status: 'sourcing', repId: 'r-ifeoma' });
    expect(sp.lines.map((l) => [l.key, l.qty])).toEqual([['pl-shower', 1], ['pl-ptfe', 2], ['custom:silicone sealant', 1]]);
    expect(s.alerts['v-mile3'][0].text).toMatch(/New supply request/);
    expect(s.alerts['v-tradefair']).toBeUndefined(); // Lagos vendor
    expect((s.alerts['v-glass'] ?? []).some((a) => a.jobId === job.id)).toBe(false); // doesn't sell plumbing materials

    s = offerAll(s, job.id, 'v-oilmill');
    s = approveAndOrder(s, job.id, 'single', 'v-oilmill');
    const po = J(s, job.id).supply!.orders[0];
    expect(po).toMatchObject({ vendorId: 'v-oilmill', status: 'issued' });
    s = as(s, 'v-oilmill', { type: 'confirmPO', jobId: job.id, poId: po.id, confirmed: {} }, { type: 'dispatchPO', jobId: job.id, poId: po.id, waybill: 'Rider Musa' });
    expect(J(s, job.id).status).toBe('materials_on_the_way');
    s = as(s, 'c-kenneth', { type: 'receivePO', jobId: job.id, poId: po.id, received: {} });
    expect(s.wallets['v-oilmill']).toBe(28100);
    expect(J(s, job.id).escrow).toBe(20000);
    expect(J(s, job.id).supply!.status).toBe('complete');
    expect(J(s, job.id).status).toBe('ready');
    expect(s.alerts['a-ibrahim'][0].text).toMatch(/All materials .* are at the client's home/i);

    // Not before the scheduled day (Wednesday).
    expect(() => as(s, 'a-ibrahim', { type: 'startWork', jobId: job.id })).toThrow(/scheduled day/);
    at(new Date(2026, 10, 4, 9).getTime());
    s = as(s, 'a-ibrahim', { type: 'startWork', jobId: job.id }, { type: 'finishWork', jobId: job.id });
    expect(s.alerts['c-kenneth'][0].text).toMatch(/finished/);
    const before = s.wallets['a-ibrahim'];
    s = as(s, 'c-kenneth', { type: 'completeJob', jobId: job.id });
    // ₦20,000 service fee minus the 5% Allyfe fee on a Basic job.
    expect(s.wallets['a-ibrahim']).toBe(before + 19000);
    expect(s.wallets['allyfe']).toBe(1000);
    expect(J(s, job.id).escrow).toBe(0);

    s = as(s, 'c-kenneth', { type: 'rateJob', jobId: job.id, work: 5, attitude: 4, text: 'Neat' });
    const ib = s.users['a-ibrahim'] as Artisan;
    expect(J(s, job.id).rating?.stars).toBe(4.5);
    expect(ib.ratingCount).toBe(81);
    expect(ib.rating).toBeCloseTo((4.8 * 80 + 4.5) / 81, 2);
  });

  it('skips vendors when the quotation has no materials', () => {
    let { s, job } = posted();
    s = as(s, 'a-ibrahim', { type: 'submitBid', jobId: job.id, bid: bid({ lines: [] }) });
    s = as(s, 'c-kenneth', { type: 'acceptBid', jobId: job.id, bidId: s.jobs[0].bids[0].id });
    expect(s.jobs[0].status).toBe('ready');
    expect(s.jobs[0].supply).toBeUndefined();
  });

  it('routes Premium jobs through the supervisor', () => {
    let { s, job } = posted({ tier: 'Premium' });
    s = as(s, 'a-ibrahim', { type: 'submitBid', jobId: job.id, bid: bid({ lines: [] }) });
    s = as(s, 'c-kenneth', { type: 'acceptBid', jobId: job.id, bidId: s.jobs[0].bids[0].id });
    at(new Date(2026, 10, 4, 9).getTime());
    s = as(s, 'a-ibrahim', { type: 'startWork', jobId: job.id }, { type: 'finishWork', jobId: job.id });
    expect(s.jobs[0].status).toBe('supervisor_check');
    expect(() => as(s, 'c-kenneth', { type: 'completeJob', jobId: job.id })).toThrow(DomainError);
    s = run(s, { type: 'supervisorApprove', jobId: job.id });
    s = as(s, 'c-kenneth', { type: 'completeJob', jobId: job.id });
    expect(s.jobs[0].status).toBe('completed');
  });

  it('applies the 50% rule to the service fee; the materials stay with the client', () => {
    let { s, job } = delivered();
    const before = s.wallets['c-kenneth'];
    s = as(s, 'a-ibrahim', { type: 'flagMisdescribed', jobId: job.id });
    expect(s.jobs[0].status).toBe('not_as_described');
    expect(s.wallets['c-kenneth']).toBe(before + 10000);
  });
});

describe('no-shows', () => {
  it('gives the artisan 1★ and refunds everything except delivered materials', () => {
    let { s, job } = delivered();
    expect(() => as(s, 'c-kenneth', { type: 'reportNoShow', jobId: job.id })).toThrow(/from that day/);
    at(new Date(2026, 10, 4, 15).getTime());
    s = as(s, 'c-kenneth', { type: 'reportNoShow', jobId: job.id });
    const ib = s.users['a-ibrahim'] as Artisan;
    expect(ib.ratingCount).toBe(81);
    expect(ib.rating).toBeCloseTo((4.8 * 80 + 1) / 81, 2);
    s = as(s, 'c-kenneth', { type: 'requestRefund', jobId: job.id });
    expect(s.wallets['c-kenneth']).toBe(400000 - 28100); // only the materials are kept
    expect(s.jobs[0].status).toBe('refunded');
  });

  it('lets a new artisan take over, billing only what is still needed', () => {
    let { s, job } = delivered();
    at(new Date(2026, 10, 4, 15).getTime());
    s = as(s, 'c-kenneth', { type: 'reportNoShow', jobId: job.id }, { type: 'chooseAnotherArtisan', jobId: job.id });
    expect(s.jobs[0].status).toBe('open');
    expect(s.jobs[0].escrow).toBe(20000); // the old service fee is still held
    expect(() => as(s, 'a-ibrahim', { type: 'submitBid', jobId: job.id, bid: bid() })).toThrow(/missed this job/);

    // Ibrahim's fellow plumber does not exist in seed data, so make Femi a Port Harcourt plumber for this test.
    (s.users['a-femi'] as Artisan).city = 'Port Harcourt';
    const day = s.jobs[0].preferredDays[0];
    // Needs the same shower mixer (already delivered) plus 2 extra elbows, and charges 25,000.
    s = as(s, 'a-femi', {
      type: 'submitBid',
      jobId: job.id,
      bid: bid({ day, serviceFee: 25000, lines: [{ key: 'pl-shower', name: '', unit: '', unitPrice: 0, qty: 1 }, { key: 'pl-elbow', name: '', unit: '', unitPrice: 0, qty: 2 }] }),
    });
    const walletBefore = s.wallets['c-kenneth'];
    s = as(s, 'c-kenneth', { type: 'acceptBid', jobId: job.id, bidId: s.jobs[0].bids.find((b) => b.artisanId === 'a-femi')!.id });
    // Due: 600 (elbows) + 25,000 fee − 20,000 already held = 5,600.
    expect(s.wallets['c-kenneth']).toBe(walletBefore - 5600);
    expect(s.jobs[0].supply!.lines.map((l) => [l.key, l.qty, l.budgetPrice])).toEqual([['pl-elbow', 2, 300]]);
  });

  it('refunds the difference when the new artisan costs less', () => {
    let { s, job } = delivered();
    at(new Date(2026, 10, 4, 15).getTime());
    s = as(s, 'c-kenneth', { type: 'reportNoShow', jobId: job.id }, { type: 'chooseAnotherArtisan', jobId: job.id });
    (s.users['a-femi'] as Artisan).city = 'Port Harcourt';
    s = as(s, 'a-femi', { type: 'submitBid', jobId: job.id, bid: bid({ day: s.jobs[0].preferredDays[0], serviceFee: 15000, lines: [{ key: 'pl-shower', name: '', unit: '', unitPrice: 0, qty: 1 }] }) });
    const walletBefore = s.wallets['c-kenneth'];
    s = as(s, 'c-kenneth', { type: 'acceptBid', jobId: job.id, bidId: s.jobs[0].bids.find((b) => b.artisanId === 'a-femi')!.id });
    expect(s.wallets['c-kenneth']).toBe(walletBefore + 5000);
    expect(s.jobs[0].status).toBe('ready'); // everything needed is already on site
  });

  it('refunds in full when cancelled before anything is delivered', () => {
    let { s, job } = awarded();
    s = offerAll(s, job.id, 'v-oilmill');
    s = approveAndOrder(s, job.id, 'single', 'v-oilmill');
    s = as(s, 'c-kenneth', { type: 'requestRefund', jobId: job.id });
    expect(s.wallets['c-kenneth']).toBe(400000);
    expect(J(s, job.id).supply!.orders[0].status).toBe('cancelled');
    expect(J(s, job.id).supply!.status).toBe('cancelled');
    expect(s.alerts['v-oilmill'][0].text).toMatch(/don't send/);
  });
});

describe('Allyfe Supply demo data', () => {
  it('has a supply request at every stage, with consistent money', () => {
    const s = seedState(T0);
    const st = (id: string) => [J(s, id).status, J(s, id).supply!.status];
    expect(st('j-v1')).toEqual(['awarded', 'sourcing']);
    expect(st('j-v6')).toEqual(['awarded', 'approval']);
    expect(st('j-v2')).toEqual(['awarded', 'ordering']);
    expect(st('j-v3')).toEqual(['materials_on_the_way', 'delivering']);
    expect(st('j-v5')).toEqual(['awarded', 'sourcing']);
    expect(st('j-v4')).toEqual(['ready', 'complete']);
    expect(J(s, 'j-v5').supply!.orders[0]).toMatchObject({ vendorId: 'v-mile3', status: 'refused' });
    expect(J(s, 'j-v6').supply!.plan).toMatchObject({ extra: 15000, substitutions: 1, needsClient: true });
    expect(J(s, 'j-v6').supply!.plan!.artisanOkAt).toBeDefined();
    expect(J(s, 'j-v4').escrow).toBe(J(s, 'j-v4').serviceFee); // only the service fee is left
    expect(s.wallets['c-kenneth']).toBe(400000);
    expect(s.wallets['c-ada']).toBe(300000);
  });

  it('lets every demo request carry on', () => {
    at(T0);
    let s = seedState(T0);
    const po2 = J(s, 'j-v2').supply!.orders[0];
    s = as(s, 'v-mile3', { type: 'confirmPO', jobId: 'j-v2', poId: po2.id, confirmed: {} }, { type: 'collectRefusedPO', jobId: 'j-v5', poId: J(s, 'j-v5').supply!.orders[0].id });
    s = as(s, 'c-kenneth', { type: 'receivePO', jobId: 'j-v3', poId: J(s, 'j-v3').supply!.orders[0].id, received: {} }, { type: 'clientReviewSupply', jobId: 'j-v6', ok: true, note: '' });
    expect(J(s, 'j-v3').status).toBe('ready');
    s = as(s, 'r-ifeoma', { type: 'authorizeSupply', jobId: 'j-v6' }, { type: 'recommendPlan', jobId: 'j-v5', kind: 'single', vendorId: 'v-oilmill' }, { type: 'recommendPlan', jobId: 'j-v1', kind: 'combined' });
    expect(J(s, 'j-v6').supply!.orders[0].vendorId).toBe('v-mile3');
    expect(new Set(J(s, 'j-v1').supply!.plan!.allocations.map((a) => a.vendorId))).toEqual(new Set(['v-mile3', 'v-oilmill']));
  });
});

describe('Allyfe Supply rules', () => {
  it('compares a complete supplier with a cheaper combination, never allocating stock twice', () => {
    let { s, job } = awarded();
    s = offerAll(s, job.id, 'v-oilmill', {}, 1000); // full, at budget
    // Mile 3: only the shower mixer, cheaper, and only 1 of the 2 PTFE rolls.
    const j = J(s, job.id);
    s = as(s, 'v-mile3', { type: 'submitOffer', jobId: job.id, deliveryFee: 500, deliveryDays: 1, note: '', items: [{ lineId: lineOf(j, 'pl-shower').id, qty: 1, unitPrice: 22000 }, { lineId: lineOf(j, 'pl-ptfe').id, qty: 1, unitPrice: 250 }] });
    const opts = compareOffers(J(s, job.id).supply!);
    const single = opts.find((o) => o.kind === 'single')!;
    const combined = opts.find((o) => o.kind === 'combined')!;
    expect(single).toMatchObject({ vendorId: 'v-oilmill', total: 28100 + 1000, complete: true });
    // Shower and 1 PTFE from Mile 3; the second PTFE and the sealant from Oil Mill.
    expect(combined.total).toBe(22000 + 250 + 300 + 2500 + 500 + 1000);
    expect(combined.complete).toBe(true);
    const ptfe = combined.allocations.filter((a) => a.lineId === lineOf(J(s, job.id), 'pl-ptfe').id);
    expect(ptfe.map((a) => [a.vendorId, a.qty])).toEqual([['v-mile3', 1], ['v-oilmill', 1]]);
    expect(opts[0].kind).toBe('combined'); // cheapest complete option first
  });

  it('is not first-come, first-served: the rep can pick a later, better offer', () => {
    let { s, job } = awarded();
    s = offerAll(s, job.id, 'v-oilmill');
    s = offerAll(s, job.id, 'v-mile3', { 'pl-shower': 23000 });
    s = approveAndOrder(s, job.id, 'single', 'v-mile3');
    expect(J(s, job.id).supply!.orders.map((o) => o.vendorId)).toEqual(['v-mile3']);
  });

  it('only the representative recommends and authorizes; artisan and client approvals come first', () => {
    let { s, job } = awarded();
    s = offerAll(s, job.id, 'v-oilmill');
    expect(() => as(s, 'a-ibrahim', { type: 'recommendPlan', jobId: job.id, kind: 'single', vendorId: 'v-oilmill' })).toThrow(/Only reps/);
    s = as(s, 'r-ifeoma', { type: 'recommendPlan', jobId: job.id, kind: 'single', vendorId: 'v-oilmill' });
    expect(() => as(s, 'r-ifeoma', { type: 'authorizeSupply', jobId: job.id })).toThrow(/artisan/);
    s = as(s, 'a-ibrahim', { type: 'artisanReviewSupply', jobId: job.id, ok: true, note: '' });
    s = as(s, 'r-ifeoma', { type: 'authorizeSupply', jobId: job.id });
    expect(J(s, job.id).supply!.status).toBe('ordering');
  });

  it('asks the client to approve, and pay for, any extra cost or substitution', () => {
    let { s, job } = awarded();
    const j = J(s, job.id);
    s = as(s, 'v-oilmill', {
      type: 'submitOffer', jobId: job.id, deliveryFee: 2000, deliveryDays: 1, note: '',
      items: [
        { lineId: lineOf(j, 'pl-shower').id, qty: 1, unitPrice: 27000, substitute: 'Shower mixer, Grohe' },
        { lineId: lineOf(j, 'pl-ptfe').id, qty: 2, unitPrice: 300 },
        { lineId: lineOf(j, 'custom:silicone sealant').id, qty: 1, unitPrice: 2500 },
      ],
    });
    s = as(s, 'r-ifeoma', { type: 'recommendPlan', jobId: job.id, kind: 'single', vendorId: 'v-oilmill' });
    expect(J(s, job.id).supply!.plan).toMatchObject({ extra: 4000, substitutions: 1, needsClient: true });
    expect(() => as(s, 'c-kenneth', { type: 'clientReviewSupply', jobId: job.id, ok: true, note: '' })).toThrow(/artisan has to confirm/);
    s = as(s, 'a-ibrahim', { type: 'artisanReviewSupply', jobId: job.id, ok: true, note: '' });
    expect(() => as(s, 'r-ifeoma', { type: 'authorizeSupply', jobId: job.id })).toThrow(/client/);
    const before = s.wallets['c-kenneth'];
    s = as(s, 'c-kenneth', { type: 'clientReviewSupply', jobId: job.id, ok: true, note: '' });
    expect(s.wallets['c-kenneth']).toBe(before - 4000);
    s = as(s, 'r-ifeoma', { type: 'authorizeSupply', jobId: job.id });
    expect(J(s, job.id).supply!.orders[0].lines[0]).toMatchObject({ substitute: 'Shower mixer, Grohe', unitPrice: 27000 });
  });

  it('lets the artisan send a plan back for re-sourcing', () => {
    let { s, job } = awarded();
    s = offerAll(s, job.id, 'v-oilmill');
    s = as(s, 'r-ifeoma', { type: 'recommendPlan', jobId: job.id, kind: 'single', vendorId: 'v-oilmill' });
    expect(() => as(s, 'a-ibrahim', { type: 'artisanReviewSupply', jobId: job.id, ok: false, note: '' })).toThrow(/what is wrong/);
    s = as(s, 'a-ibrahim', { type: 'artisanReviewSupply', jobId: job.id, ok: false, note: 'Wrong mixer type' });
    expect(J(s, job.id).supply).toMatchObject({ status: 'sourcing', plan: undefined });
    expect(s.alerts['r-ifeoma'][0].text).toMatch(/Wrong mixer type/);
  });

  it('reserves stock only on confirmation and returns unconfirmed quantities to sourcing', () => {
    let { s, job } = awarded();
    s = offerAll(s, job.id, 'v-oilmill');
    s = approveAndOrder(s, job.id, 'single', 'v-oilmill');
    const po = J(s, job.id).supply!.orders[0];
    const ptfe = lineOf(J(s, job.id), 'pl-ptfe').id;
    expect(Object.values(supplyNeed(J(s, job.id).supply!)).every((q) => q === 0)).toBe(true);
    s = as(s, 'v-oilmill', { type: 'confirmPO', jobId: job.id, poId: po.id, confirmed: { [ptfe]: 1 } });
    expect(supplyNeed(J(s, job.id).supply!)[ptfe]).toBe(1);
    expect(J(s, job.id).supply!.status).toBe('sourcing');
    expect(s.alerts['r-ifeoma'][0].text).toMatch(/only confirm part/);
  });

  it('returns a declined purchase order to the sourcing pool', () => {
    let { s, job } = awarded();
    s = offerAll(s, job.id, 'v-oilmill');
    s = offerAll(s, job.id, 'v-mile3', { 'pl-shower': 26000 });
    s = approveAndOrder(s, job.id, 'single', 'v-oilmill');
    s = as(s, 'v-oilmill', { type: 'declinePO', jobId: job.id, poId: J(s, job.id).supply!.orders[0].id, note: 'Out of stock' });
    const sp = J(s, job.id).supply!;
    expect(sp.status).toBe('sourcing');
    expect(compareOffers(sp).map((o) => o.vendorIds)).toEqual([['v-mile3']]); // Mile 3's offer still stands
  });

  it('pays only for what arrived and re-sources a short delivery', () => {
    let { s, job } = awarded();
    s = offerAll(s, job.id, 'v-oilmill');
    s = approveAndOrder(s, job.id, 'single', 'v-oilmill');
    const po = J(s, job.id).supply!.orders[0];
    const ptfe = lineOf(J(s, job.id), 'pl-ptfe').id;
    s = as(s, 'v-oilmill', { type: 'confirmPO', jobId: job.id, poId: po.id, confirmed: {} }, { type: 'dispatchPO', jobId: job.id, poId: po.id, waybill: 'GIG 1' });
    s = as(s, 'c-kenneth', { type: 'receivePO', jobId: job.id, poId: po.id, received: { [ptfe]: 1 } });
    expect(s.wallets['v-oilmill']).toBe(28100 - 300);
    expect(supplyNeed(J(s, job.id).supply!)[ptfe]).toBe(1);
    expect(J(s, job.id).status).toBe('awarded');
  });

  it('returns unspent materials money to the client when everything is delivered', () => {
    let { s, job } = awarded();
    s = offerAll(s, job.id, 'v-oilmill', { 'pl-shower': 22000 }); // ₦3,000 under budget
    s = approveAndOrder(s, job.id, 'single', 'v-oilmill');
    const po = J(s, job.id).supply!.orders[0];
    s = as(s, 'v-oilmill', { type: 'confirmPO', jobId: job.id, poId: po.id, confirmed: {} }, { type: 'dispatchPO', jobId: job.id, poId: po.id, waybill: 'GIG 2' });
    const before = s.wallets['c-kenneth'];
    s = as(s, 'c-kenneth', { type: 'receivePO', jobId: job.id, poId: po.id, received: {} });
    expect(s.wallets['c-kenneth']).toBe(before + 3000);
    expect(J(s, job.id).supply!.refunded).toBe(3000);
    expect(J(s, job.id).escrow).toBe(20000);
  });

  it('keeps an auditable record of every step', () => {
    const { s, job } = delivered();
    const log = J(s, job.id).history.map((h) => h.label).join('\n');
    for (const step of [/Supply request SR-/, /offered the full list/, /recommended complete supply/, /Artisan confirmed/, /authorized the allocation/, /confirmed PO-.*stock reserved/, /dispatched/, /Client received PO-/, /All materials delivered and reconciled/])
      expect(log).toMatch(step);
  });

  it('only matching vendors in the same city can offer', () => {
    const { s, job } = awarded();
    expect(() => offerAll(s, job.id, 'v-glass')).toThrow(/don't sell plumbing/);
    expect(() => offerAll(s, job.id, 'v-tradefair')).toThrow(/Port Harcourt/);
    expect(() => offerAll(s, job.id, 'a-chidi')).toThrow(/Only vendors/);
  });
});

describe('vendor matching', () => {
  it('only sends requests to verified vendors who sell that kind of material', () => {
    let { s, job } = posted({ category: 'Painter', title: 'Paint two rooms', desc: 'Two bedrooms, walls only, about 3 m high. Old paint is peeling in one corner of the bigger room.' });
    s = as(s, 'a-blessing', { type: 'submitBid', jobId: job.id, bid: bid({ lines: [{ key: 'pa-emul', name: '', unit: '', unitPrice: 0, qty: 2 }] }) });
    s = as(s, 'c-kenneth', { type: 'acceptBid', jobId: job.id, bidId: s.jobs[0].bids[0].id });
    expect(s.alerts['v-mile3'][0].text).toMatch(/Paint two rooms/);
    expect((s.alerts['v-oilmill'] ?? []).some((a) => /Paint two rooms/.test(a.text))).toBe(false);
    expect(() => offerAll(s, job.id, 'v-oilmill')).toThrow(/don't sell painting/);
  });
});

describe('profiles', () => {
  it('lets an artisan work as a team and keep apprentices', () => {
    let s = as(seedState(T0), 'a-emeka', { type: 'updateProfile', kind: 'team', teamName: 'Uche Woodworks', teamMembers: ['Emeka Uche', 'Obinna'], bio: '' });
    s = run(s, { type: 'addApprentice', name: 'Ifeanyi', phone: '0803 222 0000', photo: 'room' });
    const e = s.users['a-emeka'] as Artisan;
    expect(e.kind).toBe('team');
    expect(e.apprentices.map((a) => a.name)).toEqual(['Chinedu Okafor', 'Ifeanyi']);
    expect(() => run(s, { type: 'updateProfile', kind: 'team', teamName: 'X', teamMembers: ['Solo'], bio: '' })).toThrow(/2 members/);
  });
});

describe('Allyfe fee', () => {
  it('takes 10% of the service fee on Premium jobs', () => {
    let { s, job } = posted({ tier: 'Premium' });
    s = as(s, 'a-ibrahim', { type: 'submitBid', jobId: job.id, bid: bid({ lines: [], serviceFee: 30000 }) });
    s = as(s, 'c-kenneth', { type: 'acceptBid', jobId: job.id, bidId: s.jobs[0].bids[0].id });
    at(new Date(2026, 10, 4, 9).getTime());
    s = as(s, 'a-ibrahim', { type: 'startWork', jobId: job.id }, { type: 'finishWork', jobId: job.id });
    s = run(s, { type: 'supervisorApprove', jobId: job.id });
    const before = s.wallets['a-ibrahim'];
    s = as(s, 'c-kenneth', { type: 'completeJob', jobId: job.id });
    expect(s.wallets['a-ibrahim']).toBe(before + 27000);
    expect(s.wallets['allyfe']).toBe(3000);
    expect(s.wallets['c-kenneth']).toBe(400000 - 30000); // the client pays the quoted fee, nothing extra
  });
});

describe('refusing materials', () => {
  it('does not pay the vendor, tells them to collect, and re-sources the items', () => {
    let { s, job } = awarded();
    s = offerAll(s, job.id, 'v-oilmill');
    s = approveAndOrder(s, job.id, 'single', 'v-oilmill');
    const po = J(s, job.id).supply!.orders[0];
    s = as(s, 'v-oilmill', { type: 'confirmPO', jobId: job.id, poId: po.id, confirmed: {} }, { type: 'dispatchPO', jobId: job.id, poId: po.id, waybill: 'Rider Musa' });
    expect(() => as(s, 'c-kenneth', { type: 'refusePO', jobId: job.id, poId: po.id, reason: 'Made up', note: '' })).toThrow(/reason/);
    expect(() => as(s, 'c-kenneth', { type: 'refusePO', jobId: job.id, poId: po.id, reason: 'Other', note: '' })).toThrow(/what is wrong/);
    s = as(s, 'c-kenneth', { type: 'refusePO', jobId: job.id, poId: po.id, reason: 'Poor quality or substandard', note: 'Tap is plastic, not chrome' });
    expect(s.wallets['v-oilmill']).toBe(0);
    expect(J(s, job.id).status).toBe('awarded');
    expect(J(s, job.id).supply!.status).toBe('sourcing');
    expect(J(s, job.id).escrow).toBe(48100); // still held for the materials and fee
    expect(s.alerts['v-oilmill'].some((a) => /did NOT accept .* collect the goods/.test(a.text))).toBe(true);
    s = as(s, 'v-oilmill', { type: 'collectRefusedPO', jobId: job.id, poId: po.id });
    expect(J(s, job.id).supply!.orders[0].refusal!.pickedUpAt).toBeDefined();
    expect(() => as(s, 'v-oilmill', { type: 'collectRefusedPO', jobId: job.id, poId: po.id })).toThrow(/Already/);
    // Another vendor supplies it properly and is paid on receipt.
    const mile3Before = s.wallets['v-mile3'];
    s = offerAll(s, job.id, 'v-mile3');
    s = approveAndOrder(s, job.id, 'single', 'v-mile3');
    const po2 = J(s, job.id).supply!.orders[1];
    s = as(s, 'v-mile3', { type: 'confirmPO', jobId: job.id, poId: po2.id, confirmed: {} }, { type: 'dispatchPO', jobId: job.id, poId: po2.id, waybill: 'GIG 4471' });
    s = as(s, 'c-kenneth', { type: 'receivePO', jobId: job.id, poId: po2.id, received: {} });
    expect(s.wallets['v-mile3']).toBe(mile3Before + 28100);
    expect(J(s, job.id).status).toBe('ready');
  });
});

describe('feed', () => {
  it('lets vendors list materials in stock, but not artisans', () => {
    at(T0);
    let s = as(seedState(T0), 'v-mile3', { type: 'createPost', image: 'tiles', text: 'New tiles in', stock: { name: 'Floor tiles', price: 9500, unit: 'carton' } });
    expect(s.posts[0].stock).toEqual({ name: 'Floor tiles', price: 9500, unit: 'carton' });
    expect(() => as(s, 'a-emeka', { type: 'createPost', image: 'tiles', text: 'x', stock: { name: 'Wood', price: 1, unit: 'x' } })).toThrow(/Only vendors/);
    expect(() => as(s, 'c-kenneth', { type: 'createPost', image: 'tiles', text: 'x' })).toThrow(/artisans and vendors/);
  });
  it('posts, likes and comments', () => {
    at(T0);
    let s = as(seedState(T0), 'a-emeka', { type: 'createPost', image: 'cabinet', text: 'New kitchen' });
    const pid = s.posts[0].id;
    s = as(s, 'c-kenneth', { type: 'toggleLike', postId: pid }, { type: 'addComment', postId: pid, text: 'Lovely' });
    expect(s.posts[0].likes).toEqual(['c-kenneth']);
    expect(s.posts[0].comments[0].text).toBe('Lovely');
  });
  it('uses the date helpers consistently', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
