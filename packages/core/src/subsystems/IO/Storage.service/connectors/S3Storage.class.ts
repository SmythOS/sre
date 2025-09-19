//==[ SRE: S3Storage ]======================

//#region = [Polyfill for CommonJS] =================================

//S3 Methods fail in CommonJS build because they expect a global 'crypto' object with a 'getRandomValues' method
//getRandomValues is supposed to be for browser environments, but it seems that CommonJS build leaks some browser related code to the packaged AWS-SDK

import crypto from 'crypto';

if (!global.crypto || !global.crypto.getRandomValues) {
    Object.defineProperty(global, 'crypto', {
        value: {
            getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
        },
        configurable: true,
        writable: true,
    });
}
//#endregion

import {
    DeleteObjectCommand,
    GetObjectCommand,
    GetObjectCommandOutput,
    HeadObjectCommand,
    HeadObjectCommandOutput,
    PutObjectCommand,
    PutObjectTaggingCommand,
    S3Client,
} from '@aws-sdk/client-s3';

import { Logger } from '@sre/helpers/Log.helper';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';
import { streamToBuffer } from '@sre/utils';
import type { Readable } from 'stream';

//import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { checkAndInstallLifecycleRules, generateExpiryMetadata, ttlToExpiryDays } from '@sre/helpers/S3Cache.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';

const console = Logger('S3Storage');

//export type S3Config = AWSCredentials & AWSRegionConfig & { bucket: string };

//We need to flatten the S3Config type in order to make it work with the SDK
export type S3Config = {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
};

export class S3Storage extends StorageConnector {
    public name = 'S3Storage';
    private client: S3Client;
    private bucket: string;
    private isInitialized: boolean = false;
    private initializationPromise: Promise<void> | null = null;

