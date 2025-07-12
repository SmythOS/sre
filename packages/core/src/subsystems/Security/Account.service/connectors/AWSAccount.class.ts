import { Pool } from 'pg';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { DEFAULT_TEAM_ID, IAccessCandidate, IACL, TAccessRole } from '@sre/types/ACL.types';
import { AccountConnector } from '../AccountConnector';
import { KeyValueObject } from '@sre/types/Common.types';

export class AWSAccount extends AccountConnector {
    public name = 'AWSAccount';

    private pool: Pool;

    constructor(protected _settings: any) {
        super(_settings);

        this.pool = new Pool({
            host: _settings.host,
            database: _settings.database || 'app',
            user: _settings.user || 'app',
            password: _settings.password,
        });
    }

    public isTeamMember(team: string, candidate: IAccessCandidate): Promise<boolean> {
        return Promise.resolve(true);
    }

    public getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.role === TAccessRole.Team) {
            return Promise.resolve(candidate.id);
        }

        return Promise.resolve(DEFAULT_TEAM_ID);
    }

    public async getAllTeamSettings(acRequest: AccessRequest, teamId: string): Promise<KeyValueObject[]> {
        try {
            const { rows } = await this.pool.query('SELECT key, value FROM TeamSettings');
            const settings: KeyValueObject[] = [];
            if (Array.isArray(rows) && rows.length > 0) {
                settings.push(...rows.map((row) => ({ key: row.key, value: row.value })));
            }
            return settings;
        } catch (error) {
            console.error('Error in getTeamSetting:', error);
            return [] as KeyValueObject[];
        }
    }

    public async getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string): Promise<string> {
        try {
            const { rows } = await this.pool.query('SELECT value FROM TeamSettings WHERE key = $1 LIMIT 1', [settingKey]);
            if (Array.isArray(rows) && rows.length > 0 && 'value' in rows[0]) return rows[0].value;
            return '';
        } catch (error) {
            console.error('Error in getTeamSetting:', error);
            return '';
        }
    }

    // TODO: Implement this
    public getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        throw new Error('getResourceACL Method not implemented.');
    }
    public getAllUserSettings(acRequest: AccessRequest, accountId: string): Promise<KeyValueObject[]> {
        throw new Error('getAllUserSettings Method not implemented.');
    }
    public getUserSetting(acRequest: AccessRequest, accountId: string, settingKey: string): Promise<string> {
        throw new Error('getUserSetting Method not implemented.');
    }

    public getAgentSetting(acRequest: AccessRequest, agentId: string, settingKey: string): Promise<string> {
        throw new Error('getAgentSetting Method not implemented.');
    }
}
