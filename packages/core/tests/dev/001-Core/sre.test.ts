import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { S3Storage } from '@sre/IO/Storage.service/connectors/S3Storage.class';
import { RedisCache } from '@sre/MemoryManager/Cache.service/connectors/RedisCache.class';
import config from '@sre/config';
import { AgentRequest, ConnectorService, SmythRuntime } from '@sre/index';
import { AgentDataConnector } from '@sre/AgentManager/AgentData.service/AgentDataConnector';

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
    it('Runs a simple Agent', async () => {
        let error;
        try {
            const sre = SmythRuntime.Instance;
            const agentData = fs.readFileSync('./tests/data/sre-openai-LLMPrompt.smyth', 'utf-8');
            const data = JSON.parse(agentData);

            const request = new AgentRequest({
                method: 'POST',
                path: '/api/say',
                body: { message: 'Write a poem about flowers, the poem should mention the word "flower" at least once' },
            });
            const output = await sre.runAgent('test', { data, agentVersion: '1.0' }, request);

            //const output = await AgentProcess.load(data).run({ method: 'POST', path: '/api/say', body: { message: 'Write a poem about flowers' } });
            expect(JSON.stringify(output)?.toLowerCase()).toContain('flowers');
        } catch (e) {
            error = e;
        }
        expect(error).toBeUndefined();
    });
});
