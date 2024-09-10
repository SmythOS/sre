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

}
