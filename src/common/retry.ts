// AI-ASSISTED: written by Claude (Anthropic) in a TDD-driven session; reviewed and
// understood by Uriel Pineda, not hand-typed. See README.md, "AI Usage".

export interface RetryOptions {
  attempts: number; // retries after the first attempt, not the total call count
  baseMs: number;
  isRetryable: (error: unknown) => boolean;
}

function fullJitterDelay(baseMs: number, attempt: number): number {
  const cap = baseMs * 2 ** attempt;
  return Math.random() * cap;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries idempotent reads only; the caller decides what's retryable (a
// definitive 404/400 should return false, so a bad id doesn't waste
// retries on an answer that will never change).
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  for (let attempt = 0; attempt <= options.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === options.attempts || !options.isRetryable(error)) {
        throw error;
      }
      await sleep(fullJitterDelay(options.baseMs, attempt));
    }
  }
  // Unreachable: the loop always throws on its last attempt above. TypeScript
  // can't prove that, so it still requires a terminating statement here.
  throw new Error('unreachable');
}
