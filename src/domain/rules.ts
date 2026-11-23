import type { Allocation, Artisan, Category, City, Job, OfferItem, PurchaseOrder, QuoteLine, Supply, SupplyLine, SupplyOffer, Tier } from './types';

/**
 * The 12 main job roles for the first launch. People pick from this short list;
 * the specialisations give examples and let artisans say what they do best.
 */
export const JOB_ROLES: { role: Category; service: string; specialisations: string[] }[] = [
  { role: 'Plumber', service: 'Plumbing', specialisations: ['Pipe installation', 'Bathroom fittings', 'Water systems', 'Repairs'] },
  { role: 'Woodworker', service: 'Woodwork', specialisations: ['Furniture making', 'Carpentry', 'Upholstery', 'Kitchen cabinets', 'Wardrobes'] },
  { role: 'Electrician', service: 'Electrical', specialisations: ['House wiring', 'Lighting', 'Electrical installations', 'Repairs'] },
  { role: 'Painter', service: 'Painting', specialisations: ['Interior painting', 'Exterior painting', 'Decorative finishes'] },
  { role: 'Tiler', service: 'Tiling', specialisations: ['Floor tiling', 'Wall tiling', 'Bathroom tiling'] },
  { role: 'POP Installer', service: 'POP ceilings', specialisations: ['POP ceilings', 'Cornices', 'Ceiling designs'] },
  { role: 'Welder', service: 'Welding', specialisations: ['Gates', 'Burglary proofs', 'Railings', 'Metal fabrication'] },
  { role: 'Aluminium Fabricator', service: 'Aluminium work', specialisations: ['Aluminium windows', 'Aluminium doors', 'Partitions'] },
  { role: 'Glass Installer', service: 'Glass work', specialisations: ['Glass doors', 'Mirrors', 'Shower cubicles', 'Glass partitions'] },
  { role: 'Cleaner', service: 'Cleaning', specialisations: ['Domestic cleaning', 'Commercial cleaning', 'Post-construction cleaning'] },
  { role: 'AC Technician', service: 'Air conditioning', specialisations: ['AC installation', 'AC servicing', 'AC repairs'] },
  { role: 'Builder', service: 'Building', specialisations: ['Building construction', 'Blockwork', 'Renovations'] },
];
export const CATEGORIES: Category[] = JOB_ROLES.map((r) => r.role);
export const roleInfo = (c: Category) => JOB_ROLES.find((r) => r.role === c)!;
/** "Plumbing", "Woodwork"… for sentences about the kind of work or materials. */
export const serviceName = (c: Category) => roleInfo(c).service;
export const CITIES: City[] = ['Port Harcourt', 'Lagos', 'Abuja', 'Aba'];
export const TIERS: Tier[] = ['Basic', 'Pro', 'Premium'];

/**
 * Allyfe's company fee, taken from the artisan's service fee when a job is done.
 * Materials carry no fee. Change the rates here and every screen and payout follows.
 */
export const PLATFORM_FEE_RATES: Record<Tier, number> = { Basic: 0.05, Pro: 0.05, Premium: 0.1 };
export const platformFee = (serviceFee: number, tier: Tier) => Math.round(serviceFee * PLATFORM_FEE_RATES[tier]);
export const feePercent = (tier: Tier) => `${Math.round(PLATFORM_FEE_RATES[tier] * 100)}%`;

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

