import { Logger } from '@sre/helpers/Log.helper';
import { IAccessCandidate, IACL, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { CacheMetadata } from '@sre/types/Cache.types';
import { CacheConnector } from '../CacheConnector';

import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';

import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    PutObjectCommandInput,
    DeleteObjectCommand,
    HeadObjectCommand,
    CopyObjectCommand,
    GetObjectTaggingCommand,
    PutObjectTaggingCommand,
    HeadObjectCommandOutput,
    GetObjectTaggingCommandOutput,
    GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { checkAndInstallLifecycleRules, generateExpiryMetadata, ttlToExpiryDays } from '@sre/helpers/S3Cache.helper';

const console = Logger('S3Cache');
export type S3CacheConfig = {
    bucketName: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
};

export class S3Cache extends CacheConnector {
    public name: string = 'S3Cache';
    private s3Client: S3Client;
    private bucketName: string;
    private isInitialized: boolean = false;
    private cachePrefix: string = '_smyth_cache';

    constructor(settings: S3CacheConfig) {
        super();
        this.s3Client = new S3Client({
            region: settings.region,
            credentials: {
                accessKeyId: settings.accessKeyId,
                secretAccessKey: settings.secretAccessKey,
            },
        });
        this.bucketName = settings.bucketName;
    }

    public get client() {
        return this.s3Client;
    }

    @SecureConnector.AccessControl
    public async get(acRequest: AccessRequest, key: string): Promise<string | null> {
        const candidateId = acRequest.candidate.id;
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const params = {
                Bucket: this.bucketName,
                Key: `${this.cachePrefix}/${candidateId}/${key}`,
            };

            const s3HeadCommand = new HeadObjectCommand(params);
            const headData: HeadObjectCommandOutput = await this.s3Client.send(s3HeadCommand);

            const expirationHeader = headData?.Expiration;
            if (expirationHeader) {
                const expirationDateMatch = expirationHeader.match(/expiry-date="([^"]+)"/);
                if (expirationDateMatch) {
                    const expirationDate = new Date(expirationDateMatch[1]);
                    const currentDate = new Date();

                    if (currentDate > expirationDate) {
                        const s3DeleteCommand = new DeleteObjectCommand(params);
                        await this.s3Client.send(s3DeleteCommand);
                        console.log(`Object ${key} expired and deleted.`);
                        return null;
                    }
                }
            }

            const s3GetCommand = new GetObjectCommand(params);
            const objectData: GetObjectCommandOutput = await this.s3Client.send(s3GetCommand);
            return objectData.Body.transformToString();
        } catch (error) {
            console.error(`Error reading object ${key}:`, error);
            throw null;
        }
    }

    @SecureConnector.AccessControl
    public async set(acRequest: AccessRequest, key: string, data: any, acl?: IACL, metadata?: CacheMetadata, ttl?: number): Promise<boolean> {
        const accessCandidate = acRequest.candidate;
        const candidateId = accessCandidate.id;

        const newMetadata: CacheMetadata = metadata || {};
        newMetadata['acl'] = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
        const serializedMetadata = this.serializeS3Metadata(newMetadata);

        const s3PutCommandConfig: PutObjectCommandInput = {
            Bucket: this.bucketName,
            Key: `${this.cachePrefix}/${candidateId}/${key}`,
            Body: data,
            Metadata: serializedMetadata,
        };
        if (ttl) {
            const expiryMetadata = generateExpiryMetadata(ttlToExpiryDays(ttl)); // seconds to days
            s3PutCommandConfig.Tagging = `${expiryMetadata.Key}=${expiryMetadata.Value}`;
        }

        const s3PutCommand = new PutObjectCommand(s3PutCommandConfig);
        await this.s3Client.send(s3PutCommand);

        return true;
    }

    @SecureConnector.AccessControl
    public async delete(acRequest: AccessRequest, key: string): Promise<void> {
        try {
            const candidateId = acRequest.candidate.id;
            const deleteCommand = new DeleteObjectCommand({ Bucket: this.bucketName, Key: `${this.cachePrefix}/${candidateId}/${key}` });
            await this.s3Client.send(deleteCommand);
        } catch (error) {
            console.log(`Error deleting object ${key}:`, error);
            return;
        }
    }

    @SecureConnector.AccessControl
    public async exists(acRequest: AccessRequest, key: string): Promise<boolean> {
        const candidateId = acRequest.candidate.id;
        try {
            const params = {
                Bucket: this.bucketName,
                Key: `${this.cachePrefix}/${candidateId}/${key}`,
            };
            const s3HeadCommand = new HeadObjectCommand(params);
            const headData: HeadObjectCommandOutput = await this.s3Client.send(s3HeadCommand);

            const expirationHeader = headData?.Expiration;
            if (expirationHeader) {
                const expirationDateMatch = expirationHeader.match(/expiry-date="([^"]+)"/);
                if (expirationDateMatch) {
                    const expirationDate = new Date(expirationDateMatch[1]);
                    const currentDate = new Date();

                    if (currentDate > expirationDate) {
                        await this.delete(acRequest, key);
                        console.log(`Object ${key} expired and deleted.`);
                        return false;
                    }
                }
            }

            return true;
        } catch (error) {
            console.error(`Error reading object ${key}:`, error);
            return false;
        }
    }

    @SecureConnector.AccessControl
    public async getMetadata(acRequest: AccessRequest, key: string): Promise<CacheMetadata> {
        const candidateId = acRequest.candidate.id;

        try {
            const s3Metadata = await this.getS3Metadata(`${this.cachePrefix}/${candidateId}/${key}`);
            return s3Metadata as CacheMetadata;
        } catch (error) {
            console.error(`Error getting access rights in S3`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    public async setMetadata(acRequest: AccessRequest, key: string, metadata: CacheMetadata): Promise<void> {
        const candidateId = acRequest.candidate.id;

        try {
            let s3Metadata = await this.getS3Metadata(`${this.cachePrefix}/${candidateId}/${key}`);
            if (!s3Metadata) s3Metadata = {};
            //s3Metadata['x-amz-meta-data'] = metadata;
            s3Metadata = { ...s3Metadata, ...metadata };
            await this.setS3Metadata(`${this.cachePrefix}/${candidateId}/${key}`, s3Metadata);
        } catch (error) {
            console.error(`Error setting access rights in S3`, error);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    public async updateTTL(acRequest: AccessRequest, key: string, ttl?: number): Promise<void> {
        if (ttl) {
            const candidateId = acRequest.candidate.id;
            const expiryMetadata = generateExpiryMetadata(ttlToExpiryDays(ttl)); // seconds to days
            const s3PutObjectTaggingCommand = new PutObjectTaggingCommand({
                Bucket: this.bucketName,
                Key: `${this.cachePrefix}/${candidateId}/${key}`,
                Tagging: { TagSet: [{ Key: expiryMetadata.Key, Value: expiryMetadata.Value }] },
            });
            await this.s3Client.send(s3PutObjectTaggingCommand);
        }
    }

    @SecureConnector.AccessControl
    public async getTTL(acRequest: AccessRequest, key: string): Promise<number> {
        const candidateId = acRequest.candidate.id;
        const s3HeadCommand = new HeadObjectCommand({ Bucket: this.bucketName, Key: `${this.cachePrefix}/${candidateId}/${key}` });
        const s3HeadObjectResponse: HeadObjectCommandOutput = await this.s3Client.send(s3HeadCommand);
        const expirationHeader = s3HeadObjectResponse?.Expiration;
        if (expirationHeader) {
            const expirationDateMatch = expirationHeader.match(/expiry-date="([^"]+)"/);
            if (expirationDateMatch) {
                const expirationDate = new Date(expirationDateMatch[1]);
                const currentDate = new Date();
                const timeDifference = expirationDate.getTime() - currentDate.getTime();
                return Math.floor(timeDifference / (1000 * 60 * 60 * 24)); // Convert to days
            }
        }
        return -1; // Return -1 if no expiration date is found
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        try {
            const s3HeadCommand = new HeadObjectCommand({ Bucket: this.bucketName, Key: `${this.cachePrefix}/${candidate.id}/${resourceId}` });
            const s3HeadObjectResponse: HeadObjectCommandOutput = await this.s3Client.send(s3HeadCommand);

            const metadata = s3HeadObjectResponse.Metadata;
            if (!metadata.acl) {
                //the resource does not exist yet, we grant write access to the candidate in order to allow the resource creation
                return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
            }
            return ACL.from(metadata?.acl as string);
        } catch (error) {
            if (error.name === 'NotFound') {
                //the resource does not exist yet, we grant write access to the candidate in order to allow the resource creation
                return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
            }
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async getACL(acRequest: AccessRequest, key: string): Promise<IACL> {
        try {
            const metadata = await this.getMetadata(acRequest, key);
            return (metadata?.acl as IACL) || {};
        } catch (error) {
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setACL(acRequest: AccessRequest, key: string, acl: IACL) {
        try {
            let metadata = await this.getMetadata(acRequest, key);
            if (!metadata) metadata = {};
            //when setting ACL make sure to not lose ownership
            metadata.acl = ACL.from(acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            await this.setMetadata(acRequest, key, metadata);
        } catch (error) {
            console.error(`Error setting access rights in S3`, error);
            throw error;
        }
    }

    private async getS3Metadata(resourceId: string): Promise<Record<string, any> | undefined> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
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
            const getObjectTaggingCommand = new GetObjectTaggingCommand({
                Bucket: this.bucketName,
                Key: resourceId,
            });
            const objectTagging: GetObjectTaggingCommandOutput = await this.client.send(getObjectTaggingCommand);
            const serializedMetadata = this.serializeS3Metadata(metadata);
            const copyObjectCommand = new CopyObjectCommand({
                Bucket: this.bucketName,
                CopySource: `${this.bucketName}/${resourceId}`,
                Key: resourceId,
                Metadata: serializedMetadata,
                MetadataDirective: 'REPLACE',
                Tagging: objectTagging.TagSet.map((tag) => `${tag.Key}=${tag.Value}`).join('&'),
            });

            await this.client.send(copyObjectCommand);
        } catch (error) {
            console.error(`Error setting object metadata in S3`, error.name, error.message);
            throw error;
        }
    }

    private async initialize() {
        await checkAndInstallLifecycleRules(this.bucketName, this.s3Client);
        this.isInitialized = true;
    }

    private serializeS3Metadata(s3Metadata: Record<string, any>): Record<string, string> {
        let amzMetadata = {};
        if (s3Metadata['acl']) {
            amzMetadata['acl'] = typeof s3Metadata['acl'] == 'string' ? s3Metadata['acl'] : ACL.from(s3Metadata['acl']).serializedACL;
            delete s3Metadata['acl'];
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
            if (key === 'acl') {
                metadata[key] = ACL.from(amzMetadata[key]).ACL;
                continue;
            }

            try {
                metadata[key] = JSON.parse(amzMetadata[key]);
            } catch (error) {
                metadata[key] = amzMetadata[key];
            }
        }

        return metadata;
    }

    // async hasAccess(request: IAccessRequest): Promise<boolean> {
    //     try {
    //         const metadata = await this.getMetadata(request.resourceId);
    //         const acl: IACL = metadata?.acl as IACL;
    //         return ACL.from(acl).checkExactAccess(request);
    //     } catch (error) {
    //         if (error.name === 'NotFound') {
    //             return false;
    //         }
    //         console.error(`Error checking access rights in S3`, error.name, error.message);
    //         throw error;
    //     }
    // }
}
