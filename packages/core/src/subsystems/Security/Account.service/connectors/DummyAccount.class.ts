import { Connector } from '@sre/Core/Connector.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { DEFAULT_TEAM_ID, IAccessCandidate, IACL, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';
import { AccountConnector } from '../AccountConnector';
import { KeyValueObject } from '@sre/types/Common.types';
import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('DummyAccount');

/*
data format 

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

export class DummyAccount extends AccountConnector {
    public name = 'DummyAccount';
    public data: any = {};

    constructor(private settings) {
        super();
        this.data = settings.data || {};
        if (!this.data[DEFAULT_TEAM_ID]) {
            this.data[DEFAULT_TEAM_ID] = {
                users: {},
                agents: { FAKE_AGENT_ID: {} },
                settings: {},
            };
        }
        if (!this.data[DEFAULT_TEAM_ID])
            console.warn(
                'You are using the DummyAccount connector. This is a development tool and should not be used in production if you have security concerns.',
            );
    }

    public isTeamMember(team: string, candidate: IAccessCandidate): Promise<boolean> {
        if (team === DEFAULT_TEAM_ID) {
            return Promise.resolve(true);
        }

        switch (candidate.role) {
            case TAccessRole.Team:
                return Promise.resolve(team === candidate.id);
            case TAccessRole.User:
                return Promise.resolve(this.data[team]?.users?.[candidate.id]);
            case TAccessRole.Agent:
                return Promise.resolve(this.data[team]?.agents?.[candidate.id]);
            default:
                return Promise.resolve(false);
        }
    }
    public getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.role === TAccessRole.Team) {
            return Promise.resolve(candidate.id);
        }

        //lookup the team id for the user or agent
        for (const team in this.data) {
            if (candidate.role === TAccessRole.User && this.data[team]?.users?.[candidate.id]) {
                return Promise.resolve(team);
            }
            if (candidate.role === TAccessRole.Agent && this.data[team]?.agents?.[candidate.id]) {
                return Promise.resolve(team);
            }
        }
        return Promise.resolve(DEFAULT_TEAM_ID);
    }

    public getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        throw new Error('getResourceACL Method not implemented.');
    }
    public getAllTeamSettings(acRequest: AccessRequest, teamId: string): Promise<KeyValueObject[]> {
        return Promise.resolve(this.data[teamId]?.settings);
    }
    public getAllUserSettings(acRequest: AccessRequest, accountId: string): Promise<KeyValueObject[]> {
        for (const team in this.data) {
            if (this.data[team]?.users?.[accountId]) {
                return Promise.resolve(this.data[team]?.users?.[accountId]?.settings);
            }
        }
        return Promise.resolve([]);
    }
    public getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string): Promise<string> {
        return Promise.resolve(this.data[teamId]?.settings?.[settingKey]);
    }
    public getUserSetting(acRequest: AccessRequest, accountId: string, settingKey: string): Promise<string> {
        for (const team in this.data) {
            if (this.data[team]?.users?.[accountId]) {
                return Promise.resolve(this.data[team]?.users?.[accountId]?.settings?.[settingKey]);
            }
        }
        return Promise.resolve(undefined);
    }
    public getAgentSetting(acRequest: AccessRequest, agentId: string, settingKey: string): Promise<string> {
        for (const team in this.data) {
            if (this.data[team]?.agents?.[agentId]) {
                return Promise.resolve(this.data[team]?.agents?.[agentId]?.settings?.[settingKey]);
            }
        }
        return Promise.resolve(undefined);
    }
}
