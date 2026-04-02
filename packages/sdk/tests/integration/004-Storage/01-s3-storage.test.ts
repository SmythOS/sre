// prettier-ignore-file
/**
 * Storage.S3() integration — requires AWS credentials.
 *
 * Env vars:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model, Storage } from '../../../src/index';
import { initSRE, unique, HAS_S3_STORAGE } from '../_helpers';

describe.skipIf(!HAS_S3_STORAGE)('Storage - S3 integration', () => {
    beforeAll(() => initSRE());

    const s3Config = () => ({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.S3_BUCKET_NAME!,
    });

    it('standalone Storage.S3() write/read/delete cycle', async () => {
        const store = Storage.S3(s3Config());
        const key = `integration-test-${Date.now()}.txt`;
        const content = `S3 test content ${Date.now()}`;

        const uri = await store.write(key, content);
        expect(uri).toBeDefined();
        expect(typeof uri).toBe('string');

        const data = await store.read(key);
        expect(data.toString()).toBe(content);

        await store.delete(key);
    }, 30000);

    it('exists() returns truthy for written file', async () => {
        const store = Storage.S3(s3Config());
        const key = `exists-s3-${Date.now()}.txt`;

        await store.write(key, 'exists-test');
        const existsResult = await store.exists(key);
        expect(existsResult).toBeTruthy();

        // Cleanup
        await store.delete(key);
    }, 30000);

    it('agent-scoped S3 storage generates unique URIs per agent', async () => {
        const teamId = unique('team');
        const agentA = new Agent({ id: unique('a'), teamId, name: 'A', model: Model.Echo('Echo') });
        const agentB = new Agent({ id: unique('b'), teamId, name: 'B', model: Model.Echo('Echo') });

        const storeA = agentA.storage.S3(s3Config());
        const storeB = agentB.storage.S3(s3Config());

        const key = `scoped-s3-${Date.now()}.txt`;
        const uriA = await storeA.write(key, 'from A');
        const uriB = await storeB.write(key, 'from B');

        // Different agents get different URIs
        expect(uriA).not.toBe(uriB);

        // Cleanup
        await storeA.delete(key);
        await storeB.delete(key);
    }, 30000);

    it('read/write binary data', async () => {
        const store = Storage.S3(s3Config());
        const key = `binary-s3-${Date.now()}.bin`;
        const buffer = Buffer.from([0x00, 0x01, 0x02, 0xFF]);

        await store.write(key, buffer);
        const data = await store.read(key);
        expect(Buffer.isBuffer(data) || data instanceof Uint8Array).toBe(true);

        // Cleanup
        await store.delete(key);
    }, 30000);
});
