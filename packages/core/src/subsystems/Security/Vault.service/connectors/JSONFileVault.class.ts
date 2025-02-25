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
    private sharedVault: boolean;

    constructor(private config: JSONFileVaultConfig) {
        super();
        if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.sharedVault = config.shared || false; //if config.shared, all keys are accessible to all teams, and they are set under the 'shared' teamId

        if (fs.existsSync(config.file)) {
            try {
                if (config.fileKey && fs.existsSync(config.fileKey)) {
                    try {
                        const privateKey = fs.readFileSync(config.fileKey, 'utf8');
                        const encryptedVault = fs.readFileSync(config.file, 'utf8').toString();
                        const decryptedBuffer = crypto.privateDecrypt(
                            {
                                key: privateKey,
                                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                            },
                            Buffer.from(encryptedVault, 'base64')
                        );
                        this.vaultData = JSON.parse(decryptedBuffer.toString('utf8'));
                    } catch (error) {
                        throw new Error('Failed to decrypt vault');
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

        return this.vaultData?.[teamId]?.[keyId] || this.vaultData?.['shared']?.[keyId];
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        return !!(this.vaultData?.[teamId]?.[keyId] || this.vaultData?.['shared']?.[keyId]);
    }

    @SecureConnector.AccessControl
    protected async listKeys(acRequest: AccessRequest) {
        return Object.keys(this.vaultData);
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = /*this.sharedVault ? 'shared' : */ await accountConnector.getCandidateTeam(candidate);

        const acl = new ACL();

        if (typeof this.vaultData?.[teamId]?.[resourceId] !== 'string') {
            if (this.sharedVault && typeof this.vaultData?.['shared']?.[resourceId] === 'string') {
                acl.addAccess(candidate.role, candidate.id, TAccessLevel.Read);
            }

            return acl;
        }

        acl.addAccess(TAccessRole.Team, teamId, TAccessLevel.Owner)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Read)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Write);

        if (this.sharedVault && typeof this.vaultData?.['shared']?.[resourceId] === 'string') {
            acl.addAccess(candidate.role, candidate.id, TAccessLevel.Read);
        }

        return acl;
    }
}
