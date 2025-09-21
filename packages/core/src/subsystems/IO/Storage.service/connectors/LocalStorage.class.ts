//==[ SRE: LocalStorage ]======================

import { Logger } from '@sre/helpers/Log.helper';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel, TAccessResult, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';
//import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import fs, { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { findSmythPath } from '../../../..';

const console = Logger('LocalStorage');

export type LocalStorageConfig = {
    /**
     * The folder to use for the local storage.
     *
     * If not provided, the default folder will be used.
     * The default folder is ~/.smyth/storage
     */
    folder?: string;
};

//TODO : detect and store ContentType metadata when saving

export class LocalStorage extends StorageConnector {
    public name = 'LocalStorage';
    private folder: string;
    private storagePrefix = 'local';
    private metadataPrefix = '.local.metadata';
    private isInitialized = false;

    constructor(protected _settings?: LocalStorageConfig) {
        super(_settings);
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.folder = this.findStorageFolder(_settings?.folder);
        this.initialize();
        if (!fs.existsSync(this.folder)) {
            //throw new Error('Invalid folder provided');
            console.error(`Invalid folder provided: ${this.folder}`);
        }
    }

    private findStorageFolder(folder) {
        let _storageFolder = folder;

        if (_storageFolder && fs.existsSync(_storageFolder)) {
            return _storageFolder;
        }

        _storageFolder = findSmythPath('storage');

        if (fs.existsSync(_storageFolder)) {
            console.warn('Using alternative storage folder found in : ', _storageFolder);
            return _storageFolder;
        }

        console.warn('!!! All attempts to find an existing storage folder failed !!!');
        console.warn('!!! I will use this folder: ', _storageFolder);
        return _storageFolder;
    }

    /**
     * Reads an object from the local storage.
     *
     * @param {string} resourceId - The key of the object to be read.
     * @returns {Promise<any>} - A promise that resolves with the object data.
     */

