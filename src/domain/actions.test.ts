import { describe, expect, it } from 'vitest';
import { DomainError, reduce, type Action, type BidDraft, type JobDraft } from './actions';
import { seedState } from './seed';
import { addRating, billableMaterials, dayKey, earliestWorkDay, jobStars, misdescribedSplit, rankArtisans } from './rules';
import type { AppState, Artisan } from './types';

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
  category: 'Plumbing',
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
function delivered() {
  let { s, job } = awarded();
  s = as(s, 'v-oilmill', { type: 'vendorAcceptOrder', jobId: job.id }, { type: 'vendorDispatch', jobId: job.id, waybill: 'Rider Musa, 0803 555 0101' });
  s = as(s, 'c-kenneth', { type: 'confirmMaterials', jobId: job.id });
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
    expect(s.alerts['a-emeka']).toBeUndefined(); // carpenter
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
    const { s, job } = posted({ category: 'Electrical', title: 'Sockets' });
    expect(() => as(s, 'a-grace', { type: 'submitBid', jobId: job.id, bid: bid({ lines: [] }) })).toThrow(/verification/);
  });
});

describe('the full journey', () => {
  it('accept → vendor → delivered → started → finished → job done → rated, with the right payouts', () => {
    let { s, job } = awarded();
    expect(s.jobs[0].status).toBe('awarded');
    expect(s.jobs[0].escrow).toBe(48100);
    expect(s.wallets['c-kenneth']).toBe(400000 - 48100);
    expect(s.jobs[0].materialsOrder).toMatchObject({ total: 28100, status: 'open' });
    expect(s.alerts['v-mile3'][0].text).toMatch(/New materials request/);
    expect(s.alerts['v-tradefair']).toBeUndefined(); // Lagos vendor

    s = as(s, 'v-oilmill', { type: 'vendorAcceptOrder', jobId: job.id });
    expect(() => as(s, 'v-mile3', { type: 'vendorAcceptOrder', jobId: job.id })).toThrow(DomainError);
    s = as(s, 'v-oilmill', { type: 'vendorDispatch', jobId: job.id, waybill: 'Rider Musa' });
    s = as(s, 'c-kenneth', { type: 'confirmMaterials', jobId: job.id });
    expect(s.wallets['v-oilmill']).toBe(28100);
    expect(s.jobs[0].escrow).toBe(20000);
    expect(s.alerts['a-ibrahim'][0].text).toMatch(/materials .* are at the client's home/i);

    // Not before the scheduled day (Wednesday).
    expect(() => as(s, 'a-ibrahim', { type: 'startWork', jobId: job.id })).toThrow(/scheduled day/);
    at(new Date(2026, 10, 4, 9).getTime());
    s = as(s, 'a-ibrahim', { type: 'startWork', jobId: job.id }, { type: 'finishWork', jobId: job.id });
    expect(s.alerts['c-kenneth'][0].text).toMatch(/finished/);
    const before = s.wallets['a-ibrahim'];
    s = as(s, 'c-kenneth', { type: 'completeJob', jobId: job.id });
    expect(s.wallets['a-ibrahim']).toBe(before + 20000);
    expect(s.jobs[0].escrow).toBe(0);

    s = as(s, 'c-kenneth', { type: 'rateJob', jobId: job.id, work: 5, attitude: 4, text: 'Neat' });
    const ib = s.users['a-ibrahim'] as Artisan;
    expect(s.jobs[0].rating?.stars).toBe(4.5);
    expect(ib.ratingCount).toBe(81);
    expect(ib.rating).toBeCloseTo((4.8 * 80 + 4.5) / 81, 2);
  });

  it('skips vendors when the quotation has no materials', () => {
    let { s, job } = posted();
    s = as(s, 'a-ibrahim', { type: 'submitBid', jobId: job.id, bid: bid({ lines: [] }) });
    s = as(s, 'c-kenneth', { type: 'acceptBid', jobId: job.id, bidId: s.jobs[0].bids[0].id });
    expect(s.jobs[0].status).toBe('ready');
    expect(s.jobs[0].materialsOrder).toBeUndefined();
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
    expect(s.jobs[0].materialsOrder).toMatchObject({ total: 600 });
    expect(s.jobs[0].materialsOrder!.lines.map((l) => l.key)).toEqual(['pl-elbow']);
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

  it('refunds in full when cancelled before the vendor delivers', () => {
    let { s, job } = awarded();
    s = as(s, 'v-oilmill', { type: 'vendorAcceptOrder', jobId: job.id });
    s = as(s, 'c-kenneth', { type: 'requestRefund', jobId: job.id });
    expect(s.wallets['c-kenneth']).toBe(400000);
    expect(s.jobs[0].materialsOrder?.status).toBe('cancelled');
    expect(s.alerts['v-oilmill'][0].text).toMatch(/don't send/);
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

describe('wallet rentals and feed', () => {
  it('holds a rental fee, then pays the company on approval or refunds on decline', () => {
    at(T0);
    let s = as(seedState(T0), 'a-emeka', { type: 'requestRental', toolId: 't1', days: 2 });
    expect(s.wallets['a-emeka']).toBe(86500 - 16000);
    s = as(s, 'co-buildright', { type: 'respondRental', rentalId: s.rentals[0].id, approve: false });
    expect(s.wallets['a-emeka']).toBe(86500);
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
