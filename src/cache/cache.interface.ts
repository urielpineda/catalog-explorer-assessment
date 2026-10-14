// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

// A cache entry distinguishes three states by its presence/value, not two:
// - true miss: get() resolves to undefined (nothing cached for this key)
// - negative hit: get() resolves to { value: null }  ("confirmed does not exist")
// - positive hit: get() resolves to { value: <T> }
//
// Negative hits still have to surface as NOT_FOUND to the RPC caller; the
// cache only ever decides whether to call upstream, never the gRPC status.
export interface CacheEntry<T> {
  value: T | null;
}

export interface Cache {
  get<T>(key: string): Promise<CacheEntry<T> | undefined>;
  set<T>(key: string, value: T | null, ttlMs: number): Promise<void>;
}
