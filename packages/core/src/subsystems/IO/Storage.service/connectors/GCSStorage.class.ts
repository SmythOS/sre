//==[ SRE: GCSStorage ]======================

import { Storage, File, Bucket } from '@google-cloud/storage';

import { Logger } from '@sre/helpers/Log.helper';
import { IStorageRequest, StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel, TAccessResult, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';

import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { checkAndInstallLifecycleRules, generateExpiryMetadata, ttlToExpiryDays } from '@sre/helpers/GCSCache.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';

const console = Logger('GCSStorage');

export type GCSConfig = {
    projectId: string;
    clientEmail: string;    // Service account email (equivalent to accessKeyId)
    privateKey: string;     // Service account private key (equivalent to secretAccessKey)
    bucket: string;
};

export class GCSStorage extends StorageConnector {
    public name = 'GCSStorage';
    private storage: Storage;
    private bucket: Bucket;
    private bucketName: string;
    private isInitialized: boolean = false;
    private initializationPromise: Promise<void> | null = null;

    constructor(protected _settings: GCSConfig) {
        super(_settings);

        // Validate required configuration
        if (!_settings.bucket || _settings.bucket.trim() === '') {
            console.warn('GCS bucket name is required and cannot be empty, connector not initialized');
            return;
        }

        if (!_settings.projectId || _settings.projectId.trim() === '') {
            console.warn('GCS project ID is required and cannot be empty, connector not initialized');
            return;
        }

        if (!_settings.clientEmail || _settings.clientEmail.trim() === '') {
            console.warn('GCS client email is required and cannot be empty, connector not initialized');
            return;
        }

        if (!_settings.privateKey || _settings.privateKey.trim() === '') {
            console.warn('GCS private key is required and cannot be empty, connector not initialized');
            return;
        }

        this.bucketName = _settings.bucket;
        
        const clientConfig: any = {
            projectId: _settings.projectId,
        };

        if (_settings.clientEmail && _settings.privateKey) {
            clientConfig.credentials = {
                client_email: _settings.clientEmail,
                private_key: _settings.privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
                type: 'service_account'
            };
        }

        this.storage = new Storage(clientConfig);
        this.bucket = this.storage.bucket(this.bucketName);
        
        // Don't call initialize() synchronously in constructor
        // It will be called when needed by methods that require initialization
    }

    private async ensureInitialized(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.initialize();
        return this.initializationPromise;
    }

    private async initialize(): Promise<void> {
        if (!this.storage) {
            console.warn('GCS storage client not initialized');
            return;
        }
        if (this.isInitialized) {
            return;
        }

        try {
            await checkAndInstallLifecycleRules(this.bucketName, this.storage);
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize GCSStorage:', error);
            // Reset the initialization promise so it can be retried
            this.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Reads an object from the GCS bucket.
     *
     * @param {string} resourceId - The name of the object to be read.
     * @returns {Promise<any>} - A promise that resolves with the object data.
     */
    @SecureConnector.AccessControl
    public async read(acRequest: AccessRequest, resourceId: string) {
        await this.ensureInitialized();

        const file = this.bucket.file(resourceId);

        try {
            // Check if file exists and get metadata
            const [exists] = await file.exists();
            if (!exists) {
                return undefined;
            }

            const [metadata] = await file.getMetadata();
            
            // Check for expiration using custom metadata
            if (metadata.metadata && metadata.metadata['expiry-date']) {
                const expiryDateValue = metadata.metadata['expiry-date'];
                if (typeof expiryDateValue === 'string') {
                    const expirationDate = new Date(expiryDateValue);
                    const currentDate = new Date();

                    if (currentDate > expirationDate) {
                        await file.delete();
                        return undefined;
                    }
                }
            }

            // Download and return the file content
            const [buffer] = await file.download();
            return buffer;
        } catch (error) {
            if (error.code === 404) {
                return undefined;
            }
            console.error(`Error reading object from GCS`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined> {
        await this.ensureInitialized();

        try {
            const gcsMetadata = await this.getGCSMetadata(resourceId);
            return gcsMetadata as StorageMetadata;
        } catch (error) {
            console.error(`Error getting metadata from GCS`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata) {
        await this.ensureInitialized();

        try {
            let gcsMetadata = await this.getGCSMetadata(resourceId);
            if (!gcsMetadata) gcsMetadata = {};
            gcsMetadata = { ...gcsMetadata, ...metadata };
            await this.setGCSMetadata(resourceId, gcsMetadata);
        } catch (error) {
            console.error(`Error setting metadata in GCS`, error);
            throw error;
        }
    }

    /**
     * Writes an object to the GCS bucket.
     *
     * @param {string} resourceId - The name of the object to be written.
     * @param {any} value - The value of the object to be written.
     * @param {Metadata} metadata - Optional metadata to be associated with the object.
     * @returns {Promise<void>} - A promise that resolves when the object has been written.
     */
    @SecureConnector.AccessControl
    async write(acRequest: AccessRequest, resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void> {
        await this.ensureInitialized();

        const accessCandidate = acRequest.candidate;
        let aclData = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
        let gcsMetadata = {
            ...metadata,
            'gcs-acl': aclData,
        };

        const file = this.bucket.file(resourceId);

        try {
            const uploadOptions: any = {
                metadata: {
                    metadata: this.serializeGCSMetadata(gcsMetadata),
                },
            };

            if (gcsMetadata['ContentType']) {
                uploadOptions.metadata.contentType = gcsMetadata['ContentType'];
            }

            await file.save(value, uploadOptions);
        } catch (error) {
            console.error(`Error writing object to GCS`, error.name, error.message);
            throw error;
        }
    }

    /**
     * Deletes an object from the GCS bucket.
     *
     * @param {string} resourceId - The name of the object to be deleted.
     * @returns {Promise<void>} - A promise that resolves when the object has been deleted.
     */
    @SecureConnector.AccessControl
    async delete(acRequest: AccessRequest, resourceId: string): Promise<void> {
        await this.ensureInitialized();

        const file = this.bucket.file(resourceId);

        try {
            await file.delete();
        } catch (error) {
            console.error(`Error deleting object from GCS`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async exists(acRequest: AccessRequest, resourceId: string): Promise<boolean> {
        await this.ensureInitialized();

        const file = this.bucket.file(resourceId);

        try {
            const [exists] = await file.exists();
            return exists;
        } catch (error) {
            console.error(`Error checking object existence in GCS`, error.name, error.message);
            throw error;
        }
    }

    //this determines the access rights for the requested resource
    //the connector should check if the resource exists or not
    //if the resource exists we read it's ACL and return it
    //if the resource does not exist we return an write access ACL for the candidate
    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        await this.ensureInitialized();

        try {
            const gcsMetadata = await this.getGCSMetadata(resourceId);
            const exists = gcsMetadata !== undefined; //undefined metadata means the resource does not exist

            if (!exists) {
                //the resource does not exist yet, we grant write access to the candidate in order to allow the resource creation
                return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
            }
            return ACL.from(gcsMetadata?.['gcs-acl'] as IACL);
        } catch (error) {
            console.error('Error in getResourceACL:', error);
            // If we can't check the resource, assume it doesn't exist and grant write access
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }
    }

    @SecureConnector.AccessControl
    async getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined> {
        await this.ensureInitialized();

        try {
            const gcsMetadata = await this.getGCSMetadata(resourceId);
            return ACL.from(gcsMetadata?.['gcs-acl'] as IACL);
        } catch (error) {
            console.error(`Error getting access rights from GCS`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setACL(acRequest: AccessRequest, resourceId: string, acl: IACL) {
        await this.ensureInitialized();

        try {
            let gcsMetadata = await this.getGCSMetadata(resourceId);
            if (!gcsMetadata) gcsMetadata = {};
            //when setting ACL make sure to not lose ownership
            gcsMetadata['gcs-acl'] = ACL.from(acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            await this.setGCSMetadata(resourceId, gcsMetadata);
        } catch (error) {
            console.error(`Error setting access rights in GCS`, error);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async expire(acRequest: AccessRequest, resourceId: string, ttl: number) {
        await this.ensureInitialized();

        const expiryDays = ttlToExpiryDays(ttl);
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + expiryDays);

        // Set expiry date in custom metadata
        let gcsMetadata = await this.getGCSMetadata(resourceId);
        if (!gcsMetadata) gcsMetadata = {};
        gcsMetadata['expiry-date'] = expirationDate.toISOString();
        
        await this.setGCSMetadata(resourceId, gcsMetadata);

        // Also add a suffix to the file name for lifecycle management
        const expiryMetadata = generateExpiryMetadata(expiryDays);
        const file = this.bucket.file(resourceId);
        
        // We can't rename files in GCS directly, but we can use labels for lifecycle management
        // For now, we'll rely on the custom metadata expiry-date for expiration logic
    }

    private migrateMetadata(metadata: Record<string, string>): Record<string, any> {
        if (!metadata.agentid && !metadata.teamid && !metadata.userid) return metadata as Record<string, any>;
        else {
            const convertibleItems = ['agentid', 'teamid', 'userid'];
            const aclHelper = new ACL();

            for (let key of convertibleItems) {
                if (!metadata[key]) continue;
                const role = key === 'agentid' ? TAccessRole.Agent : key === 'teamid' ? TAccessRole.Team : TAccessRole.User;
                aclHelper.addAccess(role, metadata[key].toString(), [TAccessLevel.Owner, TAccessLevel.Read, TAccessLevel.Write]);
                delete metadata[key];
            }
            aclHelper.migrated = true;
            const newMetadata: Record<string, any> = {
                'gcs-acl': aclHelper.ACL,
            };
            //copy remaining metadata
            for (let key in metadata) {
                newMetadata[key] = metadata[key];
            }

            return newMetadata;
        }
    }

    private serializeGCSMetadata(gcsMetadata: Record<string, any>): Record<string, string | number | boolean | null> {
        let metadata: Record<string, string | number | boolean | null> = {};
        if (gcsMetadata['gcs-acl']) {
            if (gcsMetadata['gcs-acl']) {
                metadata['gcs-acl'] =
                    typeof gcsMetadata['gcs-acl'] == 'string'
                        ? gcsMetadata['gcs-acl']
                        : ACL.from(gcsMetadata['gcs-acl']).serializedACL;
            }

            delete gcsMetadata['gcs-acl'];
        }

        for (let key in gcsMetadata) {
            if (key == 'ContentType') continue; //skip ContentType as it's handled separately
            const value = gcsMetadata[key];
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
                metadata[key] = value;
            } else {
                metadata[key] = JSON.stringify(value);
            }
        }

        return metadata;
    }

    private deserializeGCSMetadata(metadata: Record<string, string | number | boolean | null>): Record<string, any> {
        let deserializedMetadata: Record<string, any> = {};

        for (let key in metadata) {
            const value = metadata[key];
            if (key === 'gcs-acl') {
                if (typeof value === 'string') {
                    deserializedMetadata[key] = ACL.from(value).ACL;
                } else {
                    deserializedMetadata[key] = value;
                }
                continue;
            }

            if (typeof value === 'string') {
                try {
                    deserializedMetadata[key] = JSON.parse(value);
                } catch (error) {
                    deserializedMetadata[key] = value;
                }
            } else {
                deserializedMetadata[key] = value;
            }
        }
        
        // Migration support for legacy metadata format
        deserializedMetadata = this.migrateMetadata(deserializedMetadata) as Record<string, any>;

        return deserializedMetadata;
    }

    private async getGCSMetadata(resourceId: string): Promise<Record<string, any> | undefined> {
        try {
            const file = this.bucket.file(resourceId);
            const [exists] = await file.exists();
            
            if (!exists) {
                return undefined;
            }

            const [metadata] = await file.getMetadata();
            const customMetadata = metadata.metadata || {};
            
            let deserializedMetadata: Record<string, any> = this.deserializeGCSMetadata(customMetadata);

            if (!deserializedMetadata['ContentType']) {
                deserializedMetadata['ContentType'] = metadata.contentType || 'application/octet-stream';
            }
            
            return deserializedMetadata;
        } catch (error) {
            if (error.code === 404) {
                return undefined;
            }
            console.error(`Error reading object metadata from GCS`, error.name, error.message);
            throw error;
        }
    }

    private async setGCSMetadata(resourceId: string, metadata: Record<string, any>): Promise<void> {
        try {
            const file = this.bucket.file(resourceId);
            
            // Get current file to preserve content
            const [exists] = await file.exists();
            if (!exists) {
                throw new Error(`File ${resourceId} does not exist`);
            }

            const serializedMetadata = this.serializeGCSMetadata(metadata);
            
            // Update metadata
            await file.setMetadata({
                metadata: serializedMetadata,
            });
        } catch (error) {
            console.error(`Error setting object metadata in GCS`, error.name, error.message);
            throw error;
        }
    }
}