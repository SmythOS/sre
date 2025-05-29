import xxhash from 'xxhashjs';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { describe, expect, it } from 'vitest';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { LocalStorageCache } from '@sre/MemoryManager/Cache.service/connectors/LocalStorageCache.class';

function xxh3(source) {
    const h64 = xxhash.h64(); // Use xxhashjs's h64 function
    return h64.update(source.toString()).digest().toString(16);
}

const sre = SmythRuntime.Instance.init({
    Cache: {
        Connector: 'LocalStorage',
        Settings: {},
    },
});

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const testFile = 'test_file.txt';
const testAdditionalACLMetadata = {
    hashAlgorithm: 'xxh3',
    entries: {
        [TAccessRole.Team]: {
            //hash 'team1'
            [xxh3('team1')]: [TAccessLevel.Read, TAccessLevel.Write],
        },
    },
};

const testFileWithMeta = 'test_file_meta.txt';
const testOriginalACLMetadata = {
    hashAlgorithm: 'none',
    entries: {
        [TAccessRole.Team]: {
            teamMeta: [TAccessLevel.Read, TAccessLevel.Write],
        },
    },
};

const agentCandidate = AccessCandidate.agent('agent-123456').team('team1');
const testOriginalMetadata = {
    'Content-Type': 'text/plain',
    'x-amz-meta-test': 'test',
    tag: 'test',
};

let localStorageCache: CacheConnector = ConnectorService.getCacheConnector();
describe('LocalStorageCache Tests', () => {
    it('Create LocalStorageCache', async () => {
        expect(localStorageCache).toBeInstanceOf(LocalStorageCache);
    });

    it('Reset Test Data', async () => {
        let error;
        try {
            await Promise.all([
                localStorageCache.user(agentCandidate).delete(testFile),
                localStorageCache.user(agentCandidate).delete(testFileWithMeta),
            ]);
        } catch (e) {
            console.error(e);
            error = e;
        }
        expect(error).toBeUndefined();
    });
    it('Set Caches', async () => {
        let error;

        try {
            const res1 = await localStorageCache.user(agentCandidate).set(testFile, 'Hello World!');
            expect(res1).toBeTruthy();

            const res2 = await localStorageCache
                .user(agentCandidate)
                .set(testFileWithMeta, 'I have metadata', testOriginalACLMetadata, testOriginalMetadata);
            expect(res2).toBeTruthy();
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does cache exist?', async () => {
        let found = await localStorageCache.user(agentCandidate).exists(testFile);
        expect(found).toBeTruthy();

        found = await localStorageCache.user(agentCandidate).exists(testFileWithMeta);
        expect(found).toBeTruthy();
    });

    it('Does metadata exist?', async () => {
        let metadata = await localStorageCache.user(agentCandidate).getMetadata(testFileWithMeta);
        expect(metadata).toBeDefined();
    });

    it('Set ACL Metadata', async () => {
        //we set the metadata for the file created in the previous test
        await localStorageCache.user(agentCandidate).setACL(testFile, testAdditionalACLMetadata);
    });

    it('Are Metadata ACL valid', async () => {
        const accessRights = await localStorageCache.user(agentCandidate).getACL(testFile);

        expect(accessRights?.entries?.team).toEqual(testAdditionalACLMetadata.entries.team);
    });

    it('Check Access Rights => Grant', async () => {
        try {
            const agent = AccessCandidate.agent('agent-123456').team('team1');
            const accessCheck = await localStorageCache.user(agent).get(testFile);
            expect(accessCheck).toBeDefined();
        } catch (e) {
            expect(e).toBeUndefined();
        }
    });

    it('Check Access Rights => Refuse', async () => {
        try {
            const teamNoAccess = AccessCandidate.team('team2');
            const data = await localStorageCache.user(teamNoAccess);
            expect(data).toBeUndefined();
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    it('Read keys ', async () => {
        const data = await localStorageCache.user(agentCandidate).get(testFile);
        const strData = data?.toString();
        expect(strData).toEqual('Hello World!');

        const dataWithMeta = await localStorageCache.user(agentCandidate).get(testFileWithMeta);
        const strDataWithMeta = dataWithMeta?.toString();
        expect(strDataWithMeta).toEqual('I have metadata');
    });

    it('Delete key', async () => {
        let error;

        try {
            await localStorageCache.user(agentCandidate).delete(testFile);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('The key should be deleted', async () => {
        const found = await localStorageCache.user(agentCandidate).exists(testFile);
        expect(found).toBeFalsy();
    });

    it('Set and verify Cache TTL', async () => {
        await localStorageCache.user(agentCandidate).updateTTL(testFileWithMeta, 5);
        await delay(3000);
        const ttl = await localStorageCache.user(agentCandidate).getTTL(testFileWithMeta);
        expect(ttl).toBeLessThanOrEqual(5);
    }, 10000);
    it('Cache not expired yet', async () => {
        const exists = await localStorageCache.user(agentCandidate).exists(testFileWithMeta);
        expect(exists).toBeTruthy();
    });

    it('Cache expired', async () => {
        await delay(3000); //wait for expiration
        const exists = await localStorageCache.user(agentCandidate).exists(testFileWithMeta);
        expect(exists).toBeFalsy();
    });
    it('Metadata removed after cache expiration', async () => {
        const metadata = await localStorageCache.user(agentCandidate).getMetadata(testFileWithMeta);
        expect(metadata).toBeUndefined();
    });
});
