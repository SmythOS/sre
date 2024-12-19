import xxhash from 'xxhashjs';
import { CacheConnector } from '@sre/MemoryManager/Cache.service';
import { RedisCache } from '@sre/MemoryManager/Cache.service/connectors/RedisCache.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { describe, expect, it } from 'vitest';

import config from '@sre/config';
import { ConnectorService, SmythRuntime } from '@sre/index';
import { S3Cache } from '@sre/MemoryManager/Cache.service/connectors/S3Cache.class';

function xxh3(source) {
    const h64 = xxhash.h64(); // Use xxhashjs's h64 function
    return h64.update(source.toString()).digest().toString(16);
}

const sre = SmythRuntime.Instance.init({
    Cache: {
        Connector: 'S3',
        Settings: {
            bucketName: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
});

//import SRE, { AgentRequest } from '../../dist';
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const s3Key = 'i-am-a-test-key';
const s3KeyWithMeta = 'i-am-a-test-key-with-meta';
const testAdditionalACLMetadata = {
    hashAlgorithm: 'xxh3',
    entries: {
        [TAccessRole.Team]: {
            //hash 'team1'
            [xxh3('team1')]: [TAccessLevel.Read, TAccessLevel.Write],
        },
    },
};

const testOriginalACLMetadata = {
    hashAlgorithm: 'xxh3',
    entries: {
        [TAccessRole.Team]: {
            teamMeta: [TAccessLevel.Read, TAccessLevel.Write],
        },
    },
};

const agentCandidate = AccessCandidate.team('team1');
const testOriginalMetadata = {
    'Content-Type': 'text/plain',
    'test': 'test',
};

let s3Cache: CacheConnector = ConnectorService.getCacheConnector();
describe('S3Cache Tests', () => {
    it('Create S3Cache', async () => {
        expect(s3Cache).toBeInstanceOf(S3Cache);
    });

    it('Reset Test Data', async () => {
        let error;
        try {
            await Promise.all([
                s3Cache.user(agentCandidate).delete(s3Key),
                s3Cache.user(AccessCandidate.team('team1')).delete(s3KeyWithMeta),
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
            const res1 = await s3Cache.user(agentCandidate).set(s3Key, 'Hello World!');
            expect(res1).toBeTruthy();

            const res2 = await s3Cache
                .user(agentCandidate)
                .set(s3KeyWithMeta, 'I have metadata', testOriginalACLMetadata, testOriginalMetadata);
            expect(res2).toBeTruthy();
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does cache exist ?', async () => {
        let found = await s3Cache.user(agentCandidate).exists(s3Key);
        expect(found).toBeTruthy();

        found = await s3Cache.user(agentCandidate).exists(s3KeyWithMeta);
        expect(found).toBeTruthy();
    });

    it('Does metadata exist ?', async () => {
        let metadata = await s3Cache.user(agentCandidate).getMetadata(s3KeyWithMeta);
        expect(JSON.stringify(metadata?.acl?.entries?.team.teamMeta)).toEqual(JSON.stringify(testOriginalACLMetadata.entries.team.teamMeta));
    });

    it('Set ACL Metadata', async () => {
        //we set the metadata for the file created in the previous test
        await s3Cache.user(agentCandidate).setACL(s3Key, testAdditionalACLMetadata);
    });

    it('Are Metadata ACL valid', async () => {
        const accessRights = await s3Cache.user(agentCandidate).getACL(s3Key);
        expect(JSON.stringify(accessRights?.entries?.team)).toEqual(JSON.stringify(testAdditionalACLMetadata.entries.team));
    });

    it('Check Access Rights => Grant', async () => {
        try {
            const team1 = AccessCandidate.team('team1');
            const accessCheck = await s3Cache.user(team1).get(s3Key);

            expect(accessCheck).toBeDefined();
        } catch (e) {
            expect(e).toBeUndefined();
        }
    });

    it('Check Access Rights => Refuse', async () => {
        try {
            const teamNoAccess = AccessCandidate.team('team2');
            const accessCheck = await s3Cache
                .user(teamNoAccess)
                .get(s3Key)
                .catch((error) => ({
                    error,
                }));
            expect(accessCheck?.error).toBeDefined();

        } catch (e) {
            expect(e).toBeUndefined();
        }
    });

    it('Read keys ', async () => {
        const data = await s3Cache.user(agentCandidate).get(s3Key);
        const strData = data?.toString();
        expect(strData).toEqual('Hello World!');

        const dataWithMeta = await s3Cache.user(agentCandidate).get(s3KeyWithMeta);
        const strDataWithMeta = dataWithMeta?.toString();
        expect(strDataWithMeta).toEqual('I have metadata');
    });

    it('Delete key', async () => {
        let error;

        try {
            await s3Cache.user(agentCandidate).delete(s3Key);
            //redisCache.delete(testFileWithMeta);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('The key should be deleted', async () => {
        const found = await s3Cache.user(agentCandidate).exists(s3Key);
        expect(found).toBeFalsy();
    });

    it('Set and verify Cache TTL', async () => {
        await s3Cache.user(agentCandidate).updateTTL(s3KeyWithMeta, 432000);
        await delay(1000);
        const ttl = await s3Cache.user(agentCandidate).getTTL(s3KeyWithMeta);
        expect(ttl).toBeLessThanOrEqual(432000);
    }, 10000);

    it('Cache not expired yet', async () => {
        const exists = await s3Cache.user(agentCandidate).exists(s3KeyWithMeta);
        expect(exists).toBeTruthy();
    });

    it('Cache expired', async () => {
        await delay(3000); //wait for expiration
        const exists = await s3Cache.user(agentCandidate).exists(s3KeyWithMeta);
        expect(exists).toBeFalsy();
    });
    it('Metadata removed after cache expiration', async () => {
        const metadata = await s3Cache.user(agentCandidate).getMetadata(s3KeyWithMeta);
        expect(metadata).toEqual({});
    });
});
