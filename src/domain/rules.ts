import type { Artisan, Category, City, Job, QuoteLine, Rental, Tier } from './types';

export const CATEGORIES: Category[] = ['Home Renovation', 'Interior Design', 'Plumbing', 'Electrical', 'Painting'];
export const CITIES: City[] = ['Port Harcourt', 'Lagos', 'Abuja', 'Aba'];
export const TIERS: Tier[] = ['Basic', 'Pro', 'Premium'];

/**
 * Allyfe's cut of each artisan service fee. Not agreed yet, so it is 0 for now.
 * Change it here and every payout, screen and test follows.
 */
export const PLATFORM_FEE_RATE = 0;

/** Share of the service fee the client forfeits when an artisan finds the job misdescribed on arrival. */
export const MISDESCRIBED_FORFEIT = 0.5;

/** Pro tier only matches artisans at or above this rating. */
export const PRO_MIN_RATING = 4.7;

/** Work days start at this hour. The first allowed day is the first whose start is 24 hours after posting. */
export const WORKDAY_START_HOUR = 8;
export const SCHEDULE_LEAD_HOURS = 24;

/** Job descriptions must be at least this long so artisans can quote accurately. */
export const MIN_DESCRIPTION = 60;

export const MAX_VIDEO_SECONDS = 20;

export const TIER_FEATURES: Record<Tier, string[]> = {
  Basic: ['Any verified artisan can bid', 'Pay safely through your Allyfe wallet'],
  Pro: [`Only top-rated artisans (${PRO_MIN_RATING}★ and above) can bid`, 'Priority with vendors and faster response'],
  Premium: ['Everything in Pro', 'An Allyfe supervisor inspects the work before you release payment'],
};

export function formatNaira(n: number): string {
  return '₦' + Math.round(n).toLocaleString('en-NG');
}

/** Can this artisan bid on this job? */
export function artisanQualifies(a: Artisan, job: Pick<Job, 'tier' | 'category' | 'city'>): boolean {
  if (a.verification.status !== 'verified') return false;
  if (a.city !== job.city || !a.categories.includes(job.category)) return false;
  return job.tier === 'Basic' || a.rating >= PRO_MIN_RATING;
}

/* ---------------- dates ---------------- */

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDay = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** The first day a client may book: its 8am start must be at least 24 hours after `postedAt`. */
export function earliestWorkDay(postedAt: number): string {
  const d = new Date(postedAt);
  d.setHours(WORKDAY_START_HOUR, 0, 0, 0);
  while (d.getTime() < postedAt + SCHEDULE_LEAD_HOURS * 3600_000) d.setDate(d.getDate() + 1);
  return dayKey(d);
}

/** True when `now` falls on or after the scheduled day. */
export const isOnOrAfterDay = (day: string, now: number) => dayKey(new Date(now)) >= day;

/* ---------------- materials ---------------- */

export type CatalogItem = { key: string; name: string; unit: string; price: number };

/**
 * Sample unit prices for common materials, by job type. These are the prices
 * artisans quote with; vendors supply at these prices. Review with real market data.
 */
