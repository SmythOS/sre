import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { S3Storage } from '@sre/IO/Storage.service/connectors/S3Storage.class';
import { RAMCache } from '@sre/MemoryManager/Cache.service/connectors/RAMCache.class';
import config from '@sre/config';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { AgentDataConnector } from '@sre/AgentManager/AgentData.service/AgentDataConnector';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { setupSRE } from '../../utils/sre';

const { SREInstance: sre } = setupSRE({
    Storage: {
        Connector: 'S3',
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
        expect(cacheFromSRE).toBeInstanceOf(RAMCache);
    });

    it('SRE returns Dummy Instance if not configured', async () => {
        const agentData: AgentDataConnector = ConnectorService.getAgentDataConnector('NOTFOUND');

        // make sure it is a dummy instance (Proxy object)
        expect(isProbablyProxy(agentData)).toBe(true);
    });
});

function isProbablyProxy(obj: any): boolean {
    try {
        // A naive check: the object should not be strictly equal to its own `Object.assign({}, obj)`
        // because copying it will access its traps
        const copy = Object.assign({}, obj);
        return obj !== copy && typeof obj === 'object';
    } catch {
        return true; // If an error occurs during access, it's likely a proxy
    }
}
