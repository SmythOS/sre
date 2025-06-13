import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { JSONFileVaultConfig, EncryptionSettings } from '@sre/types/Security.types';
import { IVaultRequest, VaultConnector } from '../VaultConnector';
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';
import * as readlineSync from 'readline-sync';
import path from 'path';

const console = Logger('JSONFileVault');
export class JSONFileVault extends VaultConnector {
    public name: string = 'JSONFileVault';
    private vaultData: any;
    private index: any;
    private sharedVault: boolean;

    constructor(protected _settings: JSONFileVaultConfig) {
        super(_settings);
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.sharedVault = _settings.shared || false; //if config.shared, all keys are accessible to all teams, and they are set under the 'shared' teamId

        let vaultFile = this.findVaultFile(_settings.file);
        this.vaultData = {};
        if (fs.existsSync(vaultFile)) {
            try {
                if (_settings.fileKey && fs.existsSync(_settings.fileKey)) {
                    try {
                        const privateKey = fs.readFileSync(_settings.fileKey, 'utf8');
                        const encryptedVault = fs.readFileSync(vaultFile, 'utf8').toString();
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
                    this.vaultData = JSON.parse(fs.readFileSync(vaultFile).toString());
                }
            } catch (e) {
                this.vaultData = {};
            }

            if (this.vaultData?.encrypted && this.vaultData?.algorithm && this.vaultData?.data) {
                //this is an encrypted vault we need to request the master key
                this.setInteraction(this.getMasterKeyInteractive.bind(this));
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

    private findVaultFile(vaultFile) {
        let _vaultFile = vaultFile;

        if (fs.existsSync(_vaultFile)) {
            return _vaultFile;
        }
        console.warn('Vault file not found in:', _vaultFile, 'trying to find in .smyth directory');

        //try to find the vault file in the .smyth directory
        _vaultFile = path.join(os.homedir(), '.smyth', '.sre', 'vault.json');
        if (fs.existsSync(_vaultFile)) {
            console.warn('Using alternative vault file found in : ', _vaultFile);
            return _vaultFile;
        }

        console.warn('Vault file not found in:', _vaultFile, 'trying to find in local directory');

        //try local directory
        _vaultFile = path.join(process.cwd(), '.smyth', '.sre', 'vault.json');
        if (fs.existsSync(_vaultFile)) {
            console.warn('Using alternative vault file found in : ', _vaultFile);
            return _vaultFile;
        }

        console.warn('Vault file not found in:', _vaultFile);
        console.warn('!!! All attempts to find the vault file failed !!!');
        console.warn('!!! Will continue without vault !!!');
        console.warn('!!! Many features might not work !!!');

        return null;
    }

    private getMasterKeyInteractive(): string {
        //read master key using readline-sync (blocking)

        process.stdout.write('\x1b[1;37m===[ Encrypted Vault Detected ]=================================\x1b[0m\n');
        const masterKey = readlineSync.question('Enter master key: ', {
            hideEchoBack: true,
            mask: '*',
        });
        console.info('Master key entered');
        return masterKey;
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

        if (resourceId && typeof this.vaultData?.[teamId]?.[resourceId] !== 'string') {
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
