import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { normalizePhone } from '../src/domain/rules';

/** Sessions survive restarts and redeploys; codes and sign-up tickets live in memory only. */
export type AuthData = { sessions: Record<string, { userId: string; at: number }> };
export interface AuthStore {
  load(): Promise<AuthData | null>;
  save(data: AuthData): Promise<void>;
}

export type SendSms = (phone: string, text: string) => Promise<void>;

const CODE_TTL = 10 * 60_000;
const TICKET_TTL = 30 * 60_000;
const SESSION_TTL = 90 * 24 * 3600_000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;
const RESEND_AFTER = 30_000;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export type AuthFail = { ok: false; status: number; error: string };

/**
 * Phone-number sign-in with one-time codes.
 * - `sms` sends real texts. Without it, `showCodes` returns the code to the app (staging only).
 * - Production with neither refuses to send codes rather than pretending.
 */
export async function createAuth(opts: { store: AuthStore; sms?: SendSms; showCodes: boolean; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const data: AuthData = (await opts.store.load()) ?? { sessions: {} };
  const codes = new Map<string, { hash: string; expires: number; attempts: number; sent: number[] }>();
  const tickets = new Map<string, { phone: string; expires: number }>();
  const fail = (status: number, error: string): AuthFail => ({ ok: false, status, error });

  async function issue(userId: string) {
    const token = randomBytes(32).toString('base64url');
    // Drop expired sessions while we're here.
    for (const [k, v] of Object.entries(data.sessions)) if (now() - v.at > SESSION_TTL) delete data.sessions[k];
    data.sessions[sha(token)] = { userId, at: now() };
    await opts.store.save(data);
    return token;
  }

  return {
    /** Sends a 6-digit code. `exists` says whether the number already has an account. */
    async start(phoneRaw: string, purpose: 'signin' | 'signup', exists: (phone: string) => boolean) {
      const phone = normalizePhone(String(phoneRaw ?? ''));
      if (!phone) return fail(400, 'Enter a valid Nigerian mobile number, e.g. 0803 123 4567.');
      if (purpose === 'signin' && !exists(phone)) return fail(404, 'No Allyfe account uses this number. Create an account instead.');
      if (purpose === 'signup' && exists(phone)) return fail(409, 'This number already has an Allyfe account. Sign in instead.');
      if (!opts.sms && !opts.showCodes) return fail(503, 'Text messages are not set up yet. Please try again later.');
      const prev = codes.get(phone);
      const recent = (prev?.sent ?? []).filter((t) => now() - t < 3600_000);
      if (recent.length >= MAX_CODES_PER_HOUR) return fail(429, 'Too many codes requested. Try again in an hour.');
      if (recent.length && now() - recent[recent.length - 1] < RESEND_AFTER) return fail(429, 'Please wait 30 seconds before asking for another code.');
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      codes.set(phone, { hash: sha(phone + code), expires: now() + CODE_TTL, attempts: 0, sent: [...recent, now()] });
      if (opts.sms) {
        try {
          await opts.sms(phone, `Your Allyfe code is ${code}. It expires in 10 minutes. Do not share it with anyone.`);
        } catch (e) {
          console.error('sms failed', e);
          return fail(502, "We couldn't send the text. Please try again.");
        }
      }
      return { ok: true as const, phone, ...(opts.sms ? {} : { demoCode: code }) };
    },

    /** Checks a code. Known numbers get a session; new numbers get a short-lived sign-up ticket. */
    async verify(phoneRaw: string, code: string, userIdFor: (phone: string) => string | undefined) {
      const phone = normalizePhone(String(phoneRaw ?? ''));
      const entry = phone ? codes.get(phone) : undefined;
      if (!phone || !entry || now() > entry.expires) return fail(400, 'That code has expired. Ask for a new one.');
      if (entry.attempts >= MAX_ATTEMPTS) return fail(429, 'Too many wrong codes. Ask for a new one.');
      if (!/^\d{6}$/.test(String(code ?? '')) || !sameHash(sha(phone + code), entry.hash)) {
        entry.attempts++;
        return fail(400, `Wrong code. ${MAX_ATTEMPTS - entry.attempts} tries left.`);
      }
      codes.delete(phone);
      const userId = userIdFor(phone);
      if (userId) return { ok: true as const, token: await issue(userId), userId };
      const ticket = randomBytes(24).toString('base64url');
      tickets.set(sha(ticket), { phone, expires: now() + TICKET_TTL });
      return { ok: true as const, ticket, phone };
    },

    /** Exchanges a sign-up ticket for the verified phone number (once). */
    takeTicket(ticket: string): string | null {
      const k = sha(String(ticket ?? ''));
      const t = tickets.get(k);
      if (!t || now() > t.expires) return null;
      tickets.delete(k);
      return t.phone;
    },

    issue,

    userFor(token: string | undefined): string | null {
      if (!token) return null;
      const s = data.sessions[sha(token)];
      if (!s || now() - s.at > SESSION_TTL) return null;
      return s.userId;
    },

    async revoke(token: string | undefined) {
      if (!token) return;
      delete data.sessions[sha(token)];
      await opts.store.save(data);
    },

    /** Removes every session (used when demo data is reset). */
    async revokeAll() {
      data.sessions = {};
      await opts.store.save(data);
    },
  };
}
export type Auth = Awaited<ReturnType<typeof createAuth>>;

export function memoryAuthStore(): AuthStore {
  let saved: AuthData | null = null;
  return {
    async load() {
      return saved && structuredClone(saved);
    },
    async save(d) {
      saved = structuredClone(d);
    },
  };
}

/** Termii (Nigerian SMS provider). Untested until an account and key are connected. */
export function termiiSender(apiKey: string, senderId: string, baseUrl = 'https://api.ng.termii.com'): SendSms {
  return async (phone, text) => {
    const r = await fetch(`${baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, to: phone.replace('+', ''), from: senderId, sms: text, type: 'plain', channel: 'generic' }),
    });
    if (!r.ok) throw new Error(`Termii ${r.status}: ${(await r.text()).slice(0, 200)}`);
  };
}