    constructor(protected _settings: S3Config) {
        super(_settings);
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        // Validate required configuration
        if (!_settings.bucket || _settings.bucket.trim() === '') {
            console.warn('S3 bucket name is required and cannot be empty, connector not initialized');
            return;
        }

        this.bucket = _settings.bucket;
        const clientConfig: any = {};
        if (_settings.region) clientConfig.region = _settings.region;
        if (_settings.accessKeyId && _settings.secretAccessKey) {
            clientConfig.credentials = {
                accessKeyId: _settings.accessKeyId,
                secretAccessKey: _settings.secretAccessKey,
            };
        }

        this.client = new S3Client(clientConfig);
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
        if (!this.client) {
            console.warn('S3 client not initialized');
            return;
        }
        if (this.isInitialized) {
            return;
        }

        try {
            await checkAndInstallLifecycleRules(this.bucket, this.client);
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize S3Storage:', error);
            // Reset the initialization promise so it can be retried
            this.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Reads an object from the S3 bucket.
     *
     * @param {string} resourceId - The key of the object to be read.
     * @returns {Promise<any>} - A promise that resolves with the object data.
     */

    @SecureConnector.AccessControl
    public async read(acRequest: AccessRequest, resourceId: string) {
        await this.ensureInitialized();

        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');
        const params = {
            Bucket: this.bucket,
            Key: resourceId,
        };

        const s3HeadCommand = new HeadObjectCommand(params);
        const s3HeadData: HeadObjectCommandOutput = await this.client.send(s3HeadCommand);

        const expirationHeader = s3HeadData?.Expiration;
        if (expirationHeader) {
            const expirationDateMatch = expirationHeader.match(/expiry-date="([^"]+)"/);
            if (expirationDateMatch) {
                const expirationDate = new Date(expirationDateMatch[1]);
                const currentDate = new Date();

                if (currentDate > expirationDate) {
                    const s3DeleteCommand = new DeleteObjectCommand(params);
                    await this.client.send(s3DeleteCommand);

                    return undefined;
                }
            }
        }

        const command = new GetObjectCommand(params);

        try {
            const response: GetObjectCommandOutput = await this.client.send(command);
            //const metadata = response.Metadata;
            return await streamToBuffer(response.Body as Readable);
        } catch (error) {
            if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
                return undefined;
            }
            console.error(`Error reading object from S3`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined> {
        await this.ensureInitialized();

        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');

        try {
            const s3Metadata = await this.getS3Metadata(resourceId);
            return s3Metadata as StorageMetadata;
        } catch (error) {
            console.error(`Error getting access rights in S3`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata) {
        await this.ensureInitialized();

        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');

        try {
            let s3Metadata = await this.getS3Metadata(resourceId);
            if (!s3Metadata) s3Metadata = {};
            //s3Metadata['x-amz-meta-data'] = metadata;
            s3Metadata = { ...s3Metadata, ...metadata };
            await this.setS3Metadata(resourceId, s3Metadata);
        } catch (error) {
            console.error(`Error setting access rights in S3`, error);
            throw error;
        }
    }
    /**
     * Writes an object to the S3 bucket.
     *
     * @param {string} resourceId - The key of the object to be written.
     * @param {any} value - The value of the object to be written.
     * @param {Metadata} metadata - Optional metadata to be associated with the object.
     * @returns {Promise<void>} - A promise that resolves when the object has been written.
     */
    @SecureConnector.AccessControl
    async write(acRequest: AccessRequest, resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void> {
        await this.ensureInitialized();

        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');
        const accessCandidate = acRequest.candidate;

        let amzACL = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
        let s3Metadata = {
            ...metadata,
            'x-amz-meta-acl': amzACL,
        };

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: resourceId,
            Body: value,
            Metadata: this.serializeS3Metadata(s3Metadata),
            ContentType: s3Metadata['ContentType'],
        });

        try {
            const result: any = await this.client.send(command);
        } catch (error) {
            console.error(`Error writing object to S3`, error.name, error.message);
            //console.error(error);
            throw error;
        }
    }

    /**
     * Deletes an object from the S3 bucket.
     *
     * @param {string} resourceId - The key of the object to be deleted.
     * @returns {Promise<void>} - A promise that resolves when the object has been deleted.
     */
    @SecureConnector.AccessControl
    async delete(acRequest: AccessRequest, resourceId: string): Promise<void> {
        await this.ensureInitialized();

        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');

        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: resourceId,
        });

        try {
            await this.client.send(command);
        } catch (error) {
            console.error(`Error deleting object from S3`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async exists(acRequest: AccessRequest, resourceId: string): Promise<boolean> {
        await this.ensureInitialized();

        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');
        const command = new HeadObjectCommand({
            Bucket: this.bucket,
            Key: resourceId,
        });

        try {
            await this.client.send(command);
            return true;
        } catch (error) {
            if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
                return false;
            }

            console.error(`Error checking object existence in S3`, error.name, error.message);
            throw error;
        }
    }

    //this determines the access rights for the requested resource
    //the connector should check if the resource exists or not
    //if the resource exists we read it's ACL and return it
    //if the resource does not exist we return an write access ACL for the candidate
    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        await this.ensureInitialized();

        const s3Metadata = await this.getS3Metadata(resourceId);
        const exists = s3Metadata !== undefined; //undefined metadata means the resource does not exist
        //let acl: ACL = ACL.from(s3Metadata?.['x-amz-meta-acl'] as IACL);

        if (!exists) {
            //the resource does not exist yet, we grant write access to the candidate in order to allow the resource creation
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }
        return ACL.from(s3Metadata?.['x-amz-meta-acl'] as IACL);
    }

    @SecureConnector.AccessControl
    async getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined> {
        await this.ensureInitialized();

        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');

        try {
            const s3Metadata = await this.getS3Metadata(resourceId);
            return ACL.from(s3Metadata?.['x-amz-meta-acl'] as IACL);
        } catch (error) {
            console.error(`Error getting access rights in S3`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setACL(acRequest: AccessRequest, resourceId: string, acl: IACL) {
        await this.ensureInitialized();

        // const accessTicket = await this.getAccessTicket(resourceId, acRequest);
        // if (accessTicket.access !== TAccessResult.Granted) throw new Error('Access Denied');

        try {
            let s3Metadata = await this.getS3Metadata(resourceId);
            if (!s3Metadata) s3Metadata = {};
            //when setting ACL make sure to not lose ownership
            s3Metadata['x-amz-meta-acl'] = ACL.from(acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            await this.setS3Metadata(resourceId, s3Metadata);
        } catch (error) {
            console.error(`Error setting access rights in S3`, error);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async expire(acRequest: AccessRequest, resourceId: string, ttl: number) {
        await this.ensureInitialized();

        const expiryMetadata = generateExpiryMetadata(ttlToExpiryDays(ttl)); // seconds to days
        const s3PutObjectTaggingCommand = new PutObjectTaggingCommand({
            Bucket: this.bucket,
            Key: resourceId,
            Tagging: { TagSet: [{ Key: expiryMetadata.Key, Value: expiryMetadata.Value }] },
        });
        await this.client.send(s3PutObjectTaggingCommand);
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
                'x-amz-meta-acl': aclHelper.ACL,
            };
            //copy remaining metadata
            for (let key in metadata) {
                newMetadata[key] = metadata[key];
            }

            return newMetadata;
        }
    }

    private serializeS3Metadata(s3Metadata: Record<string, any>): Record<string, string> {
        let amzMetadata = {};
        if (s3Metadata['x-amz-meta-acl']) {
            //const acl: TACL = s3Metadata['x-amz-meta-acl'];
            if (s3Metadata['x-amz-meta-acl']) {
                amzMetadata['x-amz-meta-acl'] =
                    typeof s3Metadata['x-amz-meta-acl'] == 'string'
                        ? s3Metadata['x-amz-meta-acl']
                        : ACL.from(s3Metadata['x-amz-meta-acl']).serializedACL;
            }

            delete s3Metadata['x-amz-meta-acl'];
        }

        for (let key in s3Metadata) {
            if (key == 'ContentType') continue; //skip ContentType as it can only be set when writing the object
            amzMetadata[key] = typeof s3Metadata[key] === 'string' ? s3Metadata[key] : JSON.stringify(s3Metadata[key]);
        }

        return amzMetadata;
    }

    private deserializeS3Metadata(amzMetadata: Record<string, string>): Record<string, any> {
        let metadata: Record<string, any> = {};

        for (let key in amzMetadata) {
            if (key === 'x-amz-meta-acl') {
                metadata[key] = ACL.from(amzMetadata[key]).ACL;
                continue;
            }

            try {
                metadata[key] = JSON.parse(amzMetadata[key]);
            } catch (error) {
                metadata[key] = amzMetadata[key];
            }
        }
        //TODO : Remove this migration code after all metadata is migrated
        //       Context : an old ACL metadata format was used in initial implementation of Smyth Storage
        //       We need to ensure compatibility with legacy format and seamlessly convert it when reading
        metadata = this.migrateMetadata(metadata) as Record<string, any>;

        return metadata;
    }

    private async getS3Metadata(resourceId: string): Promise<Record<string, any> | undefined> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: resourceId,
            });
            const response: HeadObjectCommandOutput = await this.client.send(command);
            const s3RawMetadata = response.Metadata;
            if (!s3RawMetadata || Object.keys(s3RawMetadata).length === 0) return {};

            let metadata: Record<string, any> = this.deserializeS3Metadata(s3RawMetadata);

            if (!metadata['ContentType']) metadata['ContentType'] = response.ContentType ? response.ContentType : 'application/octet-stream';
            return metadata;
        } catch (error) {
            if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
                return undefined;
            }
            console.error(`Error reading object metadata from S3`, error.name, error.message);
            throw error;
        }
    }

    private async setS3Metadata(resourceId: string, metadata: Record<string, any>): Promise<void> {
        try {
            // Get the current object content
            const getObjectCommand = new GetObjectCommand({
                Bucket: this.bucket,
                Key: resourceId,
            });
            const objectData: GetObjectCommandOutput = await this.client.send(getObjectCommand);

            // Read the object's content
            const bufferBody = await streamToBuffer(objectData.Body as Readable);

            const amzMetadata = this.serializeS3Metadata(metadata);
            // Put the object back with the new metadata and the same content
            const putObjectCommand = new PutObjectCommand({
                Bucket: this.bucket,
                Key: resourceId,
                Body: bufferBody,
                Metadata: amzMetadata,
            });

            await this.client.send(putObjectCommand);
        } catch (error) {
            console.error(`Error setting object metadata in S3`, error.name, error.message);
            throw error;
        }
    }
}
