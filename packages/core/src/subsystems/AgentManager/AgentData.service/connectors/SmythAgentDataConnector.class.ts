import { AgentDataConnector } from '../AgentDataConnector';
import { OAuthConfig, SmythConfigs } from '@sre/types/Security.types';
import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { AxiosInstance } from 'axios';
import axios from 'axios';
import { getM2MToken } from '@sre/utils/oauth.utils';

export class SmythAgentDataConnector extends AgentDataConnector {
    public name: string = 'SmythAgentData';
    private oAuthAppId: string;
    private oAuthAppSecret: string;
    private oAuthBaseUrl: string;
    private oAuthResource?: string;
    private oAuthScope?: string;
    private smythAPI: AxiosInstance;
    private agentStageDomain: string;
    private agentProdDomain: string;

    constructor(private config: SmythConfigs & OAuthConfig & { agentStageDomain: string; agentProdDomain: string }) {
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
        this.agentStageDomain = config.agentStageDomain;
        this.agentProdDomain = config.agentProdDomain;
    }

    public async getAgentData(agentId: string, version?: string): Promise<any> {
        try {
            let agentObj;

            //FIXME : once we have the agent name in deployment api response, we can skip this call
            // const response = await mwSysAPI.get(`/ai-agent/${agentID}?include=team.subscription`, includeAuth(token));
            const response = await this.smythAPI.get(`/v1/ai-agent/${agentId}?include=team.subscription`, {
                headers: await this.getSmythRequestHeaders(),
            });
            agentObj = response.data.agent;
            const authData = agentObj.data.auth; //use most up to date auth data

            // const tasksResponse = await mwSysAPI.get(`/quota/team/${agentObj.teamId}/tasks/subscription`, includeAuth(token));
            const tasksResponse = await this.smythAPI.get(`/v1/quota/team/${agentObj.teamId}/tasks/subscription`, {
                headers: await this.getSmythRequestHeaders(),
            });
            agentObj.taskData = tasksResponse.data;

            agentObj.data.debugSessionEnabled = agentObj?.data?.debugSessionEnabled && agentObj?.isLocked; //disable debug session if agent is not locked (locked agent means that it's open in the Agent builder)

            if (version) {
                // const deploymentsList = await mwSysAPI.get(`/ai-agent/${agentID}/deployments`, includeAuth(token));
                const deploymentsList = await this.smythAPI.get(`/v1/ai-agent/${agentId}/deployments`, {
                    headers: await this.getSmythRequestHeaders(),
                });
                const deployment =
                    version == 'latest'
                        ? deploymentsList?.data?.deployments[0]
                        : deploymentsList?.data?.deployments?.find((deployment) => deployment.version === version);
                if (deployment) {
                    // const deployResponse = await mwSysAPI.get(`/ai-agent/deployments/${deployment.id}`, includeAuth(token));
                    const deployResponse = await this.smythAPI.get(`/v1/ai-agent/deployments/${deployment.id}`, {
                        headers: await this.getSmythRequestHeaders(),
                    });
                    agentObj.data = deployResponse?.data?.deployment?.aiAgentData;
                    agentObj.data.debugSessionEnabled = false; //never enable debug session when using a deployed version
                    agentObj.data.agentVersion = deployment.version;
                    agentObj.version = deployment.version;
                } else {
                    //if (version !== 'latest') {
                    throw new Error(`Requested Deploy Version not found: ${version}`);
                    //} // if version == 'latest' but no deployment is found we just fallback to the agent live data
                }
            }

            //TODO: Also include team and subscription info

            //agentObj.data.auth = authData;
            if (!agentObj?.data?.auth?.method || agentObj?.data?.auth?.method == 'none') agentObj.data.auth = authData;

            agentObj.data = this.migrateAgentData(agentObj.data);

            return agentObj;
        } catch (error: any) {
            console.error(error.response?.data, error.message);
            console.log(`Error getting agent data for agentId=${agentId}: ${error?.message}`);
            throw new Error(`Error getting agent data for agentId=${agentId}: ${error?.message}`);
        }
    }

