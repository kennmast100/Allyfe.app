export type Role = 'client' | 'artisan' | 'vendor';
export type Tier = 'Basic' | 'Pro' | 'Premium';
export type Category = 'Home Renovation' | 'Interior Design' | 'Plumbing' | 'Electrical' | 'Painting';
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
};
/** Market vendor: supplies the materials in an accepted quotation and delivers them to the client. */
export type Vendor = BaseUser & { role: 'vendor'; bank: string; verification: Verification; market: string; ownerName: string; categories: Category[] };

/** Bank details collected at sign-up. Only the masked form is kept on the profile. */
export type BankDetails = { bankName: string; accountNumber: string; accountName: string };
export type User = Client | Artisan | Vendor;

/** One line of an artisan's quotation: a catalogue item or a custom item. */
export type QuoteLine = { key: string; name: string; unit: string; unitPrice: number; qty: number };

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

export type OrderStatus = 'open' | 'accepted' | 'dispatched' | 'delivered' | 'cancelled';
/** A delivery the client refused. The vendor must collect the goods (vendor contract). */
export type MaterialRejection = { vendorId: string; reason: string; note: string; at: number; pickedUpAt?: number };
export type MaterialOrder = {
  id: string;
  lines: QuoteLine[];
  total: number;
  status: OrderStatus;
  vendorId?: string;
  waybill?: string;
  at: number;
  rejections: MaterialRejection[];
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
  materialsOrder?: MaterialOrder;
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
