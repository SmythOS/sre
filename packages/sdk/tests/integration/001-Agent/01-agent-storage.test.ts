// prettier-ignore-file
/**
 * Agent + LocalStorage integration — no API keys required.
 * Tests real Storage connector wiring through the Agent.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model, Storage } from '../../../src/index';
import { initSRE, unique } from '../_helpers';

describe('Agent - LocalStorage integration', () => {
    beforeAll(() => initSRE());

    it('write and read a file via agent.storage', async () => {
        const agent = new Agent({
            id: unique('store'),
            name: 'StorageBot',
            model: Model.Echo('Echo'),
        });
        const store = agent.storage.LocalStorage();

        const content = `test-content-${Date.now()}`;
        const uri = await store.write('integration-test.txt', content);
        expect(uri).toBeDefined();
        expect(typeof uri).toBe('string');

        const data = await store.read('integration-test.txt');
        expect(data).toBeDefined();
        expect(data.toString()).toBe(content);

        // Cleanup
        await store.delete('integration-test.txt');
    });

    it('exists() returns truthy for written file', async () => {
        const agent = new Agent({
            id: unique('store'),
            name: 'StorageBot',
            model: Model.Echo('Echo'),
        });
        const store = agent.storage.LocalStorage();
        const key = `exists-test-${Date.now()}.txt`;

        await store.write(key, 'data');
        const existsResult = await store.exists(key);
        expect(existsResult).toBeTruthy();

        // Cleanup
        await store.delete(key);
    });

    it('standalone Storage.LocalStorage() works without agent', async () => {
        const store = Storage.LocalStorage();
        const key = `standalone-${Date.now()}.txt`;

        await store.write(key, 'standalone data');
        const data = await store.read(key);
        expect(data.toString()).toBe('standalone data');

        await store.delete(key);
    });

    it('agent-scoped storage generates unique URIs per agent', async () => {
        const teamId = unique('team');
        const agentA = new Agent({ id: unique('a'), teamId, name: 'A', model: Model.Echo('Echo') });
        const agentB = new Agent({ id: unique('b'), teamId, name: 'B', model: Model.Echo('Echo') });

        const storeA = agentA.storage.LocalStorage();
        const storeB = agentB.storage.LocalStorage();

        const key = 'scoped-key.txt';
        const uriA = await storeA.write(key, 'from A');
        const uriB = await storeB.write(key, 'from B');

        // Different agents should get different URIs (different scope prefix)
        expect(uriA).not.toBe(uriB);
        expect(uriA).toContain('.agent/');
        expect(uriB).toContain('.agent/');

        // Cleanup
        await storeA.delete(key);
        await storeB.delete(key);
    });
});
