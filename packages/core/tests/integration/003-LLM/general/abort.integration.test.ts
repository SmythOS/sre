import { describe, it, expect } from 'vitest';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { TLLMEvent } from '@sre/types/LLM.types';
import EventEmitter from 'events';
import { checkIntegrationTestConsent } from '../../../utils/test-data-manager';
import { setupSRE } from '../../../utils/sre';
import testModels from './testModels';

checkIntegrationTestConsent();
setupSRE();
process.on('unhandledRejection', (err) => {
    if (err instanceof Error && /Request was aborted/i.test(err.message)) {
        return;
    }
    throw err;
});

const agentId = 'cm0zjhkzx0dfvhxf81u76taiz';
const TIMEOUT = 20000;
// Mid-flight abort delay so we exercise real cancellation instead of pre-cancel.
const CANCEL_DELAY_MS = 100;
const ABORT_MATCH = /Abort|fetch failed|Connection error|EAI_AGAIN/i;

async function expectAbortWithModel(modelId: string) {
    const llmInference = await LLMInference.getInstance(modelId, AccessCandidate.team('default'));
    const abortController = new AbortController();

    const promptPromise = llmInference.prompt({
        query: 'ping',
        params: {
            model: modelId,
            agentId,
            maxTokens: 5,
            abortSignal: abortController.signal,
        },
    });

    const cancelTimer = setTimeout(() => abortController.abort(), CANCEL_DELAY_MS);

    await expect(promptPromise).rejects.toThrow(ABORT_MATCH);
    clearTimeout(cancelTimer);
}

async function expectStreamAbortWithModel(modelId: string) {
    const llmInference = await LLMInference.getInstance(modelId, AccessCandidate.team('default'));
    const abortController = new AbortController();

    let result: EventEmitter | Promise<unknown>;
    const cancelTimer = setTimeout(() => abortController.abort(), CANCEL_DELAY_MS);

    try {
        result = await llmInference.promptStream({
            query: 'ping',
            params: {
                model: modelId,
                agentId,
                maxTokens: 16,
                abortSignal: abortController.signal,
            },
        });
    } catch (err: any) {
        clearTimeout(cancelTimer);
        await expect(Promise.reject(err)).rejects.toThrow(ABORT_MATCH);
        return;
    }

    // If the connector rejects, it will be caught by expect below.
    if (result instanceof Promise) {
        await expect(result).rejects.toThrow(ABORT_MATCH);
        clearTimeout(cancelTimer);
        return;
    }

    // Otherwise treat the returned EventEmitter as the stream and ensure it emits an error/end after abort.
    const stream: EventEmitter = result as EventEmitter;
    await expect(
        new Promise<void>((resolve, reject) => {
            const timeoutTimer = setTimeout(() => {
                clearTimeout(cancelTimer);
                stream.removeAllListeners();
                reject(new Error('Stream did not abort in time'));
            }, 1000);

            abortController.signal.addEventListener(
                'abort',
                () => {
                    clearTimeout(cancelTimer);
                    clearTimeout(timeoutTimer);
                    stream.removeAllListeners();
                    resolve();
                },
                { once: true }
            );

            const finish = (err?: Error) => {
                clearTimeout(cancelTimer);
                clearTimeout(timeoutTimer);
                stream.removeAllListeners();
                if (!err || ABORT_MATCH.test(err?.message || '')) {
                    resolve();
                } else {
                    reject(err);
                }
            };

            stream.once(TLLMEvent.Error, finish);
            stream.once(TLLMEvent.Interrupted, () => finish());
            stream.once(TLLMEvent.End, () => {
                if (abortController.signal.aborted) {
                    finish();
                } else {
                    reject(new Error('Stream finished before abort was triggered'));
                }
            });
        })
    ).resolves.toBeUndefined();
}

describe.each(testModels)('LLM abort integration: $provider ($id)', ({ id }) => {
    it(
        'aborts prompt when AbortSignal is triggered mid-flight',
        async () => {
            await expectAbortWithModel(id);
        },
        TIMEOUT
    );

    it(
        'aborts promptStream when AbortSignal is triggered mid-flight',
        async () => {
            await expectStreamAbortWithModel(id);
        },
        TIMEOUT
    );
});
