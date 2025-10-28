import { ConnectorService } from '@sre/Core/ConnectorsService';
import { CLIConnector } from '@sre/IO/CLI.service/CLIConnector';
import fs from 'fs';
import path from 'path';
import { AgentDataConnector } from '../AgentDataConnector';

type TArgs = { args: Record<string, any> };
export class NullAgentData extends AgentDataConnector {
    public name: string = 'NullAgentData';
    constructor(settings: TArgs) {
        super();
    }

    public getAgentConfig(agentId: string): Partial<TArgs> {
        return null; //{};
    }

    public async getAgentData(agentId: string, version?: string) {
        return null; // { data: {}, version: '1.0' };
    }

    public getAgentIdByDomain(domain: string): Promise<string> {
        return Promise.resolve('');
    }
    public async getAgentSettings(agentId: string, version?: string) {
        return {};
    }

    public async getAgentEmbodiments(agentId: string): Promise<any> {
        return [];
    }

    public async listTeamAgents(teamId: string, deployedOnly?: boolean): Promise<any[]> {
        return [];
    }
    public async isDeployed(agentId: string): Promise<boolean> {
        return true;
    }
}
