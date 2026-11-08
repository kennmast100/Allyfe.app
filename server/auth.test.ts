import { describe, expect, it } from 'vitest';
import { createAuth, memoryAuthStore } from './auth';
import { createCore, memoryStorage } from './core';
import type { SignupProfile } from '../src/domain/actions';
import { normalizePhone } from '../src/domain/rules';

const known = new Map([['+2348030001111', 'c-kenneth']]);
const exists = (p: string) => known.has(p);
const idFor = (p: string) => known.get(p);

async function setup(over: Partial<Parameters<typeof createAuth>[0]> = {}) {
  let t = 1_800_000_000_000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const sent: string[] = [];
  const auth = await createAuth({ store: memoryAuthStore(), showCodes: true, now: clock.now, ...over });
  return { auth, clock, sent };
}

describe('phone numbers', () => {
  it('accepts the usual Nigerian formats and rejects the rest', () => {
    for (const p of ['0803 000 1111', '08030001111', '+234 803 000 1111', '2348030001111', '8030001111']) expect(normalizePhone(p)).toBe('+2348030001111');
    for (const p of ['0803 000 111', '0603 000 1111', 'hello', '']) expect(normalizePhone(p)).toBeNull();
  });
});

describe('sign in with a code', () => {
  it('signs in an existing number and remembers the session', async () => {
    const { auth } = await setup();
    const s = await auth.start('0803 000 1111', 'signin', exists);
    expect(s.ok).toBe(true);
    const code = (s as { demoCode: string }).demoCode;
    expect(code).toMatch(/^\d{6}$/);
    const v = await auth.verify('08030001111', code, idFor);
    expect(v).toMatchObject({ ok: true, userId: 'c-kenneth' });
    const token = (v as { token: string }).token;
    expect(auth.userFor(token)).toBe('c-kenneth');
    await auth.revoke(token);
    expect(auth.userFor(token)).toBeNull();
  });

  it('refuses unknown numbers on sign-in and known numbers on sign-up', async () => {
    const { auth } = await setup();
    expect(await auth.start('0813 555 0000', 'signin', exists)).toMatchObject({ ok: false, status: 404 });
    expect(await auth.start('0803 000 1111', 'signup', exists)).toMatchObject({ ok: false, status: 409 });
    expect(await auth.start('12345', 'signin', exists)).toMatchObject({ ok: false, status: 400 });
  });

  it('locks a code after 5 wrong tries and expires it after 10 minutes', async () => {
    const { auth, clock } = await setup();
    const s = (await auth.start('0803 000 1111', 'signin', exists)) as { demoCode: string };
    const wrong = s.demoCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await auth.verify('0803 000 1111', wrong, idFor)).ok).toBe(false);
    expect(await auth.verify('0803 000 1111', s.demoCode, idFor)).toMatchObject({ ok: false, status: 429 });
    clock.advance(31_000);
    const s2 = (await auth.start('0803 000 1111', 'signin', exists)) as { demoCode: string };
    clock.advance(11 * 60_000);
    expect(await auth.verify('0803 000 1111', s2.demoCode, idFor)).toMatchObject({ ok: false, error: expect.stringMatching(/expired/) });
  });

  it('limits how often codes are sent', async () => {
    const { auth, clock } = await setup();
    expect((await auth.start('0803 000 1111', 'signin', exists)).ok).toBe(true);
    expect(await auth.start('0803 000 1111', 'signin', exists)).toMatchObject({ status: 429 });
    for (let i = 0; i < 4; i++) {
      clock.advance(31_000);
      expect((await auth.start('0803 000 1111', 'signin', exists)).ok).toBe(true);
    }
    clock.advance(31_000);
    expect(await auth.start('0803 000 1111', 'signin', exists)).toMatchObject({ status: 429, error: expect.stringMatching(/hour/) });
  });

  it('never shows codes in production; it needs a real SMS sender', async () => {
    const off = await createAuth({ store: memoryAuthStore(), showCodes: false });
    expect(await off.start('0803 000 1111', 'signin', exists)).toMatchObject({ ok: false, status: 503 });
    const texts: string[] = [];
    const on = await createAuth({ store: memoryAuthStore(), showCodes: false, sms: async (_p, t) => void texts.push(t) });
    const r = await on.start('0803 000 1111', 'signin', exists);
    expect(r.ok).toBe(true);
    expect(r).not.toHaveProperty('demoCode');
    expect(texts[0]).toMatch(/Your Allyfe code is \d{6}/);
  });
});

