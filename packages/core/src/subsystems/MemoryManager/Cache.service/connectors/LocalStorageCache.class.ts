import { Logger } from '@sre/helpers/Log.helper';
import { IAccessCandidate, IACL, TAccessLevel } from '@sre/types/ACL.types';
import { CacheMetadata } from '@sre/types/Cache.types';
import { CacheConnector } from '../CacheConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import os from 'os';
import { LocalStorageConfig } from '@sre/types/LocalStorage.types';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';

const console = Logger('LocalStorageCache');

export class LocalStorageCache extends CacheConnector {
    public name: string = 'LocalStorageCache';
    private folder: string;
    private _prefix: string = 'cache';
    private _mdPrefix: string = 'cache.metadata';
    private isInitialized: boolean = false;
    constructor(settings: LocalStorageConfig) {
        super();
        this.folder = settings.folder || `${os.tmpdir()}/.smyth/cache`;
        this.initialize();
    }

    private async initialize() {
        if (!existsSync(this.folder)) {
            mkdirSync(this.folder, { recursive: true });
        }
        const cacheFolderPath = path.join(this.folder, this._prefix);
        if (!existsSync(cacheFolderPath)) {
            mkdirSync(cacheFolderPath, { recursive: true });
        }
        const metadataFolderPath = path.join(this.folder, this._mdPrefix);
        if (!existsSync(metadataFolderPath)) {
            mkdirSync(metadataFolderPath, { recursive: true });
            writeFileSync(
                path.join(metadataFolderPath, 'README_IMPORTANT.txt'),
                'This folder is used for smythOS metadata, do not delete it, it will break SmythOS cache functionality',
            );
        }
        this.isInitialized = true;
    }

    public get prefix() {
        return this._prefix;
    }

    public get mdPrefix() {
        return this._mdPrefix;
    }

