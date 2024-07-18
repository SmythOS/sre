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
            get: async (keyId: string) => this.get(candidate.readRequest, keyId),
            set: async (keyId: string, value: string) => this.set(candidate.writeRequest, keyId, value),
            delete: async (keyId: string) => this.delete(candidate.writeRequest, keyId),
            exists: async (keyId: string) => this.exists(candidate.readRequest, keyId),
        };
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);

        return this.vaultData?.[teamId]?.[keyId];
    }

    @SecureConnector.AccessControl
    protected async set(acRequest: AccessRequest, keyId: string, value: string) {
        throw new Error('JSONFileVault.set not allowed');
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, keyId: string) {
        throw new Error('JSONFileVault.delete not allowed');
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
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
