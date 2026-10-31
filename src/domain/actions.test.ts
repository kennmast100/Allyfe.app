import { describe, expect, it } from 'vitest';
import { DomainError, reduce, type Action, type JobDraft } from './actions';
import { seedState } from './seed';
import { addRating, completionSplit, misdescribedSplit, rankArtisans, tierPrices } from './rules';
import type { AppState, Artisan } from './types';

const T0 = 1_800_000_000_000;
let clock = T0;
const run = (s: AppState, ...actions: Action[]) => actions.reduce((acc, a) => reduce(acc, a, (clock += 1000)), s);
const as = (s: AppState, userId: string, ...actions: Action[]) => run(s, { type: 'signIn', userId }, ...actions);

const draft = (over: Partial<JobDraft> = {}): JobDraft => ({
  title: 'Build kitchen cabinets',
  desc: 'Replace 6 doors.',
  addr: '12 Woji Road',
  category: 'Home Renovation',
  tier: 'Pro',
  schedule: { mode: 'This week', days: [] },
  photos: [],
  honest: true,
  ...over,
});

function postedJob(over: Partial<JobDraft> = {}) {
  let s = as(seedState(T0), 'c-kenneth', { type: 'postJob', draft: draft(over) });
  const job = s.jobs[0];
  return { s, job };
}

describe('rules', () => {
  it('prices tiers per category', () => {
    expect(tierPrices('Home Renovation')).toEqual({ Basic: 120000, Pro: 156000, Premium: 180000 });
  });
  it('averages a new rating into the running total', () => {
    expect(addRating(4.9, 120, 5)).toEqual([4.9, 121]);
    expect(addRating(4, 1, 2)).toEqual([3, 2]);
    expect(() => addRating(4, 1, 6)).toThrow();
  });
  it('ranks a long, strong track record above one lucky review', () => {
    const base = seedState(T0).users['a-emeka'] as Artisan;
    const veteran = { ...base, id: 'v', rating: 4.8, ratingCount: 150, jobsDone: 160 };
    const newcomer = { ...base, id: 'n', rating: 5, ratingCount: 1, jobsDone: 1 };
    expect(rankArtisans([newcomer, veteran]).map((a) => a.id)).toEqual(['v', 'n']);
  });
  it('splits 50/50 when a job is misdescribed', () => {
    expect(misdescribedSplit(156001)).toEqual({ artisan: 78001, clientRefund: 78000 });
  });
});

