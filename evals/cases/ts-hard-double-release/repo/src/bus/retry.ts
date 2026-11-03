import type { Clock } from "../platform/clock.ts";
import { RetryExhaustedError, TimeoutError } from "../platform/errors.ts";

export interface RetryOptions {
  attempts: number;
  /** An attempt that has not finished after this long counts as failed. */
  timeoutMs: number;
  /** Wait before attempt n+1 is backoffMs * n. */
  backoffMs: number;
  clock: Clock;
}

function sleep(ms: number, clock: Clock): Promise<void> {
  return new Promise((resolve) => {
    clock.setTimeout(resolve, ms);
  });
}

function withTimeout<T>(run: () => Promise<T>, ms: number, clock: Clock): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = clock.setTimeout(() => reject(new TimeoutError(ms)), ms);
    run().then(
      (value) => {
        clock.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clock.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Wraps an event handler so a slow or failing attempt is tried again. A timed-out attempt is not cancelled
 * (nothing can cancel a promise): it keeps running, and may finish after the next attempt has started.
 */
export function withRetry<E>(handler: (event: E) => Promise<void>, options: RetryOptions): (event: E) => Promise<void> {
  return async (event) => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= options.attempts; attempt++) {
      try {
        await withTimeout(() => handler(event), options.timeoutMs, options.clock);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < options.attempts) await sleep(options.backoffMs * attempt, options.clock);
      }
    }
    throw new RetryExhaustedError(options.attempts, lastError);
  };
}
