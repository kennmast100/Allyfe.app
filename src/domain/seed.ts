import type { AppState, Artisan, Client, Company, Job, Post, Tool, User } from './types';
import { tierPrices } from './rules';

export const STATE_VERSION = 1;

const H = 3600_000;
const D = 24 * H;

function artisan(a: Omit<Artisan, 'role' | 'verification'> & { verification?: Artisan['verification'] }): Artisan {
  return {
    role: 'artisan',
    verification: { status: 'verified', files: { id: 'room', selfie: 'room', w1: 'cabinet', w2: 'wardrobe', w3: 'ceiling' } },
    ...a,
  };
}

export function seedState(now = Date.now()): AppState {
  const clients: Client[] = [
    { id: 'c-kenneth', role: 'client', name: 'Kenneth Obi', phone: '0803 000 1111', area: 'GRA Phase 2, Port Harcourt', bank: 'GTBank •••• 4471', avatar: { bg: '#E8ECF3', skin: '#6B3F22', hair: 'short', shirt: '#14B8A6' } },
    { id: 'c-ada', role: 'client', name: 'Ada Nwachukwu', phone: '0803 000 2222', area: 'D-Line, Port Harcourt', bank: 'Zenith •••• 9013', avatar: { bg: '#FFE4E0', skin: '#7A4A2A', hair: 'long', shirt: '#0E1F3B' } },
  ];
  const artisans: Artisan[] = [
    artisan({ id: 'a-emeka', name: 'Emeka Uche', phone: '0803 000 3333', trade: 'Carpenter', categories: ['Home Renovation', 'Interior Design'], rating: 4.9, ratingCount: 120, jobsDone: 132, area: 'Rumuola, Port Harcourt', years: 9, bio: 'Kitchen cabinets, wardrobes, doors and POP ceilings.', avatar: { bg: '#FDE7C7', skin: '#6B3F22', hair: 'hat', shirt: '#0E1F3B', vest: true }, work: ['cabinet', 'wardrobe', 'ceiling'], bank: 'Access Bank •••• 2210' }),
    artisan({ id: 'a-chidi', name: 'Chidi Amadi', phone: '0803 000 4444', trade: 'Electrician', categories: ['Electrical'], rating: 4.8, ratingCount: 95, jobsDone: 101, area: 'Trans-Amadi, Port Harcourt', years: 7, bio: 'House wiring, solar installs and fault finding.', avatar: { bg: '#DBEAFE', skin: '#5A3420', hair: 'hat', shirt: '#1F2937', vest: true }, work: ['solar', 'room'], bank: 'UBA •••• 5521' }),
    artisan({ id: 'a-ibrahim', name: 'Ibrahim Sani', phone: '0803 000 5555', trade: 'Plumber', categories: ['Plumbing'], rating: 4.8, ratingCount: 80, jobsDone: 88, area: 'D-Line, Port Harcourt', years: 11, bio: 'Leaks, boreholes, bathroom fittings.', avatar: { bg: '#E0F2FE', skin: '#7A4A2A', hair: 'short', shirt: '#0369A1' }, work: ['tiles'], bank: 'First Bank •••• 7782' }),
    artisan({ id: 'a-blessing', name: 'Blessing Okoro', phone: '0803 000 6666', trade: 'Painter', categories: ['Painting', 'Interior Design'], rating: 4.7, ratingCount: 64, jobsDone: 70, area: 'GRA Phase 2, Port Harcourt', years: 6, bio: 'Interior and exterior painting, wall finishes.', avatar: { bg: '#EDE9FE', skin: '#6B3F22', hair: 'long', shirt: '#7C3AED' }, work: ['room'], bank: 'GTBank •••• 1180' }),
    artisan({ id: 'a-tunde', name: 'Tunde Bakare', phone: '0803 000 7777', trade: 'Tiler', categories: ['Home Renovation'], rating: 4.6, ratingCount: 41, jobsDone: 45, area: 'Eliozu, Port Harcourt', years: 5, bio: 'Floor and wall tiling, bathrooms.', avatar: { bg: '#DCFCE7', skin: '#5A3420', hair: 'hat', shirt: '#15803D', vest: true }, work: ['tiles'], bank: 'Fidelity •••• 3304' }),
    artisan({ id: 'a-grace', name: 'Grace Nwosu', phone: '0803 000 8888', trade: 'Electrician', categories: ['Electrical'], rating: 4.5, ratingCount: 22, jobsDone: 24, area: 'Rumuokoro, Port Harcourt', years: 4, bio: 'Sockets, lighting and inverter setup.', avatar: { bg: '#FFE4E0', skin: '#7A4A2A', hair: 'wrap', shirt: '#0E1F3B' }, work: ['room'], bank: 'Access Bank •••• 6610', verification: { status: 'partial', files: { id: 'room', selfie: 'room' } } }),
  ];
  const companies: Company[] = [
    { id: 'co-buildright', role: 'company', name: 'BuildRight Tools', phone: '0803 000 9999', area: 'Trans-Amadi, Port Harcourt', bank: 'Zenith •••• 2002', avatar: { bg: '#FEF3C7', skin: '#5A3420', hair: 'short', shirt: '#B45309' }, verification: { status: 'verified', files: { cac: 'room', shop: 'room', owner: 'room', w1: 'room' } } },
    { id: 'co-toolhub', role: 'company', name: 'ToolHub PH', phone: '0803 000 1010', area: 'Rumuola, Port Harcourt', bank: 'GTBank •••• 6789', avatar: { bg: '#0E1F3B', skin: '#7A4A2A', hair: 'short', shirt: '#F59E0B' }, verification: { status: 'none', files: {} } },
  ];
  const users: Record<string, User> = {};
  [...clients, ...artisans, ...companies].forEach((u) => (users[u.id] = u));

  const tools: Tool[] = [
    { id: 't1', companyId: 'co-buildright', name: 'Cordless drill kit', kind: 'drill', pricePerDay: 8000 },
    { id: 't2', companyId: 'co-buildright', name: 'Tile cutter (60 cm)', kind: 'cutter', pricePerDay: 6500 },
    { id: 't6', companyId: 'co-buildright', name: 'Concrete mixer', kind: 'mixer', pricePerDay: 18000 },
    { id: 't3', companyId: 'co-toolhub', name: 'Mobile scaffold set', kind: 'scaffold', pricePerDay: 15000 },
    { id: 't4', companyId: 'co-toolhub', name: 'Airless paint sprayer', kind: 'sprayer', pricePerDay: 12000 },
    { id: 't5', companyId: 'co-toolhub', name: '5 kVA generator', kind: 'generator', pricePerDay: 10000 },
  ];

  const openJob = (id: string, ref: string, title: string, desc: string, category: Job['category'], tier: Job['tier'], ago: number, photos: string[]): Job => {
    const deposit = tierPrices(category)[tier];
    return {
      id, ref, clientId: 'c-ada', title, desc, addr: '7 Ikwerre Road, D-Line', category, tier, deposit, escrow: deposit,
      schedule: { mode: 'Next week', days: [] }, photos, status: 'open', proposals: [],
      history: [{ label: `${formatShort(deposit)} paid into Allyfe`, by: 'Ada Nwachukwu', at: now - ago }],
      createdAt: now - ago,
    };
  };
  const jobs: Job[] = [
    openJob('j-seed1', 'PH-4120', 'Kitchen cabinet installation', 'Fit 6 base units and 4 wall units in a new kitchen. Units are bought; need assembly, levelling and fixing to concrete walls.', 'Home Renovation', 'Pro', 2 * D, ['cabinet']),
    openJob('j-seed2', 'PH-4121', 'POP ceiling and lighting', 'POP ceiling with 8 recessed lights for a 6 m by 5 m living room. Wiring is already in place.', 'Interior Design', 'Premium', 3 * D, ['ceiling']),
    openJob('j-seed3', 'PH-4122', 'Built-in wardrobe, 2 rooms', 'Two built-in wardrobes, 2.4 m wide each, with sliding doors.', 'Home Renovation', 'Basic', 4 * D, ['wardrobe']),
    {
      id: 'j-seed0', ref: 'PH-4007', clientId: 'c-kenneth', title: 'Fix leaking kitchen sink', desc: 'Sink trap leaking under the cabinet.', addr: '12 Woji Road, GRA Phase 2',
      category: 'Plumbing', tier: 'Basic', deposit: 35000, escrow: 0, schedule: { mode: 'This week', days: [] }, photos: ['tiles'], status: 'completed',
      proposals: [{ id: 'pr-seed0', artisanId: 'a-ibrahim', kind: 'apply', amount: 35000, message: 'I can come tomorrow morning.', status: 'accepted', at: now - 70 * D }],
      artisanId: 'a-ibrahim', agreedAmount: 35000,
      history: [
        { label: '₦35,000 paid into Allyfe', by: 'Kenneth Obi', at: now - 71 * D },
        { label: 'Work completed · payment released', by: 'Kenneth Obi', at: now - 69 * D },
      ],
      review: { stars: 5, text: 'Quick and tidy.', at: now - 69 * D },
      createdAt: now - 71 * D,
    },
  ];

  const posts: Post[] = [
    { id: 'p1', authorId: 'a-blessing', image: 'room', text: 'Living room repaint finished today in GRA. Client chose a soft green with a white trim.', likes: ['c-ada', 'a-tunde'], comments: [{ id: 'cm1', authorId: 'c-kenneth', text: 'Clean lines. Saving this for my sitting room.', at: now - 1.5 * H }, { id: 'cm2', authorId: 'a-tunde', text: 'Nice finish, sis.', at: now - H }], at: now - 2 * H },
    { id: 'p2', authorId: 'a-chidi', image: 'solar', text: '4 panels and a 3.5 kVA inverter installed in Trans-Amadi. No more fuel queues for this family.', likes: ['a-grace', 'c-ada', 'a-emeka'], comments: [{ id: 'cm3', authorId: 'a-grace', text: 'Good job on the cable runs.', at: now - 4 * H }], at: now - 5 * H },
    { id: 'p3', authorId: 'a-tunde', image: 'tiles', text: 'Bathroom retiled in 3 days, using a tile cutter rented from BuildRight Tools on Allyfe.', likes: ['a-emeka'], comments: [], at: now - D },
  ];

  return {
    version: STATE_VERSION,
    sessionUserId: null,
    users,
    jobs,
    tools,
    rentals: [],
    posts,
    wallets: { 'c-kenneth': 250000, 'c-ada': 150000, 'a-emeka': 86500, 'a-chidi': 42000, 'a-ibrahim': 61000, 'a-blessing': 23000, 'a-tunde': 9000, 'a-grace': 0, 'co-buildright': 54000, 'co-toolhub': 0 },
    txns: {
      'c-kenneth': [{ id: 'x1', label: 'Top-up from GTBank', amount: 250000, kind: 'in', at: now - 5 * D }],
      'a-emeka': [
        { id: 'x2', label: 'Payment · Wardrobe for Mrs Ada', amount: 180000, kind: 'in', at: now - 10 * D },
        { id: 'x3', label: 'Withdrawal to Access Bank', amount: 120000, kind: 'out', at: now - 9 * D },
        { id: 'x4', label: 'Tile cutter rental · BuildRight', amount: 13000, kind: 'out', at: now - 16 * D },
      ],
    },
    alerts: {},
    favourites: {},
    seq: 1,
  };
}

function formatShort(n: number) {
  return '₦' + n.toLocaleString('en-NG');
}

/** Accounts offered on the sign-in screen. */
export const DEMO_ACCOUNTS: { id: string; note: string }[] = [
  { id: 'c-kenneth', note: 'Client · hiring for his home' },
  { id: 'c-ada', note: 'Client · has 3 open jobs' },
  { id: 'a-emeka', note: 'Artisan · carpenter, ★ 4.9' },
  { id: 'a-grace', note: 'Artisan · verification not finished' },
  { id: 'co-toolhub', note: 'Tool company · not yet verified' },
  { id: 'co-buildright', note: 'Tool company · verified' },
];