    @SecureConnector.AccessControl
    public async read(acRequest: AccessRequest, resourceId: string) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');
        try {
            const filePath = this.getStorageFilePath(acRequest.candidate.id, resourceId);
            if (!fs.existsSync(filePath)) return undefined;
            const data = fs.readFileSync(filePath, null);
            return data;
        } catch (error) {
            console.error(`Error reading object from local storage`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined> {
        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');

        try {
            const metadataFilePath = this.getMetadataFilePath(acRequest.candidate.id, resourceId);
            if (!fs.existsSync(metadataFilePath)) return undefined;
            const data = fs.readFileSync(metadataFilePath, 'utf-8');
            return this.deserializeMetadata(JSON.parse(data)) as StorageMetadata;
        } catch (error) {
            console.error(`Error reading metadata from LocalStorage`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata) {
        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');

        try {
            let fileMetadata = await this.getMetadata(acRequest, resourceId);
            if (!fileMetadata) fileMetadata = {};

            fileMetadata = { ...fileMetadata, ...metadata };

            //now we can write the metadata
            const metadataFilePath = this.getMetadataFilePath(acRequest.candidate.id, resourceId, true);
            const serializedMetadata = this.serializeMetadata(fileMetadata);
            fs.writeFileSync(metadataFilePath, JSON.stringify(serializedMetadata));
        } catch (error) {
            console.error(`Error setting metadata in local storage`, error.name, error.message);
            throw error;
        }
    }
    /**
     * Writes an object to the local storage.
     *
     * @param {string} resourceId - The key of the object to be written.
     * @param {any} value - The value of the object to be written.
     * @param {Metadata} metadata - Optional metadata to be associated with the object.
     * @returns {Promise<void>} - A promise that resolves when the object has been written.
     */
    @SecureConnector.AccessControl
    async write(acRequest: AccessRequest, resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void> {
        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');
        if (!this.isInitialized) {
            await this.initialize();
        }
        const accessCandidate = acRequest.candidate;

        let localACL = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
        let fileMetadata = {
            ...metadata,
            acl: localACL,
        };

        //now we can write the file
        const filePath = this.getStorageFilePath(acRequest.candidate.id, resourceId, true);
        fs.writeFileSync(filePath, value as Buffer);
        //now we can write the metadata
        await this.setMetadata(acRequest, resourceId, fileMetadata);
    }

    /**
     * Deletes an object from the local storage.
     *
     * @param {string} resourceId - The key of the object to be deleted.
     * @returns {Promise<void>} - A promise that resolves when the object has been deleted.
     */
    @SecureConnector.AccessControl
    async delete(acRequest: AccessRequest, resourceId: string): Promise<void> {
        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');

        try {
            const filePath = this.getStorageFilePath(acRequest.candidate.id, resourceId);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            const metadataFilePath = this.getMetadataFilePath(acRequest.candidate.id, resourceId);
            if (fs.existsSync(metadataFilePath)) fs.unlinkSync(metadataFilePath);
        } catch (error) {
            console.error(`Error deleting object from local storage`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async exists(acRequest: AccessRequest, resourceId: string): Promise<boolean> {
        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');
        if (!this.isInitialized) {
            await this.initialize();
        }
        const filePath = this.getStorageFilePath(acRequest.candidate.id, resourceId);
        return !!fs.existsSync(filePath);
    }

    //this determines the access rights for the requested resource
    //the connector should check if the resource exists or not
    //if the resource exists we read it's ACL and return it
    //if the resource does not exist we return an write access ACL for the candidate
    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const metadataFilePath = this.getMetadataFilePath(candidate.id, resourceId);

        if (!fs.existsSync(metadataFilePath)) return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);

        const metadata = fs.readFileSync(metadataFilePath, 'utf-8');
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
    async getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined> {
        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');

        try {
            const fileMetadata = await this.getMetadata(acRequest, resourceId);
            return ACL.from(fileMetadata?.['acl'] as IACL);
        } catch (error) {
            console.error(`Error getting access rights in local storage`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setACL(acRequest: AccessRequest, resourceId: string, acl: IACL) {
        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');

        try {
            let fileMetadata = await this.getMetadata(acRequest, resourceId);
            if (!fileMetadata) fileMetadata = {};
            //when setting ACL make sure to not lose ownership
            fileMetadata['acl'] = ACL.from(acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            await this.setMetadata(acRequest, resourceId, fileMetadata);
        } catch (error) {
            console.error(`Error setting access rights in local storage`, error);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async expire(acRequest: AccessRequest, resourceId: string, ttl: number) {
        console.warn(`LocalStorage.expire is not implemented, request will be ignored for resource ${resourceId} and ttl ${ttl}`);
    }

    private async initialize() {
        const storageFolderPath = path.join(this.folder, this.storagePrefix);
        if (!existsSync(storageFolderPath)) {
            fs.mkdirSync(storageFolderPath, { recursive: true });
        }
        const metadataFolderPath = path.join(this.folder, this.metadataPrefix);
        if (!existsSync(metadataFolderPath)) {
            fs.mkdirSync(metadataFolderPath, { recursive: true });
            fs.writeFileSync(
                path.join(metadataFolderPath, 'README_IMPORTANT.txt'),
                'This folder is used for smythOS metadata, do not delete it, it will break SmythOS local filesystem'
            );
        }
        this.isInitialized = true;
    }

    private getStorageFilePath(candidateId: string, resourceId: string, createFoldersIfNotExists: boolean = false) {
        const fullPath = path.join(this.folder, this.storagePrefix, resourceId);
        const folder = path.dirname(fullPath);
        if (createFoldersIfNotExists && !fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        return fullPath;
    }

    private getMetadataFilePath(candidateId: string, resourceId: string, createFoldersIfNotExists: boolean = false) {
        const fullPath = path.join(this.folder, this.metadataPrefix, resourceId);
        const folder = path.dirname(fullPath);
        if (createFoldersIfNotExists && !fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        return fullPath;
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
}
