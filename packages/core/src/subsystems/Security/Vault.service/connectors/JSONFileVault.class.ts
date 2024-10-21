import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { JSONFileVaultConfig } from '@sre/types/Security.types';
import { IVaultRequest, VaultConnector } from '../VaultConnector';
import crypto from 'crypto';
import fs from 'fs';

const console = Logger('JSONFileVault');
export class JSONFileVault extends VaultConnector {
    public name: string = 'JSONFileVault';
    private vaultData: any;
    private index: any;

    constructor(private config: JSONFileVaultConfig) {
        super();
        if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        if (fs.existsSync(config.file)) {
            try {
                if (config.fileKey && fs.existsSync(config.fileKey)) {
                    try {
                        const PUBKEY = fs.readFileSync(config.fileKey, 'utf8').toString();
                        const encryptedVault = fs.readFileSync(config.file);
                        const decryptedVault = crypto.publicDecrypt(PUBKEY, Buffer.from(encryptedVault, 'base64')).toString();
                        this.vaultData = JSON.parse(decryptedVault);
                    } catch (error) {
                        this.vaultData = {};
                    }
                } else {
                    this.vaultData = JSON.parse(fs.readFileSync(config.file).toString());
                }
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

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);

        return this.vaultData?.[teamId]?.[keyId];
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        return !!this.vaultData?.[teamId]?.[keyId];
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(candidate);

        const acl = new ACL();

        if (typeof this.vaultData?.[teamId]?.[resourceId] !== 'string') return acl;

        acl.addAccess(TAccessRole.Team, teamId, TAccessLevel.Owner)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Read)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Write);

        return acl;
    }
}
