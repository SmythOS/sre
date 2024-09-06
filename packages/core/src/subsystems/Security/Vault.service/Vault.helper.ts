import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '../AccessControl/AccessCandidate.class';
import axios from 'axios';
import config from '@sre/config';
import qs from 'qs';

export class VaultHelper {
    static async getTeamKey(key: string, teamId: string): Promise<string> {
        const vaultConnector = ConnectorService.getVaultConnector();
        return await vaultConnector.user(AccessCandidate.team(teamId)).get(key);
    }

    static async getUserKey(key: string, userId: string): Promise<string> {
        const vaultConnector = ConnectorService.getVaultConnector();
        const accountConnector = ConnectorService.getAccountConnector();

        const teamId = await accountConnector.getCandidateTeam(AccessCandidate.user(userId));

        return await vaultConnector.user(AccessCandidate.team(teamId)).get(key);
    }

    static async getAgentKey(key: string, agentId: string): Promise<string> {
        const vaultConnector = ConnectorService.getVaultConnector();
        const accountConnector = ConnectorService.getAccountConnector();

        const teamId = await accountConnector.getCandidateTeam(AccessCandidate.agent(agentId));

        return await vaultConnector.user(AccessCandidate.team(teamId)).get(key);
    }

    static async getM2MToken(clientId: string, clientSecret: string, resource?: string, scope?: string): Promise<string> {
        return new Promise((resolve, reject) => {

            const base64Credentials = Buffer.from(
                `${clientId}:${clientSecret}`,
                'utf8',
            ).toString('base64');

            const body = {
                grant_type: 'client_credentials',
                resource: resource,
                scope: scope || '',
            };
            axios({
                method: 'post',
                url: `${config.env.LOGTO_SERVER}/oidc/token`,
                headers: {
                    Authorization: 'Basic ' + base64Credentials,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data: qs.stringify(body),
            })
                .then((response) => {
                    resolve(response.data.access_token);
                })
                .catch((error) => {
                    reject({ error: error.response.data });
                });
        });
    }


    static vaultAPI = axios.create({
        baseURL: `${config.env.SMYTH_VAULT_API_BASE_URL}/v1/api`,
    });

}