describe('job lifecycle', () => {
  it('holds the deposit when a client posts a job', () => {
    const { s, job } = postedJob();
    expect(job.status).toBe('open');
    expect(job.escrow).toBe(156000);
    expect(s.wallets['c-kenneth']).toBe(250000 - 156000);
    expect(s.alerts['a-emeka']?.[0].text).toMatch(/New home renovation job/);
  });

  it('refuses to post without the honesty confirmation', () => {
    const s = as(seedState(T0), 'c-kenneth');
    expect(() => reduce(s, { type: 'postJob', draft: draft({ honest: false }) })).toThrow(DomainError);
  });

  it('refuses to post when the wallet is short', () => {
    const s = as(seedState(T0), 'c-kenneth', { type: 'withdraw', amount: 200000 });
    expect(() => reduce(s, { type: 'postJob', draft: draft() })).toThrow(/needs/);
  });

  it('runs post → propose → confirm → work → complete → rate, splitting funds with a tool company', () => {
    let { s, job } = postedJob();
    s = as(s, 'a-emeka', { type: 'submitProposal', jobId: job.id, kind: 'propose', amount: 170000, message: 'Includes hinges.' });
    const proposal = s.jobs[0].proposals[0];

    s = as(s, 'c-kenneth', { type: 'confirmProposal', jobId: job.id, proposalId: proposal.id });
    expect(s.jobs[0].status).toBe('confirmed');
    expect(s.jobs[0].escrow).toBe(170000);
    expect(s.wallets['c-kenneth']).toBe(250000 - 170000);

    // ToolHub must be verified before anyone can rent from it.
    s = as(s, 'co-toolhub', ...['cac', 'shop', 'owner', 'w1'].map((key) => ({ type: 'addVerificationFile', key, image: 'room' }) as Action), { type: 'submitVerification' });
    s = run(s, { type: 'approveVerification', userId: 'co-toolhub' });

    s = as(s, 'a-emeka', { type: 'startWork', jobId: job.id }, { type: 'requestRental', toolId: 't3', days: 2, jobId: job.id });
    const rental = s.rentals[0];
    s = as(s, 'co-toolhub', { type: 'respondRental', rentalId: rental.id, approve: true });
    s = as(s, 'a-emeka', { type: 'markDone', jobId: job.id });
    expect(s.jobs[0].status).toBe('awaiting_client');

    const emekaBefore = s.wallets['a-emeka'];
    s = as(s, 'c-kenneth', { type: 'completeJob', jobId: job.id });
    expect(s.jobs[0].status).toBe('completed');
    expect(s.jobs[0].escrow).toBe(0);
    expect(s.wallets['co-toolhub']).toBe(30000);
    expect(s.wallets['a-emeka']).toBe(emekaBefore + 140000);
    expect(s.rentals[0].status).toBe('paid');

    s = as(s, 'c-kenneth', { type: 'submitReview', jobId: job.id, stars: 4, text: 'Good' });
    const emeka = s.users['a-emeka'] as Artisan;
    expect(emeka.ratingCount).toBe(121);
    expect(emeka.rating).toBeCloseTo((4.9 * 120 + 4) / 121, 2);
    expect(() => reduce(s, { type: 'submitReview', jobId: job.id, stars: 5, text: '' })).toThrow(/already/);
  });

  it('returns the difference when the agreed price is below the deposit', () => {
    let { s, job } = postedJob();
    s = as(s, 'a-emeka', { type: 'submitProposal', jobId: job.id, kind: 'propose', amount: 100000, message: 'Doors only.' });
    s = as(s, 'c-kenneth', { type: 'confirmProposal', jobId: job.id, proposalId: s.jobs[0].proposals[0].id });
    expect(s.wallets['c-kenneth']).toBe(250000 - 100000);
  });

  it('declines the other proposals when one is confirmed', () => {
    let { s, job } = postedJob({ tier: 'Basic' });
    s = as(s, 'a-emeka', { type: 'submitProposal', jobId: job.id, kind: 'apply', amount: 0, message: '' });
    s = as(s, 'a-tunde', { type: 'submitProposal', jobId: job.id, kind: 'apply', amount: 0, message: '' });
    const [p1, p2] = s.jobs[0].proposals;
    s = as(s, 'c-kenneth', { type: 'confirmProposal', jobId: job.id, proposalId: p2.id });
    expect(s.jobs[0].proposals.find((p) => p.id === p1.id)!.status).toBe('declined');
    expect(s.alerts['a-emeka'][0].text).toMatch(/chose another artisan/);
  });

  it('keeps Pro jobs for artisans rated 4.7★ and above', () => {
    const { s, job } = postedJob({ tier: 'Pro' });
    const tunde = as(s, 'a-tunde');
    expect(() => reduce(tunde, { type: 'submitProposal', jobId: job.id, kind: 'apply', amount: 0, message: '' })).toThrow(/4.7/);
  });

  it('blocks unverified artisans from applying', () => {
    const { s, job } = postedJob({ category: 'Electrical', tier: 'Basic' });
    const grace = as(s, 'a-grace');
    expect(() => reduce(grace, { type: 'submitProposal', jobId: job.id, kind: 'apply', amount: 0, message: '' })).toThrow(/verification/);
  });

  it('applies the 50% rule when the artisan flags the job as misdescribed', () => {
    let { s, job } = postedJob();
    s = as(s, 'a-emeka', { type: 'submitProposal', jobId: job.id, kind: 'apply', amount: 0, message: '' });
    s = as(s, 'c-kenneth', { type: 'confirmProposal', jobId: job.id, proposalId: s.jobs[0].proposals[0].id });
    const emekaBefore = s.wallets['a-emeka'];
    s = as(s, 'a-emeka', { type: 'flagMisdescribed', jobId: job.id });
    expect(s.jobs[0].status).toBe('not_as_described');
    expect(s.wallets['a-emeka']).toBe(emekaBefore + 78000);
    expect(s.wallets['c-kenneth']).toBe(250000 - 78000);
  });

  it('routes Premium jobs through the supervisor before the client confirms', () => {
    let { s, job } = postedJob({ tier: 'Premium' });
    s = as(s, 'a-emeka', { type: 'submitProposal', jobId: job.id, kind: 'apply', amount: 0, message: '' });
    s = as(s, 'c-kenneth', { type: 'confirmProposal', jobId: job.id, proposalId: s.jobs[0].proposals[0].id });
    s = as(s, 'a-emeka', { type: 'startWork', jobId: job.id }, { type: 'markDone', jobId: job.id });
    expect(s.jobs[0].status).toBe('supervisor_check');
    expect(() => as(s, 'c-kenneth', { type: 'completeJob', jobId: job.id })).toThrow(DomainError);
    s = run(s, { type: 'supervisorApprove', jobId: job.id });
    s = as(s, 'c-kenneth', { type: 'completeJob', jobId: job.id });
    expect(s.jobs[0].status).toBe('completed');
  });

  it('refunds the deposit when an open job is cancelled', () => {
    let { s, job } = postedJob();
    s = run(s, { type: 'cancelJob', jobId: job.id });
    expect(s.wallets['c-kenneth']).toBe(250000);
    expect(s.jobs[0].status).toBe('cancelled');
  });

  it('only lets the posting client release payment', () => {
    const { s, job } = postedJob();
    expect(() => as(s, 'c-ada', { type: 'cancelJob', jobId: job.id })).toThrow(/Only the client/);
  });
});