export const MATERIALS: Record<Category, CatalogItem[]> = {
  Plumbing: [
    { key: 'pl-pvc12', name: 'PVC pipe ½" (5 m length)', unit: 'length', price: 3500 },
    { key: 'pl-pvc34', name: 'PVC pipe ¾" (5 m length)', unit: 'length', price: 4500 },
    { key: 'pl-elbow', name: 'Elbow ½"', unit: 'piece', price: 300 },
    { key: 'pl-tee', name: 'Tee connector ½"', unit: 'piece', price: 350 },
    { key: 'pl-ball', name: 'Ball valve ½"', unit: 'piece', price: 2500 },
    { key: 'pl-gate', name: 'Gate valve 1"', unit: 'piece', price: 6000 },
    { key: 'pl-ptrap', name: 'P-trap', unit: 'piece', price: 2500 },
    { key: 'pl-sinkmix', name: 'Kitchen sink mixer tap', unit: 'piece', price: 18000 },
    { key: 'pl-shower', name: 'Shower mixer set', unit: 'set', price: 25000 },
    { key: 'pl-wc', name: 'WC cistern fittings set', unit: 'set', price: 15000 },
    { key: 'pl-gum', name: 'PVC solvent cement (gum)', unit: 'tin', price: 1500 },
    { key: 'pl-ptfe', name: 'PTFE thread tape', unit: 'roll', price: 300 },
  ],
  Electrical: [
    { key: 'el-cab25', name: '2.5 mm² cable (100 m roll)', unit: 'roll', price: 65000 },
    { key: 'el-cab15', name: '1.5 mm² cable (100 m roll)', unit: 'roll', price: 42000 },
    { key: 'el-socket', name: '13A double socket', unit: 'piece', price: 2500 },
    { key: 'el-sw1', name: 'Switch, 1-gang', unit: 'piece', price: 1200 },
    { key: 'el-sw2', name: 'Switch, 2-gang', unit: 'piece', price: 1800 },
    { key: 'el-led', name: 'LED bulb 12W', unit: 'piece', price: 1500 },
    { key: 'el-down', name: 'Recessed downlight', unit: 'piece', price: 3500 },
    { key: 'el-mcb', name: 'Circuit breaker (MCB)', unit: 'piece', price: 2500 },
    { key: 'el-db', name: 'Distribution board, 8-way', unit: 'piece', price: 25000 },
    { key: 'el-conduit', name: 'Conduit pipe 20 mm', unit: 'length', price: 1200 },
    { key: 'el-jbox', name: 'Junction box', unit: 'piece', price: 300 },
    { key: 'el-tape', name: 'Insulating tape', unit: 'roll', price: 300 },
  ],
  Painting: [
    { key: 'pa-emul', name: 'Emulsion paint (20 L)', unit: 'bucket', price: 35000 },
    { key: 'pa-satin', name: 'Satin paint (20 L)', unit: 'bucket', price: 45000 },
    { key: 'pa-gloss', name: 'Gloss paint (4 L)', unit: 'tin', price: 12000 },
    { key: 'pa-primer', name: 'Primer / sealer (20 L)', unit: 'bucket', price: 25000 },
    { key: 'pa-putty', name: 'Wall putty / filler (20 kg)', unit: 'bag', price: 9000 },
    { key: 'pa-roller', name: 'Paint roller 9"', unit: 'piece', price: 3500 },
    { key: 'pa-brush', name: 'Paint brush 4"', unit: 'piece', price: 1500 },
    { key: 'pa-sand', name: 'Sandpaper', unit: 'sheet', price: 200 },
    { key: 'pa-mask', name: 'Masking tape', unit: 'roll', price: 800 },
  ],
  'Home Renovation': [
    { key: 'hr-ply', name: 'Plywood ¾" sheet', unit: 'sheet', price: 22000 },
    { key: 'hr-mdf', name: 'MDF board 18 mm', unit: 'sheet', price: 25000 },
    { key: 'hr-hinge', name: 'Soft-close hinge', unit: 'piece', price: 3500 },
    { key: 'hr-runner', name: 'Drawer runners (pair)', unit: 'pair', price: 4500 },
    { key: 'hr-handle', name: 'Cabinet handle', unit: 'piece', price: 1200 },
    { key: 'hr-glue', name: 'Wood glue (1 L)', unit: 'bottle', price: 2500 },
    { key: 'hr-screws', name: 'Wood screws (box)', unit: 'box', price: 2000 },
    { key: 'hr-tiles', name: 'Floor tiles 60×60 (carton)', unit: 'carton', price: 9500 },
    { key: 'hr-adhes', name: 'Tile adhesive (25 kg)', unit: 'bag', price: 7500 },
    { key: 'hr-grout', name: 'Tile grout (2 kg)', unit: 'bag', price: 2500 },
    { key: 'hr-cement', name: 'Cement (50 kg)', unit: 'bag', price: 6500 },
    { key: 'hr-sand', name: 'Sharp sand', unit: 'ton', price: 25000 },
  ],
  'Interior Design': [
    { key: 'id-pop', name: 'POP cement (bag)', unit: 'bag', price: 4500 },
    { key: 'id-fibre', name: 'POP fibre (bundle)', unit: 'bundle', price: 3000 },
    { key: 'id-down', name: 'Recessed downlight', unit: 'piece', price: 3500 },
    { key: 'id-strip', name: 'LED strip light (5 m)', unit: 'roll', price: 6000 },
    { key: 'id-wallpaper', name: 'Wallpaper roll', unit: 'roll', price: 12000 },
    { key: 'id-rod', name: 'Curtain rod set', unit: 'set', price: 8000 },
    { key: 'id-emul', name: 'Emulsion paint (20 L)', unit: 'bucket', price: 35000 },
  ],
};