describe('sign up', () => {
  const artisan: SignupProfile = {
    role: 'artisan', name: 'Uche  Nnamdi', city: 'Port Harcourt', area: 'Rumuola', kind: 'individual', teamName: '', teamMembers: [],
    trade: 'Plumber', categories: ['Plumbing'], years: 6, bio: 'Bathrooms and boreholes.', bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Uche Nnamdi' },
  };

  it('gives a new number a one-time ticket, then creates the account', async () => {
    const { auth } = await setup();
    const s = (await auth.start('0815 222 3333', 'signup', exists)) as { demoCode: string };
    const v = (await auth.verify('0815 222 3333', s.demoCode, idFor)) as { ticket: string };
    expect(v.ticket).toBeTruthy();
    const phone = auth.takeTicket(v.ticket)!;
    expect(phone).toBe('+2348152223333');
    expect(auth.takeTicket(v.ticket)).toBeNull(); // single use

    const core = await createCore(memoryStorage());
    const r = await core.register(phone, artisan, 'signupaa1');
    expect(r.ok).toBe(true);
    const id = (r as { userId: string }).userId;
    const u = r.state.users[id];
    expect(u).toMatchObject({ role: 'artisan', name: 'Uche Nnamdi', phone: '0815 222 3333', area: 'Rumuola, Port Harcourt', bank: 'GTBank •••• 6789', rating: 0, ratingCount: 0 });
    expect(u.role === 'artisan' && u.verification.status).toBe('none');
    expect(JSON.stringify(r.state)).not.toContain('0123456789'); // full account number is not stored
    // The same number can't sign up twice.
    expect((await core.register(phone, artisan, 'signupaa2')).ok).toBe(false);
  });

  it('checks each account type’s required details', async () => {
    const core = await createCore(memoryStorage());
    const bad = await core.register('+2348152223334', { ...artisan, bank: { ...artisan.bank, accountNumber: '123' } }, 'signupbb1');
    expect(bad).toMatchObject({ ok: false, error: expect.stringMatching(/10 digits/) });
    const team = await core.register('+2348152223334', { ...artisan, kind: 'team', teamName: 'Uche Plumbing', teamMembers: ['Uche'] }, 'signupbb2');
    expect(team).toMatchObject({ ok: false, error: expect.stringMatching(/2 members/) });
    const vendor = await core.register('+2348152223335', { role: 'vendor', name: 'Rumuola Supplies', ownerName: 'Ada Obi', market: 'Rumuola Market', city: 'Port Harcourt', area: 'Rumuola', categories: [], bank: artisan.bank }, 'signupbb3');
    expect(vendor).toMatchObject({ ok: false, error: expect.stringMatching(/kind of material/) });
    const client = await core.register('+2348152223336', { role: 'client', name: 'Ebi Tamuno', city: 'Port Harcourt', area: 'Woji' }, 'signupbb4');
    expect(client.ok).toBe(true);
  });

  it('will not create accounts through the normal action endpoint', async () => {
    const core = await createCore(memoryStorage());
    const r = await core.apply({ userId: 'c-kenneth', action: { type: 'registerUser', phone: '+2348152223337', profile: { role: 'client', name: 'X Y Z', city: 'Lagos', area: 'Yaba' } }, now: Date.now(), nonce: 'regxxxx1' });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });
});
