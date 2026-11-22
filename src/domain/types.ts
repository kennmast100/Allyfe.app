export type Role = 'client' | 'artisan' | 'vendor' | 'rep';
export type Tier = 'Basic' | 'Pro' | 'Premium';
/** The 12 main job roles for the first launch. A job's category is the role it needs. */
export type Category =
  | 'Plumber'
  | 'Woodworker'
  | 'Electrician'
  | 'Painter'
  | 'Tiler'
  | 'POP Installer'
  | 'Welder'
  | 'Aluminium Fabricator'
  | 'Glass Installer'
  | 'Cleaner'
  | 'AC Technician'
  | 'Builder';
export type City = 'Port Harcourt' | 'Lagos' | 'Abuja' | 'Aba';

export type AvatarSpec = {
  bg: string;
  skin: string;
  hair: 'short' | 'long' | 'wrap' | 'hat';
  shirt: string;
  vest?: boolean;
  /** A real profile photo (data URL). When set it replaces the illustration. */
  photo?: ImageRef;
};

/** A built-in illustration key, or a data: URL from a real upload (photo or video). */
export type ImageRef = string;

export type VerificationStatus = 'none' | 'partial' | 'review' | 'verified';
export type Verification = { status: VerificationStatus; files: Record<string, ImageRef> };

export type BaseUser = { id: string; role: Role; name: string; phone: string; avatar: AvatarSpec; area: string; city: City };
export type Client = BaseUser & { role: 'client'; bank: string };

export type Apprentice = { id: string; name: string; phone: string; photo: ImageRef; addedAt: number };
export type Artisan = BaseUser & {
  role: 'artisan';
  trade: string;
  categories: Category[];
  /** Average of per-job stars (each job is the mean of two 1–5 answers, so halves are possible). */
  rating: number;
  ratingCount: number;
  jobsDone: number;
  years: number;
  bio: string;
  work: ImageRef[];
  bank: string;
  verification: Verification;
  /** An individual, or a construction team working under one account. */
  kind: 'individual' | 'team';
  teamName?: string;
  teamMembers: string[];
  apprentices: Apprentice[];
  /** Specialisations within their main job role, e.g. "Kitchen cabinets". */
  specialisations: string[];
  /** Artisans this one trained under. Filled in by the server, which keeps apprentices' numbers private. */
  mentors?: string[];
};
/** Market vendor: supplies the materials in an accepted quotation and delivers them to the client. */
export type Vendor = BaseUser & { role: 'vendor'; bank: string; verification: Verification; market: string; ownerName: string; categories: Category[] };

/** Bank details collected at sign-up. Only the masked form is kept on the profile. */
export type BankDetails = { bankName: string; accountNumber: string; accountName: string };
/** Allyfe market representative: staff who coordinate material sourcing in a city. Invitation only. */
export type Rep = BaseUser & { role: 'rep'; bank: string; markets: string[] };
export type User = Client | Artisan | Vendor | Rep;

/** One line of an artisan's quotation: a catalogue item or a custom item. */
export type QuoteLine = { key: string; name: string; unit: string; unitPrice: number; qty: number; spec?: string };

export type BidStatus = 'pending' | 'accepted' | 'declined';
export type Bid = {
  id: string;
  artisanId: string;
  lines: QuoteLine[];
  serviceFee: number;
  day: string;
  message: string;
  status: BidStatus;
  at: number;
};

/* ---------------- Allyfe Supply: procurement ---------------- */

/** One material line of a procurement request, tracked independently from sourcing to delivery. */
export type SupplyLine = {
  id: string;
  key: string;
  name: string;
  unit: string;
  /** What the artisan specified (brand, size, colour, finish…). */
  spec: string;
  qty: number;
  /** The price the artisan quoted with; the client paid this into Allyfe. */
  budgetPrice: number;
  /** Quantity received and accepted by the client so far. */
  delivered: number;
};

/** A vendor's offer for some or all lines. `substitute` is set when they offer something other than the spec. */
export type OfferItem = { lineId: string; qty: number; unitPrice: number; substitute?: string };
export type SupplyOffer = {
  id: string;
  vendorId: string;
  items: OfferItem[];
  deliveryFee: number;
  deliveryDays: number;
  note: string;
  status: 'active' | 'withdrawn';
  at: number;
};

export type Allocation = { lineId: string; vendorId: string; offerId: string; qty: number; unitPrice: number; substitute?: string };

