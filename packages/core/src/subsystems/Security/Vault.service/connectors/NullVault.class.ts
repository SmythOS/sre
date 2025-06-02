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
import crypto from 'crypto';
import fs from 'fs';
import * as readlineSync from 'readline-sync';

const console = Logger('NullVault');
export class NullVault extends VaultConnector {
    public name: string = 'NullVault';
    private vaultData: any;
    private index: any;
    private sharedVault: boolean;

    constructor(private settings: JSONFileVaultConfig) {
        super();
        console.warn('NullVault is used : Vault features will not be available');
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, keyId: string) {
        console.debug(`Ignored operation:NullVault.get: ${keyId}`);
        return 'NULLKEY';
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
        console.debug(`Ignored operation:NullVault.exists: ${keyId}`);
        return false;
    }

    @SecureConnector.AccessControl
    protected async listKeys(acRequest: AccessRequest) {
        console.debug(`Ignored operation:NullVault.listKeys`);
        return [];
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const acl = new ACL();

        //give just read access by default
        //Cannot write to null vault
        acl.addAccess(candidate.role, candidate.id, TAccessLevel.Read);

        return acl;
    }
}
