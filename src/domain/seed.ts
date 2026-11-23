import type { AppState, Artisan, Category, Client, Job, Post, QuoteLine, Rep, User, Vendor } from './types';
import { MATERIALS, dayKey, earliestWorkDay } from './rules';
import { reduce, type Action } from './actions';

export const STATE_VERSION = 5;

const H = 3600_000;
const D = 24 * H;

type ArtisanSeed = Omit<Artisan, 'role' | 'verification' | 'city' | 'kind' | 'teamMembers' | 'apprentices' | 'specialisations'> &
  Partial<Pick<Artisan, 'verification' | 'city' | 'kind' | 'teamMembers' | 'apprentices' | 'teamName' | 'specialisations'>>;
function artisan(a: ArtisanSeed): Artisan {
  return {
    role: 'artisan',
    city: 'Port Harcourt',
    kind: 'individual',
    teamMembers: [],
    apprentices: [],
    specialisations: [],
    verification: { status: 'verified', files: { id: 'room', selfie: 'room', w1: 'cabinet', w2: 'wardrobe', w3: 'ceiling' } },
    ...a,
  };
}
const vendorDocs = { status: 'verified' as const, files: { cac: 'room', shop: 'room', owner: 'room', w1: 'room' } };

export function seedState(now = Date.now()): AppState {
  const clients: Client[] = [
    { id: 'c-kenneth', role: 'client', city: 'Port Harcourt', name: 'Kenneth Obi', phone: '0803 000 1111', area: 'GRA Phase 2, Port Harcourt', bank: 'GTBank •••• 4471', avatar: { bg: '#E8ECF3', skin: '#6B3F22', hair: 'short', shirt: '#14B8A6' } },
    { id: 'c-ada', role: 'client', city: 'Port Harcourt', name: 'Ada Nwachukwu', phone: '0803 000 2222', area: 'D-Line, Port Harcourt', bank: 'Zenith •••• 9013', avatar: { bg: '#FFE4E0', skin: '#7A4A2A', hair: 'long', shirt: '#0E1F3B' } },
  ];
  const artisans: Artisan[] = [
    artisan({
      id: 'a-emeka', name: 'Emeka Uche', phone: '0803 000 3333', trade: 'Woodworker', categories: ['Woodworker', 'POP Installer'], specialisations: ['Kitchen cabinets', 'Wardrobes', 'Carpentry', 'POP ceilings'],
      rating: 4.9, ratingCount: 120, jobsDone: 132, area: 'Rumuola, Port Harcourt', years: 9,
      bio: 'Kitchen cabinets, wardrobes, doors and POP ceilings.', avatar: { bg: '#FDE7C7', skin: '#6B3F22', hair: 'hat', shirt: '#0E1F3B', vest: true }, work: ['cabinet', 'wardrobe', 'ceiling'], bank: 'Access Bank •••• 2210',
      apprentices: [{ id: 'ap-chinedu', name: 'Chinedu Okafor', phone: '0803 000 1212', photo: 'room', addedAt: now - 400 * D }],
    }),
    artisan({ id: 'a-chidi', name: 'Chidi Amadi', phone: '0803 000 4444', trade: 'Electrician', categories: ['Electrician'], specialisations: ['House wiring', 'Electrical installations', 'Repairs'], rating: 4.8, ratingCount: 95, jobsDone: 101, area: 'Trans-Amadi, Port Harcourt', years: 7, bio: 'House wiring, solar installs and fault finding.', avatar: { bg: '#DBEAFE', skin: '#5A3420', hair: 'hat', shirt: '#1F2937', vest: true }, work: ['solar', 'room'], bank: 'UBA •••• 5521' }),
    artisan({ id: 'a-ibrahim', name: 'Ibrahim Sani', phone: '0803 000 5555', trade: 'Plumber', categories: ['Plumber'], specialisations: ['Bathroom fittings', 'Water systems', 'Repairs'], rating: 4.8, ratingCount: 80, jobsDone: 88, area: 'D-Line, Port Harcourt', years: 11, bio: 'Leaks, boreholes, bathroom fittings.', avatar: { bg: '#E0F2FE', skin: '#7A4A2A', hair: 'short', shirt: '#0369A1' }, work: ['tiles'], bank: 'First Bank •••• 7782' }),
    artisan({ id: 'a-blessing', name: 'Blessing Okoro', phone: '0803 000 6666', trade: 'Painter', categories: ['Painter'], specialisations: ['Interior painting', 'Exterior painting', 'Decorative finishes'], rating: 4.7, ratingCount: 64, jobsDone: 70, area: 'GRA Phase 2, Port Harcourt', years: 6, bio: 'Interior and exterior painting, wall finishes.', avatar: { bg: '#EDE9FE', skin: '#6B3F22', hair: 'long', shirt: '#7C3AED' }, work: ['room'], bank: 'GTBank •••• 1180' }),
    artisan({
      id: 'a-tunde', name: 'Tunde Bakare', phone: '0803 000 7777', trade: 'Tiler', categories: ['Tiler'], specialisations: ['Floor tiling', 'Wall tiling', 'Bathroom tiling'], rating: 4.6, ratingCount: 41, jobsDone: 45, area: 'Eliozu, Port Harcourt', years: 5, bio: 'Floor and wall tiling, bathrooms. A team of four for bigger jobs.',
      avatar: { bg: '#DCFCE7', skin: '#5A3420', hair: 'hat', shirt: '#15803D', vest: true }, work: ['tiles'], bank: 'Fidelity •••• 3304',
      kind: 'team', teamName: 'Tunde & Sons Tiling', teamMembers: ['Tunde Bakare', 'Sola Bakare', 'Musa Ibrahim', 'Peter Eze'],
    }),
    artisan({ id: 'a-grace', name: 'Grace Nwosu', phone: '0803 000 8888', trade: 'Electrician', categories: ['Electrician'], specialisations: ['Lighting', 'Repairs'], rating: 4.5, ratingCount: 22, jobsDone: 24, area: 'Rumuokoro, Port Harcourt', years: 4, bio: 'Sockets, lighting and inverter setup.', avatar: { bg: '#FFE4E0', skin: '#7A4A2A', hair: 'wrap', shirt: '#0E1F3B' }, work: ['room'], bank: 'Access Bank •••• 6610', verification: { status: 'partial', files: { id: 'room', selfie: 'room' } } }),
    artisan({ id: 'a-chinedu', name: 'Chinedu Okafor', phone: '0803 000 1212', trade: 'Woodworker', categories: ['Woodworker'], specialisations: ['Kitchen cabinets', 'Wardrobes'], rating: 4.6, ratingCount: 6, jobsDone: 6, area: 'Rumuola, Port Harcourt', years: 1, bio: 'Trained under Emeka Uche for two years. Cabinets and wardrobes.', avatar: { bg: '#FEF3C7', skin: '#5A3420', hair: 'short', shirt: '#B45309' }, work: ['wardrobe'], bank: 'Opay •••• 4040' }),
    artisan({ id: 'a-david', name: 'David Johnson', phone: '0803 000 1717', trade: 'Plumber', categories: ['Plumber'], specialisations: ['Pipe installation', 'Bathroom fittings'], rating: 4.5, ratingCount: 30, jobsDone: 33, area: 'Rumuibekwe, Port Harcourt', years: 5, bio: 'Bathroom and kitchen plumbing, water heaters.', avatar: { bg: '#DCFCE7', skin: '#5A3420', hair: 'short', shirt: '#0F766E' }, work: ['tiles'], bank: 'Kuda •••• 1717' }),
    artisan({ id: 'a-musa', name: 'Musa Danjuma', phone: '0803 000 2121', trade: 'Welder', categories: ['Welder'], specialisations: ['Gates', 'Burglary proofs', 'Railings'], rating: 4.7, ratingCount: 38, jobsDone: 41, area: 'Woji, Port Harcourt', years: 10, bio: 'Gates, burglary proofs, railings and staircases.', avatar: { bg: '#FEF3C7', skin: '#7A4A2A', hair: 'hat', shirt: '#1F2937', vest: true }, work: ['room'], bank: 'Zenith •••• 2121' }),
    artisan({ id: 'a-kelechi', name: 'Kelechi Nwankwo', phone: '0803 000 2323', trade: 'AC Technician', categories: ['AC Technician'], specialisations: ['AC installation', 'AC servicing', 'AC repairs'], rating: 4.8, ratingCount: 57, jobsDone: 60, area: 'Rumuokwuta, Port Harcourt', years: 8, bio: 'Split and window AC installation, gas refill and servicing.', avatar: { bg: '#E0F2FE', skin: '#5A3420', hair: 'short', shirt: '#0369A1' }, work: ['room'], bank: 'UBA •••• 2323' }),
    artisan({
      id: 'a-joy', name: 'Joy Ekpo', phone: '0803 000 2424', trade: 'Cleaner', categories: ['Cleaner'], specialisations: ['Domestic cleaning', 'Post-construction cleaning'], rating: 4.9, ratingCount: 44, jobsDone: 47, area: 'Elelenwo, Port Harcourt', years: 4, bio: 'Deep cleaning for homes and after building work.',
      avatar: { bg: '#DCFCE7', skin: '#6B3F22', hair: 'wrap', shirt: '#0F766E' }, work: ['room'], bank: 'Moniepoint •••• 2424', kind: 'team', teamName: 'Sparkle Cleaning Crew', teamMembers: ['Joy Ekpo', 'Esther Ekpo', 'Mary Bassey'],
    }),
    artisan({ id: 'a-segun', name: 'Segun Alabi', phone: '0803 000 2525', trade: 'Builder', categories: ['Builder', 'Tiler'], specialisations: ['Building construction', 'Blockwork', 'Renovations'], rating: 4.6, ratingCount: 29, jobsDone: 31, area: 'Eneka, Port Harcourt', years: 12, bio: 'Fences, extensions and renovations from foundation to roofing.', avatar: { bg: '#FDE7C7', skin: '#5A3420', hair: 'hat', shirt: '#B45309', vest: true }, work: ['room'], bank: 'First Bank •••• 2525' }),
    artisan({ id: 'a-ikenna', name: 'Ikenna Obi', phone: '0803 000 2626', trade: 'Glass Installer', categories: ['Glass Installer', 'Aluminium Fabricator'], specialisations: ['Shower cubicles', 'Mirrors', 'Aluminium windows'], rating: 4.7, ratingCount: 33, jobsDone: 35, area: 'Rumuokoro, Port Harcourt', years: 7, bio: 'Shower cubicles, mirrors, glass doors and aluminium windows.', avatar: { bg: '#EDE9FE', skin: '#7A4A2A', hair: 'short', shirt: '#6D28D9' }, work: ['room'], bank: 'GTBank •••• 2626' }),
    artisan({ id: 'a-femi', name: 'Femi Adeyemi', phone: '0803 000 1313', city: 'Lagos', trade: 'Plumber', categories: ['Plumber'], specialisations: ['Pipe installation', 'Repairs'], rating: 4.8, ratingCount: 70, jobsDone: 75, area: 'Yaba, Lagos', years: 8, bio: 'Plumbing for homes and offices in Lagos mainland.', avatar: { bg: '#E0F2FE', skin: '#6B3F22', hair: 'short', shirt: '#0E1F3B' }, work: ['tiles'], bank: 'GTBank •••• 1313' }),
  ];
  const vendors: Vendor[] = [
    { id: 'v-mile3', role: 'vendor', city: 'Port Harcourt', market: 'Mile 3 Market', ownerName: 'Ngozi Eke', categories: ['Woodworker', 'Tiler', 'Painter', 'POP Installer', 'Builder', 'Welder', 'Plumber', 'Electrician'], name: 'Mile 3 Building Supplies', phone: '0803 000 1414', area: 'Mile 3, Port Harcourt', bank: 'UBA •••• 1414', avatar: { bg: '#DCFCE7', skin: '#6B3F22', hair: 'wrap', shirt: '#15803D' }, verification: vendorDocs },
    { id: 'v-oilmill', role: 'vendor', city: 'Port Harcourt', market: 'Oil Mill Market', ownerName: 'Musa Bello', categories: ['Electrician', 'Plumber', 'AC Technician', 'Welder'], name: 'Oil Mill Electricals & Plumbing', phone: '0803 000 1515', area: 'Oil Mill, Port Harcourt', bank: 'Zenith •••• 1515', avatar: { bg: '#E0F2FE', skin: '#5A3420', hair: 'short', shirt: '#0369A1' }, verification: vendorDocs },
    { id: 'v-glass', role: 'vendor', city: 'Port Harcourt', market: 'Rumuokoro Market', ownerName: 'Peace Amadi', categories: ['Glass Installer', 'Aluminium Fabricator', 'Cleaner'], name: 'Rumuokoro Glass & Aluminium', phone: '0803 000 1919', area: 'Rumuokoro, Port Harcourt', bank: 'Access Bank •••• 1919', avatar: { bg: '#EDE9FE', skin: '#7A4A2A', hair: 'long', shirt: '#6D28D9' }, verification: vendorDocs },
    { id: 'v-tradefair', role: 'vendor', city: 'Lagos', market: 'Trade Fair Complex', ownerName: 'Bisi Ade', categories: ['Plumber', 'Electrician', 'Tiler'], name: 'Trade Fair Supplies', phone: '0803 000 1616', area: 'Ojo, Lagos', bank: 'GTBank •••• 1616', avatar: { bg: '#EDE9FE', skin: '#7A4A2A', hair: 'short', shirt: '#6D28D9' }, verification: vendorDocs },
  ];
  const reps: Rep[] = [
    { id: 'r-ifeoma', role: 'rep', city: 'Port Harcourt', name: 'Ifeoma Briggs', phone: '0803 000 1818', area: 'Mile 3, Port Harcourt', bank: '', markets: ['Mile 3 Market', 'Oil Mill Market', 'Rumuokoro Market'], rating: 4.7, ratingCount: 9, avatar: { bg: '#FEF3C7', skin: '#6B3F22', hair: 'long', shirt: '#F59E0B' } },
  ];
  const users: Record<string, User> = {};
  [...clients, ...artisans, ...vendors, ...reps].forEach((u) => (users[u.id] = u));

  const day = (offset: number) => {
    const d = new Date(earliestWorkDay(now) + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    return dayKey(d);
  };
  const openJob = (id: string, ref: string, title: string, desc: string, category: Category, tier: Job['tier'], ago: number, media: string[]): Job => {
    const posted = now - ago;
    return {
      id, ref, clientId: 'c-ada', city: 'Port Harcourt', title, desc, addr: '7 Ikwerre Road, D-Line', category, tier, preferredDays: [day(0), day(2)], media,
      status: 'open', bids: [], escrow: 0, deliveredMaterials: [], noShows: [],
      history: [{ label: 'Job posted', by: 'Ada Nwachukwu', at: posted }], createdAt: posted,
    };
  };

  const posts: Post[] = [
    { id: 'p1', authorId: 'a-blessing', image: 'room', text: 'Living room repaint finished today in GRA. Client chose a soft green with a white trim.', likes: ['c-ada', 'a-tunde'], comments: [{ id: 'cm1', authorId: 'c-kenneth', text: 'Clean lines. Saving this for my sitting room.', at: now - 1.5 * H }, { id: 'cm2', authorId: 'a-tunde', text: 'Nice finish, sis.', at: now - H }], at: now - 2 * H },
    { id: 'p2', authorId: 'a-chidi', image: 'solar', text: '4 panels and a 3.5 kVA inverter installed in Trans-Amadi. No more fuel queues for this family.', likes: ['a-grace', 'c-ada', 'a-emeka'], comments: [{ id: 'cm3', authorId: 'a-grace', text: 'Good job on the cable runs.', at: now - 4 * H }], at: now - 5 * H },
    { id: 'p3', authorId: 'a-tunde', image: 'tiles', text: 'Bathroom retiled in 3 days. Client supplied the tiles through a Mile 3 vendor on Allyfe.', likes: ['a-emeka'], comments: [], at: now - D },
    { id: 'p5', authorId: 'v-mile3', image: 'tiles', text: 'Fresh stock of 60×60 floor tiles, matte grey and cream. Delivery anywhere in Port Harcourt.', likes: ['a-tunde', 'c-ada'], comments: [{ id: 'cm4', authorId: 'a-tunde', text: 'Do you have the glossy white?', at: now - 2 * H }], at: now - 3 * H, stock: { name: 'Floor tiles 60×60', price: 9500, unit: 'carton' } },
    { id: 'p6', authorId: 'v-oilmill', image: 'room', text: 'Kitchen sink mixer taps back in stock. Chrome finish, 1-year warranty.', likes: [], comments: [], at: now - 6 * H, stock: { name: 'Kitchen sink mixer tap', price: 18000, unit: 'piece' } },
    { id: 'p4', authorId: 'a-emeka', image: 'wardrobe', text: 'Sliding wardrobe for a family in Rumuola. Chinedu handled the doors and rails.', likes: ['c-kenneth'], comments: [], at: now - 200 * D },
  ];

  const START = { 'c-kenneth': 400000, 'c-ada': 300000 };
  const BIG = 10_000_000;
  let s: AppState = {
    version: STATE_VERSION,
    sessionUserId: null,
    users,
    jobs: [
      openJob('j-seed1', 'PH-4120', 'Kitchen cabinet installation', 'Fit 6 base units and 4 wall units in a new kitchen. Units are bought but not assembled; they need assembly, levelling and fixing to concrete walls. Space is 3.4 m wide.', 'Woodworker', 'Pro', 2 * H, ['cabinet']),
      openJob('j-seed2', 'PH-4121', 'POP ceiling with 8 downlights', 'POP ceiling for a 6 m by 5 m living room with 8 recessed downlights. Wiring points are already in place. Ceiling height is 3 m. Old ceiling boards must be removed first.', 'POP Installer', 'Premium', 5 * H, ['ceiling']),
      openJob('j-seed3', 'PH-4122', 'Built-in wardrobes for 2 bedrooms', 'Two built-in wardrobes, each 2.4 m wide and 2.4 m high, with sliding doors, one hanging rail and four shelves each. Walls are plastered concrete.', 'Woodworker', 'Basic', 7 * H, ['wardrobe']),
      {
        id: 'j-seed0', ref: 'PH-4007', clientId: 'c-kenneth', city: 'Port Harcourt', title: 'Fix leaking kitchen sink', desc: 'Sink trap leaking under the cabinet, water pools after every wash.', addr: '12 Woji Road, GRA Phase 2',
        category: 'Plumber', tier: 'Basic', preferredDays: [], media: ['tiles'], status: 'completed', escrow: 0, deliveredMaterials: [], noShows: [],
        bids: [{ id: 'b-seed0', artisanId: 'a-ibrahim', lines: [{ key: 'pl-ptrap', name: 'P-trap', unit: 'piece', unitPrice: 2500, qty: 1 }], serviceFee: 15000, day: dayKey(new Date(now - 69 * D)), message: 'I can come tomorrow morning.', status: 'accepted', at: now - 70 * D }],
        artisanId: 'a-ibrahim', acceptedBidId: 'b-seed0', serviceFee: 15000, scheduledDay: dayKey(new Date(now - 69 * D)),
        history: [
          { label: 'Job posted', by: 'Kenneth Obi', at: now - 71 * D },
          { label: 'Job done · artisan paid', by: 'Kenneth Obi', at: now - 69 * D },
        ],
        rating: { work: 5, attitude: 5, stars: 5, text: 'Quick and tidy.', at: now - 69 * D },
        createdAt: now - 71 * D,
      },
    ],
    posts,
    wallets: { 'c-kenneth': BIG, 'c-ada': BIG, 'a-emeka': 86500, 'a-chidi': 42000, 'a-ibrahim': 61000, 'a-blessing': 23000, 'a-tunde': 9000, 'a-grace': 0, 'a-chinedu': 12000, 'a-david': 18000, 'a-femi': 30000, 'a-musa': 15000, 'a-kelechi': 27000, 'a-joy': 8000, 'a-segun': 19000, 'a-ikenna': 11000, 'v-mile3': 64500 - 60000, 'v-oilmill': 0, 'v-glass': 0, 'v-tradefair': 0 },
    txns: {
      'v-mile3': [
        { id: 'xv3', label: 'Withdrawal to UBA •••• 1414', amount: 60000, kind: 'out', at: now - 8 * D },
        { id: 'xv2', label: 'Materials · Bathroom tiles for Eliozu job', amount: 64500, kind: 'in', at: now - 9 * D },
      ],
      'a-emeka': [
        { id: 'x2', label: 'Payment · Wardrobe for Mrs Ada', amount: 180000, kind: 'in', at: now - 10 * D },
        { id: 'x3', label: 'Withdrawal to Access Bank', amount: 120000, kind: 'out', at: now - 9 * D },
      ],
    },
    alerts: {},
    favourites: {},
    seq: 1,
  };

  /* ---- Allyfe Supply demo: real actions, played in the past, so every number and record is consistent ---- */
  let step = 0;
  const play = (userId: string, action: Action, at: number) => {
    s = reduce({ ...s, sessionUserId: userId }, action, at, 'seed' + String(++step).padStart(3, '0'));
  };
  const line = (cat: Category, key: string, qty: number, spec = ''): QuoteLine => {
    const m = MATERIALS[cat].find((x) => x.key === key)!;
    return { key: m.key, name: m.name, unit: m.unit, unitPrice: 0, qty, spec };
  };
  const J = (id: string) => s.jobs.find((j) => j.id === id)!;
  /** Posts a job, gets the artisan's bid and has the client accept it. Returns the stable demo id. */
  const awarded = (o: { id: string; clientId: string; addr: string; artisanId: string; title: string; desc: string; category: Category; tier: Job['tier']; lines: QuoteLine[]; fee: number; dayOffset: number; at: number; media: string[] }) => {
    play(o.clientId, { type: 'postJob', draft: { title: o.title, desc: o.desc, addr: o.addr, category: o.category, tier: o.tier, preferredDays: [day(o.dayOffset)], media: o.media, honest: true } }, o.at);
    const posted = s.jobs[0];
    const old = posted.id;
    posted.id = o.id;
    posted.ref = 'PH-' + o.id.replace(/\D/g, '').padStart(4, '41');
    for (const list of Object.values(s.alerts)) for (const a of list) if (a.jobId === old) a.jobId = o.id;
    play(o.artisanId, { type: 'submitBid', jobId: o.id, bid: { lines: o.lines, serviceFee: o.fee, day: day(o.dayOffset), message: '' } }, o.at + 1 * H);
    play(o.clientId, { type: 'acceptBid', jobId: o.id, bidId: J(o.id).bids[0].id }, o.at + 2 * H);
    return o.id;
  };
  const offer = (jobId: string, vendorId: string, items: [key: string, qty: number | 'all', price: number, substitute?: string][], deliveryFee: number, at: number, note = '') =>
    play(vendorId, {
      type: 'submitOffer', jobId, deliveryFee, deliveryDays: 1, note,
      items: items.map(([key, qty, unitPrice, substitute]) => {
        const l = J(jobId).supply!.lines.find((x) => x.key === key)!;
        return { lineId: l.id, qty: qty === 'all' ? l.qty : qty, unitPrice, ...(substitute ? { substitute } : {}) };
      }),
    }, at);
  const REP = 'r-ifeoma';
  const say = (userId: string, jobId: string, thread: string, text: string, at: number) => play(userId, { type: 'sendSupplyMessage', jobId, thread, text }, at);
  const lastPO = (jobId: string) => J(jobId).supply!.orders[J(jobId).supply!.orders.length - 1];

  // 6. Woodwork, delivered and paid: the materials are at Ada's home.
  const t4 = now - 4 * D;
  awarded({ id: 'j-v4', clientId: 'c-ada', addr: '7 Ikwerre Road, D-Line', artisanId: 'a-emeka', title: 'Kitchen wall units', category: 'Woodworker', tier: 'Pro', desc: 'Build and fit 3 wall units above the worktop, 2.4 m in total, MDF with soft-close doors. Walls are concrete.', lines: [line('Woodworker', 'hr-mdf', 3, '18 mm, white melamine'), line('Woodworker', 'hr-hinge', 6, 'Clip-on, 110°'), line('Woodworker', 'hr-handle', 3, 'Brushed steel, 128 mm'), line('Woodworker', 'hr-screws', 1)], fee: 70000, dayOffset: 2, at: t4, media: ['cabinet'] });
  offer('j-v4', 'v-mile3', [['hr-mdf', 'all', 24500], ['hr-hinge', 'all', 3200], ['hr-handle', 'all', 1200], ['hr-screws', 'all', 1800]], 3000, t4 + 4 * H, 'All in stock.');
  play(REP, { type: 'recommendPlan', jobId: 'j-v4', kind: 'single', vendorId: 'v-mile3' }, t4 + 6 * H);
  play('c-ada', { type: 'clientReviewSupply', jobId: 'j-v4', ok: true, note: '' }, t4 + 8 * H);
  play('v-mile3', { type: 'confirmPO', jobId: 'j-v4', poId: lastPO('j-v4').id, confirmed: {} }, t4 + 9 * H);
  play('v-mile3', { type: 'dispatchPO', jobId: 'j-v4', poId: lastPO('j-v4').id, waybill: 'GIG waybill 7712' }, t4 + 20 * H);
  play('c-ada', { type: 'receivePO', jobId: 'j-v4', poId: lastPO('j-v4').id, received: {} }, t4 + 26 * H);
  play('c-ada', { type: 'rateRep', jobId: 'j-v4', stars: 5, text: 'Ifeoma kept me updated and the boards came the next day.' }, t4 + 27 * H);

  // 4. Painting: Mile 3's delivery is on the way to Kenneth (he can receive or refuse it).
  const t3 = now - 36 * H;
  awarded({ id: 'j-v3', clientId: 'c-kenneth', addr: '12 Woji Road, GRA Phase 2', artisanId: 'a-blessing', title: 'Repaint living room and dining', category: 'Painter', tier: 'Pro', desc: 'Living and dining area, about 60 m² of wall, 3 m high. Light peeling near the window. Colour: soft green walls with white trim.', lines: [line('Painter', 'pa-emul', 2, 'Soft green, matt'), line('Painter', 'pa-gloss', 1, 'White'), line('Painter', 'pa-putty', 1), line('Painter', 'pa-roller', 2), line('Painter', 'pa-mask', 3)], fee: 60000, dayOffset: 0, at: t3, media: ['room'] });
  offer('j-v3', 'v-mile3', [['pa-emul', 'all', 34000], ['pa-gloss', 'all', 12000], ['pa-putty', 'all', 8500], ['pa-roller', 'all', 3500], ['pa-mask', 'all', 800]], 2500, t3 + 3 * H, 'Colour mixed at the shop.');
  play(REP, { type: 'recommendPlan', jobId: 'j-v3', kind: 'single', vendorId: 'v-mile3' }, t3 + 5 * H);
  play('c-kenneth', { type: 'clientReviewSupply', jobId: 'j-v3', ok: true, note: '' }, t3 + 7 * H);
  play('v-mile3', { type: 'confirmPO', jobId: 'j-v3', poId: lastPO('j-v3').id, confirmed: {} }, t3 + 8 * H);
  play('v-mile3', { type: 'dispatchPO', jobId: 'j-v3', poId: lastPO('j-v3').id, waybill: 'Rider Chuks · 0803 555 0303 · arriving this afternoon' }, now - 3 * H);
  say('v-mile3', 'j-v3', 'v-mile3', 'Paint has been mixed and sent. Rider should be there by 3pm.', now - 3 * H + 5 * 60000);
  say(REP, 'j-v3', 'client', 'Your paint is on the way, Mr Kenneth. Please check each item and tap “I\'ve received it” when it arrives.', now - 2 * H - 30 * 60000);

  // 5. Plumbing: Kenneth refused Mile 3's delivery. Mile 3 must collect it; Oil Mill's offer is still open for the rep to re-plan.
  const t5 = now - 30 * H;
  awarded({ id: 'j-v5', clientId: 'c-kenneth', addr: '12 Woji Road, GRA Phase 2', artisanId: 'a-ibrahim', title: 'Replace upstairs WC fittings', category: 'Plumber', tier: 'Basic', desc: 'Upstairs toilet cistern keeps running and the flush handle is broken. Replace the full cistern fittings set and the angle valve.', lines: [line('Plumber', 'pl-wc', 1, 'For a close-coupled cistern'), line('Plumber', 'pl-ball', 1, 'Angle valve, chrome'), line('Plumber', 'pl-ptfe', 2)], fee: 15000, dayOffset: 1, at: t5, media: ['tiles'] });
  offer('j-v5', 'v-oilmill', [['pl-wc', 'all', 16000], ['pl-ball', 'all', 2600], ['pl-ptfe', 'all', 300]], 2000, t5 + 3 * H);
  offer('j-v5', 'v-mile3', [['pl-wc', 'all', 14500], ['pl-ball', 'all', 2400], ['pl-ptfe', 'all', 300]], 0, t5 + 4 * H, 'Free delivery in GRA.');
  play(REP, { type: 'recommendPlan', jobId: 'j-v5', kind: 'single', vendorId: 'v-mile3' }, t5 + 5 * H);
  play('c-kenneth', { type: 'clientReviewSupply', jobId: 'j-v5', ok: true, note: '' }, t5 + 7 * H);
  play('v-mile3', { type: 'confirmPO', jobId: 'j-v5', poId: lastPO('j-v5').id, confirmed: {} }, t5 + 8 * H);
  play('v-mile3', { type: 'dispatchPO', jobId: 'j-v5', poId: lastPO('j-v5').id, waybill: 'Rider Ebi · 0803 555 0404' }, t5 + 20 * H);
  play('c-kenneth', { type: 'refusePO', jobId: 'j-v5', poId: lastPO('j-v5').id, reason: 'Wrong item or brand', note: 'Fittings are for a low-level cistern; mine is close-coupled.' }, now - 2 * H);
  say('c-kenneth', 'j-v5', 'client', 'The fittings they brought are the wrong type. Please get the close-coupled set.', now - 2 * H + 10 * 60000);

  // 3. Tiling: purchase order issued to Mile 3, waiting for Mile 3 to confirm its stock.
  const t2 = now - 20 * H;
  awarded({ id: 'j-v2', clientId: 'c-ada', addr: '7 Ikwerre Road, D-Line', artisanId: 'a-tunde', title: 'Retile guest bathroom floor', category: 'Tiler', tier: 'Basic', desc: 'Guest bathroom floor is 2.5 m by 2 m. Remove old cracked tiles and lay new 60×60 grey floor tiles. Drain must stay where it is.', lines: [line('Tiler', 'hr-tiles', 6, '60×60 matte grey, non-slip'), line('Tiler', 'hr-adhes', 3), line('Tiler', 'hr-grout', 2, 'Grey'), line('Tiler', 'hr-cement', 1)], fee: 40000, dayOffset: 1, at: t2, media: ['tiles'] });
  offer('j-v2', 'v-mile3', [['hr-tiles', 'all', 9200], ['hr-adhes', 'all', 7400], ['hr-grout', 'all', 2500], ['hr-cement', 'all', 6400]], 2000, t2 + 3 * H, 'Same batch, no shade difference.');
  play(REP, { type: 'recommendPlan', jobId: 'j-v2', kind: 'single', vendorId: 'v-mile3' }, t2 + 5 * H);
  play('c-ada', { type: 'clientReviewSupply', jobId: 'j-v2', ok: true, note: '' }, now - 4 * H);

  // 2. Welding: plan with a substitution and extra cost; the artisan has confirmed, Kenneth must approve.
  const t6 = now - 14 * H;
  awarded({ id: 'j-v6', clientId: 'c-kenneth', addr: '12 Woji Road, GRA Phase 2', artisanId: 'a-musa', title: 'Burglary proof for 4 windows', category: 'Welder', tier: 'Basic', desc: 'Four bedroom windows, each 1.2 m by 1.2 m, need burglary proofs in 1" square pipe with a simple vertical bar pattern, painted black.', lines: [line('Welder', 'we-square', 8, '1" square pipe, 1.5 mm'), line('Welder', 'we-flat', 4), line('Welder', 'we-rod', 1), line('Welder', 'we-paint', 1, 'Black, anti-rust')], fee: 45000, dayOffset: 2, at: t6, media: ['room'] });
  offer('j-v6', 'v-mile3', [['we-square', 'all', 9800, '1" square pipe 1.5 mm, Turkish brand (local brand out of stock)'], ['we-flat', 'all', 5600], ['we-rod', 'all', 7200], ['we-paint', 'all', 13500]], 3500, t6 + 3 * H, 'Local 1.5 mm pipe is out of stock until next month. The Turkish brand is the same gauge, slightly dearer.');
  offer('j-v6', 'v-oilmill', [['we-rod', 'all', 6800], ['we-paint', 'all', 13000]], 1500, t6 + 4 * H);
  play(REP, { type: 'recommendPlan', jobId: 'j-v6', kind: 'single', vendorId: 'v-mile3' }, t6 + 6 * H);
  play('a-musa', { type: 'artisanReviewSupply', jobId: 'j-v6', ok: true, note: '' }, now - 5 * H);
  say(REP, 'j-v6', 'client', 'Good afternoon sir. The local 1.5 mm pipe is out of stock in Mile 3 until next month. Musa has checked the Turkish one and it is the same gauge. The total is in your quotation below.', now - 5 * H + 20 * 60000);

  // 1. Electrical: still collecting offers. Oil Mill can supply everything; Mile 3 only part, cheaper.
  const t1 = now - 8 * H;
  awarded({ id: 'j-v1', clientId: 'c-ada', addr: '7 Ikwerre Road, D-Line', artisanId: 'a-chidi', title: 'Rewire kitchen sockets and lights', category: 'Electrician', tier: 'Pro', desc: 'Four double sockets and three ceiling lights in the kitchen need new cabling. Breaker trips when the kettle is on. Conduit is already in the wall.', lines: [line('Electrician', 'el-cab25', 1, 'Copper, 2.5 mm² twin and earth'), line('Electrician', 'el-socket', 4, 'White, switched'), line('Electrician', 'el-down', 3, 'Warm white'), line('Electrician', 'el-mcb', 2, '20A')], fee: 35000, dayOffset: 1, at: t1, media: ['solar'] });
  offer('j-v1', 'v-oilmill', [['el-cab25', 'all', 64000], ['el-socket', 'all', 2600], ['el-down', 'all', 3600], ['el-mcb', 'all', 2500]], 2000, t1 + 3 * H, 'Nigerchin cable, all items in stock.');
  offer('j-v1', 'v-mile3', [['el-socket', 'all', 2300], ['el-down', 'all', 3000]], 1500, t1 + 4 * H);
  say('c-ada', 'j-v1', 'client', 'Please make sure the cable is Nigerchin or Coleman. The old one was a cheap brand.', t1 + 4 * H + 30 * 60000);
  say(REP, 'j-v1', 'client', 'Noted, Ma. Oil Mill is offering Nigerchin. I will send you the best quotation shortly.', t1 + 5 * H);
  say(REP, 'j-v1', 'v-mile3', 'Do you have 2.5 mm² Nigerchin cable too? It would save a second delivery.', t1 + 5 * H + 10 * 60000);
  say('v-mile3', 'j-v1', 'v-mile3', 'No ma, only Coleman 1.5 mm in stock now.', t1 + 6 * H);

  // Wallets: clients start from friendly round numbers, with one top-up covering what they paid above.
  for (const [id, start] of Object.entries(START)) {
    const spent = BIG - s.wallets[id];
    s.wallets[id] = start;
    (s.txns[id] ??= []).push({ id: 'x-top-' + id, label: `Top-up from ${(users[id] as Client).bank.split(' ')[0]}`, amount: start + spent, kind: 'in', at: now - 5 * D });
  }
  // Older alerts are already read; keep the last few unread so the bell has something to show.
  for (const list of Object.values(s.alerts)) list.forEach((a, i) => (a.read = i >= 3));
  s.sessionUserId = null;
  s.seq = 1000;
  return s;
}

/** Accounts offered on the sign-in screen (staging only). */
export const DEMO_ACCOUNTS: { id: string; note: string }[] = [
  { id: 'c-kenneth', note: 'Client · a materials quotation to pay' },
  { id: 'c-ada', note: 'Client · has 3 open jobs' },
  { id: 'r-ifeoma', note: 'Allyfe market representative · Port Harcourt' },
  { id: 'v-mile3', note: 'Market vendor · orders at every stage' },
  { id: 'v-oilmill', note: 'Market vendor · Oil Mill, Port Harcourt' },
  { id: 'a-emeka', note: 'Woodworker · ★ 4.9, has an apprentice' },
  { id: 'a-ibrahim', note: 'Plumber · ★ 4.8' },
  { id: 'a-musa', note: 'Welder · substitute confirmed' },
  { id: 'a-chidi', note: 'Electrician · materials being priced' },
  { id: 'a-tunde', note: 'Tiler · construction team of 4' },
  { id: 'a-chinedu', note: 'Woodworker · former apprentice of Emeka' },
  { id: 'a-david', note: 'Plumber · ★ 4.5' },
  { id: 'a-grace', note: 'Electrician · verification not finished' },
];
