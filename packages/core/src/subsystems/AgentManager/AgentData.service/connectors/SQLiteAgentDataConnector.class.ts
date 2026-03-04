import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { AgentDataConnector } from '../AgentDataConnector';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('SQLiteAgentDataConnector');

export type SQLiteAgentDataSettings = {
    databasePath: string;
    tableName?: string;
};

type SQLiteRunResult = { changes?: number; lastInsertRowid?: number | bigint };

export interface SQLiteStatementAdapter<T = any> {
    all(...params: any[]): T[];
    get(...params: any[]): T | undefined;
    run(...params: any[]): SQLiteRunResult;
}

export interface SQLiteDatabaseAdapter {
    prepare<T = any>(sql: string): SQLiteStatementAdapter<T>;
    exec(sql: string): void;
    close(): void;
}

export type SQLiteAdapterFactory = (databasePath: string) => SQLiteDatabaseAdapter;

class NativeSQLiteAdapter implements SQLiteDatabaseAdapter {
    private db: DatabaseSync;

    constructor(databasePath: string) {
        this.db = new DatabaseSync(databasePath);
    }

    public prepare<T = any>(sql: string) {
        return this.db.prepare(sql) as unknown as SQLiteStatementAdapter<T>;
    }

    public exec(sql: string) {
        this.db.exec(sql);
    }

    public close() {
        this.db.close();
    }
}

type AgentRow = {
    id: number;
    data: any;
    aiAgentId: string;
};

export class SQLiteAgentDataConnector extends AgentDataConnector {
    public name = 'SQLiteAgentDataConnector';
    private adapter!: SQLiteDatabaseAdapter;
    private readonly tableName: string;

    constructor(protected _settings: SQLiteAgentDataSettings) {
        super(_settings);
        this.tableName = this.validateTableName(_settings?.tableName || 'AiAgentData');
    }

    public getAgentConfig(agentId: string): Partial<SQLiteAgentDataSettings> {
        return {
            databasePath: this._settings?.databasePath,
            tableName: this.tableName,
        };
    }

    public async start() {
        super.start();
        this.started = false;

        if (!this._settings?.databasePath) {
            throw new Error('SQLiteAgentDataConnector requires a databasePath setting');
        }

        this.ensureDatabaseDirectory(this._settings.databasePath);
        this.adapter = new NativeSQLiteAdapter(this._settings.databasePath);
        this.ensureSchema();

        this.started = true;
    }

    public async stop() {
        try {
            this.adapter?.close();
        } catch (error: any) {
            console.warn('Error closing SQLite adapter', error?.message || error);
        }
        await super.stop();
    }

    public async getAgentData(agentId: string, version?: string) {
        const ready = await this.ready();
        if (!ready) {
            throw new Error('Connector not ready');
        }
        const row = this.prepareStatement<AgentRow>(`SELECT id, data, aiAgentId FROM "${this.tableName}" WHERE aiAgentId = ? LIMIT 1`).get(agentId);

        if (!row) {
            throw new Error(`Agent with id ${agentId} not found`);
        }

        const parsed = this.parseData(row.data);
        return {
            data: parsed,
            version: version || parsed?.version || '1.0',
        };
    }

    public async getAgentIdByDomain(domain: string): Promise<string> {
        return Promise.resolve('');
    }

    public async getAgentSettings(agentId: string, version?: string) {
        const ready = await this.ready();
        if (!ready) {
            throw new Error('Connector not ready');
        }
        const agent = await this.getAgentData(agentId, version);
        return agent?.data?.settings || {};
    }

    public async getAgentEmbodiments(agentId: string): Promise<any> {
        const ready = await this.ready();
        if (!ready) {
            throw new Error('Connector not ready');
        }
        return [];
    }

    public async listTeamAgents(teamId: string, deployedOnly?: boolean, includeData?: boolean): Promise<any[]> {
        const ready = await this.ready();
        if (!ready) {
            throw new Error('Connector not ready');
        }
        console.warn(`listTeamAgents is not implemented for SQLiteAgentDataConnector`);
        return [];
    }

    public async isDeployed(agentId: string): Promise<boolean> {
        const ready = await this.ready();
        if (!ready) {
            throw new Error('Connector not ready');
        }
        const record = await this.getAgentData(agentId).catch(() => null);
        return !!record;
    }

    private ensureDatabaseDirectory(databasePath: string) {
        if (databasePath === ':memory:') return;
        const dbDir = path.dirname(path.resolve(databasePath));
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    private ensureSchema() {
        const ddl = `
            CREATE TABLE IF NOT EXISTS "${this.tableName}" (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT CHECK (json_valid(data)),
                aiAgentId TEXT NOT NULL UNIQUE
            );
        `;
        this.adapter.exec(ddl);
    }

    private validateTableName(tableName: string) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
            throw new Error(`Invalid SQLite table name: ${tableName}`);
        }
        return tableName;
    }

    private prepareStatement<T = any>(sql: string) {
        return this.adapter.prepare<T>(sql);
    }

    private parseData(data: any) {
        if (Buffer.isBuffer(data)) data = data.toString('utf-8');
        if (typeof data === 'string') return JSONContentHelper.create(data).tryParse();
        return data;
    }
}
