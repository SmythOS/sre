import { xxh3 } from '@node-rs/xxhash';
import { describe, expect, it } from 'vitest';

import { S3Storage } from '@sre/IO/Storage.service/connectors/S3Storage.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
//import SRE, { AgentRequest } from '../../dist';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';

import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';

import config from '@sre/config';
import { ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
const SREInstance = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
});

const testFile = 'unit-tests/test.txt';
const testAdditionalACLMetadata = {
    hashAlgorithm: 'xxh3',
    entries: {
        [TAccessRole.Team]: {
            //hash 'team1'
            [xxh3.xxh64('team1').toString(16)]: [TAccessLevel.Read, TAccessLevel.Write],
        },
        [TAccessRole.Agent]: {
            //hash 'team1'
            [xxh3.xxh64('agent1').toString(16)]: [TAccessLevel.Owner],
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

const agentCandidate = AccessCandidate.agent('agent-123456');

const testOriginalMetadata = {
    'Content-Type': 'text/plain',
    'x-amz-meta-test': 'test',
};

describe('S3 Storage Tests', () => {
    it('Create S3Storage', async () => {
        const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
        expect(s3Storage).toBeInstanceOf(S3Storage);
    });

    it('Read Legacy Metadata', async () => {
        //Expected to not work, will only work if we associate the candidate "agent-123456" with the team "9"
        //here we create a custom connector just to test this case

        class CustomAccountConnector extends AccountConnector {
            public getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
                if (candidate.id === 'agent-123456') {
                    return Promise.resolve('9');
                }
                return super.getCandidateTeam(candidate);
            }
        }
        ConnectorService.register(TConnectorService.Account, 'MyCustomAccountConnector', CustomAccountConnector);

        //initialize the custom account connector and force it to be default AccountConnector
        ConnectorService.init(TConnectorService.Account, 'MyCustomAccountConnector', {}, true);

        const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
        const legacyFile = 'teams/9/logs/closz0vak00009tsctm7e8xzs/2024-05-12/LLW3FLB08WIE';

        const metadata = await s3Storage.user(agentCandidate).getMetadata(legacyFile);

        expect(metadata.ContentType).toEqual('text/plain');

        const acl = await s3Storage.user(agentCandidate).getACL(legacyFile);
        expect(acl.migrated).toBe(true);
    });

    it('Write a file in S3Storage', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
            await s3Storage.user(agentCandidate).write(testFile, 'Hello World!');
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Write a file with metadata in S3Storage', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
            await s3Storage.user(agentCandidate).write(testFileWithMeta, 'I have metadata', testOriginalACLMetadata, testOriginalMetadata);

            const storageReq = await s3Storage.user(agentCandidate);
            storageReq.write(testFileWithMeta, 'I have metadata');
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does the files exist ?', async () => {
        const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
        const files = [testFile, testFileWithMeta];

        const promises = files.map((file) => {
            return s3Storage.user(agentCandidate).exists(file);
        });

        const results = await Promise.all(promises);

        expect(results).toEqual([true, true]);
    });

    it('Is Metadata present', async () => {
        const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
        const metadata = await s3Storage.user(agentCandidate).getMetadata(testFileWithMeta);

        expect(metadata).toBeDefined();
    });

    it('Set ACL Metadata', async () => {
        let error;
        try {
            const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
            //we set the metadata for the file created in the previous test

            await s3Storage.user(agentCandidate).setACL(testFile, testAdditionalACLMetadata);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does ACL metadata exist ?', async () => {
        const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
        //here we need to build an access request for the agent1 because we changed the ACL metadata to have agent1 as owner
        const agent = AccessCandidate.agent('agent1');
        let metadata: any = await s3Storage.user(agent).getACL(testFile);

        expect(metadata.entries?.team).toEqual(testAdditionalACLMetadata.entries.team);
    });

    it('Read files from S3Storage', async () => {
        const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
        const agent = AccessCandidate.agent('agent1');

        const data = await s3Storage.user(agent).read(testFile);
        const strData = data.toString();
        expect(strData).toEqual('Hello World!');

        const dataWithMeta = await s3Storage.user(agentCandidate).read(testFileWithMeta);
        const strDataWithMeta = dataWithMeta.toString();
        expect(strDataWithMeta).toEqual('I have metadata');
    });

    it('Delete files from S3Storage', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
            const agent = AccessCandidate.agent('agent1');
            await Promise.all([s3Storage.user(agent).delete(testFile), s3Storage.user(agentCandidate).delete(testFileWithMeta)]);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('The file should be deleted', async () => {
        const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
        const files = [testFile, testFileWithMeta];

        const promises = files.map((file) => {
            return s3Storage.user(agentCandidate).exists(file);
        });

        const results = await Promise.all(promises);

        expect(results).toEqual([false, false]);
    });
});
