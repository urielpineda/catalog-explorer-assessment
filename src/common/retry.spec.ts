// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

import { withRetry } from './retry';

describe('withRetry', () => {
  it('returns the result on first success with no retries', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await withRetry(fn, { attempts: 2, baseMs: 10, isRetryable: () => true });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a retryable failure and returns the eventual success', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { attempts: 2, baseMs: 1, isRetryable: () => true });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting attempts and throws the last error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('still failing'));

    await expect(
      withRetry(fn, { attempts: 2, baseMs: 1, isRetryable: () => true }),
    ).rejects.toThrow('still failing');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry when isRetryable returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('not found'));

    await expect(
      withRetry(fn, { attempts: 3, baseMs: 1, isRetryable: () => false }),
    ).rejects.toThrow('not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
