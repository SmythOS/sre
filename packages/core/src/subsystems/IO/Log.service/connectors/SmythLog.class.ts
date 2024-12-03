import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, TAccessLevel } from '@sre/types/ACL.types';
import { OAuthConfig, SmythConfigs } from '@sre/types/Security.types';
import { getM2MToken } from '@sre/utils/oauth.utils';
import axios, { AxiosInstance } from 'axios';
import { LogConnector } from '../LogConnector';
import { AgentCallLog } from '@sre/types/AgentLogger.types';

const console = Logger('SmythLog');

export class SmythLog extends LogConnector {
    public name = 'SmythLog';
    public id = 'smyth-log';
    private oAuthAppId: string;
    private oAuthAppSecret: string;
    private oAuthBaseUrl: string;
    private oAuthResource?: string;
    private oAuthScope?: string;
    private smythAPI: AxiosInstance;

    constructor(private config: SmythConfigs & OAuthConfig) {
        super();
        if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.oAuthAppId = config.oAuthAppID;
        this.oAuthAppSecret = config.oAuthAppSecret;
        this.oAuthBaseUrl = config.oAuthBaseUrl;
        this.oAuthResource = config.oAuthResource || '';
        this.oAuthScope = config.oAuthScope || '';

        this.smythAPI = axios.create({
            baseURL: `${config.smythAPIBaseUrl}`,
        });
    }

    protected async log(acRequest: AccessRequest, logData: AgentCallLog, callId?: string): Promise<any> {
        const agentId = acRequest.candidate.id;
        let logResult: any;
        if (callId) {
            logResult = await this.smythAPI.put(`/v1/ai-agent/logs/calls/${callId}`, logData, { headers: await this.getSmythRequestHeaders() });
        } else {
            logResult = await this.smythAPI.post(`/v1/ai-agent/${agentId}/logs/calls`, logData, {
                headers: await this.getSmythRequestHeaders(),
            });
        }

        return logResult;
    }

    protected async logTask(acRequest: AccessRequest, tasks: number, isUsingTestDomain: boolean): Promise<void> {
        if (isUsingTestDomain) return;
        const agentId = acRequest.candidate.id;

        try {
            const day = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
            await this.smythAPI.put(`/v1/quota/agent/${agentId}/tasks`, { number: tasks, day }, { headers: await this.getSmythRequestHeaders() });
        } catch (error) {
            console.error('Error logging task:', error?.response?.data?.message || error);
        }
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        // const teamId = await this.accountConnector.getCandidateTeam(AccessCandidate.clone(candidate));
        return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
    }

    private async getSmythRequestHeaders() {
        return {
            Authorization: `Bearer ${await getM2MToken({
                baseUrl: this.oAuthBaseUrl,
                oauthAppId: this.oAuthAppId,
                oauthAppSecret: this.oAuthAppSecret,
                resource: this.oAuthResource,
                scope: this.oAuthScope,
            })}`,
        };
    }
}
