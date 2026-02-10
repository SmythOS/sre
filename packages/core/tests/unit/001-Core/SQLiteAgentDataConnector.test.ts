import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SQLiteAgentDataConnector } from '@sre/AgentManager/AgentData.service/connectors/SQLiteAgentDataConnector.class';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';

const TABLE_NAME = 'AiAgentData';

// Use tmpdir for test isolation
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sre-sqlite-test-'));
const dbPath = path.join(tmpDir, 'agents.db');

setupSRE({
    AgentData: {
        Connector: 'SQLite',
        Settings: {
            databasePath: dbPath,
            tableName: TABLE_NAME,
        },
    },
});

const seedAgentRow = (agentId: string, data: Record<string, any>) => {
    const db = new DatabaseSync(dbPath);
    db.exec(`DELETE FROM "${TABLE_NAME}";`);
    const stmt = db.prepare(`INSERT INTO "${TABLE_NAME}" (data, aiAgentId) VALUES (?, ?)`);
    stmt.run(JSON.stringify(data), agentId);
    db.close();
};

describe('SQLiteAgentDataConnector', () => {
    let connector: SQLiteAgentDataConnector;
    const agentId = 'agent-sqlite-test';
    const sampleData = {
        version: '1.0.0',
        id: agentId,
        name: 'SQLite Test Agent',
        teamId: 'team-sqlite-test',
        components: [
            {
                id: 'component-llm-1',
                name: 'GenAILLM',
                data: { model: 'Echo', prompt: 'Test prompt' },
            },
        ],
        settings: {},
        embodiments: [],
        deployment: { status: true },
    };

    beforeAll(async () => {
        connector = ConnectorService.getAgentDataConnector() as SQLiteAgentDataConnector;
        await connector.ready();
    });

    beforeEach(() => {
        seedAgentRow(agentId, sampleData);
    });

    afterAll(async () => {
        await connector.stop();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('reads agent data with parsed JSON and version', async () => {
        const result = await connector.getAgentData(agentId);
        expect(result.data).toMatchObject({ name: 'SQLite Test Agent', teamId: sampleData.teamId });
        expect(result.version).toBe('1.0.0');
    });

    it('returns settings and embodiments', async () => {
        const settings = await connector.getAgentSettings(agentId);
        const embodiments = await connector.getAgentEmbodiments(agentId);

        expect(settings).toEqual(sampleData.settings);
        expect(embodiments).toEqual([]);
    });

    it('returns empty string for domain lookup (not available locally)', async () => {
        const foundId = await connector.getAgentIdByDomain('example.com');
        expect(foundId).toBe('');
    });

    it('lists team agents returns empty (not implemented locally)', async () => {
        const agents = await connector.listTeamAgents(sampleData.teamId, true, false);
        expect(agents).toEqual([]);
    });

    it('detects deployed agents', async () => {
        const deployed = await connector.isDeployed(agentId);
        expect(deployed).toBe(true);
    });

    it('creates the table when missing', async () => {
        const localTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sre-sqlite-test-'));
        const localDbPath = path.join(localTmpDir, 'agents.db');

        const localConnector = new SQLiteAgentDataConnector({
            databasePath: localDbPath,
            tableName: TABLE_NAME,
        });

        await localConnector.start();

        // Verify table was created by checking SQLite metadata
        const localDb = new DatabaseSync(localDbPath);
        const tableCheck = localDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(TABLE_NAME);
        localDb.close();

        expect(tableCheck).toBeDefined();
        expect(tableCheck.name).toBe(TABLE_NAME);

        await localConnector.stop();
        fs.rmSync(localTmpDir, { recursive: true, force: true });
    });
});
