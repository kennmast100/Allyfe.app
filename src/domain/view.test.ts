import { describe, expect, it } from 'vitest';
import { reduce, type Action } from './actions';
import { seedState } from './seed';
import { supplyNeed } from './rules';
import { viewFor } from './view';
import type { AppState, Artisan } from './types';

const T0 = new Date(2026, 10, 2, 9, 0, 0).getTime();
let clock = T0;
const as = (s: AppState, userId: string, ...actions: Action[]) => [{ type: 'signIn', userId } as Action, ...actions].reduce((acc, a) => reduce(acc, a, (clock += 1000)), s);
const text = (v: AppState) => JSON.stringify(v);

describe('what each person can see', () => {
  const s = seedState(T0);

  it('signed out: public profiles and posts only, no phone numbers or money', () => {
    const v = viewFor(s, null);
    expect(Object.values(v.users).every((u) => u.phone === '' && u.bank === '')).toBe(true);
    expect(v.wallets).toEqual({});
    expect(v.alerts).toEqual({});
    expect(v.posts.length).toBe(s.posts.length);
    expect(v.jobs.every((j) => j.status === 'completed' && j.addr === '')).toBe(true); // review stubs only
  });

  it("never sends anyone else's bank details, verification documents, wallet or alerts", () => {
    const v = viewFor(s, 'c-kenneth');
    expect(Object.keys(v.wallets)).toEqual(['c-kenneth']);
    expect(Object.keys(v.alerts).every((k) => k === 'c-kenneth')).toBe(true);
    for (const u of Object.values(v.users)) {
      if (u.id === 'c-kenneth') continue;
      expect(u.bank).toBe('');
      if (u.role === 'artisan' || u.role === 'vendor') expect(u.verification.files).toEqual({});
    }
    expect(text(v)).not.toContain('UBA •••• 1414');
  });

  it('a vendor sees the client phone and address only on orders they accepted', () => {
    const v = viewFor(s, 'v-oilmill');
    const open = v.jobs.find((j) => j.id === 'j-v1')!; // a new request Oil Mill could take
    expect(open.addr).toBe('');
    expect(v.users['c-ada'].phone).toBe('');
    expect(open.desc).toBe('');
    expect(v.jobs.find((j) => j.id === 'j-v2')).toBeUndefined(); // Mile 3's order
    // Oil Mill sees only its own offer, never a competitor's, and no plan.
    expect(open.supply!.offers.every((o) => o.vendorId === 'v-oilmill')).toBe(true);
    expect(open.supply!.offers.length).toBe(1);

    const m = viewFor(s, 'v-mile3');
    expect(m.jobs.find((j) => j.id === 'j-v2')!.addr).toBe('7 Ikwerre Road, D-Line');
    expect(m.users['c-ada'].phone).toBe('0803 000 2222');
    expect(m.users['c-kenneth'].phone).toBe('0803 000 1111'); // refused delivery to collect
  });

  it("an artisan sees open jobs in their trade without the address or other artisans' prices", () => {
    // Emeka bids; Chinedu (another woodworker) looks at the same open job.
    let st = as(s, 'a-emeka', { type: 'submitBid', jobId: 'j-seed3', bid: { lines: [{ key: 'hr-mdf', name: '', unit: '', unitPrice: 0, qty: 4 }], serviceFee: 90000, day: s.jobs.find((j) => j.id === 'j-seed3')!.preferredDays[0], message: 'Can do' } });
    const v = viewFor(st, 'a-chinedu');
    const j = v.jobs.find((x) => x.id === 'j-seed3')!;
    expect(j.addr).toBe('');
    expect(j.desc).not.toBe('');
    expect(j.bids).toHaveLength(1);
    expect(j.bids[0]).toMatchObject({ artisanId: '', serviceFee: 0, lines: [] });
    expect(text(v)).not.toContain('90000');
    expect(v.users['c-ada'].phone).toBe('');
    // Not their trade, not their city: not sent at all.
    expect(v.jobs.find((x) => x.id === 'j-seed2')).toBeUndefined();
  });

  it('the assigned artisan sees the address and client phone; the client sees every bid on their job', () => {
    const v = viewFor(s, 'a-tunde');
    const mine = v.jobs.find((j) => j.id === 'j-v2')!;
    expect(mine.addr).toBe('7 Ikwerre Road, D-Line');
    expect(v.users['c-ada'].phone).toBe('0803 000 2222');

    let st = as(s, 'a-chinedu', { type: 'submitBid', jobId: 'j-seed3', bid: { lines: [], serviceFee: 90000, day: s.jobs.find((j) => j.id === 'j-seed3')!.preferredDays[0], message: '' } });
    const c = viewFor(st, 'c-ada');
    expect(c.jobs.find((j) => j.id === 'j-seed3')!.bids[0]).toMatchObject({ artisanId: 'a-chinedu', serviceFee: 90000 });
    expect(c.users['a-chinedu'].phone).toBe(''); // not hired yet
  });

  it("a vendor sees how much is already ordered elsewhere, but not from whom or at what price", () => {
    let st = as(s, 'r-ifeoma', { type: 'recommendPlan', jobId: 'j-v1', kind: 'combined' });
    st = as(st, 'a-chidi', { type: 'artisanReviewSupply', jobId: 'j-v1', ok: true, note: '' });
    if (st.jobs.find((j) => j.id === 'j-v1')!.supply!.plan!.needsClient) st = as(st, 'c-ada', { type: 'clientReviewSupply', jobId: 'j-v1', ok: true, note: '' });
    st = as(st, 'r-ifeoma', { type: 'authorizeSupply', jobId: 'j-v1' });
    const sp = viewFor(st, 'v-oilmill').jobs.find((j) => j.id === 'j-v1')!.supply!;
    const others = sp.orders.filter((o) => o.vendorId !== 'v-oilmill');
    expect(others.length).toBe(1);
    expect(others[0]).toMatchObject({ vendorId: '', ref: '', deliveryFee: 0 });
    expect(others[0].lines.every((l) => l.unitPrice === 0 && l.name === '')).toBe(true);
    expect(Object.values(supplyNeed(sp)).every((q) => q === 0)).toBe(true);
  });

  it('the representative sees every offer; clients and artisans see the plan but not the offers', () => {
    const r = viewFor(s, 'r-ifeoma');
    expect(new Set(r.jobs.find((j) => j.id === 'j-v1')!.supply!.offers.map((o) => o.vendorId))).toEqual(new Set(['v-oilmill', 'v-mile3']));
    const c = viewFor(s, 'c-kenneth');
    const j6 = c.jobs.find((j) => j.id === 'j-v6')!;
    expect(j6.supply!.offers).toEqual([]);
    expect(j6.supply!.plan?.extra).toBe(15000);
    expect(viewFor(s, 'a-musa').jobs.find((j) => j.id === 'j-v6')!.supply!.offers).toEqual([]);
  });

  it("keeps apprentices' numbers private but still links collaborated projects", () => {
    const v = viewFor(s, 'c-kenneth');
    const emeka = v.users['a-emeka'] as Artisan;
    expect(emeka.apprentices[0].phone).toBe('');
    expect((v.users['a-chinedu'] as Artisan).mentors).toEqual(['a-emeka']);
    expect(text(v)).not.toContain('0803 000 1212');
  });

  it('keeps public reviews visible to everyone, without the job details', () => {
    const v = viewFor(s, 'a-emeka');
    const review = v.jobs.find((j) => j.id === 'j-seed0')!;
    expect(review.rating?.stars).toBe(5);
    expect(review.addr).toBe('');
    expect(review.bids).toEqual([]);
  });
});
