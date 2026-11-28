import { describe, expect, it } from 'vitest';
import { MediaError, createMediaStore, presignGet, r2ConfigFromEnv, signHeaders } from './r2';

// Amazon's published Signature Version 4 examples (S3 docs, "Signature Calculations for the Authorization Header"
// and "Query String Authentication"), all at 2013-05-24 00:00:00 UTC.
const AWS = { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1' };
const T = new Date(Date.UTC(2013, 4, 24));

describe('SigV4 signing', () => {
  it('matches the AWS GET Object example (Authorization header)', () => {
    const h = signHeaders({
      ...AWS, method: 'GET', path: '/test.txt', now: T,
      headers: { host: 'examplebucket.s3.amazonaws.com', range: 'bytes=0-9' },
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });
    expect(h.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  it('matches the AWS presigned URL example', () => {
    const url = presignGet({ ...AWS, host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', expires: 86400, now: T });
    expect(url).toContain('X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
  });
});

const CFG = { accountId: 'acc123', accessKeyId: 'AK', secretAccessKey: 'SK', publicBucket: 'allyfe-media', privateBucket: 'allyfe-private', publicUrl: 'https://media.example.com' };
const JPEG = 'data:image/jpeg;base64,' + Buffer.from('fake jpeg bytes').toString('base64');

function fakeR2() {
  const puts: { url: string; type: string; size: number; auth: string }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const h = init.headers as Record<string, string>;
    puts.push({ url, type: h['content-type'], size: (init.body as Uint8Array).length, auth: h.authorization });
    return new Response('', { status: 200 });
  }) as unknown as typeof fetch;
  return { puts, fetch: f };
}

describe('media store', () => {
  it('reads the six R2 settings, or stays off if any is missing', () => {
    expect(r2ConfigFromEnv({ R2_ACCOUNT_ID: 'a' })).toBeNull();
    expect(r2ConfigFromEnv({ R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'b', R2_SECRET_ACCESS_KEY: 'c', R2_PUBLIC_BUCKET: 'd', R2_PRIVATE_BUCKET: 'e', R2_PUBLIC_URL: 'https://x.dev/' })).toMatchObject({ publicUrl: 'https://x.dev' });
  });

  it('moves job photos to the public bucket and keeps only the link', async () => {
    const r2 = fakeR2();
    const m = createMediaStore(CFG, { fetch: r2.fetch });
    const a = await m.ingest({ type: 'postJob', draft: { title: 'x', media: [JPEG, 'room'] } } as any, 'c-kenneth');
    expect(a.draft.media[0]).toMatch(/^https:\/\/media\.example\.com\/jobs\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/);
    expect(a.draft.media[1]).toBe('room'); // built-in demo picture, untouched
    expect(r2.puts).toHaveLength(1);
    expect(r2.puts[0]).toMatchObject({ type: 'image/jpeg', size: 15 });
    expect(r2.puts[0].url).toMatch(/^https:\/\/acc123\.r2\.cloudflarestorage\.com\/allyfe-media\/jobs\//);
    expect(r2.puts[0].auth).toMatch(/^AWS4-HMAC-SHA256 Credential=AK\/\d{8}\/auto\/s3\/aws4_request/);
  });

  it('keeps ID documents private, and only the owner or staff can open them', async () => {
    const r2 = fakeR2();
    const m = createMediaStore(CFG, { fetch: r2.fetch });
    const a = await m.ingest({ type: 'addVerificationFile', key: 'id', image: JPEG } as any, 'a-emeka');
    expect(a.image).toMatch(/^r2priv:verification\/a-emeka\/[0-9a-f-]{36}\.jpg$/);
    expect(r2.puts[0].url).toContain('/allyfe-private/verification/a-emeka/');
    expect(m.signedUrl(a.image, { id: 'a-emeka', role: 'artisan' })).toMatch(/^https:\/\/acc123\.r2\.cloudflarestorage\.com\/allyfe-private\/verification\/a-emeka\/.*X-Amz-Expires=300/);
    expect(m.signedUrl(a.image, { id: 'r-ifeoma', role: 'rep' })).toBeTruthy();
    expect(m.signedUrl(a.image, { id: 'c-kenneth', role: 'client' })).toBeNull();
    expect(m.signedUrl('https://media.example.com/jobs/x.jpg', { id: 'a-emeka', role: 'artisan' })).toBeNull();
  });

  it('refuses outside links, other people’s private files, bad types and oversized files', async () => {
    const m = createMediaStore(CFG, { fetch: fakeR2().fetch });
    await expect(m.ingest({ type: 'createPost', image: 'https://evil.example/track.png' } as any, 'a-emeka')).rejects.toThrow(MediaError);
    await expect(m.ingest({ type: 'addVerificationFile', key: 'id', image: 'r2priv:verification/a-chidi/x.jpg' } as any, 'a-emeka')).rejects.toThrow(MediaError);
    await expect(m.ingest({ type: 'createPost', image: 'data:application/pdf;base64,AAAA' } as any, 'a-emeka')).rejects.toThrow(/Only JPG/);
    const big = 'data:image/jpeg;base64,' + Buffer.alloc(4 * 1024 * 1024).toString('base64');
    await expect(m.ingest({ type: 'createPost', image: big } as any, 'a-emeka')).rejects.toThrow(/too large/);
    // Re-sending a link we already issued is fine (e.g. a retried action).
    const ok = await m.ingest({ type: 'createPost', image: 'https://media.example.com/posts/2026/11/a.jpg' } as any, 'a-emeka');
    expect(ok.image).toBe('https://media.example.com/posts/2026/11/a.jpg');
  });

  it('without R2 settings keeps photos inline but still refuses outside links', async () => {
    const m = createMediaStore(null);
    expect(m.enabled).toBe(false);
    expect((await m.ingest({ type: 'createPost', image: JPEG } as any, 'a-emeka')).image).toBe(JPEG);
    await expect(m.ingest({ type: 'createPost', image: 'https://evil.example/x.png' } as any, 'a-emeka')).rejects.toThrow(MediaError);
  });

  it('reports a failed upload instead of saving a broken link', async () => {
    const failing = (async () => new Response('denied', { status: 403 })) as unknown as typeof fetch;
    const m = createMediaStore(CFG, { fetch: failing });
    await expect(m.ingest({ type: 'createPost', image: JPEG } as any, 'a-emeka')).rejects.toThrow(/R2 upload failed: 403/);
  });
});
