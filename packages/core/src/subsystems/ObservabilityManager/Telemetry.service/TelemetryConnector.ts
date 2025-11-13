import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AgentCallLog } from '@sre/types/AgentLogger.types';

export interface ITelemetryRequest {}

export abstract class TelemetryConnector extends SecureConnector {
    public abstract id: string;

    constructor() {
        super();
    }

    public requester(candidate: AccessCandidate): ITelemetryRequest {
        return {};
    }

    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    protected abstract setupHooks(): Promise<void>;
}
