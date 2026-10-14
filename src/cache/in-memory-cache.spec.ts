// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { InMemoryCache } from './in-memory-cache';

describe('InMemoryCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is a true miss for a key that was never set', async () => {
    const cache = new InMemoryCache();

    await expect(cache.get('missing')).resolves.toBeUndefined();
  });

  it('is a positive hit for a key just set', async () => {
    const cache = new InMemoryCache();
    await cache.set('search:dune:1:20', { title: 'Dune' }, 60_000);

    await expect(cache.get('search:dune:1:20')).resolves.toEqual({ value: { title: 'Dune' } });
  });

  it('is a negative hit (value: null) for a key cached as not-found', async () => {
    const cache = new InMemoryCache();
    await cache.set('work:OLBOGUSW', null, 60_000);

    await expect(cache.get('work:OLBOGUSW')).resolves.toEqual({ value: null });
  });

  it('expires a positive entry once its TTL has elapsed', async () => {
    const cache = new InMemoryCache();
    await cache.set('search:dune:1:20', { title: 'Dune' }, 1_000);

    jest.advanceTimersByTime(1_001);

    await expect(cache.get('search:dune:1:20')).resolves.toBeUndefined();
  });

  it('is still a hit just before the TTL elapses', async () => {
    const cache = new InMemoryCache();
    await cache.set('search:dune:1:20', { title: 'Dune' }, 1_000);

    jest.advanceTimersByTime(999);

    await expect(cache.get('search:dune:1:20')).resolves.toEqual({ value: { title: 'Dune' } });
  });
});
