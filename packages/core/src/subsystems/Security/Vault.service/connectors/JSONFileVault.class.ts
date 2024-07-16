import { ConnectorService } from '@sre/Core/ConnectorsService';
import { createLogger } from '@sre/Core/Logger';
import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { JSONFileVaultConfig } from '@sre/types/Security.types';
import fs from 'fs';
import { IVaultRequest, VaultConnector } from '../VaultConnector';

const console = createLogger('JSONFileVault');
export class JSONFileVault extends VaultConnector {
    public name: string = 'JSONFileVault';
    private vaultData: any;
    private index: any;

    constructor(private config: JSONFileVaultConfig) {
        super();
        if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        if (fs.existsSync(config.file)) {
            try {
                this.vaultData = JSON.parse(fs.readFileSync(config.file).toString());
            } catch (e) {
                this.vaultData = {};
            }

            for (let teamId in this.vaultData) {
                for (let resourceId in this.vaultData[teamId]) {
                    if (!this.index) this.index = {};
                    if (!this.index[resourceId]) this.index[resourceId] = {};
                    const value = this.vaultData[teamId][resourceId];
                    this.index[resourceId][teamId] = value;
                }
            }
        }
    }

    user(candidate: AccessCandidate): IVaultRequest {
        return {
            get: async (keyId: string) => {
                return this.get(keyId, candidate.readRequest);
            },

            set: async (keyId: string, value: string) => this.set(keyId, candidate.writeRequest, value),
            delete: async (keyId: string) => this.delete(keyId, candidate.writeRequest),
            exists: async (keyId: string) => this.exists(keyId, candidate.readRequest),
        };
    }

    @SecureConnector.AccessControl
    protected async get(keyId: string, acRequest: AccessRequest) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);

        return this.vaultData?.[teamId]?.[keyId];
    }

    @SecureConnector.AccessControl
    protected async set(keyId: string, acRequest: AccessRequest, value: string) {
        throw new Error('JSONFileVault.set not allowed');
    }

    @SecureConnector.AccessControl
    protected async delete(keyId: string, acRequest: AccessRequest) {
        throw new Error('JSONFileVault.delete not allowed');
    }

    @SecureConnector.AccessControl
    protected async exists(keyId: string, acRequest: AccessRequest) {
        return false;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(candidate);

        const acl = new ACL();

        if (!this.vaultData?.[teamId]?.[resourceId]) return acl;

        acl.addAccess(TAccessRole.Team, teamId, TAccessLevel.Owner)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Read)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Write);

        return acl;
    }
}
