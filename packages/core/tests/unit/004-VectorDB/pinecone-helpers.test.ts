import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleepWithJitter, withTimeout } from '@sre/IO/VectorDB.service/connectors/pinecone/async-utils';
import { withSafeRetry } from '@sre/IO/VectorDB.service/connectors/pinecone/retry-utils';
import * as retryUtils from '@sre/IO/VectorDB.service/connectors/pinecone/retry-utils';
import { PineconeConnectionManager } from '@sre/IO/VectorDB.service/connectors/pinecone/connection-manager';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';

const { pineconeCtor } = vi.hoisted(() => {
    const ctor = vi
        .fn()
        .mockImplementation(function (this: any, { apiKey }: { apiKey: string }) {
            this.apiKey = apiKey;
            this.Index = vi.fn().mockReturnValue({
                namespace: vi.fn().mockReturnValue({
                    upsert: vi.fn(),
                    deleteAll: vi.fn(),
                    deleteMany: vi.fn(),
                    query: vi.fn(),
                }),
            });
        });
    return { pineconeCtor: ctor };
});

vi.mock('@pinecone-database/pinecone', () => ({
    Pinecone: pineconeCtor,
}));

describe('async-utils', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('sleepWithJitter waits for deterministic jittered delay', async () => {
        vi.useFakeTimers();
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const promise = sleepWithJitter(100, 0.2);

        await vi.advanceTimersByTimeAsync(110);
        await expect(promise).resolves.toBeUndefined();
        expect(randomSpy).toHaveBeenCalled();
    });

    it('withTimeout resolves before deadline', async () => {
        const result = await withTimeout(async () => 'done', { timeoutMs: 100 });
        expect(result).toBe('done');
    });

    it('withTimeout rejects on timeout and triggers callback', async () => {
        const onTimeout = vi.fn();
        const promise = withTimeout(
            () => new Promise<never>(() => {
                /* never resolves */
            }),
            { timeoutMs: 10, onTimeout }
        );

        await expect(promise).rejects.toThrow('Operation timed out');
        expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('withTimeout respects external abort signal', async () => {
        const controller = new AbortController();
        const promise = withTimeout(
            () => new Promise<never>(() => {
                /* never resolves */
            }),
            { timeoutMs: 1000, signal: controller.signal }
        );

        controller.abort(new Error('stop now'));
        await expect(promise).rejects.toThrow('stop now');
    });
});

describe('retry-utils', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('returns result on first attempt', async () => {
        const operation = vi.fn().mockResolvedValue('ok');
        await expect(withSafeRetry('query', operation)).resolves.toBe('ok');
        expect(operation).toHaveBeenCalledTimes(1);
    });

    it('retries after failure and eventually succeeds', async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const operation = vi
            .fn<[AbortSignal?], Promise<string>>()
            .mockRejectedValueOnce(new Error('first'))
            .mockResolvedValueOnce('ok');
        const onAttempt = vi.fn();

        const pending = withSafeRetry('query', operation, { attempts: 3, baseDelayMs: 100, maxDelayMs: 100, jitterRatio: 0 }, undefined, undefined, onAttempt);
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(100);
        await expect(pending).resolves.toBe('ok');

        expect(operation).toHaveBeenCalledTimes(2);
        expect(onAttempt).toHaveBeenCalledWith(1, expect.any(Error));
        expect(onAttempt).toHaveBeenCalledWith(2);
    });

    it('throws after exhausting retry attempts', async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const operation = vi.fn().mockRejectedValue(new Error('fail'));

        const pending = withSafeRetry('query', operation, { attempts: 2, baseDelayMs: 50, maxDelayMs: 50, jitterRatio: 0 });
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(50);

        await expect(pending).rejects.toThrow('fail');
        expect(operation).toHaveBeenCalledTimes(2);
    });

    it('honors external abort signals', async () => {
        vi.useFakeTimers();
        const controller = new AbortController();
        const operation = vi.fn().mockImplementation(async () => {
            await vi.advanceTimersByTimeAsync(10);
            return 'never';
        });

        const pending = withSafeRetry('query', operation, { attempts: 2, baseDelayMs: 10, maxDelayMs: 10, jitterRatio: 0 }, undefined, controller.signal);
        controller.abort(new Error('aborted'));

        await expect(pending).rejects.toThrow('aborted');
        expect(operation).toHaveBeenCalledTimes(1);
    });
});

