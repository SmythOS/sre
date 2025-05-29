import { afterAll, describe, expect, it, vi } from 'vitest';
import config from '@sre/config';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { PineconeVectorDB } from '@sre/IO/VectorDB.service/connectors/PineconeVectorDB.class';
import { faker } from '@faker-js/faker';
import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { IVectorDataSourceDto, SourceTypes } from '@sre/types/VectorDB.types';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TConnectorService } from '@sre/types/SRE.types';
import { RedisCache } from '@sre/MemoryManager/Cache.service/connectors/RedisCache.class';
import { TestAccountConnector } from '../../utils/TestConnectors';

class CustomAccountConnector extends TestAccountConnector {
    public getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.id === 'agent-123456') {
            return Promise.resolve('9');
        } else if (candidate.id === 'agent-654321') {
            return Promise.resolve('5');
        }
        return super.getCandidateTeam(candidate);
    }
}
ConnectorService.register(TConnectorService.Account, 'MyCustomAccountConnector', CustomAccountConnector);

const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'MyCustomAccountConnector',
        Settings: {},
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: config.env.REDIS_SENTINEL_HOSTS,
            name: config.env.REDIS_MASTER_NAME || '',
            password: config.env.REDIS_PASSWORD || '',
        },
    },

    NKV: {
        Connector: 'Redis',
        Settings: {},
    },
});

const ownerAgent = AccessCandidate.agent('agent-123456');

describe('Integration: Redis NKV', () => {
    describe('Functional', () => {
        it('write', async () => {
            const nkv = ConnectorService.getNKVConnector('Redis');
            const namespace = faker.word.noun();

            await nkv.user(ownerAgent).set(namespace, faker.word.noun(), JSON.stringify({ str: faker.lorem.sentence() }));
        });

        it('read', async () => {
            const nkv = ConnectorService.getNKVConnector('Redis');
            const namespace = faker.word.noun();

            const key = faker.word.noun();
            const value = JSON.stringify({ str: faker.lorem.sentence() });
            await nkv.user(ownerAgent).set(namespace, key, value);
            const data = await nkv.user(ownerAgent).get(namespace, key);
            expect(data).toEqual(value);
            expect(JSON.parse(data as string)).toEqual(JSON.parse(value));
        });

        it('exists', async () => {
            const nkv = ConnectorService.getNKVConnector('Redis');
            const namespace = faker.word.noun();
            const key = faker.word.noun();

            await nkv.user(ownerAgent).set(namespace, key, JSON.stringify({ str: faker.lorem.sentence() }));
            const exists = await nkv.user(ownerAgent).exists(namespace, key);
            expect(exists).toBe(true);
        });

        it('delete', async () => {
            const nkv = ConnectorService.getNKVConnector('Redis');
            const namespace = faker.word.noun();

            const key = faker.word.noun();
            await nkv.user(ownerAgent).set(namespace, key, JSON.stringify({ str: faker.lorem.sentence() }));

            await nkv.user(ownerAgent).delete(namespace, key);
            const exists = await nkv.user(ownerAgent).exists(namespace, key);
            expect(exists).toBe(false);
        });

        it('list', async () => {
            const records = [
                { key: faker.word.noun(), value: JSON.stringify({ str: faker.lorem.sentence().repeat(1000) }) },
                { key: faker.word.noun(), value: JSON.stringify({ str: faker.lorem.sentence().repeat(1000) }) },
                { key: faker.word.noun(), value: JSON.stringify({ str: faker.lorem.sentence().repeat(1000) }) },
            ];

            const nkv = ConnectorService.getNKVConnector('Redis');
            const namespace = faker.word.noun();

            const promises = records.map((record) => nkv.user(ownerAgent).set(namespace, record.key, record.value));
            await Promise.all(promises);

            const list = await nkv.user(ownerAgent).list(namespace);
            expect(list.length).toBe(records.length);
            expect(list).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ key: records[0].key, data: records[0].value }),
                    expect.objectContaining({ key: records[1].key, data: records[1].value }),
                    expect.objectContaining({ key: records[2].key, data: records[2].value }),
                ]),
            );
        });

        it('deleteAll keys in a namespace', async () => {
            const records = [
                { key: faker.word.noun(), value: JSON.stringify({ str: faker.lorem.sentence().repeat(1000) }) },
                { key: faker.word.noun(), value: JSON.stringify({ str: faker.lorem.sentence().repeat(1000) }) },
                { key: faker.word.noun(), value: JSON.stringify({ str: faker.lorem.sentence().repeat(1000) }) },
            ];
            const nkv = ConnectorService.getNKVConnector('Redis');
            const namespace = faker.word.noun();

            const promises = records.map((record) => nkv.user(ownerAgent).set(namespace, record.key, record.value));
            await Promise.all(promises);

            await nkv.user(ownerAgent).deleteAll(namespace);
            const list = await nkv.user(ownerAgent).list(namespace);
            expect(list.length).toBe(0);
        });
    });

    describe('Security', () => {
        // only test list() and deleteAll() as the other methods are already tested in the lower level connector RedisCache
        const ownerAgent = AccessCandidate.agent('agent-123456');
        // const ownerTeam = AccessCandidate.team('9');
        const strangerAgent = AccessCandidate.agent('agent-654321');

        it('should isolate namespaces for different teams', async () => {
            const nkv = ConnectorService.getNKVConnector('Redis');
            const namespace = faker.word.noun();

            const record = { key: faker.word.noun(), value: JSON.stringify({ str: faker.lorem.sentence().repeat(1000) }) };

            await nkv.user(ownerAgent).set(namespace, record.key, record.value);

            const list = await nkv.user(ownerAgent).list(namespace);
            expect(list.length).toBe(1);
            expect(list).toEqual(expect.arrayContaining([expect.objectContaining({ key: record.key, data: record.value })]));

            const list2 = await nkv.user(strangerAgent).list(namespace);
            expect(list2.length).toBe(0);
        });
    });
});
