import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { S3Storage } from '@sre/IO/Storage.service/connectors/S3Storage.class';
import { RedisCache } from '@sre/MemoryManager/Cache.service/connectors/RedisCache.class';
import config from '@sre/config';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { AgentDataConnector } from '@sre/AgentManager/AgentData.service/AgentDataConnector';
import { ConnectorService } from '@sre/Core/ConnectorsService';

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
describe('SRE Basic Tests', () => {
    it('SRE Instance', async () => {
        expect(sre).toBeInstanceOf(SmythRuntime);
    });
    it('SRE exposes storage', async () => {
        const storageFromSRE = ConnectorService.getStorageConnector();
        expect(storageFromSRE).toBeInstanceOf(S3Storage);
        // expect(storageFromSRE.read).toBeTypeOf('function');
        // expect(storageFromSRE.write).toBeTypeOf('function');
        // expect(storageFromSRE.delete).toBeTypeOf('function');
        // expect(storageFromSRE.exists).toBeTypeOf('function');
    });
    it('SRE exposes cache', async () => {
        const cacheFromSRE = ConnectorService.getCacheConnector();
        expect(cacheFromSRE).toBeInstanceOf(RedisCache);
    });

    it('SRE returns Dummy Instance if not configured', async () => {
        const agentData: AgentDataConnector = ConnectorService.getAgentDataConnector();
        const result = agentData.getAgentData('test', '1.0');
        expect(result).toBeUndefined();
    });
});
