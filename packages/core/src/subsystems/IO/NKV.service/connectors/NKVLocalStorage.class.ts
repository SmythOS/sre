import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { NKVConnector, NKVPaginationOptions, NKVListResult } from '../NKVConnector';
import { ACLAccessDeniedError, IAccessCandidate, TAccessResult } from '@sre/types/ACL.types';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { StorageData } from '@sre/types/Storage.types';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import Joi from 'joi';
import fs from 'fs';
import path from 'path';
import { findSmythPath } from '../../../../';
import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('NKVLocalStorage');

export type NKVLocalStorageConfig = {
    folder?: string;
};

export class NKVLocalStorage extends NKVConnector {
    public name = 'NKVLocalStorage';
    private folder: string;
    private accountConnector: AccountConnector;
    private cacheConnector: CacheConnector;
    private isInitialized = false;

    constructor(protected _settings?: NKVLocalStorageConfig) {
        super(_settings);
        this.accountConnector = ConnectorService.getAccountConnector();
        this.cacheConnector = ConnectorService.getCacheConnector('RAM');
        this.folder = this.findStorageFolder(_settings?.folder);
        this.initialize();
    }

    private findStorageFolder(folder?: string): string {
        let _storageFolder = folder;

        if (_storageFolder && fs.existsSync(_storageFolder)) {
            return _storageFolder;
        }

        _storageFolder = findSmythPath('nkv');

        if (fs.existsSync(_storageFolder)) {
            console.warn('Using alternative storage folder found in : ', _storageFolder);
            return _storageFolder;
        }

        console.warn('!!! All attempts to find an existing storage folder failed !!!');
        console.warn('!!! I will use this folder: ', _storageFolder);
        return _storageFolder;
    }

    private initialize() {
        if (!this.isInitialized) {
            if (!fs.existsSync(this.folder)) {
                fs.mkdirSync(this.folder, { recursive: true });
            }
            this.isInitialized = true;
        }
    }

    private normalizeFilename(filename: string): string {
        // Step 1: Deduplicate successive colons (:: becomes :)
        let normalized = filename.replace(/:+/g, ':');

        // Step 2: Replace colons with forward slashes for subfolder structure
        normalized = normalized.replace(/:/g, '/');

        // Step 3: Replace invalid filename characters with dots
        // Invalid characters for cross-platform compatibility:
        // - Control characters (0-31 and 127)
        // - Windows reserved: < > : " | ? * \
        // - Preserve forward slashes from step 2 for subfolder structure
        normalized = normalized.replace(/[<>:"|?*\\\x00-\x1f\x7f]/g, '.');

        // Step 4: Handle edge cases - remove leading/trailing dots and spaces
        normalized = normalized.replace(/^[.\s]+|[.\s]+$/g, '');

        // Step 5: Ensure we don't have empty path components
        normalized = normalized.replace(/\/+/g, '/').replace(/\/\./g, '/').replace(/\.\//g, './');

        return normalized || 'default';
    }

    private getStoragePath(teamId: string, namespace: string, key?: string): string {
        const parts = [`team_${this.normalizeFilename(teamId)}`, this.normalizeFilename(namespace)];
        if (key) {
            parts.push(this.normalizeFilename(key));
        }
        return path.join(this.folder, ...parts);
    }

    public key(...parts: string[]) {
        return parts.join(':');
    }

    @NKVLocalStorage.Validate
    @NKVLocalStorage.NamespaceAccessControl
    protected async get(acRequest: AccessRequest, namespace: string, key: string): Promise<StorageData> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const filePath = this.getStoragePath(teamId, namespace, key);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading from NKVLocalStorage: ${error.message}`);
            return null;
        }
    }

    @NKVLocalStorage.Validate
    @NKVLocalStorage.NamespaceAccessControl
    protected async set(acRequest: AccessRequest, namespace: string, key: string, value: any): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const filePath = this.getStoragePath(teamId, namespace, key);
        const dirPath = path.dirname(filePath);

        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(value));
    }

    @NKVLocalStorage.Validate
    @NKVLocalStorage.NamespaceAccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, key: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const filePath = this.getStoragePath(teamId, namespace, key);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    @NKVLocalStorage.Validate
    @NKVLocalStorage.NamespaceAccessControl
    protected async exists(acRequest: AccessRequest, namespace: string, key: string): Promise<boolean> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const filePath = this.getStoragePath(teamId, namespace, key);
        return fs.existsSync(filePath);
    }

    @NKVLocalStorage.NamespaceAccessControl
    public async list(acRequest: AccessRequest, namespace: string, pagination?: NKVPaginationOptions): Promise<NKVListResult> {
        if (pagination) {
            console.warn('[NKVLocalStorage] Pagination is not supported for NKVLocalStorage provider, returning all items');
        }

        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const namespacePath = this.getStoragePath(teamId, namespace);
        const items: { key: string; data: StorageData }[] = [];

        if (!fs.existsSync(namespacePath)) {
            return { items, total: 0 };
        }

        const files = fs.readdirSync(namespacePath);
        for (const file of files) {
            const filePath = path.join(namespacePath, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                const data = fs.readFileSync(filePath, 'utf-8');
                items.push({
                    key: file,
                    data: JSON.parse(data) as StorageData,
                });
            }
        }
        return { items, total: items.length };
    }

    @NKVLocalStorage.NamespaceAccessControl
    public async deleteAll(acRequest: AccessRequest, namespace: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const namespacePath = this.getStoragePath(teamId, namespace);
        if (fs.existsSync(namespacePath)) {
            fs.rmSync(namespacePath, { recursive: true, force: true });
        }
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        return this.cacheConnector.getResourceACL(resourceId, candidate);
    }

    public clearAll(): void {
        if (fs.existsSync(this.folder)) {
            fs.rmSync(this.folder, { recursive: true, force: true });
            this.initialize();
        }
    }

    static NamespaceAccessControl(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            let [acRequest, namespace, key] = args;
            const isNamespaceSearch = key === undefined;

            const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
            const resourceId = isNamespaceSearch ? namespace : `${namespace}:${key}`;
            const finalKey = this.key(`team_${teamId}`, resourceId);
            const accessTicket = await this.getAccessTicket(finalKey, acRequest);

            if (accessTicket.access !== TAccessResult.Granted) throw new ACLAccessDeniedError('Access Denied');

            return originalMethod.apply(this, args);
        };

        return descriptor;
    }

    static Validate(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            let [acRequest, namespace, key] = args;

            const schemaValidator = Joi.object().keys({
                namespace: Joi.string().min(1).required(),
                key: Joi.string().min(1).required(),
            });
            const validationResult = schemaValidator.validate({ namespace, key });

            if (validationResult.error) {
                throw new Error(`Validation Error: ${validationResult.error.message}`);
            }

            return originalMethod.apply(this, args);
        };

        return descriptor;
    }
}
