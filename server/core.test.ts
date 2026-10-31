import { describe, expect, it } from 'vitest';
import { createCore, memoryStorage } from './core';
import { reduce, type Action } from '../src/domain/actions';

const post: Action = {
  type: 'postJob',
  draft: { title: 'Fix sockets', desc: 'Three sockets dead.', addr: '12 Woji Road', category: 'Electrical', tier: 'Basic', schedule: { mode: 'This week', days: [] }, photos: [], honest: true },
};

describe('server core', () => {
  it('produces the same ids as the phone did for the same action', async () => {
    const core = await createCore(memoryStorage());
    const now = Date.now();
    const phone = reduce({ ...core.snapshot().state, sessionUserId: 'c-kenneth' }, post, now, 'abc123xyz');
    const r = await core.apply({ userId: 'c-kenneth', action: post, now, nonce: 'abc123xyz' });
    expect(r.ok).toBe(true);
    expect(r.state.jobs[0].id).toBe(phone.jobs[0].id);
    expect(r.state.jobs[0].ref).toBe(phone.jobs[0].ref);
    expect(r.state.sessionUserId).toBeNull();
    expect(r.rev).toBe(2);
  });

  it('shares changes between users: what one posts, the other sees', async () => {
    const core = await createCore(memoryStorage());
    await core.apply({ userId: 'c-kenneth', action: post, now: Date.now(), nonce: 'n1aaaaaa' });
    const jobId = core.snapshot().state.jobs[0].id;
    const r = await core.apply({ userId: 'a-chidi', action: { type: 'submitProposal', jobId, kind: 'apply', amount: 0, message: '' }, now: Date.now(), nonce: 'n2aaaaaa' });
    expect(r.ok).toBe(true);
    expect(core.snapshot().state.jobs[0].proposals[0].artisanId).toBe('a-chidi');
    expect(core.snapshot().state.alerts['c-kenneth'][0].text).toMatch(/Chidi Amadi applied/);
  });

  it('refuses broken rules with the reason and leaves the state alone', async () => {
    const core = await createCore(memoryStorage());
    const before = core.snapshot().rev;
    const r = await core.apply({ userId: 'c-kenneth', action: { type: 'withdraw', amount: 99_000_000 }, now: Date.now(), nonce: 'n3aaaaaa' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
    expect(core.snapshot().rev).toBe(before);
  });

  it('rejects unknown users, device-only actions and bad nonces', async () => {
    const core = await createCore(memoryStorage());
    expect((await core.apply({ userId: 'nobody', action: { type: 'topUp', amount: 5 }, now: Date.now(), nonce: 'n4aaaaaa' })).ok).toBe(false);
    expect((await core.apply({ userId: 'c-kenneth', action: { type: 'signIn', userId: 'co-toolhub' }, now: Date.now(), nonce: 'n5aaaaaa' })).ok).toBe(false);
    expect((await core.apply({ userId: 'c-kenneth', action: { type: 'topUp', amount: 5 }, now: Date.now(), nonce: '../x' })).ok).toBe(false);
  });

  it('can block resetting the shared data (production)', async () => {
    const core = await createCore(memoryStorage(), { allowReset: false });
    const r = await core.apply({ userId: 'c-kenneth', action: { type: 'reset' }, now: Date.now(), nonce: 'n7aaaaaa' });
    expect(r.ok).toBe(false);
  });

  it('keeps state across restarts', async () => {
    const storage = memoryStorage();
    const a = await createCore(storage);
    await a.apply({ userId: 'c-kenneth', action: post, now: Date.now(), nonce: 'n6aaaaaa' });
    const b = await createCore(storage);
    expect(b.snapshot().state.jobs[0].title).toBe('Fix sockets');
    expect(b.snapshot().rev).toBe(2);
  });
});
