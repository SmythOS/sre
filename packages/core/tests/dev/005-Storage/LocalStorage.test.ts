import xxhash from 'xxhashjs';
import { describe, expect, it } from 'vitest';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ConnectorService, SmythRuntime } from '@sre/index';
import { LocalStorage } from '@sre/IO/Storage.service/connectors/LocalStorage.class';

function xxh3(source) {
    const h64 = xxhash.h64(); // Use xxhashjs's h64 function
    return h64.update(source.toString()).digest().toString(16);
}

const SREInstance = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'Local',
        Settings: {
            folder: '/Users/zubair/Zubair/SmythOS/test-folder',
        },
    },
});

const testFile = 'test.txt';
const testAdditionalACLMetadata = {
    hashAlgorithm: 'xxh3',
    entries: {
        [TAccessRole.Team]: {
            //hash 'team1'
            [xxh3('team1')]: [TAccessLevel.Read, TAccessLevel.Write],
        },
        [TAccessRole.Agent]: {
            //hash 'team1'
            [xxh3('agent1')]: [TAccessLevel.Owner],
        },
    },
};

const testFileWithMeta = 'test-meta.txt';
const testOriginalACLMetadata = {
    hashAlgorithm: 'xxh3',
    entries: {
        [TAccessRole.Team]: {
            teamMeta: [TAccessLevel.Read, TAccessLevel.Write],
        },
    },
};

const agentCandidate = AccessCandidate.agent('agent1');

const testOriginalMetadata = {
    'Content-Type': 'text/plain',
    'x-amz-meta-test': 'test',
};

describe('Local Storage Tests', () => {
    it('Create LocalStorage', async () => {
        const localStorage: StorageConnector = ConnectorService.getStorageConnector();
        const newClient = localStorage.instance({
            folder: '/Users/zubair/Zubair/SmythOS/test-folder',
        });
        newClient.name = 'test';

        expect(localStorage).toBeInstanceOf(LocalStorage);
    });

    it('Write a file in LocalStorage', async () => {
        let error;

        try {
            const localStorage: StorageConnector = ConnectorService.getStorageConnector();
            await localStorage.user(agentCandidate).write(testFile, 'Hello World!');
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Write a file with metadata in LocalStorage', async () => {
        let error;

        try {
            const localStorage: StorageConnector = ConnectorService.getStorageConnector();
            await localStorage.user(agentCandidate).write(testFileWithMeta, 'I have metadata', testOriginalACLMetadata, testOriginalMetadata);

            const storageReq = await localStorage.user(agentCandidate);
            storageReq.write(testFileWithMeta, 'I have metadata');
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does the files exist?', async () => {
        const localStorage: StorageConnector = ConnectorService.getStorageConnector();
        const files = [testFile, testFileWithMeta];

        const promises = files.map((file) => {
            return localStorage.user(agentCandidate).exists(file);
        });

        const results = await Promise.all(promises);

        expect(results).toEqual([true, true]);
    });

    it('Is Metadata present', async () => {
        const localStorage: StorageConnector = ConnectorService.getStorageConnector();
        const metadata = await localStorage.user(agentCandidate).getMetadata(testFileWithMeta);

        expect(metadata).toBeDefined();
    });

    it('Set ACL Metadata', async () => {
        let error;
        try {
            const localStorage: StorageConnector = ConnectorService.getStorageConnector();
            //we set the metadata for the file created in the previous test

            await localStorage.user(agentCandidate).setACL(testFile, testAdditionalACLMetadata);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does ACL metadata exist?', async () => {
        const localStorage: StorageConnector = ConnectorService.getStorageConnector();
        //here we need to build an access request for the agent1 because we changed the ACL metadata to have agent1 as owner
        let metadata: any = await localStorage.user(agentCandidate).getACL(testFile);

        expect(metadata.entries?.team).toEqual(testAdditionalACLMetadata.entries.team);
    });

    it('Read files from LocalStorage', async () => {
        const localStorage: StorageConnector = ConnectorService.getStorageConnector();

        const data = await localStorage.user(agentCandidate).read(testFile);
        const strData = data.toString();
        expect(strData).toEqual('Hello World!');

        const dataWithMeta = await localStorage.user(agentCandidate).read(testFileWithMeta);
        const strDataWithMeta = dataWithMeta.toString();
        expect(strDataWithMeta).toEqual('I have metadata');
    });

    it('Delete files from LocalStorage', async () => {
        let error;

        try {
            const localStorage: StorageConnector = ConnectorService.getStorageConnector();
            await Promise.all([localStorage.user(agentCandidate).delete(testFile), localStorage.user(agentCandidate).delete(testFileWithMeta)]);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('The file should be deleted', async () => {
        const localStorage: StorageConnector = ConnectorService.getStorageConnector();
        const files = [testFile, testFileWithMeta];

        const promises = files.map((file) => {
            return localStorage.user(agentCandidate).exists(file);
        });

        const results = await Promise.all(promises);

        expect(results).toEqual([false, false]);
    });
});
