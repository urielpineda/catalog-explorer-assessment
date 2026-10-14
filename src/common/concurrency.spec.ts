// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('maps every item and preserves input order in the output', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => n * 10);

    expect(results).toEqual([
      { ok: true, value: 10 },
      { ok: true, value: 20 },
      { ok: true, value: 30 },
    ]);
  });

  it('never runs more than `limit` tasks concurrently', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const items = [1, 2, 3, 4, 5, 6];

    await mapWithConcurrency(items, 2, async (n) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 5));
      concurrent--;
      return n;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('tolerates a single failing item without failing the whole batch', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 3, async (n) => {
      if (n === 2) throw new Error('bad item');
      return n;
    });

    expect(results).toEqual([
      { ok: true, value: 1 },
      { ok: false, error: new Error('bad item') },
      { ok: true, value: 3 },
    ]);
  });

  it('returns an empty array for an empty input', async () => {
    const results = await mapWithConcurrency([], 5, async (n: number) => n);

    expect(results).toEqual([]);
  });
});
