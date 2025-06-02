import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { Connector } from '@sre/Core/Connector.class';
import config from '@sre/config';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { faker } from '@faker-js/faker';

const TestConnector = class extends Connector {
    public name = 'TestConnector';
    public config: any;
    public instanceId: string;

    constructor(config: any) {
        super();
        this.config = config;
        this.instanceId = faker.string.uuid();
    }
};

const sre = SmythRuntime.Instance.init({
    CLI: {
        Connector: 'CLI',
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
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: config.env.REDIS_SENTINEL_HOSTS,
            name: config.env.REDIS_MASTER_NAME || '',
            password: config.env.REDIS_PASSWORD || '',
        },
    },
    AgentData: {
        Connector: 'Local',
        Settings: {
            devDir: './tests/data/AgentData',
            prodDir: './tests/data/AgentData',
        },
    },
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

const TTL = 60 * 60 * 1000;

describe('Connector Tests', () => {
    // Set up fake timers
    beforeEach(() => {
        vi.useFakeTimers();
    });

    // Restore real timers
    afterEach(() => {
        vi.useRealTimers();
    });

    it('should create a new instance with updated config', () => {
        const connector = new TestConnector({ changed: 0 });

        const newConnector = connector.instance({ changed: 1 });

        expect(newConnector.config).toEqual({ changed: 1 });
        expect(newConnector.instanceId).not.toEqual(connector.instanceId);
    });

    it('should keep instance with same settings in cache for 1 hour only', async () => {
        //* Every time we use a cache instance, we increase the TTL by the original TTL (1 hour)
        const connector = new TestConnector({ changed: 0 });

        const settings = { changed: 1 };

        const instance = connector.instance(settings);
        vi.advanceTimersByTime(TTL / 2);
        const cacheInstance = connector.instance(settings);
        expect(cacheInstance.instanceId, 'instance was expired after TTL/2').toEqual(instance.instanceId);

        vi.advanceTimersByTime(TTL / 2);
        expect(cacheInstance.instanceId, 'instance was expired after TTL ** was supposed to be refreshed upon the first instance call').toEqual(
            instance.instanceId,
        );

        vi.advanceTimersByTime(TTL);

        const cacheInstanceAfterTTL = connector.instance(settings);
        expect(cacheInstanceAfterTTL.instanceId, 'instance was not expired after TTL').not.toEqual(instance.instanceId);
    });
});