export function catalogItem(cat: Category, key: string): CatalogItem | undefined {
  return MATERIALS[cat].find((i) => i.key === key);
}

/** Custom items match by name, case-insensitively. */
export const customKey = (name: string) => 'custom:' + name.trim().toLowerCase().replace(/\s+/g, ' ');

export const lineTotal = (l: QuoteLine) => l.unitPrice * l.qty;
export const linesTotal = (ls: QuoteLine[]) => ls.reduce((s, l) => s + lineTotal(l), 0);

/**
 * When a replacement artisan quotes, anything already delivered for the job is
 * taken off their materials list. Returns what still has to be bought and what is covered.
 */
export function billableMaterials(lines: QuoteLine[], delivered: QuoteLine[]): { billable: QuoteLine[]; covered: QuoteLine[] } {
  const stock = new Map<string, number>();
  delivered.forEach((d) => stock.set(d.key, (stock.get(d.key) ?? 0) + d.qty));
  const billable: QuoteLine[] = [];
  const covered: QuoteLine[] = [];
  for (const l of lines) {
    const have = stock.get(l.key) ?? 0;
    const use = Math.min(have, l.qty);
    if (use > 0) {
      covered.push({ ...l, qty: use });
      stock.set(l.key, have - use);
    }
    if (l.qty - use > 0) billable.push({ ...l, qty: l.qty - use });
  }
  return { billable, covered };
}

/** What the client pays when accepting a bid, after anything Allyfe already holds for the job. */
export function bidCharge(job: Pick<Job, 'escrow' | 'deliveredMaterials'>, bid: { lines: QuoteLine[]; serviceFee: number }) {
  const { billable, covered } = billableMaterials(bid.lines, job.deliveredMaterials);
  const materials = linesTotal(billable);
  const total = materials + bid.serviceFee;
  return { billable, covered, materials, coveredValue: linesTotal(covered), serviceFee: bid.serviceFee, total, alreadyHeld: job.escrow, due: total - job.escrow };
}

/* ---------------- ratings & ranking ---------------- */

export const WORK_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Very poor'] as const;
export const ATTITUDE_OPTIONS = ['Professional and honest', 'Friendly and helpful', 'Okay', 'Difficult to work with', 'Rude'] as const;
/** Option index 0 is 5 stars, index 4 is 1 star. */
export const optionStars = (index: number) => 5 - index;

/** Two answers out of 5 each, added (out of 10) and halved: the job's stars. */
export function jobStars(work: number, attitude: number): number {
  for (const v of [work, attitude]) if (!Number.isInteger(v) || v < 1 || v > 5) throw new Error('Each answer must be 1 to 5');
  return (work + attitude) / 2;
}

/** Adds one job's stars to an artisan's running average. Returns the new [rating, count]. */
export function addRating(rating: number, count: number, stars: number): [number, number] {
  if (!(stars >= 1 && stars <= 5)) throw new Error('Stars must be from 1 to 5');
  const next = (rating * count + stars) / (count + 1);
  return [Math.round(next * 100) / 100, count + 1];
}

/** Stars given automatically when an artisan doesn't show up for a paid job. */
export const NO_SHOW_STARS = 1;

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