/** The representative's recommended allocation, waiting for approvals. */
export type SupplyPlan = {
  kind: 'single' | 'combined';
  allocations: Allocation[];
  materials: number;
  delivery: number;
  total: number;
  /** How much more than the money already held for materials; needs the client's approval. */
  extra: number;
  substitutions: number;
  needsClient: boolean;
  recommendedAt: number;
  artisanOkAt?: number;
  clientOkAt?: number;
};

export type POLine = { lineId: string; name: string; unit: string; qty: number; unitPrice: number; substitute?: string; confirmed?: number; received?: number };
export type POStatus = 'issued' | 'confirmed' | 'declined' | 'dispatched' | 'received' | 'refused' | 'cancelled';
export type PurchaseOrder = {
  id: string;
  ref: string;
  vendorId: string;
  lines: POLine[];
  deliveryFee: number;
  status: POStatus;
  waybill?: string;
  paid?: number;
  /** Set when the client refuses the delivery; the vendor must collect the goods. */
  refusal?: { reason: string; note: string; at: number; pickedUpAt?: number };
  at: number;
};

export type SupplyStatus = 'sourcing' | 'approval' | 'ordering' | 'delivering' | 'complete' | 'cancelled';
/** The procurement request: the central record of Allyfe Supply for one job. */
export type Supply = {
  id: string;
  ref: string;
  repId?: string;
  lines: SupplyLine[];
  offers: SupplyOffer[];
  plan?: SupplyPlan;
  orders: PurchaseOrder[];
  status: SupplyStatus;
  /** Savings returned to the client when every line is delivered. */
  refunded?: number;
  at: number;
};

export type JobStatus =
  | 'open' // collecting bids
  | 'awarded' // bid accepted and paid; waiting for a vendor
  | 'materials_on_the_way'
  | 'ready' // materials at the client's home; artisan starts on the scheduled day
  | 'in_progress'
  | 'supervisor_check' // Premium only
  | 'awaiting_client' // artisan finished; client must confirm
  | 'completed'
  | 'not_as_described'
  | 'no_show' // artisan didn't come; client chooses refund or another artisan
  | 'refunded'
  | 'disputed'
  | 'cancelled';

export type HistoryEntry = { label: string; by: string; at: number };
export type JobRating = { work: number; attitude: number; stars: number; text: string; at: number };

export type Job = {
  id: string;
  ref: string;
  clientId: string;
  city: City;
  title: string;
  desc: string;
  addr: string;
  category: Category;
  tier: Tier;
  /** Days the client can host the work. Each is at least 24 hours after posting. */
  preferredDays: string[];
  media: ImageRef[];
  status: JobStatus;
  bids: Bid[];
  invitedArtisanId?: string;
  artisanId?: string;
  acceptedBidId?: string;
  scheduledDay?: string;
  serviceFee?: number;
  /** Money Allyfe is holding for this job right now. */
  escrow: number;
  /** Allyfe Supply procurement request, created when the client accepts a quotation with materials. */
  supply?: Supply;
  /** Optional specialisation within the job role, e.g. "Kitchen cabinets". */
  specialisation?: string;
  /** Everything vendors have already delivered to the client for this job. */
  deliveredMaterials: QuoteLine[];
  /** Artisans who didn't show up; they can't bid on this job again. */
  noShows: { artisanId: string; at: number }[];
  history: HistoryEntry[];
  rating?: JobRating;
  createdAt: number;
};

export type Comment = { id: string; authorId: string; text: string; at: number };
/** A vendor's post can advertise an item in stock. */
export type StockItem = { name: string; price: number; unit: string };
export type Post = { id: string; authorId: string; image: ImageRef; text: string; likes: string[]; comments: Comment[]; at: number; stock?: StockItem };

export type TxnKind = 'in' | 'out' | 'hold';
export type Txn = { id: string; label: string; amount: number; kind: TxnKind; at: number };

export type Alert = { id: string; text: string; at: number; read: boolean; jobId?: string };

export type AppState = {
  version: number;
  sessionUserId: string | null;
  users: Record<string, User>;
  jobs: Job[];
  posts: Post[];
  wallets: Record<string, number>;
  txns: Record<string, Txn[]>;
  alerts: Record<string, Alert[]>;
  favourites: Record<string, string[]>;
  seq: number;
};
