import { Connector } from '@sre/Core/Connector.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { IAccessCandidate } from '@sre/types/ACL.types';

export interface IAgentDataConnector {
    getAgentData(agentId: string, version?: string): Promise<any>;
    getAgentIdByDomain(domain: string): Promise<string>;
    getAgentSettings(agentId: string, version?: string): Promise<any>;
}

export abstract class AgentDataConnector extends Connector implements IAgentDataConnector {
    public name = 'AgentDataConnector';
    public abstract getAgentData(agentId: string, version?: string): Promise<any>;
    public abstract getAgentIdByDomain(domain: string): Promise<string>;
    public abstract getAgentSettings(agentId: string, version?: string): Promise<any>;
}
