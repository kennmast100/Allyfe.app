import type { Artisan, Category, Job, Rental, Tier } from './types';

export const CATEGORIES: Category[] = ['Home Renovation', 'Interior Design', 'Plumbing', 'Electrical', 'Painting'];
export const TIERS: Tier[] = ['Basic', 'Pro', 'Premium'];

/**
 * Allyfe's cut of each completed job. Not agreed yet, so it is 0 for now.
 * Change it here and every payout, screen and test follows.
 */
export const PLATFORM_FEE_RATE = 0;

/** Share of the deposit a client forfeits when an artisan flags the job as misdescribed. */
export const MISDESCRIBED_FORFEIT = 0.5;

/** Pro tier only matches artisans at or above this rating. */
export const PRO_MIN_RATING = 4.7;

export const TIER_FEATURES: Record<Tier, string[]> = {
  Basic: ['A verified artisan', 'Pay safely through your Allyfe wallet'],
  Pro: [`A top-rated artisan (${PRO_MIN_RATING}★ and above)`, 'Priority booking and faster response'],
  Premium: ['Everything in Pro', 'An Allyfe supervisor inspects the work before you release payment'],
};

const BASE_PRICE: Record<Category, number> = {
  'Home Renovation': 120000,
  'Interior Design': 150000,
  Plumbing: 35000,
  Electrical: 40000,
  Painting: 80000,
};

const round1k = (n: number) => Math.round(n / 1000) * 1000;

/** Suggested deposit per tier for a category. The final price is agreed through a proposal. */
export function tierPrices(cat: Category): Record<Tier, number> {
  const basic = BASE_PRICE[cat];
  const pro = round1k(basic * 1.3);
  return { Basic: basic, Pro: pro, Premium: pro + Math.max(20000, round1k(basic * 0.2)) };
}

export function formatNaira(n: number): string {
  return '₦' + Math.round(n).toLocaleString('en-NG');
}

/** Can this artisan take a job of this tier? */
export function artisanQualifies(a: Artisan, tier: Tier): boolean {
  if (a.verification.status !== 'verified') return false;
  return tier === 'Basic' || a.rating >= PRO_MIN_RATING;
}

/* ---------------- ratings & ranking ---------------- */

/** Adds one review to an artisan's running average. Returns the new [rating, count]. */
export function addRating(rating: number, count: number, stars: number): [number, number] {
  if (stars < 1 || stars > 5 || !Number.isInteger(stars)) throw new Error('Stars must be a whole number from 1 to 5');
  const next = (rating * count + stars) / (count + 1);
  return [Math.round(next * 100) / 100, count + 1];
}

/**
 * Ranking score: a Bayesian average so one lucky 5★ review cannot beat a long
 * track record, plus a small loyalty bonus for jobs completed on Allyfe.
 */
const PRIOR_MEAN = 4.0;
const PRIOR_WEIGHT = 10;
export function rankScore(a: Pick<Artisan, 'rating' | 'ratingCount' | 'jobsDone'>): number {
  const bayes = (PRIOR_MEAN * PRIOR_WEIGHT + a.rating * a.ratingCount) / (PRIOR_WEIGHT + a.ratingCount);
  const loyalty = Math.min(a.jobsDone, 200) * 0.001;
  return bayes + loyalty;
}

export function rankArtisans<T extends Artisan>(list: T[]): T[] {
  return list.slice().sort((x, y) => rankScore(y) - rankScore(x) || y.ratingCount - x.ratingCount);
}

/* ---------------- money ---------------- */

export type Split = { artisan: number; companies: { companyId: string; rentalId: string; amount: number }[]; platform: number };

/** How a job's escrow is split when the client taps "Work completed". */
export function completionSplit(job: Pick<Job, 'escrow' | 'id'>, rentals: Rental[]): Split {
  const jobRentals = rentals.filter((r) => r.jobId === job.id && r.status === 'approved');
  const companies = jobRentals.map((r) => ({ companyId: r.companyId, rentalId: r.id, amount: r.fee }));
  const toolTotal = companies.reduce((s, c) => s + c.amount, 0);
  if (toolTotal > job.escrow) throw new Error('Tool rentals cost more than the job escrow');
  const platform = Math.round((job.escrow - toolTotal) * PLATFORM_FEE_RATE);
  return { artisan: job.escrow - toolTotal - platform, companies, platform };
}

/** The 50% rule: what goes to the artisan for the visit and what returns to the client. */
export function misdescribedSplit(escrow: number): { artisan: number; clientRefund: number } {
  const artisan = Math.round(escrow * MISDESCRIBED_FORFEIT);
  return { artisan, clientRefund: escrow - artisan };
}

/** Rentals booked against a job that still need paying from its escrow. */
export function jobToolCost(jobId: string, rentals: Rental[]): number {
  return rentals.filter((r) => r.jobId === jobId && r.status === 'approved').reduce((s, r) => s + r.fee, 0);
}

export const JOB_STATUS_LABEL: Record<Job['status'], string> = {
  open: 'Open for proposals',
  confirmed: 'Artisan confirmed',
  in_progress: 'In progress',
  supervisor_check: 'Supervisor check',
  awaiting_client: 'Waiting for you',
  completed: 'Completed',
  not_as_described: 'Not as described',
  disputed: 'Under review',
  cancelled: 'Cancelled',
};

export const JOB_STATUS_TONE: Record<Job['status'], 'grey' | 'blue' | 'warn' | 'good' | 'bad'> = {
  open: 'grey',
  confirmed: 'blue',
  in_progress: 'blue',
  supervisor_check: 'warn',
  awaiting_client: 'warn',
  completed: 'good',
  not_as_described: 'bad',
  disputed: 'bad',
  cancelled: 'grey',
};

export const ACTIVE_STATUSES: Job['status'][] = ['open', 'confirmed', 'in_progress', 'supervisor_check', 'awaiting_client', 'disputed'];
