// prettier-ignore-file
/**
 * Cache.RAM() integration — no API keys required.
 * Tests real RAM cache connector through Agent and standalone.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model, Cache } from '../../../src/index';
import { initSRE, unique } from '../_helpers';

describe('Cache - RAM integration', () => {
    beforeAll(() => initSRE());

    it('standalone Cache.RAM() set/get/delete cycle', async () => {
        const cache = Cache.RAM();

        await cache.set('key1', { value: 42 });
        const val = await cache.get('key1');
        expect(val).toEqual({ value: 42 });

        await cache.delete('key1');
        const gone = await cache.get('key1');
        expect(gone).toBeNull();
    });

    it('exists() checks key presence', async () => {
        const cache = Cache.RAM();

        await cache.set('exists-key', 'yes');
        expect(await cache.exists('exists-key')).toBe(true);

        await cache.delete('exists-key');
        expect(await cache.exists('exists-key')).toBe(false);
    });

    it('TTL support — key expires', async () => {
        const cache = Cache.RAM();

        await cache.set('ttl-key', 'temporary', 1); // 1 second TTL
        expect(await cache.exists('ttl-key')).toBe(true);

        // Wait for expiration
        await new Promise((r) => setTimeout(r, 1500));
        const val = await cache.get('ttl-key');
        expect(val).toBeNull();
    });

    it('agent.cache.RAM() works with agent scope', async () => {
        const agent = new Agent({
            id: unique('cache'),
            name: 'CacheBot',
            model: Model.Echo('Echo'),
        });
        const cache = agent.cache.RAM();

        await cache.set('agent-key', 'agent-value');
        const val = await cache.get('agent-key');
        expect(val).toBe('agent-value');

        await cache.delete('agent-key');
    });
});
