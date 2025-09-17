/**
 * Resilient async utilities: retry, withTimeout, and sleep.
 *
 * - retry: Retries an async function with exponential backoff and optional jitter.
 * - withTimeout: Races a promise against a timeout.
 * - sleep: Delay helper (abortable via AbortSignal).
 */

export class AbortError extends Error {
  constructor(message = 'Operation aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/** Delay for a given number of milliseconds. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let timer: any;

    const onAbort = () => {
      if (timer) clearTimeout(timer);
      reject(new AbortError());
    };

    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
  });
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = `Timeout after ${ms}ms`,
  signal?: AbortSignal
): Promise<T> {
  if (ms <= 0) return promise; // no timeout

  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(new AbortError());
    };

    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    timeoutId = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error(message));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export type RetryOptions = {
  retries?: number; // number of retries on failure (default 3)
  minDelay?: number; // base delay (ms) for first retry (default 100)
  maxDelay?: number; // cap delay (ms) (default 10_000)
  factor?: number;   // backoff factor (default 2)
  jitter?: boolean;  // add random [0, delay) jitter (default true)
  onRetry?: (error: unknown, attempt: number, nextDelayMs: number) => void | Promise<void>;
  signal?: AbortSignal; // external abort controller
  timeoutPerAttemptMs?: number; // per-attempt timeout (ms)
  /**
   * Custom delay strategy. Receives attempt number (1-based for the first retry) and the computed base delay.
   * Should return the actual delay to wait before the next attempt. Return 0 for fastest tests.
   */
  delayStrategy?: (attempt: number, baseDelayMs: number) => number;
};

/**
 * Retry an async function with exponential backoff.
 *
 * The provided function receives the current attempt number (starting at 0 for the first call) and the AbortSignal.
 */
export async function retry<T>(
  fn: (attempt: number, signal?: AbortSignal) => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    minDelay = 100,
    maxDelay = 10_000,
    factor = 2,
    jitter = true,
    onRetry,
    signal,
    timeoutPerAttemptMs,
    delayStrategy,
  } = opts;

  // Helper to compute backoff delay for a given retry attempt (1-based for retries)
  const computeDelay = (attempt: number): number => {
    const base = Math.min(maxDelay, Math.max(0, Math.floor(minDelay * Math.pow(factor, attempt - 1))));
    const withJitter = jitter ? Math.floor(base * Math.random()) : base;
    return delayStrategy ? Math.max(0, Math.floor(delayStrategy(attempt, base))) : withJitter;
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new AbortError();

    try {
      const p = fn(attempt, signal);
      const result = timeoutPerAttemptMs ? await withTimeout(p, timeoutPerAttemptMs, `Attempt timed out after ${timeoutPerAttemptMs}ms`, signal) : await p;
      return result;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break; // out of retries

      // compute delay for the next attempt (attempt+1 is 1-based retry index)
      const nextDelay = computeDelay(attempt + 1);
      if (onRetry) await onRetry(err, attempt + 1, nextDelay);

      // wait unless aborted
      if (nextDelay > 0) await sleep(nextDelay, signal);
    }
  }

  throw lastError;
}

export const asyncUtils = { retry, withTimeout, sleep, AbortError };