    @SecureConnector.AccessControl
    public async get(acRequest: AccessRequest, key: string): Promise<string | null> {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const filePath = this.getStorageFilePath(acRequest.candidate.id, key);
            if (!existsSync(filePath)) return undefined;
            const data = readFileSync(filePath, 'utf-8');
            const metadataFilePath = this.getMetadataFilePath(acRequest.candidate.id, key);
            const metadata = readFileSync(metadataFilePath, 'utf-8');
            const metadataObject = JSON.parse(metadata);
            if (metadataObject['expiresAt'] && metadataObject['expiresAt'] < Date.now()) {
                await this.delete(acRequest, key);
                return undefined;
            }
            return data;
        } catch (error) {
            console.error(`Error reading object from local storage`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    public async set(acRequest: AccessRequest, key: string, data: any, acl?: IACL, metadata?: CacheMetadata, ttl?: number): Promise<boolean> {
        // ttl is in seconds
        if (!this.isInitialized) {
            await this.initialize();
        }
        const accessCandidate = acRequest.candidate;

        let amzACL = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
        let fileMetadata = {
            ...metadata,
            acl: amzACL,
            ...(ttl ? { expiresAt: Date.now() + ttl * 1000 } : {}),
        };
        // To create the directories for the resource we need to know the full path of the resource
        const storageFolderPath = this.getStorageFilePath(acRequest.candidate.id, key, true);
        this.createDirectories(storageFolderPath, key);
        //now we can write the file
        const filePath = this.getStorageFilePath(acRequest.candidate.id, key);
        writeFileSync(filePath, data as Buffer);
        //now we can write the metadata
        await this.setMetadata(acRequest, key, fileMetadata);
        return true;
    }

    @SecureConnector.AccessControl
    public async delete(acRequest: AccessRequest, key: string): Promise<void> {
        try {
            const filePath = this.getStorageFilePath(acRequest.candidate.id, key);
            if (!existsSync(filePath)) return;
            unlinkSync(filePath);
            const metadataFilePath = this.getMetadataFilePath(acRequest.candidate.id, key);
            unlinkSync(metadataFilePath);
        } catch (error) {
            console.error(`Error deleting object from local storage`, error.name, error.message);
            throw error;
        }
    }
    @SecureConnector.AccessControl
    public async exists(acRequest: AccessRequest, key: string): Promise<boolean> {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const filePath = this.getStorageFilePath(acRequest.candidate.id, key);
        if (!existsSync(filePath)) return false;
        const metadataFilePath = this.getMetadataFilePath(acRequest.candidate.id, key);
        if (!existsSync(metadataFilePath)) return false;
        const metadata = readFileSync(metadataFilePath, 'utf-8');
        const metadataObject = JSON.parse(metadata);
        if (metadataObject['expiresAt'] && metadataObject['expiresAt'] < Date.now()) {
            await this.delete(acRequest, key);
            return false;
        }
        return true;
    }

    @SecureConnector.AccessControl
    public async getMetadata(acRequest: AccessRequest, key: string): Promise<CacheMetadata> {
        try {
            const metadataFilePath = this.getMetadataFilePath(acRequest.candidate.id, key);
            if (!existsSync(metadataFilePath)) return undefined;
            const data = readFileSync(metadataFilePath, 'utf-8');
            return this.deserializeMetadata(JSON.parse(data)) as CacheMetadata;
        } catch (error) {
            console.error(`Error reading metadata from LocalStorage`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    public async setMetadata(acRequest: AccessRequest, key: string, metadata: CacheMetadata): Promise<void> {
        try {
            let fileMetadata = await this.getMetadata(acRequest, key);
            if (!fileMetadata) fileMetadata = {};

            fileMetadata = { ...fileMetadata, ...metadata };
            // To create the directories for the resource we need to know the full path of the resource
            const metadataFolderPath = this.getMetadataFilePath(acRequest.candidate.id, key, true);
            this.createDirectories(metadataFolderPath, key);
            //now we can write the metadata
            const metadataFilePath = this.getMetadataFilePath(acRequest.candidate.id, key);
            const serializedMetadata = this.serializeMetadata(fileMetadata);
            writeFileSync(metadataFilePath, JSON.stringify(serializedMetadata));
        } catch (error) {
            console.error(`Error setting metadata in local storage`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    public async updateTTL(acRequest: AccessRequest, key: string, ttl?: number): Promise<void> {
        // ttl is in seconds
        if (ttl) {
            const metadataFilePath = this.getMetadataFilePath(acRequest.candidate.id, key);
            const metadata = readFileSync(metadataFilePath, 'utf-8');
            const metadataObject = JSON.parse(metadata);
            metadataObject['expiresAt'] = Date.now() + ttl * 1000;
            writeFileSync(metadataFilePath, JSON.stringify(metadataObject));
        }
    }

    @SecureConnector.AccessControl
    public async getTTL(acRequest: AccessRequest, key: string): Promise<number> {
        const metadataFilePath = this.getMetadataFilePath(acRequest.candidate.id, key);
        const metadata = readFileSync(metadataFilePath, 'utf-8');
        const metadataObject = JSON.parse(metadata);
        return metadataObject['expiresAt'] && metadataObject['expiresAt'] > Date.now()
            ? Math.floor((metadataObject['expiresAt'] - Date.now()) / 1000)
            : 0;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const metadataFilePath = this.getMetadataFilePath(candidate.id, resourceId);
        if (!existsSync(metadataFilePath)) return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        const metadata = readFileSync(metadataFilePath, 'utf-8');
        const exists = metadata !== undefined; //undefined metadata means the resource does not exist

        if (!exists) {
            //the resource does not exist yet, we grant write access to the candidate in order to allow the resource creation
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }
        try {
            let metadataObject = JSON.parse(metadata);
            return ACL.from(metadataObject?.['acl'] as IACL);
        } catch (error) {
            console.error(`Error parsing metadata in local storage`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async getACL(acRequest: AccessRequest, key: string): Promise<IACL> {
        try {
            const fileMetadata = await this.getMetadata(acRequest, key);
            return ACL.from(fileMetadata?.['acl'] as IACL);
        } catch (error) {
            console.error(`Error getting access rights in local storage`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setACL(acRequest: AccessRequest, key: string, acl: IACL) {
        try {
            let fileMetadata = await this.getMetadata(acRequest, key);
            if (!fileMetadata) fileMetadata = {};
            //when setting ACL make sure to not lose ownership
            fileMetadata['acl'] = ACL.from(acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            await this.setMetadata(acRequest, key, fileMetadata);
        } catch (error) {
            console.error(`Error setting access rights in local storage`, error);
            throw error;
        }
    }
    private serializeMetadata(metadata: Record<string, any>): Record<string, string> {
        let updatedMetadata = {};
        if (metadata['acl']) {
            if (metadata['acl']) {
                updatedMetadata['acl'] = typeof metadata['acl'] == 'string' ? metadata['acl'] : ACL.from(metadata['acl']).serializedACL;
            }

            delete metadata['acl'];
        }

        for (let key in metadata) {
            if (key == 'ContentType') continue; //skip ContentType as it can only be set when writing the object
            updatedMetadata[key] = typeof metadata[key] === 'string' ? metadata[key] : JSON.stringify(metadata[key]);
        }

        return updatedMetadata;
    }

    private deserializeMetadata(metadata: Record<string, string>): Record<string, any> {
        let deserializedMetadata: Record<string, any> = {};

        for (let key in metadata) {
            if (key === 'acl') {
                deserializedMetadata[key] = ACL.from(metadata[key]).ACL;
                continue;
            }

            try {
                deserializedMetadata[key] = JSON.parse(metadata[key]);
            } catch (error) {
                deserializedMetadata[key] = metadata[key];
            }
        }
        return deserializedMetadata;
    }

    private getStorageFilePath(teamId: string, resourceId: string, returnBasePath: boolean = false) {
        if (!existsSync(path.join(this.folder, this._prefix, teamId))) {
            mkdirSync(path.join(this.folder, this._prefix, teamId));
        }
        if (returnBasePath) return path.join(this.folder, this._prefix, teamId);
        return path.join(this.folder, this._prefix, teamId, resourceId);
    }

    private getMetadataFilePath(teamId: string, resourceId: string, returnBasePath: boolean = false) {
        if (!existsSync(path.join(this.folder, this._mdPrefix, teamId))) {
            mkdirSync(path.join(this.folder, this._mdPrefix, teamId));
        }
        if (returnBasePath) return path.join(this.folder, this._mdPrefix, teamId);
        return path.join(this.folder, this._mdPrefix, teamId, resourceId);
    }

    private createDirectories(basePath: string, resourceId: string) {
        const folders = resourceId.split('/').slice(0, -1);
        let currentPath = basePath;
        for (let folder of folders) {
            currentPath = path.join(currentPath, folder);
            if (!existsSync(currentPath)) {
                mkdirSync(currentPath);
            }
        }
    }
}