describe('wallet rentals', () => {
  it('holds the fee, then pays the company on approval or refunds on decline', () => {
    let s = as(seedState(T0), 'a-emeka', { type: 'requestRental', toolId: 't1', days: 2 });
    expect(s.wallets['a-emeka']).toBe(86500 - 16000);
    s = as(s, 'co-buildright', { type: 'respondRental', rentalId: s.rentals[0].id, approve: true });
    expect(s.wallets['co-buildright']).toBe(54000 + 16000);

    s = as(s, 'a-emeka', { type: 'requestRental', toolId: 't2', days: 1 });
    s = as(s, 'co-buildright', { type: 'respondRental', rentalId: s.rentals[0].id, approve: false });
    expect(s.wallets['a-emeka']).toBe(86500 - 16000);
  });

  it('will not rent from an unverified company', () => {
    const s = as(seedState(T0), 'a-emeka');
    expect(() => reduce(s, { type: 'requestRental', toolId: 't3', days: 1 })).toThrow(/not verified/);
  });

  it('caps job-funded rentals at the job escrow', () => {
    expect(() => completionSplit({ id: 'j', escrow: 1000 }, [{ id: 'r', toolId: 't', companyId: 'c', artisanId: 'a', days: 1, fee: 2000, jobId: 'j', status: 'approved', at: 0 }])).toThrow();
  });
});

describe('feed', () => {
  it('posts, likes and comments', () => {
    let s = as(seedState(T0), 'a-emeka', { type: 'createPost', image: 'cabinet', text: 'New kitchen' });
    const pid = s.posts[0].id;
    s = as(s, 'c-kenneth', { type: 'toggleLike', postId: pid }, { type: 'addComment', postId: pid, text: 'Lovely' });
    expect(s.posts[0].likes).toEqual(['c-kenneth']);
    expect(s.posts[0].comments[0].text).toBe('Lovely');
    expect(s.alerts['a-emeka'].map((a) => a.text)).toEqual(['Kenneth commented: “Lovely”', 'Kenneth Obi liked your post.']);
  });
});
