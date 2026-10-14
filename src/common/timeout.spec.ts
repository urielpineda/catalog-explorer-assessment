// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { withTimeout, TimeoutError } from './timeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the value when the promise settles before the deadline', async () => {
    const promise = withTimeout(Promise.resolve('ok'), 1000);

    await expect(promise).resolves.toBe('ok');
  });

  it('rejects with TimeoutError when the promise never settles before the deadline', async () => {
    const never = new Promise(() => {});

    const promise = withTimeout(never, 1000);
    jest.advanceTimersByTime(1001);

    await expect(promise).rejects.toBeInstanceOf(TimeoutError);
  });

  it('propagates the original rejection when the promise fails before the deadline', async () => {
    const promise = withTimeout(Promise.reject(new Error('upstream 503')), 1000);

    await expect(promise).rejects.toThrow('upstream 503');
  });
});
