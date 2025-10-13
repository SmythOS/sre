import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { findValidResourcePath } from '@sre/helpers/Sysconfig.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import * as chokidar from 'chokidar';
import crypto from 'crypto';
import fs from 'fs';
import * as readlineSync from 'readline-sync';
import { VaultConnector } from '../VaultConnector';

const console = Logger('JSONFileVault');

export type JSONFileVaultConfig = {
    file?: string;
    fileKey?: string;
    shared?: string;
};

export class JSONFileVault extends VaultConnector {
    public name: string = 'JSONFileVault';
    private vaultData: any;
    private index: any;
    private shared: string;
    private vaultFile: string;
    private watcher: chokidar.FSWatcher | null = null;

    constructor(protected _settings: JSONFileVaultConfig) {
        super(_settings);
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.shared = _settings.shared || ''; //if config.shared, all keys are accessible to all teams, and they are set under the 'shared' teamId

        this.vaultFile = this.findVaultFile(_settings.file);
        this.fetchVaultData(this.vaultFile, _settings);
        this.initFileWatcher();
    }

    private findVaultFile(vaultFile) {
        let _vaultFile = vaultFile;

        if (_vaultFile && fs.existsSync(_vaultFile)) {
            return _vaultFile;
        }
        console.warn('Vault file not found in:', _vaultFile);

        let found = '';

        const relativeSearchLocations = ['vault.json', 'vault/vault.json', '.sre/vault.json'];
        found = findValidResourcePath(relativeSearchLocations, (dir, success, nextDir) => {
            if (!success) {
                console.warn('Vault file not found in:', nextDir);
            }
        });

        if (found) {
            console.warn('Using alternative vault file found in : ', found);
            return found;
        }

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

    /**
     * Resolves environment variable references in vault values.
     * Supports syntax: $env(VARIABLE_NAME)
     * @param value The value to process
     * @returns The value with environment variables resolved
     */
    private resolveEnvironmentVariables(value: any): any {
        if (typeof value !== 'string') {
            return value;
        }

        // Match $env(VARIABLE_NAME) pattern
        const envVarPattern = /\$env\(([^)]+)\)/g;

        return value.replace(envVarPattern, (match, envVarName) => {
            const envValue = process.env[envVarName];
            if (envValue === undefined) {
                console.warn(`Environment variable ${envVarName} not found, keeping original value: ${match}`);
                return match;
            }
            return envValue;
        });
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);

        const rawValue = this.vaultData?.[teamId]?.[keyId] || this.vaultData?.[this.shared]?.[keyId];

        // Resolve environment variables if the value contains $env() references
        return this.resolveEnvironmentVariables(rawValue);
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        return !!(this.vaultData?.[teamId]?.[keyId] || this.vaultData?.[this.shared]?.[keyId]);
    }

    @SecureConnector.AccessControl
    protected async listKeys(acRequest: AccessRequest) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        return Object.keys(this.vaultData?.[teamId] || this.vaultData?.[this.shared] || {});
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = /*this.sharedVault ? 'shared' : */ await accountConnector.getCandidateTeam(candidate);

        const acl = new ACL();

        if (resourceId && typeof this.vaultData?.[teamId]?.[resourceId] !== 'string') {
            if (this.shared && typeof this.vaultData?.[this.shared]?.[resourceId] === 'string') {
                acl.addAccess(candidate.role, candidate.id, TAccessLevel.Read);
            }

            return acl;
        }

        acl.addAccess(TAccessRole.Team, teamId, TAccessLevel.Owner)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Read)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Write);

        if (this.shared && typeof this.vaultData?.[this.shared]?.[resourceId] === 'string') {
            acl.addAccess(candidate.role, candidate.id, TAccessLevel.Read);
        }

        return acl;
    }

    private fetchVaultData(vaultFile: string, _settings: JSONFileVaultConfig) {
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
                console.error('Error parsing vault file:', e);
                console.error('!!! Vault features might not work properly !!!');
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

    private initFileWatcher() {
        this.watcher = chokidar.watch(this.vaultFile, {
            persistent: false, // Don't keep the process running
            ignoreInitial: true,
        });

        this.watcher.on('change', () => {
            this.fetchVaultData(this.vaultFile, this._settings);
        });
    }

    public async stop() {
        super.stop();
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}
