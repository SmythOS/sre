import { sleepWithJitter, withTimeout } from './async-utils';
import { PineconeRetryConfig, PineconeRequestTimeouts, PineconeOperationName } from './types';

export type RetryableOperation<T> = (signal: AbortSignal) => Promise<T>;

const DEFAULT_RETRY: Required<PineconeRetryConfig> = {
    attempts: 3,
    baseDelayMs: 200,
    maxDelayMs: 2000,
    jitterRatio: 0.4,
};

const DEFAULT_TIMEOUTS: Required<PineconeRequestTimeouts> = {
    defaultMs: 5000,
    queryMs: 5000,
    upsertMs: 10000,
    deleteMs: 5000,
    describeStatsMs: 5000,
};

function getTimeoutMs(operation: PineconeOperationName, overrides?: PineconeRequestTimeouts) {
    const merged = { ...DEFAULT_TIMEOUTS, ...overrides };
    switch (operation) {
        case 'query':
            return merged.queryMs;
        case 'upsert':
            return merged.upsertMs;
        case 'deleteMany':
        case 'deleteAll':
        case 'deleteNamespace':
            return merged.deleteMs;
        case 'describeIndexStats':
            return merged.describeStatsMs;
        default:
            return merged.defaultMs;
    }
}

export async function withSafeRetry<T>(
    operationName: PineconeOperationName,
    operation: RetryableOperation<T>,
    retryConfig?: PineconeRetryConfig,
    timeoutConfig?: PineconeRequestTimeouts,
    externalSignal?: AbortSignal,
    onAttempt?: (attempt: number, error?: unknown) => void
): Promise<T> {
    const config = { ...DEFAULT_RETRY, ...retryConfig };
    let attempt = 0;
    let lastError: unknown;

    while (attempt < config.attempts) {
        attempt += 1;
        try {
            const timeoutMs = getTimeoutMs(operationName, timeoutConfig);
            const result = await withTimeout((signal) => operation(signal), {
                timeoutMs,
                signal: externalSignal,
                onTimeout: () => onAttempt?.(attempt, new Error(`Timeout after ${timeoutMs}ms`)),
            });
            onAttempt?.(attempt);
            return result;
        } catch (error) {
            lastError = error;
            onAttempt?.(attempt, error);

            const isAbortError = error instanceof Error && error.name === 'AbortError';
            if (isAbortError || externalSignal?.aborted) {
                throw error;
            }

            if (attempt >= config.attempts) {
                break;
            }

            const delay = Math.min(config.baseDelayMs * 2 ** (attempt - 1), config.maxDelayMs);
            await sleepWithJitter(delay, config.jitterRatio, externalSignal);
        }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
