// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { Cache, CacheEntry } from './cache.interface';

interface StoredEntry {
  value: unknown;
  expiresAt: number;
}

// In-memory is fine for the assessment's scope (single instance, no
// cross-process sharing needed); the Cache interface is the seam a Redis
// implementation would sit behind without the CatalogService changing.
export class InMemoryCache implements Cache {
  private readonly store = new Map<string, StoredEntry>();

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return { value: entry.value as T | null };
  }

  async set<T>(key: string, value: T | null, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
