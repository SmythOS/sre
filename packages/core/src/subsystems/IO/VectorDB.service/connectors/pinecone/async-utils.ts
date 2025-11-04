import { setTimeout as sleep } from 'timers/promises';

export type TimeoutOptions = {
    timeoutMs: number;
    signal?: AbortSignal;
    onTimeout?: () => void;
};

export async function sleepWithJitter(delayMs: number, jitterRatio: number, signal?: AbortSignal) {
    if (delayMs <= 0) return;
    const jitter = delayMs * Math.random() * jitterRatio;
    const totalDelay = delayMs + jitter;
    await sleep(totalDelay, undefined, { signal });
}

export async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, options: TimeoutOptions): Promise<T> {
    const controller = new AbortController();
    const { timeoutMs, signal, onTimeout } = options;

    const timer = setTimeout(() => {
        controller.abort(new Error('Operation timed out'));
        onTimeout?.();
    }, timeoutMs).unref?.();

    const abortListener = () => controller.abort(signal?.reason ?? new Error('Operation aborted'));

    if (signal) {
        if (signal.aborted) {
            clearTimeout(timer as unknown as NodeJS.Timeout);
            controller.abort(signal.reason ?? new Error('Operation aborted before start'));
        } else {
            signal.addEventListener('abort', abortListener, { once: true });
        }
    }

    try {
        const result = await Promise.race([
            operation(controller.signal),
            new Promise<never>((_, reject) => {
                const abortHandler = (event: Event) => {
                    const reason = (event?.target as AbortSignal)?.reason ?? new Error('Operation aborted');
                    reject(reason instanceof Error ? reason : new Error(String(reason)));
                };
                controller.signal.addEventListener('abort', abortHandler, { once: true });
            }),
        ]);
        return result;
    } finally {
        clearTimeout(timer as unknown as NodeJS.Timeout);
        if (signal) {
            signal.removeEventListener('abort', abortListener);
        }
    }
}
