// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

export type Settled<R> = { ok: true; value: R } | { ok: false; error: unknown };

// A bounded worker pool, not Promise.all: one bad item never sinks the
// batch, and no more than `limit` calls are ever in flight at once, which
// matters when fan-out size (edition count) is upstream-controlled and can
// reach into the thousands.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<Settled<R>[]> {
  const results: Settled<R>[] = new Array(items.length);
  let cursor = 0;

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { ok: true, value: await fn(items[index]) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  });

  await Promise.all(workers);
  return results;
}
