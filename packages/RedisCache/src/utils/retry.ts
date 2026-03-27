export type RetryOptions = {
  retries?: number;         // total attempts (incl. first)
  baseMs?: number;          // initial backoff
  maxMs?: number;           // cap
  onRetry?: (err: unknown, attempt: number) => void;
  isRetryable?: (err: unknown) => boolean;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 100;
  const maxMs = opts.maxMs ?? 1500;
  const isRetryable = opts.isRetryable ?? (() => true);

  let attempt = 0;
  let lastErr: unknown;

  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      attempt++;
      if (attempt >= retries || !isRetryable(err)) break;

      const delay = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
      opts.onRetry?.(err, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