/** Reasons a client can give for refusing a materials delivery. */
export const MATERIAL_REJECT_REASONS = [
  'Wrong item or brand',
  'Poor quality or substandard',
  'Damaged or broken',
  'Short quantity or items missing',
  'Wrong size, colour or texture',
  'Used, old or expired',
  'Other',
] as const;

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
  Plumber: [
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
  Woodworker: [
    { key: 'hr-ply', name: 'Plywood ¾" sheet', unit: 'sheet', price: 22000 },
    { key: 'hr-mdf', name: 'MDF board 18 mm', unit: 'sheet', price: 25000 },
    { key: 'wd-hardwood', name: 'Hardwood plank 2"×12" (12 ft)', unit: 'plank', price: 14000 },
    { key: 'hr-hinge', name: 'Soft-close hinge', unit: 'piece', price: 3500 },
    { key: 'hr-runner', name: 'Drawer runners (pair)', unit: 'pair', price: 4500 },
    { key: 'hr-handle', name: 'Cabinet handle', unit: 'piece', price: 1200 },
    { key: 'hr-glue', name: 'Wood glue (1 L)', unit: 'bottle', price: 2500 },
    { key: 'hr-screws', name: 'Wood screws (box)', unit: 'box', price: 2000 },
    { key: 'wd-foam', name: 'Upholstery foam 2" (sheet)', unit: 'sheet', price: 18000 },
    { key: 'wd-fabric', name: 'Upholstery fabric', unit: 'yard', price: 6500 },
    { key: 'wd-lacquer', name: 'Wood lacquer (4 L)', unit: 'tin', price: 15000 },
  ],
  Electrician: [
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
  Painter: [
    { key: 'pa-emul', name: 'Emulsion paint (20 L)', unit: 'bucket', price: 35000 },
    { key: 'pa-satin', name: 'Satin paint (20 L)', unit: 'bucket', price: 45000 },
    { key: 'pa-gloss', name: 'Gloss paint (4 L)', unit: 'tin', price: 12000 },
    { key: 'pa-primer', name: 'Primer / sealer (20 L)', unit: 'bucket', price: 25000 },
    { key: 'pa-putty', name: 'Wall putty / filler (20 kg)', unit: 'bag', price: 9000 },
    { key: 'pa-texture', name: 'Textured finish (20 kg)', unit: 'bucket', price: 38000 },
    { key: 'pa-roller', name: 'Paint roller 9"', unit: 'piece', price: 3500 },
    { key: 'pa-brush', name: 'Paint brush 4"', unit: 'piece', price: 1500 },
    { key: 'pa-sand', name: 'Sandpaper', unit: 'sheet', price: 200 },
    { key: 'pa-mask', name: 'Masking tape', unit: 'roll', price: 800 },
  ],
  Tiler: [
    { key: 'hr-tiles', name: 'Floor tiles 60×60 (carton)', unit: 'carton', price: 9500 },
    { key: 'ti-wall', name: 'Wall tiles 30×60 (carton)', unit: 'carton', price: 8500 },
    { key: 'hr-adhes', name: 'Tile adhesive (25 kg)', unit: 'bag', price: 7500 },
    { key: 'hr-grout', name: 'Tile grout (2 kg)', unit: 'bag', price: 2500 },
    { key: 'hr-cement', name: 'Cement (50 kg)', unit: 'bag', price: 6500 },
    { key: 'hr-sand', name: 'Sharp sand', unit: 'ton', price: 25000 },
    { key: 'ti-spacer', name: 'Tile spacers (pack)', unit: 'pack', price: 1000 },
    { key: 'ti-trim', name: 'Tile edge trim', unit: 'length', price: 1800 },
  ],
  'POP Installer': [
    { key: 'id-pop', name: 'POP cement (bag)', unit: 'bag', price: 4500 },
    { key: 'id-fibre', name: 'POP fibre (bundle)', unit: 'bundle', price: 3000 },
    { key: 'pop-batten', name: 'Wooden batten 2"×2"', unit: 'length', price: 1500 },
    { key: 'pop-cornice', name: 'POP cornice mould (3 m)', unit: 'length', price: 4000 },
    { key: 'id-down', name: 'Recessed downlight', unit: 'piece', price: 3500 },
    { key: 'id-strip', name: 'LED strip light (5 m)', unit: 'roll', price: 6000 },
  ],
  Welder: [
    { key: 'we-pipe', name: 'Iron pipe 1" (6 m)', unit: 'length', price: 9500 },
    { key: 'we-angle', name: 'Angle iron 2" (6 m)', unit: 'length', price: 11000 },
    { key: 'we-flat', name: 'Flat bar 1" (6 m)', unit: 'length', price: 5500 },
    { key: 'we-square', name: 'Square pipe 1" (6 m)', unit: 'length', price: 8500 },
    { key: 'we-sheet', name: 'Iron sheet 1.5 mm (4×8 ft)', unit: 'sheet', price: 45000 },
    { key: 'we-rod', name: 'Welding electrodes (pack)', unit: 'pack', price: 7000 },
    { key: 'we-disc', name: 'Cutting disc', unit: 'piece', price: 1200 },
    { key: 'we-hinge', name: 'Heavy gate hinge', unit: 'pair', price: 6000 },
    { key: 'we-paint', name: 'Anti-rust paint (4 L)', unit: 'tin', price: 13000 },
  ],
  'Aluminium Fabricator': [
    { key: 'al-frame', name: 'Aluminium window profile (6 m)', unit: 'length', price: 16000 },
    { key: 'al-door', name: 'Aluminium door profile (6 m)', unit: 'length', price: 21000 },
    { key: 'al-glass', name: 'Glass pane 5 mm (per m²)', unit: 'm²', price: 14000 },
    { key: 'al-rubber', name: 'Window rubber seal (roll)', unit: 'roll', price: 4500 },
    { key: 'al-lock', name: 'Sliding window lock', unit: 'piece', price: 2500 },
    { key: 'al-roller', name: 'Sliding roller (pair)', unit: 'pair', price: 2000 },
    { key: 'al-net', name: 'Mosquito net (roll)', unit: 'roll', price: 12000 },
  ],
  'Glass Installer': [
    { key: 'gl-temp', name: 'Tempered glass 10 mm (per m²)', unit: 'm²', price: 45000 },
    { key: 'gl-mirror', name: 'Mirror 5 mm (per m²)', unit: 'm²', price: 22000 },
    { key: 'gl-hinge', name: 'Shower door hinge', unit: 'piece', price: 9000 },
    { key: 'gl-handle', name: 'Glass door handle', unit: 'piece', price: 12000 },
    { key: 'gl-clamp', name: 'Glass clamp', unit: 'piece', price: 3500 },
    { key: 'gl-silicone', name: 'Clear silicone sealant', unit: 'tube', price: 2500 },
    { key: 'gl-channel', name: 'U-channel (3 m)', unit: 'length', price: 7500 },
  ],
  Cleaner: [
    { key: 'cl-deter', name: 'Liquid detergent (5 L)', unit: 'gallon', price: 6500 },
    { key: 'cl-bleach', name: 'Bleach (5 L)', unit: 'gallon', price: 5000 },
    { key: 'cl-disinf', name: 'Disinfectant (5 L)', unit: 'gallon', price: 8000 },
    { key: 'cl-glass', name: 'Glass cleaner (1 L)', unit: 'bottle', price: 2500 },
    { key: 'cl-mop', name: 'Mop and bucket set', unit: 'set', price: 9000 },
    { key: 'cl-bags', name: 'Refuse bags (roll)', unit: 'roll', price: 2000 },
    { key: 'cl-scrub', name: 'Scrubbing pads (pack)', unit: 'pack', price: 1500 },
  ],
  'AC Technician': [
    { key: 'ac-gas', name: 'Refrigerant gas R410A (per kg)', unit: 'kg', price: 18000 },
    { key: 'ac-copper', name: 'Copper pipe set ¼"+⅜" (3 m)', unit: 'set', price: 28000 },
    { key: 'ac-insul', name: 'Pipe insulation (roll)', unit: 'roll', price: 5000 },
    { key: 'ac-bracket', name: 'Outdoor unit bracket', unit: 'set', price: 9000 },
    { key: 'ac-cap', name: 'Compressor capacitor', unit: 'piece', price: 7500 },
    { key: 'ac-drain', name: 'Drain hose (5 m)', unit: 'length', price: 2500 },
    { key: 'ac-cable', name: '2.5 mm² cable (10 m)', unit: 'length', price: 7000 },
  ],
  Builder: [
    { key: 'hr-cement-b', name: 'Cement (50 kg)', unit: 'bag', price: 6500 },
    { key: 'bu-block6', name: 'Sandcrete block 6"', unit: 'block', price: 550 },
    { key: 'bu-block9', name: 'Sandcrete block 9"', unit: 'block', price: 700 },
    { key: 'bu-sand', name: 'Sharp sand', unit: 'ton', price: 25000 },
    { key: 'bu-granite', name: 'Granite ¾"', unit: 'ton', price: 38000 },
    { key: 'bu-rod12', name: 'Iron rod 12 mm', unit: 'length', price: 9500 },
    { key: 'bu-wire', name: 'Binding wire (roll)', unit: 'roll', price: 22000 },
    { key: 'bu-dpm', name: 'Damp-proof membrane (roll)', unit: 'roll', price: 30000 },
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

/**
 * What happens to money when the client accepts a bid. Materials are priced later by market vendors,
 * so when anything has to be bought nothing is paid yet: the client pays once the Allyfe representative
 * sends the best vendor quotation. With no materials to buy, the service fee is paid now
 * (less anything Allyfe already holds for this job).
 */
export function bidCharge(job: Pick<Job, 'escrow' | 'deliveredMaterials'>, bid: { lines: QuoteLine[]; serviceFee: number }) {
  const { billable, covered } = billableMaterials(bid.lines, job.deliveredMaterials);
  const payNow = billable.length === 0;
  return { billable, covered, serviceFee: bid.serviceFee, alreadyHeld: job.escrow, payNow, due: payNow ? bid.serviceFee - job.escrow : 0 };
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

export type Split = { serviceFee: number; platform: number; artisan: number; rate: string };

/** How the service fee still held is paid out when the client taps Job done. */
export function completionSplit(job: Pick<Job, 'escrow' | 'tier'>): Split {
  const platform = platformFee(job.escrow, job.tier);
  return { serviceFee: job.escrow, platform, artisan: job.escrow - platform, rate: feePercent(job.tier) };
}

/** The 50% rule on the service fee: what goes to the artisan for the visit and what returns to the client. */
export function misdescribedSplit(serviceFee: number): { artisan: number; clientRefund: number } {
  const artisan = Math.round(serviceFee * MISDESCRIBED_FORFEIT);
  return { artisan, clientRefund: serviceFee - artisan };
}

/** The job address with its city, without repeating the city when the address already has it. */
export const fullAddress = (j: Pick<Job, 'addr' | 'city'>) => (j.addr.toLowerCase().includes(j.city.toLowerCase()) ? j.addr : `${j.addr}, ${j.city}`);

/* ---------------- labels ---------------- */

export const JOB_STATUS_LABEL: Record<Job['status'], string> = {
  open: 'Waiting for bids',
  awarded: 'Sourcing materials',
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
    { key: 'accepted', label: 'Quotation accepted' },
    { key: 'vendor', label: 'Market vendors pricing materials' },
    { key: 'paid', label: 'Paid for materials and workmanship' },
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
    case 'awarded': {
      const sp = job.supply;
      if (sp && sp.orders.some((o) => o.status !== 'cancelled' && o.status !== 'declined')) return at('delivered');
      return sp?.plan ? at('paid') : at('vendor');
    }
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

/* ---------------- accounts ---------------- */

/**
 * Nigerian mobile numbers in one canonical form, +234 followed by 10 digits.
 * Accepts 0803…, 803…, 234803… and +234 803…. Returns null if it isn't a valid mobile number.
 */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('234')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return /^[789][01]\d{8}$/.test(d) ? '+234' + d : null;
}

/** 0803 000 1111 style, for showing a canonical number. */
export function displayPhone(canonical: string): string {
  const d = '0' + canonical.replace(/^\+234/, '');
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

export const BANKS = [
  'Access Bank', 'Ecobank', 'Fidelity Bank', 'First Bank', 'FCMB', 'GTBank', 'Kuda', 'Moniepoint', 'Opay', 'PalmPay',
  'Polaris Bank', 'Stanbic IBTC', 'Sterling Bank', 'UBA', 'Union Bank', 'Wema Bank', 'Zenith Bank',
] as const;

/** Nigerian account numbers (NUBAN) are 10 digits. */
export const validAccountNumber = (n: string) => /^\d{10}$/.test(n.replace(/\s/g, ''));
/** Only the bank and last four digits are kept on the profile. */
export const maskBank = (bankName: string, accountNumber: string) => `${bankName} •••• ${accountNumber.replace(/\s/g, '').slice(-4)}`;

/** A friendly illustrated avatar picked from the name, for people who skip the photo. */
export function avatarFor(name: string, photo?: string) {
  const palette = [
    ['#E8ECF3', '#14B8A6'], ['#FDE7C7', '#0E1F3B'], ['#DBEAFE', '#1F2937'], ['#EDE9FE', '#7C3AED'],
    ['#DCFCE7', '#15803D'], ['#FFE4E0', '#0E1F3B'], ['#E0F2FE', '#0369A1'], ['#FEF3C7', '#B45309'],
  ];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, shirt] = palette[h % palette.length];
  const skins = ['#6B3F22', '#5A3420', '#7A4A2A'];
  const hairs = ['short', 'long', 'wrap', 'short'] as const;
  return { bg, shirt, skin: skins[h % skins.length], hair: hairs[(h >> 3) % hairs.length], ...(photo ? { photo } : {}) };
}

/* ---------------- Allyfe Supply: comparison engine ---------------- */

/** Quantity of each line still to be sourced: not delivered, and not held by a live purchase order. */
export function supplyNeed(supply: Pick<Supply, 'lines' | 'orders'>): Record<string, number> {
  const need: Record<string, number> = {};
  for (const l of supply.lines) need[l.id] = l.qty - l.delivered;
  for (const o of supply.orders) {
    if (!['issued', 'confirmed', 'dispatched'].includes(o.status)) continue;
    for (const pl of o.lines) need[pl.lineId] -= o.status === 'issued' ? pl.qty : (pl.confirmed ?? pl.qty);
  }
  for (const k of Object.keys(need)) need[k] = Math.max(0, need[k]);
  return need;
}

export type SupplyOption = {
  kind: 'single' | 'combined';
  /** For a single supplier: who. */
  vendorId?: string;
  vendorIds: string[];
  allocations: Allocation[];
  materials: number;
  delivery: number;
  total: number;
  /** True when every outstanding quantity is covered. */
  complete: boolean;
  uncovered: { lineId: string; qty: number }[];
  substitutions: number;
};

const finish = (kind: SupplyOption['kind'], allocations: Allocation[], offers: SupplyOffer[], need: Record<string, number>, vendorId?: string): SupplyOption => {
  const vendorIds = [...new Set(allocations.map((a) => a.vendorId))];
  const materials = allocations.reduce((s, a) => s + a.qty * a.unitPrice, 0);
  const delivery = vendorIds.reduce((s, v) => s + (offers.find((o) => o.vendorId === v && o.status === 'active')?.deliveryFee ?? 0), 0);
  const got: Record<string, number> = {};
  for (const a of allocations) got[a.lineId] = (got[a.lineId] ?? 0) + a.qty;
  const uncovered = Object.entries(need).filter(([id, q]) => q > (got[id] ?? 0)).map(([lineId, q]) => ({ lineId, qty: q - (got[lineId] ?? 0) }));
  return { kind, vendorId, vendorIds, allocations, materials, delivery, total: materials + delivery, complete: uncovered.length === 0, uncovered, substitutions: allocations.filter((a) => a.substitute).length };
};

/**
 * Compares sourcing options for what is still needed:
 * every vendor who can supply the complete outstanding list on their own, and the
 * cheapest combination of vendors (line by line, splitting quantities, never
 * allocating any offered stock twice). Sorted complete-first, then by total cost.
 */
export function compareOffers(supply: Pick<Supply, 'lines' | 'orders' | 'offers'>): SupplyOption[] {
  const need = supplyNeed(supply);
  const needed = Object.entries(need).filter(([, q]) => q > 0);
  const offers = supply.offers.filter((o) => o.status === 'active');
  if (!needed.length || !offers.length) return [];
  const options: SupplyOption[] = [];
  for (const o of offers) {
    const allocations: Allocation[] = [];
    for (const [lineId, q] of needed) {
      const it = o.items.find((i) => i.lineId === lineId);
      if (it && it.qty > 0) allocations.push({ lineId, vendorId: o.vendorId, offerId: o.id, qty: Math.min(q, it.qty), unitPrice: it.unitPrice, ...(it.substitute ? { substitute: it.substitute } : {}) });
    }
    const opt = finish('single', allocations, offers, need, o.vendorId);
    if (opt.complete) options.push(opt);
  }
  // Combined: for each line take the cheapest offered stock first (spec matches before substitutes).
  const left = new Map<string, number>();
  for (const o of offers) for (const it of o.items) left.set(o.id + '|' + it.lineId, it.qty);
  const combined: Allocation[] = [];
  for (const [lineId, q] of needed) {
    let remaining = q;
    const items = offers
      .flatMap((o) => o.items.filter((i) => i.lineId === lineId && i.qty > 0).map((i) => ({ o, i })))
      .sort((a, b) => Number(!!a.i.substitute) - Number(!!b.i.substitute) || a.i.unitPrice - b.i.unitPrice);
    for (const { o, i } of items) {
      if (remaining <= 0) break;
      const k = o.id + '|' + lineId;
      const take = Math.min(remaining, left.get(k) ?? 0);
      if (take <= 0) continue;
      left.set(k, (left.get(k) ?? 0) - take);
      remaining -= take;
      combined.push({ lineId, vendorId: o.vendorId, offerId: o.id, qty: take, unitPrice: i.unitPrice, ...(i.substitute ? { substitute: i.substitute } : {}) });
    }
  }
  const comb = finish('combined', combined, offers, need);
  const sameAsSingle = comb.vendorIds.length === 1 && options.some((o) => o.vendorId === comb.vendorIds[0] && o.total === comb.total);
  if (comb.allocations.length && !sameAsSingle) options.push(comb);
  return options.sort((a, b) => Number(b.complete) - Number(a.complete) || a.total - b.total);
}

/**
 * Money Allyfe holds for materials on this job that is not yet committed to a purchase order
 * (escrow minus the service fee and unpaid orders). Negative when the service fee itself is not paid yet.
 */
export function supplyFunds(job: Pick<Job, 'escrow' | 'serviceFee' | 'supply'>): number {
  const committed = (job.supply?.orders ?? [])
    .filter((o) => ['issued', 'confirmed', 'dispatched'].includes(o.status))
    .reduce((s, o) => s + o.lines.reduce((t, l) => t + (o.status === 'issued' ? l.qty : (l.confirmed ?? l.qty)) * l.unitPrice, 0) + o.deliveryFee, 0);
  return job.escrow - (job.serviceFee ?? 0) - committed;
}

export const poTotal = (o: Pick<PurchaseOrder, 'lines' | 'deliveryFee' | 'status'>) =>
  o.lines.reduce((s, l) => s + (o.status === 'issued' ? l.qty : (l.confirmed ?? l.qty)) * l.unitPrice, 0) + o.deliveryFee;

export const lineProgress = (l: SupplyLine) => `${l.delivered} of ${l.qty} ${l.unit}${l.qty === 1 ? '' : 's'}`;
/** What the client pays to approve a plan (never negative; any saving is returned at the end). */
export const planDue = (job: Pick<Job, 'escrow' | 'serviceFee' | 'supply'>, total: number) => Math.max(0, total - supplyFunds(job));

export const offerTotal = (items: OfferItem[], deliveryFee: number) => items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + deliveryFee;

export const SUPPLY_STATUS_LABEL: Record<Supply['status'], string> = {
  sourcing: 'Vendors are pricing the materials',
  approval: 'Quotation sent to the client',
  ordering: 'Purchase orders sent',
  delivering: 'Materials on the way',
  complete: 'All materials delivered',
  cancelled: 'Cancelled',
};