/** How the service fee still held is split when the client confirms the work is complete. */
export function completionSplit(job: Pick<Job, 'escrow' | 'id'>, rentals: Rental[]): Split {
  const jobRentals = rentals.filter((r) => r.jobId === job.id && r.status === 'approved');
  const companies = jobRentals.map((r) => ({ companyId: r.companyId, rentalId: r.id, amount: r.fee }));
  const toolTotal = companies.reduce((s, c) => s + c.amount, 0);
  if (toolTotal > job.escrow) throw new Error('Tool rentals cost more than the service fee');
  const platform = Math.round((job.escrow - toolTotal) * PLATFORM_FEE_RATE);
  return { artisan: job.escrow - toolTotal - platform, companies, platform };
}

/** The 50% rule on the service fee: what goes to the artisan for the visit and what returns to the client. */
export function misdescribedSplit(serviceFee: number): { artisan: number; clientRefund: number } {
  const artisan = Math.round(serviceFee * MISDESCRIBED_FORFEIT);
  return { artisan, clientRefund: serviceFee - artisan };
}

export function jobToolCost(jobId: string, rentals: Rental[]): number {
  return rentals.filter((r) => r.jobId === jobId && r.status === 'approved').reduce((s, r) => s + r.fee, 0);
}

/* ---------------- labels ---------------- */

export const JOB_STATUS_LABEL: Record<Job['status'], string> = {
  open: 'Waiting for bids',
  awarded: 'Waiting for a vendor',
  materials_on_the_way: 'Materials on the way',
  ready: 'Materials delivered',
  in_progress: 'Work in progress',
  supervisor_check: 'Supervisor check',
  awaiting_client: 'Waiting for client',
  completed: 'Completed',
  not_as_described: 'Not as described',
  no_show: 'Artisan didn’t show up',
  refunded: 'Refunded',
  disputed: 'Under review',
  cancelled: 'Cancelled',
};

export const JOB_STATUS_TONE: Record<Job['status'], 'grey' | 'blue' | 'warn' | 'good' | 'bad'> = {
  open: 'grey',
  awarded: 'blue',
  materials_on_the_way: 'blue',
  ready: 'blue',
  in_progress: 'blue',
  supervisor_check: 'warn',
  awaiting_client: 'warn',
  completed: 'good',
  not_as_described: 'bad',
  no_show: 'bad',
  refunded: 'grey',
  disputed: 'bad',
  cancelled: 'grey',
};

export const CLOSED_STATUSES: Job['status'][] = ['completed', 'not_as_described', 'refunded', 'cancelled'];

/** The shared project journey both client and artisan see. */
export type JourneyStep = { key: string; label: string };
export function journeySteps(job: Pick<Job, 'tier'>): JourneyStep[] {
  return [
    { key: 'posted', label: 'Job posted' },
    { key: 'bids', label: 'Bids received' },
    { key: 'accepted', label: 'Bid accepted and paid' },
    { key: 'vendor', label: 'Vendor supplying materials' },
    { key: 'delivered', label: 'Materials delivered' },
    { key: 'started', label: 'Work started' },
    { key: 'finished', label: 'Work finished' },
    ...(job.tier === 'Premium' ? [{ key: 'supervisor', label: 'Supervisor approved' }] : []),
    { key: 'done', label: 'Job done · artisan paid' },
    { key: 'rated', label: 'Rated' },
  ];
}

/** Index of the current journey step (steps before it are done). */
export function journeyIndex(job: Job): number {
  const steps = journeySteps(job).map((s) => s.key);
  const at = (k: string) => steps.indexOf(k);
  switch (job.status) {
    case 'open':
      return job.bids.some((b) => b.status === 'pending') ? at('accepted') : at('bids');
    case 'awarded':
      return at('vendor');
    case 'materials_on_the_way':
      return at('delivered');
    case 'ready':
      return at('started');
    case 'in_progress':
      return at('finished');
    case 'supervisor_check':
      return at('supervisor');
    case 'awaiting_client':
      return at('done');
    case 'completed':
      return job.rating ? steps.length : at('rated');
    default:
      return -1;
  }
}
