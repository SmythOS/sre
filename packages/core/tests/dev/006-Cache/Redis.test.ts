import { xxh3 } from '@node-rs/xxhash';
import { CacheConnector, ICacheConnector } from '@sre/MemoryManager/Cache.service';
import { RedisCache } from '@sre/MemoryManager/Cache.service/connectors/RedisCache.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { describe, expect, it } from 'vitest';

import config from '@sre/config';
import { ConnectorService, SmythRuntime } from '@sre/index';

const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: config.env.REDIS_SENTINEL_HOSTS,
            name: config.env.REDIS_MASTER_NAME || '',
            password: config.env.REDIS_PASSWORD || '',
        },
    },
});

//import SRE, { AgentRequest } from '../../dist';
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let redisCache: CacheConnector = ConnectorService.getCacheConnector();

const testFile = 'unit-tests/test.txt';
const testAdditionalACLMetadata = {
    hashAlgorithm: 'xxh3',
    entries: {
        [TAccessRole.Team]: {
            //hash 'team1'
            [xxh3.xxh64('team1').toString(16)]: [TAccessLevel.Read, TAccessLevel.Write],
        },
    },
};

const testFileWithMeta = 'unit-tests/test-meta.txt';
const testOriginalACLMetadata = {
    hashAlgorithm: 'none',
    entries: {
        [TAccessRole.Team]: {
            teamMeta: [TAccessLevel.Read, TAccessLevel.Write],
        },
    },
};
const testOriginalMetadata = {
    'Content-Type': 'text/plain',
    'x-amz-meta-test': 'test',
};
describe('RedisCache Tests', () => {
    it('Create Redis', async () => {
        expect(redisCache).toBeInstanceOf(RedisCache);
    });

    it('Reset Test Data', async () => {
        let error;
        try {
            await Promise.all([redisCache.delete(testFile), redisCache.delete(testFileWithMeta)]);
        } catch (e) {
            console.error(e);
            error = e;
        }
        expect(error).toBeUndefined();
    });
    it('Set Caches', async () => {
        let error;

        try {
            const res1 = await redisCache.set(testFile, 'Hello World!');
            expect(res1).toBeTruthy();

            const res2 = await redisCache.set(testFileWithMeta, 'I have metadata', testOriginalACLMetadata, testOriginalMetadata);
            expect(res2).toBeTruthy();
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does cache exist ?', async () => {
        let found = await redisCache.exists(testFile);
        expect(found).toBeTruthy();

        found = await redisCache.exists(testFileWithMeta);
        expect(found).toBeTruthy();
    });

    it('Does metadata exist ?', async () => {
        let metadata = await redisCache.getMetadata(testFileWithMeta);
        expect(metadata?.acl).toEqual(testOriginalACLMetadata);
    });

    it('Set ACL Metadata', async () => {
        //we set the metadata for the file created in the previous test
        await redisCache.setACL(testFile, testAdditionalACLMetadata);
    });

    it('Are Metadata ACL valid', async () => {
        const accessRights = await redisCache.getACL(testFile);

        expect(accessRights).toEqual(testAdditionalACLMetadata);
    });

    it('Check Access Rights => Grant', async () => {
        try {
            const req = AccessCandidate.team('team1').readRequest.resource(testFile);
            const accessCheck = await redisCache.hasAccess(req);

            expect(accessCheck).toBeTruthy();
        } catch (e) {
            expect(e).toBeUndefined();
        }
    });

    it('Check Access Rights => Refuse', async () => {
        try {
            const wrongRole = await redisCache.hasAccess(
                //request Write access to testFile for agent "team1" (teamid used as agentId which is wrong)
                AccessCandidate.agent('team1').writeRequest.resource(testFile)
                //
            );
            expect(wrongRole).toBeFalsy();

            const wrongTeam = await redisCache.hasAccess(
                //request Write access to testFile for team "team2" (wrong team)
                AccessCandidate.team('team2').writeRequest.resource(testFile)
                //
            );
            expect(wrongTeam).toBeFalsy();

            const wrongResource = await redisCache.hasAccess(
                //request Write access to testFileWithMeta for team "team1" (file exists but does not belong to the team1)
                AccessCandidate.team('team1').writeRequest.resource(testFileWithMeta)
            );
            expect(wrongResource).toBeFalsy();

            const nonExistingResource = await redisCache.hasAccess(
                //request Write access to non existing resource
                AccessCandidate.team('team1').writeRequest.resource('does-not-exist')
            );
            expect(nonExistingResource).toBeFalsy();
        } catch (e) {
            expect(e).toBeUndefined();
        }
    });

    it('Read keys from S3Storage', async () => {
        const data = await redisCache.get(testFile);
        const strData = data?.toString();
        expect(strData).toEqual('Hello World!');

        const dataWithMeta = await redisCache.get(testFileWithMeta);
        const strDataWithMeta = dataWithMeta?.toString();
        expect(strDataWithMeta).toEqual('I have metadata');
    });

    it('Delete key from S3Storage', async () => {
        let error;

        try {
            await redisCache.delete(testFile);
            //redisCache.delete(testFileWithMeta);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('The key should be deleted', async () => {
        const found = await redisCache.exists(testFile);
        expect(found).toBeFalsy();
    });

    it('Set and verify Cache TTL', async () => {
        await redisCache.updateTTL(testFileWithMeta, 5);
        await delay(3000);
        const ttl = await redisCache.getTTL(testFileWithMeta);
        expect(ttl).toBeLessThanOrEqual(5);
    });
    it('Cache not expired yet', async () => {
        const exists = await redisCache.exists(testFileWithMeta);
        expect(exists).toBeTruthy();
    });

    it('Cache expired', async () => {
        await delay(3000); //wait for expiration
        const exists = await redisCache.exists(testFileWithMeta);
        expect(exists).toBeFalsy();
    });
    it('Metadata removed after cache expiration', async () => {
        const metadata = await redisCache.getMetadata(testFileWithMeta);
        expect(metadata).toEqual({});
    });
});