describe('PineconeConnectionManager', () => {
    const candidate = AccessCandidate.user('user-1');
    let acRequest: AccessRequest;
    let safeRetrySpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        pineconeCtor.mockClear();
        acRequest = new AccessRequest(candidate);
        safeRetrySpy = vi.spyOn(retryUtils, 'withSafeRetry').mockImplementation(
            async (_operationName, operation, _retryConfig, _timeoutConfig, externalSignal) => {
                return operation(externalSignal ?? new AbortController().signal);
            }
        );
    });

    afterEach(() => {
        safeRetrySpy.mockRestore();
        vi.restoreAllMocks();
    });

    it('creates and caches Pinecone client when apiKey is provided', async () => {
        vi.spyOn(ConnectorService, 'getManagedVaultConnector').mockImplementation(() => {
            throw new Error('no managed vault');
        });
        vi.spyOn(ConnectorService, 'getVaultConnector').mockImplementation(() => {
            throw new Error('no vault');
        });

        const manager = new PineconeConnectionManager({
            indexName: 'test-index',
            auth: { apiKey: 'secret-key' },
        });

        const first = await manager.getClient(acRequest);
        const second = await manager.getClient(acRequest);

        expect(first).toBe(second);
        expect(pineconeCtor).toHaveBeenCalledTimes(1);
        expect(pineconeCtor).toHaveBeenCalledWith({ apiKey: 'secret-key' });
    });

    it('resets cached client on reset()', async () => {
        vi.spyOn(ConnectorService, 'getManagedVaultConnector').mockImplementation(() => {
            throw new Error('no managed vault');
        });
        vi.spyOn(ConnectorService, 'getVaultConnector').mockImplementation(() => {
            throw new Error('no vault');
        });

        const manager = new PineconeConnectionManager({
            indexName: 'test-index',
            auth: { apiKey: 'secret-key' },
        });

        await manager.getClient(acRequest);
        manager.reset();
        await manager.getClient(acRequest);

        expect(pineconeCtor).toHaveBeenCalledTimes(2);
    });

    it('fetches api key from managed vault and caches it', async () => {
        const managedVaultRequester = vi.fn().mockResolvedValue('managed-secret');
        const managedVault = {
            requester: vi.fn().mockReturnValue({
                get: managedVaultRequester,
            }),
        } as unknown as ReturnType<typeof ConnectorService.getManagedVaultConnector>;

        vi.spyOn(ConnectorService, 'getManagedVaultConnector').mockReturnValue(managedVault);
        vi.spyOn(ConnectorService, 'getVaultConnector').mockImplementation(() => {
            throw new Error('no vault');
        });

        const manager = new PineconeConnectionManager({
            indexName: 'test-index',
            auth: { vaultKey: 'secret/path' },
        });

        await manager.getClient(acRequest);
        await manager.getClient(acRequest);

        expect(managedVault.requester).toHaveBeenCalledTimes(1);
        expect(managedVaultRequester).toHaveBeenCalledWith('secret/path');
        expect(pineconeCtor).toHaveBeenCalledWith({ apiKey: 'managed-secret' });
    });

    it('throws when no credentials are available', async () => {
        vi.spyOn(ConnectorService, 'getManagedVaultConnector').mockImplementation(() => {
            throw new Error('no managed vault');
        });
        vi.spyOn(ConnectorService, 'getVaultConnector').mockImplementation(() => {
            throw new Error('no vault');
        });

        const manager = new PineconeConnectionManager({ indexName: 'test-index' });
        await expect(manager.getClient(acRequest)).rejects.toThrow('No Pinecone API key available');
        expect(pineconeCtor).not.toHaveBeenCalled();
    });
});
