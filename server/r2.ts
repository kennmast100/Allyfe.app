/**
 * Photo, video and document storage on Cloudflare R2 (S3-compatible).
 *
 * The phone still compresses media and sends it with the action as a data URL. Before the
 * action is applied, the server uploads each data URL to R2 and replaces it with a reference,
 * so the database only ever holds links:
 *   - public media (job photos, portfolio, feed posts, profile and apprentice photos) go to the
 *     public bucket and are stored as their public URL;
 *   - verification documents (ID, CAC, selfies…) go to the private bucket and are stored as
 *     `r2priv:<key>`. They can only be opened through a short-lived signed link that the server
 *     hands to the document's owner or Allyfe staff.
 *
 * With no R2 settings (local runs, tests) data URLs are kept inline, as before.
 * Requests are signed with AWS Signature Version 4 using Node's crypto; no SDK needed.
 */
import { createHash, createHmac, randomUUID } from 'node:crypto';

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string;
  privateBucket: string;
  /** Public base URL of the public bucket, e.g. https://pub-xxxx.r2.dev or https://media.allyfe.app */
  publicUrl: string;
  /** Only for local testing against an S3-compatible server; R2 itself needs no endpoint setting. */
  endpoint?: string;
};

export function r2ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): R2Config | null {
  const c = {
    accountId: env.R2_ACCOUNT_ID ?? '',
    accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
    publicBucket: env.R2_PUBLIC_BUCKET ?? '',
    privateBucket: env.R2_PRIVATE_BUCKET ?? '',
    publicUrl: (env.R2_PUBLIC_URL ?? '').replace(/\/+$/, ''),
  };
  if (!Object.values(c).every(Boolean)) return null;
  return env.R2_ENDPOINT ? { ...c, endpoint: env.R2_ENDPOINT.replace(/\/+$/, '') } : c;
}

/* ---------------- AWS Signature Version 4 ---------------- */

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest();
/** RFC 3986 encoding, as SigV4 requires. */
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
export const encodePath = (path: string) => path.split('/').map(enc).join('/');
const amzDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function signingKey(secret: string, date: string, region: string, service: string) {
  return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), service), 'aws4_request');
}

type Creds = { accessKeyId: string; secretAccessKey: string; region: string; service?: string };

/** Signs a request with an Authorization header. `headers` must include host. Returns the headers to send. */
export function signHeaders(o: Creds & { method: string; path: string; headers: Record<string, string>; payloadHash: string; now: Date }): Record<string, string> {
  const service = o.service ?? 's3';
  const date = amzDate(o.now);
  const day = date.slice(0, 8);
  const headers: Record<string, string> = { ...o.headers, 'x-amz-content-sha256': o.payloadHash, 'x-amz-date': date };
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonicalHeaders = names.map((h) => `${h}:${lower[h]}\n`).join('');
  const signed = names.join(';');
  const canonical = [o.method, encodePath(o.path), '', canonicalHeaders, signed, o.payloadHash].join('\n');
  const scope = `${day}/${o.region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', date, scope, sha256(canonical)].join('\n');
  const signature = createHmac('sha256', signingKey(o.secretAccessKey, day, o.region, service)).update(toSign).digest('hex');
  return { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${o.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}` };
}

