import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AgentCallLog } from '@sre/types/AgentLogger.types';

export interface ILogRequest {
    log(logData: AgentCallLog, callId?: string): Promise<any>;
    logTask(tasks: number, isUsingTestDomain: boolean): Promise<void>;
}

export abstract class LogConnector extends SecureConnector {
    public abstract id: string;

    constructor() {
        super();
    }

    public requester(candidate: AccessCandidate): ILogRequest {
        if (candidate.role !== 'agent') throw new Error('Only agents can use Log connector');

        return {
            log: async (logData: AgentCallLog, callId?: string) => {
                return await this.log(candidate.writeRequest, logData, callId);
            },
            logTask: async (tasks: number, isUsingTestDomain: boolean) => {
                await this.logTask(candidate.writeRequest, tasks, isUsingTestDomain);
            },
        };
    }

    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    protected abstract log(acRequest: AccessRequest, logData: AgentCallLog, callId?: string): Promise<any>;
    protected abstract logTask(acRequest: AccessRequest, tasks: number, isUsingTestDomain: boolean): Promise<void>;
    protected abstract setupHooks(): Promise<void>;
}
