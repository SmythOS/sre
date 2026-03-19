// prettier-ignore-file
/**
 * Cache.LocalStorage() integration — no API keys required.
 * NOTE: LocalStorageCache stores raw Buffer/string, not JSON objects.
 * Use string values for compatibility.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Cache } from '../../../src/index';
import { initSRE } from '../_helpers';

describe('Cache - LocalStorage integration', () => {
    beforeAll(() => initSRE());

    it('set/get/delete cycle with string values', async () => {
        const cache = Cache.LocalStorage();

        await cache.set('ls-key-1', 'hello world');
        const val = await cache.get('ls-key-1');
        expect(val.toString()).toBe('hello world');

        await cache.delete('ls-key-1');
        const gone = await cache.get('ls-key-1');
        // LocalStorageCache returns undefined (not null) for missing keys
        expect(gone == null).toBe(true);
    });

    it('exists() checks key presence', async () => {
        const cache = Cache.LocalStorage();

        await cache.set('ls-exists', 'yes');
        const exists = await cache.exists('ls-exists');
        expect(exists).toBeTruthy();

        await cache.delete('ls-exists');
        const gone = await cache.exists('ls-exists');
        expect(!gone).toBe(true);
    });

    it('stores JSON via JSON.stringify', async () => {
        const cache = Cache.LocalStorage();
        const data = { arr: [1, 2, 3], nested: { flag: true }, num: 42 };

        await cache.set('ls-json', JSON.stringify(data));
        const val = await cache.get('ls-json');
        const parsed = JSON.parse(val.toString());
        expect(parsed).toEqual(data);

        await cache.delete('ls-json');
    });
});
