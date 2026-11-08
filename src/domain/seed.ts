import type { Alert, AppState, Artisan, Category, Client, Job, Post, QuoteLine, Txn, User, Vendor } from './types';
import { MATERIALS, dayKey, earliestWorkDay, linesTotal } from './rules';

export const STATE_VERSION = 3;

const H = 3600_000;
const D = 24 * H;

type ArtisanSeed = Omit<Artisan, 'role' | 'verification' | 'city' | 'kind' | 'teamMembers' | 'apprentices'> & Partial<Pick<Artisan, 'verification' | 'city' | 'kind' | 'teamMembers' | 'apprentices' | 'teamName'>>;
function artisan(a: ArtisanSeed): Artisan {
  return {
    role: 'artisan',
    city: 'Port Harcourt',
    kind: 'individual',
    teamMembers: [],
    apprentices: [],
    verification: { status: 'verified', files: { id: 'room', selfie: 'room', w1: 'cabinet', w2: 'wardrobe', w3: 'ceiling' } },
    ...a,
  };
}

export function seedState(now = Date.now()): AppState {
  const clients: Client[] = [
    { id: 'c-kenneth', role: 'client', city: 'Port Harcourt', name: 'Kenneth Obi', phone: '0803 000 1111', area: 'GRA Phase 2, Port Harcourt', bank: 'GTBank •••• 4471', avatar: { bg: '#E8ECF3', skin: '#6B3F22', hair: 'short', shirt: '#14B8A6' } },
    { id: 'c-ada', role: 'client', city: 'Port Harcourt', name: 'Ada Nwachukwu', phone: '0803 000 2222', area: 'D-Line, Port Harcourt', bank: 'Zenith •••• 9013', avatar: { bg: '#FFE4E0', skin: '#7A4A2A', hair: 'long', shirt: '#0E1F3B' } },
  ];
  const artisans: Artisan[] = [
    artisan({
      id: 'a-emeka', name: 'Emeka Uche', phone: '0803 000 3333', trade: 'Carpenter', categories: ['Home Renovation', 'Interior Design'], rating: 4.9, ratingCount: 120, jobsDone: 132, area: 'Rumuola, Port Harcourt', years: 9,
      bio: 'Kitchen cabinets, wardrobes, doors and POP ceilings.', avatar: { bg: '#FDE7C7', skin: '#6B3F22', hair: 'hat', shirt: '#0E1F3B', vest: true }, work: ['cabinet', 'wardrobe', 'ceiling'], bank: 'Access Bank •••• 2210',
      apprentices: [{ id: 'ap-chinedu', name: 'Chinedu Okafor', phone: '0803 000 1212', photo: 'room', addedAt: now - 400 * D }],
    }),
    artisan({ id: 'a-chidi', name: 'Chidi Amadi', phone: '0803 000 4444', trade: 'Electrician', categories: ['Electrical'], rating: 4.8, ratingCount: 95, jobsDone: 101, area: 'Trans-Amadi, Port Harcourt', years: 7, bio: 'House wiring, solar installs and fault finding.', avatar: { bg: '#DBEAFE', skin: '#5A3420', hair: 'hat', shirt: '#1F2937', vest: true }, work: ['solar', 'room'], bank: 'UBA •••• 5521' }),
    artisan({ id: 'a-ibrahim', name: 'Ibrahim Sani', phone: '0803 000 5555', trade: 'Plumber', categories: ['Plumbing'], rating: 4.8, ratingCount: 80, jobsDone: 88, area: 'D-Line, Port Harcourt', years: 11, bio: 'Leaks, boreholes, bathroom fittings.', avatar: { bg: '#E0F2FE', skin: '#7A4A2A', hair: 'short', shirt: '#0369A1' }, work: ['tiles'], bank: 'First Bank •••• 7782' }),
    artisan({ id: 'a-blessing', name: 'Blessing Okoro', phone: '0803 000 6666', trade: 'Painter', categories: ['Painting', 'Interior Design'], rating: 4.7, ratingCount: 64, jobsDone: 70, area: 'GRA Phase 2, Port Harcourt', years: 6, bio: 'Interior and exterior painting, wall finishes.', avatar: { bg: '#EDE9FE', skin: '#6B3F22', hair: 'long', shirt: '#7C3AED' }, work: ['room'], bank: 'GTBank •••• 1180' }),
    artisan({
      id: 'a-tunde', name: 'Tunde Bakare', phone: '0803 000 7777', trade: 'Tiler', categories: ['Home Renovation'], rating: 4.6, ratingCount: 41, jobsDone: 45, area: 'Eliozu, Port Harcourt', years: 5, bio: 'Floor and wall tiling, bathrooms. A team of four for bigger jobs.',
      avatar: { bg: '#DCFCE7', skin: '#5A3420', hair: 'hat', shirt: '#15803D', vest: true }, work: ['tiles'], bank: 'Fidelity •••• 3304',
      kind: 'team', teamName: 'Tunde & Sons Tiling', teamMembers: ['Tunde Bakare', 'Sola Bakare', 'Musa Ibrahim', 'Peter Eze'],
    }),
    artisan({ id: 'a-grace', name: 'Grace Nwosu', phone: '0803 000 8888', trade: 'Electrician', categories: ['Electrical'], rating: 4.5, ratingCount: 22, jobsDone: 24, area: 'Rumuokoro, Port Harcourt', years: 4, bio: 'Sockets, lighting and inverter setup.', avatar: { bg: '#FFE4E0', skin: '#7A4A2A', hair: 'wrap', shirt: '#0E1F3B' }, work: ['room'], bank: 'Access Bank •••• 6610', verification: { status: 'partial', files: { id: 'room', selfie: 'room' } } }),
    artisan({ id: 'a-chinedu', name: 'Chinedu Okafor', phone: '0803 000 1212', trade: 'Carpenter', categories: ['Home Renovation'], rating: 4.6, ratingCount: 6, jobsDone: 6, area: 'Rumuola, Port Harcourt', years: 1, bio: 'Trained under Emeka Uche for two years. Cabinets and wardrobes.', avatar: { bg: '#FEF3C7', skin: '#5A3420', hair: 'short', shirt: '#B45309' }, work: ['wardrobe'], bank: 'Opay •••• 4040' }),
    artisan({ id: 'a-david', name: 'David Johnson', phone: '0803 000 1717', trade: 'Plumber', categories: ['Plumbing'], rating: 4.5, ratingCount: 30, jobsDone: 33, area: 'Rumuibekwe, Port Harcourt', years: 5, bio: 'Bathroom and kitchen plumbing, water heaters.', avatar: { bg: '#DCFCE7', skin: '#5A3420', hair: 'short', shirt: '#0F766E' }, work: ['tiles'], bank: 'Kuda •••• 1717' }),
    artisan({ id: 'a-femi', name: 'Femi Adeyemi', phone: '0803 000 1313', city: 'Lagos', trade: 'Plumber', categories: ['Plumbing'], rating: 4.8, ratingCount: 70, jobsDone: 75, area: 'Yaba, Lagos', years: 8, bio: 'Plumbing for homes and offices in Lagos mainland.', avatar: { bg: '#E0F2FE', skin: '#6B3F22', hair: 'short', shirt: '#0E1F3B' }, work: ['tiles'], bank: 'GTBank •••• 1313' }),
  ];
  const vendors: Vendor[] = [
    { id: 'v-mile3', role: 'vendor', city: 'Port Harcourt', market: 'Mile 3 Market', name: 'Mile 3 Building Supplies', phone: '0803 000 1414', area: 'Mile 3, Port Harcourt', bank: 'UBA •••• 1414', avatar: { bg: '#DCFCE7', skin: '#6B3F22', hair: 'wrap', shirt: '#15803D' }, verification: { status: 'verified', files: { cac: 'room', shop: 'room', owner: 'room', w1: 'room' } } },
    { id: 'v-oilmill', role: 'vendor', city: 'Port Harcourt', market: 'Oil Mill Market', name: 'Oil Mill Electricals & Plumbing', phone: '0803 000 1515', area: 'Oil Mill, Port Harcourt', bank: 'Zenith •••• 1515', avatar: { bg: '#E0F2FE', skin: '#5A3420', hair: 'short', shirt: '#0369A1' }, verification: { status: 'verified', files: { cac: 'room', shop: 'room', owner: 'room', w1: 'room' } } },
    { id: 'v-tradefair', role: 'vendor', city: 'Lagos', market: 'Trade Fair Complex', name: 'Trade Fair Supplies', phone: '0803 000 1616', area: 'Ojo, Lagos', bank: 'GTBank •••• 1616', avatar: { bg: '#EDE9FE', skin: '#7A4A2A', hair: 'short', shirt: '#6D28D9' }, verification: { status: 'verified', files: { cac: 'room', shop: 'room', owner: 'room', w1: 'room' } } },
  ];
  const users: Record<string, User> = {};
  [...clients, ...artisans, ...vendors].forEach((u) => (users[u.id] = u));

  const openJob = (id: string, ref: string, title: string, desc: string, category: Job['category'], tier: Job['tier'], ago: number, media: string[]): Job => {
    const posted = now - ago;
    const first = earliestWorkDay(now);
    const d2 = new Date(first + 'T12:00:00');
    d2.setDate(d2.getDate() + 2);
    return {
      id, ref, clientId: 'c-ada', city: 'Port Harcourt', title, desc, addr: '7 Ikwerre Road, D-Line', category, tier, preferredDays: [first, dayKey(d2)], media,
      status: 'open', bids: [], escrow: 0, deliveredMaterials: [], noShows: [],
      history: [{ label: 'Job posted', by: 'Ada Nwachukwu', at: posted }], createdAt: posted,
    };
  };
  /* ---- Vendor journey: one job at each stage, so the Mile 3 demo account shows every step ---- */
  const line = (cat: Category, key: string, qty: number): QuoteLine => {
    const m = MATERIALS[cat].find((x) => x.key === key)!;
    return { key: m.key, name: m.name, unit: m.unit, unitPrice: m.price, qty };
  };
  const day = (offset: number) => {
    const d = new Date(earliestWorkDay(now) + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    return dayKey(d);
  };
  /** A job whose bid was accepted and paid, with its materials order at the given stage. */
  const vendorJob = (o: {
    id: string; ref: string; clientId: string; addr: string; artisanId: string; title: string; desc: string; category: Category; tier: Job['tier'];
    lines: QuoteLine[]; fee: number; dayOffset: number; ago: number; media: string[];
    order: 'open' | 'accepted' | 'dispatched' | 'delivered'; vendorId?: string; waybill?: string;
    rejection?: { vendorId: string; reason: string; note: string };
  }): Job => {
    const total = linesTotal(o.lines);
    const posted = now - o.ago;
    const sday = day(o.dayOffset);
    const clientName = clients.find((c) => c.id === o.clientId)!.name;
    const vendorName = o.vendorId ? vendors.find((v) => v.id === o.vendorId)!.name : '';
    const history: Job['history'] = [
      { label: 'Job posted', by: clientName, at: posted },
      { label: `Accepted ${artisans.find((a) => a.id === o.artisanId)!.name}'s bid · ₦${(total + o.fee).toLocaleString('en-NG')} held by Allyfe`, by: clientName, at: posted + 3 * H },
    ];
    if (o.rejection) history.push({ label: `Materials not accepted: ${o.rejection.reason}`, by: clientName, at: now - 2 * H });
    if (o.order !== 'open') history.push({ label: `${vendorName} is supplying the materials`, by: vendorName, at: posted + 5 * H });
    if (o.order === 'dispatched' || o.order === 'delivered') history.push({ label: `Materials dispatched · ${o.waybill}`, by: vendorName, at: posted + 9 * H });
    if (o.order === 'delivered') history.push({ label: 'Client received the materials', by: clientName, at: posted + 12 * H });
    return {
      id: o.id, ref: o.ref, clientId: o.clientId, city: 'Port Harcourt', title: o.title, desc: o.desc, addr: o.addr, category: o.category, tier: o.tier,
      preferredDays: [sday], media: o.media,
      status: o.order === 'delivered' ? 'ready' : o.order === 'dispatched' ? 'materials_on_the_way' : 'awarded',
      bids: [{ id: 'b-' + o.id, artisanId: o.artisanId, lines: o.lines, serviceFee: o.fee, day: sday, message: '', status: 'accepted', at: posted + 2 * H }],
      artisanId: o.artisanId, acceptedBidId: 'b-' + o.id, scheduledDay: sday, serviceFee: o.fee,
      escrow: o.order === 'delivered' ? o.fee : total + o.fee,
      materialsOrder: {
        id: 'o-' + o.id, lines: o.lines, total, status: o.order, vendorId: o.order === 'open' ? undefined : o.vendorId, waybill: o.waybill, at: posted + 3 * H,
        rejections: o.rejection ? [{ ...o.rejection, at: now - 2 * H }] : [],
      },
      deliveredMaterials: o.order === 'delivered' ? o.lines : [],
      noShows: [], history, createdAt: posted,
    };
  };
  const vendorJobs: Job[] = [
    // 1. A brand-new request any Port Harcourt vendor can take.
    vendorJob({
      id: 'j-v1', ref: 'PH-4131', clientId: 'c-ada', addr: '7 Ikwerre Road, D-Line', artisanId: 'a-chidi', title: 'Rewire kitchen sockets and lights', category: 'Electrical', tier: 'Pro',
      desc: 'Four double sockets and three ceiling lights in the kitchen need new cabling. Breaker trips when the kettle is on. Conduit is already in the wall.',
      lines: [line('Electrical', 'el-cab25', 1), line('Electrical', 'el-socket', 4), line('Electrical', 'el-down', 3), line('Electrical', 'el-mcb', 2)], fee: 35000, dayOffset: 1, ago: 5 * H, media: ['solar'], order: 'open',
    }),
    // 2. Mile 3 accepted it and now has to buy and send the materials.
    vendorJob({
      id: 'j-v2', ref: 'PH-4127', clientId: 'c-ada', addr: '7 Ikwerre Road, D-Line', artisanId: 'a-tunde', title: 'Retile guest bathroom floor', category: 'Home Renovation', tier: 'Basic',
      desc: 'Guest bathroom floor is 2.5 m by 2 m. Remove old cracked tiles and lay new 60×60 grey floor tiles. Drain must stay where it is.',
      lines: [line('Home Renovation', 'hr-tiles', 6), line('Home Renovation', 'hr-adhes', 3), line('Home Renovation', 'hr-grout', 2), line('Home Renovation', 'hr-cement', 1)], fee: 40000, dayOffset: 1, ago: 20 * H, media: ['tiles'],
      order: 'accepted', vendorId: 'v-mile3',
    }),
    // 3. Sent by Mile 3; waiting for Kenneth to confirm (or refuse) the delivery.
    vendorJob({
      id: 'j-v3', ref: 'PH-4125', clientId: 'c-kenneth', addr: '12 Woji Road, GRA Phase 2', artisanId: 'a-blessing', title: 'Repaint living room and dining', category: 'Painting', tier: 'Pro',
      desc: 'Living and dining area, about 60 m² of wall, 3 m high. Light peeling near the window. Colour: soft green walls with white trim.',
      lines: [line('Painting', 'pa-emul', 2), line('Painting', 'pa-gloss', 1), line('Painting', 'pa-putty', 1), line('Painting', 'pa-roller', 2), line('Painting', 'pa-mask', 3)], fee: 60000, dayOffset: 0, ago: 30 * H, media: ['room'],
      order: 'dispatched', vendorId: 'v-mile3', waybill: 'Rider Chuks · 0803 555 0303 · arriving this afternoon',
    }),
    // 4. Delivered and paid: the money is in Mile 3's wallet.
    vendorJob({
      id: 'j-v4', ref: 'PH-4119', clientId: 'c-ada', addr: '7 Ikwerre Road, D-Line', artisanId: 'a-emeka', title: 'Kitchen wall units', category: 'Home Renovation', tier: 'Pro',
      desc: 'Build and fit 3 wall units above the worktop, 2.4 m in total, MDF with soft-close doors. Walls are concrete.',
      lines: [line('Home Renovation', 'hr-mdf', 3), line('Home Renovation', 'hr-hinge', 6), line('Home Renovation', 'hr-handle', 3), line('Home Renovation', 'hr-screws', 1)], fee: 70000, dayOffset: 2, ago: 3 * D, media: ['cabinet'],
      order: 'delivered', vendorId: 'v-mile3', waybill: 'GIG waybill 7712',
    }),
    // 5. Kenneth refused Mile 3's delivery: Mile 3 must collect it, and the order is open again.
    vendorJob({
      id: 'j-v5', ref: 'PH-4129', clientId: 'c-kenneth', addr: '12 Woji Road, GRA Phase 2', artisanId: 'a-ibrahim', title: 'Replace upstairs WC fittings', category: 'Plumbing', tier: 'Basic',
      desc: 'Upstairs toilet cistern keeps running and the flush handle is broken. Replace the full cistern fittings set and the angle valve.',
      lines: [line('Plumbing', 'pl-wc', 1), line('Plumbing', 'pl-ball', 1), line('Plumbing', 'pl-ptfe', 2)], fee: 15000, dayOffset: 1, ago: 26 * H, media: ['tiles'],
      order: 'open', rejection: { vendorId: 'v-mile3', reason: 'Wrong item or brand', note: 'Fittings are for a low-level cistern; mine is close-coupled.' },
    }),
  ];
  const mile3Paid = linesTotal(vendorJobs[3].materialsOrder!.lines);
  const vendorTxns: Txn[] = [
    { id: 'xv1', label: 'Materials · Kitchen wall units', amount: mile3Paid, kind: 'in', at: now - 2 * D },
    { id: 'xv2', label: 'Materials · Bathroom tiles for Eliozu job', amount: 64500, kind: 'in', at: now - 9 * D },
    { id: 'xv3', label: 'Withdrawal to UBA •••• 1414', amount: 60000, kind: 'out', at: now - 8 * D },
  ];
  const mile3Alerts: Alert[] = [
    { id: 'av1', text: `New materials request in Port Harcourt: ₦${linesTotal(vendorJobs[0].materialsOrder!.lines).toLocaleString('en-NG')} for “Rewire kitchen sockets and lights”.`, at: now - 4 * H, read: false, jobId: 'j-v1' },
    { id: 'av2', text: 'Kenneth Obi did NOT accept the materials for “Replace upstairs WC fittings”: Wrong item or brand. Under your vendor contract, go back and collect them from 12 Woji Road, GRA Phase 2.', at: now - 2 * H, read: false, jobId: 'j-v5' },
    { id: 'av3', text: `Ada Nwachukwu received the materials. ₦${mile3Paid.toLocaleString('en-NG')} is in your wallet.`, at: now - 2 * D, read: true, jobId: 'j-v4' },
  ];

  const jobs: Job[] = [
    ...vendorJobs,
    openJob('j-seed1', 'PH-4120', 'Kitchen cabinet installation', 'Fit 6 base units and 4 wall units in a new kitchen. Units are bought but not assembled; they need assembly, levelling and fixing to concrete walls. Space is 3.4 m wide.', 'Home Renovation', 'Pro', 2 * H, ['cabinet']),
    openJob('j-seed2', 'PH-4121', 'POP ceiling with 8 downlights', 'POP ceiling for a 6 m by 5 m living room with 8 recessed downlights. Wiring points are already in place. Ceiling height is 3 m. Old ceiling boards must be removed first.', 'Interior Design', 'Premium', 5 * H, ['ceiling']),
    openJob('j-seed3', 'PH-4122', 'Built-in wardrobes for 2 bedrooms', 'Two built-in wardrobes, each 2.4 m wide and 2.4 m high, with sliding doors, one hanging rail and four shelves each. Walls are plastered concrete.', 'Home Renovation', 'Basic', 7 * H, ['wardrobe']),
    {
      id: 'j-seed0', ref: 'PH-4007', clientId: 'c-kenneth', city: 'Port Harcourt', title: 'Fix leaking kitchen sink', desc: 'Sink trap leaking under the cabinet, water pools after every wash.', addr: '12 Woji Road, GRA Phase 2',
      category: 'Plumbing', tier: 'Basic', preferredDays: [], media: ['tiles'], status: 'completed', escrow: 0, deliveredMaterials: [], noShows: [],
      bids: [{ id: 'b-seed0', artisanId: 'a-ibrahim', lines: [{ key: 'pl-ptrap', name: 'P-trap', unit: 'piece', unitPrice: 2500, qty: 1 }], serviceFee: 15000, day: dayKey(new Date(now - 69 * D)), message: 'I can come tomorrow morning.', status: 'accepted', at: now - 70 * D }],
      artisanId: 'a-ibrahim', acceptedBidId: 'b-seed0', serviceFee: 15000, scheduledDay: dayKey(new Date(now - 69 * D)),
      history: [
        { label: 'Job posted', by: 'Kenneth Obi', at: now - 71 * D },
        { label: 'Job done · artisan paid', by: 'Kenneth Obi', at: now - 69 * D },
      ],
      rating: { work: 5, attitude: 5, stars: 5, text: 'Quick and tidy.', at: now - 69 * D },
      createdAt: now - 71 * D,
    },
  ];

  const posts: Post[] = [
    { id: 'p1', authorId: 'a-blessing', image: 'room', text: 'Living room repaint finished today in GRA. Client chose a soft green with a white trim.', likes: ['c-ada', 'a-tunde'], comments: [{ id: 'cm1', authorId: 'c-kenneth', text: 'Clean lines. Saving this for my sitting room.', at: now - 1.5 * H }, { id: 'cm2', authorId: 'a-tunde', text: 'Nice finish, sis.', at: now - H }], at: now - 2 * H },
    { id: 'p2', authorId: 'a-chidi', image: 'solar', text: '4 panels and a 3.5 kVA inverter installed in Trans-Amadi. No more fuel queues for this family.', likes: ['a-grace', 'c-ada', 'a-emeka'], comments: [{ id: 'cm3', authorId: 'a-grace', text: 'Good job on the cable runs.', at: now - 4 * H }], at: now - 5 * H },
    { id: 'p3', authorId: 'a-tunde', image: 'tiles', text: 'Bathroom retiled in 3 days. Client supplied the tiles through a Mile 3 vendor on Allyfe.', likes: ['a-emeka'], comments: [], at: now - D },
    { id: 'p5', authorId: 'v-mile3', image: 'tiles', text: 'Fresh stock of 60×60 floor tiles, matte grey and cream. Delivery anywhere in Port Harcourt.', likes: ['a-tunde', 'c-ada'], comments: [{ id: 'cm4', authorId: 'a-tunde', text: 'Do you have the glossy white?', at: now - 2 * H }], at: now - 3 * H, stock: { name: 'Floor tiles 60×60', price: 9500, unit: 'carton' } },
    { id: 'p6', authorId: 'v-oilmill', image: 'room', text: 'Kitchen sink mixer taps back in stock. Chrome finish, 1-year warranty.', likes: [], comments: [], at: now - 6 * H, stock: { name: 'Kitchen sink mixer tap', price: 18000, unit: 'piece' } },
    { id: 'p4', authorId: 'a-emeka', image: 'wardrobe', text: 'Sliding wardrobe for a family in Rumuola. Chinedu handled the doors and rails.', likes: ['c-kenneth'], comments: [], at: now - 200 * D },
  ];

  return {
    version: STATE_VERSION,
    sessionUserId: null,
    users,
    jobs,
    posts,
    wallets: { 'c-kenneth': 400000, 'c-ada': 300000, 'a-emeka': 86500, 'a-chidi': 42000, 'a-ibrahim': 61000, 'a-blessing': 23000, 'a-tunde': 9000, 'a-grace': 0, 'a-chinedu': 12000, 'a-david': 18000, 'a-femi': 30000, 'v-mile3': mile3Paid + 64500 - 60000, 'v-oilmill': 0, 'v-tradefair': 0 },
    txns: {
      'c-kenneth': [{ id: 'x1', label: 'Top-up from GTBank', amount: 400000, kind: 'in', at: now - 5 * D }],
      'v-mile3': vendorTxns,
      'a-emeka': [
        { id: 'x2', label: 'Payment · Wardrobe for Mrs Ada', amount: 180000, kind: 'in', at: now - 10 * D },
        { id: 'x3', label: 'Withdrawal to Access Bank', amount: 120000, kind: 'out', at: now - 9 * D },
      ],
    },
    alerts: { 'v-mile3': mile3Alerts },
    favourites: {},
    seq: 1,
  };
}

/** Accounts offered on the sign-in screen. */
export const DEMO_ACCOUNTS: { id: string; note: string }[] = [
  { id: 'c-kenneth', note: 'Client · Port Harcourt' },
  { id: 'c-ada', note: 'Client · has 3 open jobs' },
  { id: 'a-emeka', note: 'Artisan · carpenter, ★ 4.9, has an apprentice' },
  { id: 'a-ibrahim', note: 'Artisan · plumber, ★ 4.8' },
  { id: 'a-david', note: 'Artisan · plumber, ★ 4.5' },
  { id: 'a-tunde', note: 'Artisan · construction team of 4' },
  { id: 'a-chinedu', note: 'Artisan · former apprentice of Emeka' },
  { id: 'a-grace', note: 'Artisan · verification not finished' },
  { id: 'v-mile3', note: 'Market vendor · orders at every stage' },
  { id: 'v-oilmill', note: 'Market vendor · Oil Mill, Port Harcourt' },
];
