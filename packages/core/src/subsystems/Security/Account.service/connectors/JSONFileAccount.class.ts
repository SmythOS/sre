import { Connector } from '@sre/Core/Connector.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { DEFAULT_TEAM_ID, IAccessCandidate, IACL, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';
import { AccountConnector } from '../AccountConnector';
import { KeyValueObject } from '@sre/types/Common.types';
import * as fs from 'fs';
import * as path from 'path';

/*
JSONAccount format 

{
    "team1": {
        users: {
            "user1": {
                "settings": {
                    "setting1": "value1",
                    "setting2": "value2"
                }
            }
        },
        "agents": {
            "agent1": {
                "settings": {
                    "setting1": "value1",
                    "setting2": "value2"
                }
            }
        },
        "settings": {
            "setting1": "value1",
            "setting2": "value2"
        }
    }
}

*/

export type TJSONFileAccountSettings = {
    file: string;
};

export class JSONFileAccount extends AccountConnector {
    public name = 'JSONFileAccount';
    private data: any = {};
    private file: string;

    constructor(protected _settings: TJSONFileAccountSettings) {
        super(_settings);
        this.file = _settings.file;
        this.loadData();
    }

    private loadData() {
        try {
            const fileContent = fs.readFileSync(this.file, 'utf-8');
            this.data = JSON.parse(fileContent);
        } catch (error) {
            console.error('Error loading JSON account data:', error);
            this.data = {};
        }
    }

    private saveData() {
        try {
            fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving JSON account data:', error);
        }
    }

    public async isTeamMember(team: string, candidate: IAccessCandidate): Promise<boolean> {
        if (team === DEFAULT_TEAM_ID) return true; //everyone is a member of the default team

        if (!this.data[team]) return false;

        if (candidate.role === TAccessRole.Team && team === candidate.id) {
            return true;
        }

        if (candidate.role === TAccessRole.User) {
            return !!this.data[team].users?.[candidate.id];
        } else if (candidate.role === TAccessRole.Agent) {
            return !!this.data[team].agents?.[candidate.id];
        }

        return false;
    }

    public async getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.role === TAccessRole.Team) {
            return candidate.id;
        }

        // Search through all teams to find where the candidate belongs
        for (const [teamId, teamData] of Object.entries(this.data)) {
            const typedTeamData = teamData as { users?: Record<string, any>; agents?: Record<string, any> };
            if (candidate.role === TAccessRole.User && typedTeamData.users?.[candidate.id]) {
                return teamId;
            }
            if (candidate.role === TAccessRole.Agent && typedTeamData.agents?.[candidate.id]) {
                return teamId;
            }
        }

        return DEFAULT_TEAM_ID;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        throw new Error('getResourceACL Method not implemented.');
    }

    public async getAllTeamSettings(acRequest: AccessRequest, teamId: string): Promise<KeyValueObject[]> {
        if (!this.data[teamId]?.settings) return [];

        return Object.entries(this.data[teamId].settings).map(([key, value]) => ({
            key,
            value: value as string,
        }));
    }

    public async getAllUserSettings(acRequest: AccessRequest, accountId: string): Promise<KeyValueObject[]> {
        // Search through all teams to find user settings
        for (const teamData of Object.values(this.data)) {
            const typedTeamData = teamData as { users?: Record<string, { settings?: Record<string, any> }> };
            if (typedTeamData.users?.[accountId]?.settings) {
                return Object.entries(typedTeamData.users[accountId].settings).map(([key, value]) => ({
                    key,
                    value: value as string,
                }));
            }
        }
        return [];
    }

    public async getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string): Promise<string> {
        return this.data[teamId]?.settings?.[settingKey] || '';
    }

    public async getUserSetting(acRequest: AccessRequest, accountId: string, settingKey: string): Promise<string> {
        // Search through all teams to find user setting
        for (const teamData of Object.values(this.data)) {
            const typedTeamData = teamData as { users?: Record<string, { settings?: Record<string, any> }> };
            if (typedTeamData.users?.[accountId]?.settings?.[settingKey]) {
                return typedTeamData.users[accountId].settings[settingKey];
            }
        }
        return '';
    }

    public async getAgentSetting(acRequest: AccessRequest, agentId: string, settingKey: string): Promise<string> {
        // Search through all teams to find agent setting
        for (const teamData of Object.values(this.data)) {
            const typedTeamData = teamData as { agents?: Record<string, { settings?: Record<string, any> }> };
            if (typedTeamData.agents?.[agentId]?.settings?.[settingKey]) {
                return typedTeamData.agents[agentId].settings[settingKey];
            }
        }
        return '';
    }
}
