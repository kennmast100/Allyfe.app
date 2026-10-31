export type Role = 'client' | 'artisan' | 'company';
export type Tier = 'Basic' | 'Pro' | 'Premium';
export type Category = 'Home Renovation' | 'Interior Design' | 'Plumbing' | 'Electrical' | 'Painting';

export type AvatarSpec = {
  bg: string;
  skin: string;
  hair: 'short' | 'long' | 'wrap' | 'hat';
  shirt: string;
  vest?: boolean;
};

/** Built-in illustration keys, or a data: URL from a real upload. */
export type ImageRef = string;

export type VerificationStatus = 'none' | 'partial' | 'review' | 'verified';
export type Verification = { status: VerificationStatus; files: Record<string, ImageRef> };

export type BaseUser = { id: string; role: Role; name: string; phone: string; avatar: AvatarSpec; area: string };
export type Client = BaseUser & { role: 'client'; bank: string };
export type Artisan = BaseUser & {
  role: 'artisan';
  trade: string;
  categories: Category[];
  rating: number;
  ratingCount: number;
  jobsDone: number;
  years: number;
  bio: string;
  work: ImageRef[];
  bank: string;
  verification: Verification;
};
export type Company = BaseUser & { role: 'company'; bank: string; verification: Verification };
export type User = Client | Artisan | Company;

export type ScheduleMode = 'This week' | 'Next week' | 'Flexible';
export type Schedule = { mode: ScheduleMode; days: string[] };

export type JobStatus =
  | 'open' // posted, deposit held, collecting proposals
  | 'confirmed' // client picked an artisan
  | 'in_progress'
  | 'supervisor_check' // Premium only
  | 'awaiting_client' // artisan says done
  | 'completed'
  | 'not_as_described'
  | 'disputed'
  | 'cancelled';

export type ProposalKind = 'apply' | 'propose';
export type Proposal = {
  id: string;
  artisanId: string;
  kind: ProposalKind;
  amount: number;
  message: string;
  startDay?: string;
  status: 'pending' | 'accepted' | 'declined';
  at: number;
};

export type HistoryEntry = { label: string; by: string; at: number };

export type Job = {
  id: string;
  ref: string;
  clientId: string;
  title: string;
  desc: string;
  addr: string;
  category: Category;
  tier: Tier;
  /** What the client paid into Allyfe when posting. */
  deposit: number;
  /** Money Allyfe is currently holding for this job. */
  escrow: number;
  schedule: Schedule;
  photos: ImageRef[];
  status: JobStatus;
  proposals: Proposal[];
  /** Set when the client books an artisan directly from their profile. */
  invitedArtisanId?: string;
  artisanId?: string;
  agreedAmount?: number;
  agreedDay?: string;
  history: HistoryEntry[];
  review?: { stars: number; text: string; at: number };
  createdAt: number;
};

export type Tool = { id: string; companyId: string; name: string; kind: ToolKind; pricePerDay: number };
export type ToolKind = 'drill' | 'cutter' | 'scaffold' | 'sprayer' | 'generator' | 'mixer';

export type RentalStatus = 'requested' | 'approved' | 'declined' | 'paid';
export type Rental = {
  id: string;
  toolId: string;
  companyId: string;
  artisanId: string;
  days: number;
  fee: number;
  /** Paid out of this job's escrow at completion; otherwise paid from the artisan's wallet up front. */
  jobId?: string;
  status: RentalStatus;
  at: number;
};

export type Comment = { id: string; authorId: string; text: string; at: number };
export type Post = { id: string; authorId: string; image: ImageRef; text: string; likes: string[]; comments: Comment[]; at: number };

export type TxnKind = 'in' | 'out' | 'hold';
export type Txn = { id: string; label: string; amount: number; kind: TxnKind; at: number };

export type Alert = { id: string; text: string; at: number; read: boolean; jobId?: string };

export type AppState = {
  version: number;
  sessionUserId: string | null;
  users: Record<string, User>;
  jobs: Job[];
  tools: Tool[];
  rentals: Rental[];
  posts: Post[];
  wallets: Record<string, number>;
  txns: Record<string, Txn[]>;
  alerts: Record<string, Alert[]>;
  favourites: Record<string, string[]>;
  seq: number;
};