    public async getAgentIdByDomain(domain: string): Promise<string> {
        let agentId;
        //first check if this is the internal wildcard agents domain
        const isStageWildcardDomain = domain.includes(this.agentStageDomain);
        const isProdWildcardDomain = domain.includes(this.agentProdDomain);
        if (isStageWildcardDomain || isProdWildcardDomain) {
            //console.log('Internal agent domain detected', domain);
            agentId = domain.split('.')[0];
            //sanity check
            if (`${agentId}.${this.agentStageDomain}` !== domain && `${agentId}.${this.agentProdDomain}` !== domain) {
                throw new Error(`Invalid agent domain: ${domain}`);
            }

            //if this is a stage domain, no more check, return the agentId
            if (isStageWildcardDomain) return agentId;
        }

        // const result: any = await mwSysAPI.get('/domains?verified=true', { headers: { Authorization } }).catch((error) => ({ error }));
        const result: any = await this.smythAPI
            .get(`/v1/domains?verified=true`, { headers: await this.getSmythRequestHeaders() })
            .catch((error) => ({ error }));

        if (result.error) {
            throw new Error('Error getting domain info');
        }

        //we have an agentId from the wildcard domain, if this domain is already associated with
        if (agentId) {
            const hasDomain = result.data.domains.find((domainEntry: any) => domainEntry?.aiAgent?.id === agentId);
            if (hasDomain) {
                throw new Error('Wrong domain');
            }
        } else {
            agentId = result.data.domains.find((domainEntry: any) => domainEntry.name === domain)?.aiAgent?.id;
        }

        //if a custom domain is found, use it, otherwise use the agentId from the wildcard domain

        return agentId;
    }

    public async getAgentSettings(agentId: string, version?: string): Promise<any> {
        try {
            // If no matching deployment found or no deployments at all, return the current live settings
            const response = await this.smythAPI.get(`/v1/ai-agent/${agentId}/settings`, {
                headers: await this.getSmythRequestHeaders(),
            });
            const formattedSettings = response.data.settings.reduce((acc, setting) => ({ ...acc, [setting.key]: setting.value }), {});

            return formattedSettings;
        } catch (error) {
            console.error(`Error getting agent settings for agentId=${agentId}: ${error?.message}`);
            throw new Error(`Error getting agent settings for agentId=${agentId}: ${error?.message}`);
        }
    }

    public async getAgentEmbodiments(agentId: string, version?: string): Promise<any> {
        try {
            // If no matching deployment found or no deployments at all, return the current live settings
            const response = await this.smythAPI.get(`/v1/embodiments?aiAgentId=${agentId}`, {
                headers: await this.getSmythRequestHeaders(),
            });

            return response?.data?.embodiments || [];
        } catch (error) {
            console.error(`Error getting agent embodiments for agentId=${agentId}: ${error?.message}`);
            throw new Error(`Error getting agent embodiments for agentId=${agentId}: ${error?.message}`);
        }
    }

    public async listTeamAgents(teamId: string, deployedOnly?: boolean, includeData?: boolean): Promise<any[]> {
        try {
            const headers = await this.getSmythRequestHeaders();
            // If no matching deployment found or no deployments at all, return the current live settings
            const response = await this.smythAPI.get(
                `/v1/ai-agent/teams/${teamId}/?deployedOnly=${deployedOnly ? 'true' : 'false'}&includeData=${includeData ? 'true' : 'false'}`,
                {
                    headers,
                }
            );
            const agentsList = response?.data?.agents;

            return agentsList;
        } catch (error) {
            console.error(`Error listing team agents for teamId=${teamId}: ${error?.message}`);
            throw new Error(`Error listing team agents for teamId=${teamId}: ${error?.message}`);
        }
    }

    public async isDeployed(agentId: string): Promise<boolean> {
        try {
            const deploymentsList = await this.smythAPI.get(`/v1/ai-agent/${agentId}/deployments`, {
                headers: await this.getSmythRequestHeaders(),
            });
            return deploymentsList?.data?.deployments?.length > 0;
        } catch (error) {
            console.error(error);
            return false;
        }
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

    private migrateAgentData(data) {
        if (!data.version) {
            console.log(`Agent [${data.name}] has an old schema. Migrating to latest version...`);
            // version 0  ===> migrate from receptors/connectors to inputs/outputs
            const newData = JSON.parse(JSON.stringify(data));
            for (let component of newData.components) {
                component.outputs = component.connectors;
                component.inputs = component.receptors;
                component.outputProps = component.connectorProps;
                component.inputProps = component.receptorProps;
                delete component.connectors;
                delete component.receptors;
                delete component.connectorProps;
                delete component.receptorProps;
            }
            return newData;
        }

        if (data.version === '1.0.0') {
            //migrate .description to .behavior
            if (data.description && !data.behavior) {
                data.behavior = data.description;
                //delete newConfig.description;
            }
        }

        return data;
    }
}
