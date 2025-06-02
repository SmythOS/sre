import { describe, expect, it } from 'vitest';

import { S3Storage } from '@sre/IO/Storage.service/connectors/S3Storage.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
//import SRE, { AgentRequest } from '../../dist';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';

import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

import config from '@sre/config';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'DummyAccount',
    },
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

const testFile = 'unit-tests/acl-test.txt';

describe('S3 Storage Advanced Access Rights', () => {
    it('Create S3Storage', async () => {
        const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
        expect(s3Storage).toBeInstanceOf(S3Storage);
    });

    it('Write files in S3Storage', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = ConnectorService.getStorageConnector();

            const agent = AccessCandidate.agent('agent-123456');

            const acl = ACL.addAccess(TAccessRole.Team, 'myTeam', TAccessLevel.Read);

            await s3Storage.user(agent).write(testFile, 'Hello World!', acl);
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });
    it('Overwrite file With invalid access token', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
            const strangerAgent = AccessCandidate.agent('agent-stranger');

            await s3Storage.user(strangerAgent).write(testFile, 'Hello World!');
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error?.message).toEqual('Access Denied');
    });
    it('Read files from using wrong access => should fail', async () => {
        //this fails because the agent does not have access to the resource, and is not from the same team as the owner (default team name is "default")
        let error;

        try {
            const s3Storage: StorageConnector = ConnectorService.getStorageConnector();

            const agentNoAccess = AccessCandidate.agent('agent-no-access');

            const result = await s3Storage.user(agentNoAccess).read(testFile);

            expect(result.toString()).toBe('Hello World!');
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeDefined();
    });

    it('Read files', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
            const agent = AccessCandidate.agent('agent-123456');

            const result = await s3Storage.user(agent).read(testFile);

            expect(result.toString()).toBe('Hello World!');

            const team = AccessCandidate.team('myTeam');

            //const teamAccessToken = await s3Storage.getAccess(acTeamRequest);
            const teamResult = await s3Storage.user(team).read(testFile);

            expect(teamResult.toString()).toBe('Hello World!');
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Delete files in S3Storage', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = ConnectorService.getStorageConnector();
            const agent = AccessCandidate.agent('agent-123456');
            await s3Storage.user(agent).delete(testFile);
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });
});