/** A presigned GET URL that works for `expires` seconds. */
export function presignGet(o: Creds & { host: string; path: string; expires: number; now: Date }): string {
  const service = o.service ?? 's3';
  const date = amzDate(o.now);
  const day = date.slice(0, 8);
  const scope = `${day}/${o.region}/${service}/aws4_request`;
  const q: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${o.accessKeyId}/${scope}`,
    'X-Amz-Date': date,
    'X-Amz-Expires': String(o.expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const query = Object.keys(q)
    .sort()
    .map((k) => `${enc(k)}=${enc(q[k])}`)
    .join('&');
  const canonical = ['GET', encodePath(o.path), query, `host:${o.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', date, scope, sha256(canonical)].join('\n');
  const signature = createHmac('sha256', signingKey(o.secretAccessKey, day, o.region, service)).update(toSign).digest('hex');
  return `https://${o.host}${encodePath(o.path)}?${query}&X-Amz-Signature=${signature}`;
}

/* ---------------- media refs ---------------- */

export const PRIVATE_PREFIX = 'r2priv:';
const MEDIA_TYPES: Record<string, { ext: string; max: number }> = {
  'image/jpeg': { ext: 'jpg', max: 3 * 1024 * 1024 },
  'image/png': { ext: 'png', max: 3 * 1024 * 1024 },
  'image/webp': { ext: 'webp', max: 3 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', max: 6 * 1024 * 1024 },
  'video/webm': { ext: 'webm', max: 6 * 1024 * 1024 },
  'video/quicktime': { ext: 'mov', max: 6 * 1024 * 1024 },
};

export class MediaError extends Error {}

/** Built-in demo pictures are referred to by short names like "room" or "tiles". */
const isSceneName = (s: string) => /^[a-z0-9-]{1,24}$/.test(s);

export function parseDataUrl(s: string): { type: string; bytes: Buffer } {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(s);
  if (!m) throw new MediaError('That file could not be read. Try another photo.');
  const type = m[1].toLowerCase();
  const spec = MEDIA_TYPES[type];
  if (!spec) throw new MediaError('Only JPG, PNG or WebP photos and MP4, WebM or MOV videos can be uploaded.');
  const bytes = Buffer.from(m[2], 'base64');
  if (!bytes.length) throw new MediaError('That file is empty.');
  if (bytes.length > spec.max) throw new MediaError(type.startsWith('video/') ? 'That video is too large. Keep it under 20 seconds.' : 'That photo is too large. Try a smaller one.');
  return { type, bytes };
}

/** Where each action carries media, and whether it is private (verification documents). */
type Slot = { get: () => string | undefined; set: (v: string) => void; private: boolean; folder: string };
function mediaSlots(action: Record<string, any>): Slot[] {
  const one = (obj: any, key: string, folder: string, priv = false): Slot[] =>
    obj && typeof obj[key] === 'string' ? [{ get: () => obj[key], set: (v) => (obj[key] = v), private: priv, folder }] : [];
  const many = (arr: any, folder: string): Slot[] => (Array.isArray(arr) ? arr.map((_, i) => ({ get: () => arr[i], set: (v: string) => (arr[i] = v), private: false, folder })) : []);
  switch (action.type) {
    case 'postJob':
      return many(action.draft?.media, 'jobs');
    case 'addApprentice':
      return one(action, 'photo', 'apprentices');
    case 'addVerificationFile':
      return one(action, 'image', 'verification', true);
    case 'createPost':
      return one(action, 'image', 'posts');
    case 'registerUser':
      return [...one(action.profile, 'photo', 'profiles'), ...many(action.profile?.work, 'portfolio')];
    default:
      return [];
  }
}

export type MediaStore = {
  enabled: boolean;
  /** Uploads any data URLs in the action to R2 and swaps them for references. Rejects links that aren't ours. */
  ingest<A extends { type: string }>(action: A, userId: string): Promise<A>;
  /** A short-lived link to a private document, or null if this person may not open it. */
  signedUrl(ref: string, viewer: { id: string; role: string }): string | null;
};

export function createMediaStore(config: R2Config | null, deps: { fetch?: typeof fetch; now?: () => Date } = {}): MediaStore {
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  if (!config) {
    return {
      enabled: false,
      async ingest(action) {
        // Local and test runs: media stays inline, but outside links are still refused.
        for (const slot of mediaSlots(action as any)) {
          const v = slot.get() ?? '';
          if (!v.startsWith('data:') && !isSceneName(v)) throw new MediaError('That photo link is not allowed. Upload the photo instead.');
          if (v.startsWith('data:')) parseDataUrl(v);
        }
        return action;
      },
      signedUrl: () => null,
    };
  }
  const base = config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`;
  const host = new URL(base).host;
  const creds = { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, region: 'auto' };

  async function put(bucket: string, key: string, bytes: Buffer, type: string) {
    const path = `/${bucket}/${key}`;
    const headers = signHeaders({ ...creds, method: 'PUT', path, headers: { host, 'content-type': type, 'content-length': String(bytes.length) }, payloadHash: sha256(bytes), now: now() });
    delete (headers as Record<string, string>).host; // fetch sets it
    const r = await doFetch(`${base}${encodePath(path)}`, { method: 'PUT', headers, body: new Uint8Array(bytes) });
    if (!r.ok) throw new Error(`R2 upload failed: ${r.status} ${await r.text().catch(() => '')}`.slice(0, 300));
  }

  return {
    enabled: true,
    async ingest(action, userId) {
      const copy = structuredClone(action) as any;
      for (const slot of mediaSlots(copy)) {
        const v = slot.get() ?? '';
        if (isSceneName(v)) continue;
        if (slot.private ? v.startsWith(PRIVATE_PREFIX) && v.slice(PRIVATE_PREFIX.length).startsWith(`${slot.folder}/${userId}/`) : v.startsWith(config.publicUrl + '/')) continue;
        if (!v.startsWith('data:')) throw new MediaError('That photo link is not allowed. Upload the photo instead.');
        const { type, bytes } = parseDataUrl(v);
        const d = now();
        // Private keys carry the owner's id so the server can check who may open them.
        const key = slot.private
          ? `${slot.folder}/${userId}/${randomUUID()}.${MEDIA_TYPES[type].ext}`
          : `${slot.folder}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${MEDIA_TYPES[type].ext}`;
        await put(slot.private ? config.privateBucket : config.publicBucket, key, bytes, type);
        slot.set(slot.private ? PRIVATE_PREFIX + key : `${config.publicUrl}/${key}`);
      }
      return copy;
    },
    signedUrl(ref, viewer) {
      if (!ref.startsWith(PRIVATE_PREFIX)) return null;
      const key = ref.slice(PRIVATE_PREFIX.length);
      const [, owner] = key.split('/');
      // The owner, or Allyfe staff (representatives for now; admins later).
      if (owner !== viewer.id && viewer.role !== 'rep') return null;
      const url = presignGet({ ...creds, host, path: `/${config.privateBucket}/${key}`, expires: 300, now: now() });
      return config.endpoint ? url.replace(`https://${host}`, base) : url;
    },
  };
}
