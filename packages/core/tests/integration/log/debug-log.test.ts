import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { setupSRE } from '../../utils/sre';
import { Logger } from '@sre/helpers/Log.helper';

const agentId = 'test-agent';
const logDir = path.join(os.homedir(), '.smyth', 'logs', agentId);
const logger = Logger('debug-log.test');

beforeAll(() => {
    if (fs.existsSync(logDir)) fs.rmSync(logDir, { recursive: true, force: true });
    setupSRE({
        Log: { Connector: 'DebugLog' },
    });
    logger.info('starting DebugLog tests');
});

describe('DebugLog Connector', () => {
    it('creates log file when logging', async () => {
        const logConnector = ConnectorService.getLogConnector();
        await logConnector
            .requester(AccessCandidate.agent(agentId))
            .log({ sourceId: 's', componentId: 'c' });

        const file = path.join(logDir, 'debug.jsonl');
        expect(fs.existsSync(file)).toBe(true);
        const content = fs.readFileSync(file, 'utf8').trim();
        expect(content.length).toBeGreaterThan(0);
    });
});
