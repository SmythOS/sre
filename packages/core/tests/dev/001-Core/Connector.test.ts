import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { Connector } from '@sre/Core/Connector.class';
import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import fs from 'fs';
import { describe, expect, it } from 'vitest';

class TestConnector extends Connector {
    public name = 'TestConnector';
    public config: any;

    constructor(config: any) {
        super();
        this.config = config;
    }
}

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

describe('Connector Tests', () => {
    it('should create a new instance with updated config', () => {
        const connector = new TestConnector({ changed: 0 });

        const newConnector = connector.instance({ changed: 1 });

        expect(newConnector.config).toEqual({ changed: 1 });
    });
});
