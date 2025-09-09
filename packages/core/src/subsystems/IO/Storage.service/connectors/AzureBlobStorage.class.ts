//==[ SRE: AzureBlobStorage ]======================

import {
    BlobServiceClient, // manipulate Azure Storage resources and blob containers.
    ContainerClient,   // manipulate Azure Storage containers and their blobs.
    StorageSharedKeyCredential
} from '@azure/storage-blob';

import { Logger } from '@sre/helpers/Log.helper';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';

const console = Logger('AzureBlobStorage');

export type AzureBlobConfig = {
    storageAccountName: string;
    storageAccountAccessKey: string;
    blobContainerName: string;
};

export class AzureBlobStorage extends StorageConnector {
    public name = 'AzureBlobStorage';
    private blobServiceClient: BlobServiceClient;
    private containerClient: ContainerClient;
    private isInitialized: boolean = false;
    private initializationPromise: Promise<void> | null = null;

    constructor(protected _settings: AzureBlobConfig) {
        super(_settings);

        // Validate required configuration.
        if(!_settings.storageAccountName || _settings.storageAccountName.trim() === '') {
            console.warn('Missing Configuration: Azure Storage Account Name is required but was not provided.')
            console.warn('Please check your configuration settings and ensure that "storageAccountName" is set to your Azure Storage account name.');
            return;
        }

        if(!_settings.storageAccountAccessKey || _settings.storageAccountAccessKey.trim() === '') {
            console.warn('Missing Configuration: Azure Storage Account Access Key is required but was not provided.');
            console.warn('Please provide a valid "storageAccountAccessKey" in your configuration. This key is used to authenticate with your Azure Storage account.');
            return;
        }

        if(!_settings.blobContainerName || _settings.blobContainerName.trim() === '') {
            console.warn('Missing Configuration: Azure Blob Container Name is required but was not provided.');
            console.warn('Please specify the "blobContainerName" where files will be stored in your Azure Storage account.');
            return;
        }

        const endpointUrl = `https://${_settings.storageAccountName}.blob.core.windows.net`;
        const credential = new StorageSharedKeyCredential(_settings.storageAccountName, _settings.storageAccountAccessKey);

        this.blobServiceClient = new BlobServiceClient(endpointUrl, credential);
        this.containerClient = this.blobServiceClient.getContainerClient(_settings.blobContainerName);
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
        if (this.isInitialized) {
            return;
        }
        try{
            await this.containerClient.createIfNotExists();
            console.log(`Container "${this._settings.blobContainerName}" is ready.`);
            this.isInitialized = true;
        }
        catch(error){
            console.error('Failed to initialize AzureBlobStorage:', error);
            this.initializationPromise = null;
            throw error;
        }
    }


    /**
     * Reads a blob's content from the Azure Storage container.
     * This method fetches the entire blob content into a Buffer. If the specified
     * blob does not exist, it gracefully returns undefined.
     *
     * @param {AccessRequest} acRequest - The access request object, handled by the @SecureConnector decorator to authorize the operation.
     * @param {string} resourceId - The unique identifier (name) of the blob to be read from the container.
     * @returns {Promise<StorageData | undefined>} A promise that resolves with the blob's content as a Buffer (`StorageData`), or undefined if the blob is not found.
     * @throws Throws an error if any other issue occurs during the download process (e.g., network issues, permissions problems).
     */
    @SecureConnector.AccessControl
    public async read(acRequest: AccessRequest, resourceId: string): Promise<StorageData | undefined> {
        await this.ensureInitialized();

        const blockBlobClient = this.containerClient.getBlockBlobClient(resourceId);

        try {
            // Directly attempt to download. This avoids a separate `exists()` check,
            // reducing two potential network calls to just one.
            const buffer = await blockBlobClient.downloadToBuffer();
            return buffer;
        } catch (error) {
            // A 404 error is an expected outcome if the blob doesn't exist.
            // In this case, we return undefined as per the method's contract.
            if (error.statusCode === 404) {
                return undefined;
            }

            // For any other error (e.g., network failure, credentials issue),
            // log it and re-throw it to be handled by the application's upper layers.
            console.error(`Failed to read blob "${resourceId}":`, error.message);
            throw error;
        }
    }


    /**
     * Writes or overwrites a blob in the Azure Storage container.
     *
     * This method uploads data to a specified blob. It automatically handles the SmythOS
     * Access Control List (ACL) by ensuring the writer is made the owner of the object.
     * Any provided metadata is merged with this ACL and stored with the blob.
     * If a blob with the same `resourceId` already exists, this operation will completely replace its content and metadata.
     *
     * @param {AccessRequest} acRequest - The access request object, handled by the @SecureConnector decorator to authorize the operation.
     * @param {string} resourceId - The unique identifier (name) of the blob to be written or overwritten.
     * @param {StorageData} value - The content to be written to the blob, typically a Buffer.
     * @param {IACL} [acl] - An optional Access Control List to apply to the blob. If not provided, a default ACL is generated.
     * @param {StorageMetadata} [metadata] - Optional key-value metadata to associate with the blob, including properties like `ContentType`.
     * @returns {Promise<void>} A promise that resolves when the upload operation is complete.
     * @throws Throws an error if the upload fails due to network issues, invalid credentials, or other storage-related problems.
     */
    @SecureConnector.AccessControl
    async write(acRequest: AccessRequest, resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void> {
        await this.ensureInitialized();

        const accessCandidate = acRequest.candidate;

        // Ensure the creator of the object is always granted ownership, merging with any provided ACL.
        const aclData = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
        const azureMetadata = { ...metadata, 'azure-acl': aclData };

        const blockBlobClient = this.containerClient.getBlockBlobClient(resourceId);

        try {
            const uploadOptions = {
                // Serialize the combined metadata for storage with the blob.
                metadata: this._serializeAzureMetadata(azureMetadata),
                // Set the blob's Content-Type for correct handling by browsers and clients.
                blobHTTPHeaders: { blobContentType: metadata?.['ContentType'] || 'application/octet-stream' }
            };

            // Perform the upload. This is a single, efficient network operation.
            await blockBlobClient.uploadData(value, uploadOptions);

        } catch (error) {
            console.error(`Failed to write blob "${resourceId}":`, error.message);
            throw error;
        }
    }


    /**
     * Deletes a blob from the Azure Storage container.
     *
     * This method permanently removes the specified blob. The operation is idempotent,
     * meaning it will complete successfully without error even if the blob does not
     * already exist. This is useful for ensuring a resource is gone without needing to
     * check for its existence first.
     *
     * @param {AccessRequest} acRequest - The access request object, handled by the @SecureConnector decorator to authorize the operation.
     * @param {string} resourceId - The unique identifier (name) of the blob to be deleted.
     * @returns {Promise<void>} A promise that resolves when the delete operation is complete.
     * @throws Throws an error if the deletion fails for reasons other than the blob not existing (e.g., network issues, permissions problems).
     */
    @SecureConnector.AccessControl
    async delete(acRequest: AccessRequest, resourceId: string): Promise<void> {
        await this.ensureInitialized();
        const blockBlobClient = this.containerClient.getBlockBlobClient(resourceId);

        try {
            // The Azure SDK for Blob Storage handles the "not found" case gracefully
            // by design, so no preliminary `exists()` check is needed.
            await blockBlobClient.delete();

        } catch (error) {
            // This catch block will only execute for unexpected errors, such as
            // network failures or insufficient permissions, not for a 404 Not Found.
            console.error(`Failed to delete blob "${resourceId}":`, error.message);
            throw error;
        }
    }


    /**
     * Checks for the existence of a blob in the Azure Storage container.
     *
     * This method efficiently verifies if a blob with the specified `resourceId` is
     * present without downloading its content. It's the most performant way to
     * check for a blob's presence before performing other operations.
     *
     * @param {AccessRequest} acRequest - The access request object, handled by the @SecureConnector decorator to authorize the operation.
     * @param {string} resourceId - The unique identifier (name) of the blob to check.
     * @returns {Promise<boolean>} A promise that resolves with `true` if the blob exists, and `false` otherwise.
     * @throws Throws an error for any issue other than the blob not being found (e.g., network issues, invalid credentials).
     */
    @SecureConnector.AccessControl
    async exists(acRequest: AccessRequest, resourceId: string): Promise<boolean> {
        await this.ensureInitialized();
        const blockBlobClient = this.containerClient.getBlockBlobClient(resourceId);

        try {
            // This is a single, efficient network call that returns a boolean.
            return await blockBlobClient.exists();
        } catch (error) {
            // This block will catch unexpected errors like invalid credentials or network failures.
            console.error(`Failed to check existence for blob "${resourceId}":`, error.message);
            throw error;
        }
    }

    /**
     * Retrieves the user-defined metadata for a specific blob.
     *
     * This method fetches the key-value metadata associated with a blob without
     * downloading the blob's content. It's an efficient way to read custom
     * information stored with an object. If the blob is not found, it returns undefined.
     *
     * @param {AccessRequest} acRequest - The access request object, handled by the @SecureConnector decorator to authorize the operation.
     * @param {string} resourceId - The unique identifier (name) of the blob whose metadata is to be retrieved.
     * @returns {Promise<StorageMetadata | undefined>} A promise that resolves with the blob's metadata object, or undefined if the blob does not exist.
     * @throws Throws an error for any issue other than the blob not being found (e.g., network issues, invalid credentials).
     */
    @SecureConnector.AccessControl
    async getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined> {
        await this.ensureInitialized();

        try {
            // This public method delegates to a private helper for the actual implementation.
            // This is a clean design pattern that separates the public API from internal logic.
            return await this._getAzureMetadata(resourceId);
        } catch (error) {
            // The catch block ensures any unexpected errors from the helper are logged
            // with the context of the public operation.
            console.error(`Failed to get metadata for blob "${resourceId}":`, error.message);
            throw error;
        }
    }


    /**
     * Sets or updates the user-defined metadata for a specific blob.
     *
     * This method applies new metadata to an existing blob. It performs a "merge and
     * update" operation: it first reads the blob's current metadata, then merges
     * the provided metadata with it (new values overwrite existing ones).
     * This operation does not affect the blob's content.
     *
     * @param {AccessRequest} acRequest - The access request object, handled by the @SecureConnector decorator to authorize the operation.
     * @param {string} resourceId - The unique identifier (name) of the blob whose metadata is to be updated.
     * @param {StorageMetadata} metadata - An object containing the key-value pairs to set. These will be merged with any existing metadata.
     * @returns {Promise<void>} A promise that resolves when the metadata has been successfully updated.
     * @throws Throws an error if the blob does not exist, or if the update fails for other reasons (e.g., network issues).
     */
    @SecureConnector.AccessControl
    async setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata): Promise<void> {
        await this.ensureInitialized();

        try {
            // First, fetch the existing metadata to ensure the blob exists.
            const existingMetadata = await this._getAzureMetadata(resourceId);

            // Explicitly fail if the blob does not exist. Metadata can only be set on an existing blob.
            if (existingMetadata === undefined) {
                throw new Error(`Cannot set metadata for non-existent blob: "${resourceId}"`);
            }

            // Merge new metadata with existing metadata. New keys will overwrite old ones.
            const mergedMetadata = { ...existingMetadata, ...metadata };

            // Delegate the actual SDK call to a private helper.
            await this._setAzureMetadata(resourceId, mergedMetadata);

        } catch (error) {
            console.error(`Failed to set metadata for blob "${resourceId}":`, error.message);
            throw error;
        }
    }


    /**
     * Retrieves the Access Control List (ACL) for a specific blob.
     *
     * This method fetches the blob's metadata and specifically extracts the
     * SmythOS-native ACL object. It provides a direct way to inspect the
     * permissions of a blob without downloading its content.
     *
     * @param {AccessRequest} acRequest - The access request object, handled by the @SecureConnector decorator to authorize the operation.
     * @param {string} resourceId - The unique identifier (name) of the blob whose ACL is to be retrieved.
     * @returns {Promise<ACL | undefined>} A promise that resolves with the `ACL` object for the blob. Returns undefined if the blob does not exist or has no ACL.
     * @throws Throws an error for any issue other than the blob not being found (e.g., network issues, invalid credentials).
     */
    @SecureConnector.AccessControl
    async getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined> {
        await this.ensureInitialized();

        try {
            // Reuse the private helper to efficiently fetch the blob's properties.
            const azureMetadata = await this._getAzureMetadata(resourceId);

            // If the blob doesn't exist, the metadata will be undefined.
            if (!azureMetadata) {
                return undefined;
            }

            // The ACL.from() utility safely constructs an ACL object from the raw metadata.
            // It will handle cases where the 'azure-acl' key is missing.
            return ACL.from(azureMetadata['azure-acl'] as IACL);

        } catch (error) {
            // Catches any unexpected errors during the process and logs them with context.
            console.error(`Failed to get ACL for blob "${resourceId}":`, error.message);
            throw error;
        }
    }


    /**
     * Sets or updates the Access Control List (ACL) for a specific blob.
     *
     * This method applies a new SmythOS ACL to an existing blob. It reads the blob's
     * full metadata, replaces the ACL portion, and writes the updated metadata back.
     * A crucial security feature of this method is that it automatically ensures the
     * user/agent making the request always retains ownership of the blob.
     *
     * @param {AccessRequest} acRequest - The access request object, used to identify the user/agent to ensure they retain ownership.
     * @param {string} resourceId - The unique identifier (name) of the blob whose ACL is to be updated.
     * @param {IACL} acl - The new Access Control List object to apply to the blob.
     * @returns {Promise<void>} A promise that resolves when the ACL has been successfully updated.
     * @throws Throws an error if the blob does not exist or if the update fails for other reasons.
     */
    @SecureConnector.AccessControl
    async setACL(acRequest: AccessRequest, resourceId: string, acl: IACL): Promise<void> {
        await this.ensureInitialized();

        try {
            // Fetch the current metadata to ensure the blob exists.
            const azureMetadata = await this._getAzureMetadata(resourceId);

            // Explicitly fail if the blob does not exist, as an ACL cannot be set on a non-existent resource.
            if (!azureMetadata) {
                throw new Error(`Cannot set ACL for non-existent resource: "${resourceId}"`);
            }

            // Security check: Ensure the user performing the action retains ownership.
            // This prevents a user from accidentally locking themselves out.
            azureMetadata['azure-acl'] = ACL.from(acl)
                .addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner)
                .ACL;

            // Delegate the actual SDK call to the private helper.
            await this._setAzureMetadata(resourceId, azureMetadata);

        } catch (error) {
            // Catches any unexpected errors and logs them with clear, actionable context.
            console.error(`Failed to set ACL for blob "${resourceId}":`, error.message);
            throw error;
        }
    }

    /**
     * Determines the effective Access Control List (ACL) for a given resource.
     *
     * This crucial security method is called by the access control system to fetch a
     * resource's ACL before making an authorization decision. If the resource does
     * not exist (and thus has no ACL), this method dynamically generates a new ACL
     * that grants 'Owner' access to the requesting candidate. This is the mechanism
     * that allows authorized users to create new resources.
     *
     * @param {string} resourceId - The unique identifier (name) of the blob whose ACL is to be determined.
     * @param {IAccessCandidate} candidate - The user or agent attempting to access the resource, used to grant ownership if the resource is new.
     * @returns {Promise<ACL>} A promise that resolves with the existing ACL object if the blob is found, or a new ACL object granting ownership if the blob does not exist.
     * @throws Throws an error if there is an unexpected issue fetching the blob's metadata (e.g., network issues).
     */
    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        await this.ensureInitialized();

        try {
            // Reuse the private helper to efficiently fetch the blob's properties.
            const azureMetadata = await this._getAzureMetadata(resourceId);

            // If the blob does not exist, azureMetadata will be undefined.
            if (!azureMetadata) {
                // This is the "create" path: grant ownership of the non-existent resource
                // to the candidate so they are allowed to write it for the first time.
                return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
            }

            // If the blob exists, return its stored ACL.
            return ACL.from(azureMetadata['azure-acl'] as IACL);

        } catch (error) {
            // Catches any unexpected errors during the process and logs them with context.
            console.error(`Failed to get resource ACL for blob "${resourceId}":`, error.message);
            throw error;
        }
    }

    /**
     * Schedules a blob for automatic deletion after a specified time-to-live (TTL).
     *
     * This method applies a Blob Index Tag ('deleteAfterDays') to an existing blob.
     * It does not delete the blob immediately. Instead, it relies on a pre-configured
     * Lifecycle Management rule on the Azure Storage Account to automatically delete the
     * blob after the specified number of days.
     *
     * @param {AccessRequest} acRequest - The access request object, handled by the @SecureConnector decorator to authorize the operation.
     * @param {string} resourceId - The unique identifier (name) of the blob to schedule for deletion.
     * @param {number} ttl - The time-to-live for the blob, in seconds. Must be a positive number.
     * @returns {Promise<void>} A promise that resolves when the expiration tag has been successfully applied.
     * @throws Throws an error if the blob does not exist, if the TTL is invalid, or if applying the tag fails.
     */
    @SecureConnector.AccessControl
    async expire(acRequest: AccessRequest, resourceId: string, ttl: number): Promise<void> {
        await this.ensureInitialized();
        const blockBlobClient = this.containerClient.getBlockBlobClient(resourceId);

        try {
            // 1. Input Validation: Ensure the TTL is a valid positive number.
            if (ttl <= 0) {
                throw new Error('Time-to-live (ttl) must be a positive number of seconds.');
            }

            // 2. Existence Check: Ensure the blob exists before trying to tag it.
            if (!(await blockBlobClient.exists())) {
                throw new Error(`Cannot set expiration for non-existent blob: "${resourceId}"`);
            }

            // 3. Calculation: Convert TTL in seconds to the nearest whole day.
            const ttlInDays = Math.ceil(ttl / 86400);

            // 4. Set Tags: Apply the tag that the Azure Lifecycle Management rule will act upon.
            await blockBlobClient.setTags({
                deleteAfterDays: ttlInDays.toString()
            });

        } catch (error) {
            // Catches any errors from the process and logs them with clear, actionable context.
            console.error(`Failed to set expiration for blob "${resourceId}":`, error.message);
            throw error;
        }
    }


    /**
     * Migrates legacy ACL metadata to the new structured format.
     *
     * This internal helper function checks for an outdated ACL format where permissions
     * were stored in separate keys like `userid`, `teamid`, or `agentid`. If found,
     * it converts them into the modern, structured `azure-acl` object, granting full
     * ownership. This ensures seamless backward compatibility with older data.
     *
     * @param {Record<string, string>} metadata - The raw metadata object which may contain legacy ACL keys.
     * @returns {Record<string, any>} The metadata object, with legacy keys converted into a new `azure-acl` property.
     * @private
     */
    private _migrateMetadata(metadata: Record<string, string>): Record<string, any> {
        // Use object destructuring to cleanly separate legacy keys from the rest of the metadata.
        const { agentid, userid, teamid, ...rest } = metadata;

        // Fast path: If no legacy keys are present, return the original object immediately.
        if (!agentid && !userid && !teamid) {
            return metadata;
        }

        const aclHelper = new ACL();
        const legacyAcls: { [key: string]: string } = { agentid, userid, teamid };

        // A map provides a clean, maintainable way to link legacy keys to system roles.
        const roleMap: Record<string, TAccessRole> = {
            agentid: TAccessRole.Agent,
            userid: TAccessRole.User,
            teamid: TAccessRole.Team,
        };

        for (const key in roleMap) {
            const principalId = legacyAcls[key];
            if (principalId) {
                const role = roleMap[key];
                // Grant full ownership to the legacy principal.
                aclHelper.addAccess(role, principalId, [TAccessLevel.Owner, TAccessLevel.Read, TAccessLevel.Write]);
            }
        }

        aclHelper.migrated = true;

        // Reconstruct the metadata object, combining the remaining properties
        // with the new, structured 'azure-acl'.
        return {
            ...rest,
            'azure-acl': aclHelper.ACL,
        };
    }


    /**
     * Serializes the internal metadata object into a format compatible with Azure Blob Storage.
     *
     * This internal helper prepares the metadata for upload. It converts the `ACL` object
     * into its serialized string representation and stringifies any other non-string
     * metadata values. The `ContentType` property is intentionally excluded as it's
     * handled separately in the blob's HTTP headers.
     *
     * @param {Record<string, any>} metadata - The internal metadata object, containing mixed-type values.
     * @returns {Record<string, string>} A flat key-value object where all values are strings.
     * @private
     */
    private _serializeAzureMetadata(metadata: Record<string, any>): Record<string, string> {
        // Use destructuring to separate special keys from the rest of the metadata.
        // This avoids mutating the original metadata object (a best practice).
        const { 'azure-acl': aclData, ContentType, ...rest } = metadata;

        const serialized: Record<string, string> = {};

        // Handle the ACL serialization separately.
        if (aclData) {
            serialized['azure-acl'] = typeof aclData === 'string'
                ? aclData
                : ACL.from(aclData).serializedACL;
        }

        // Iterate over the remaining properties and stringify them if necessary.
        for (const key in rest) {
            const value = rest[key];
            serialized[key] = typeof value === 'string' ? value : JSON.stringify(value);
        }

        return serialized;
    }


    /**
     * Deserializes a flat metadata object from Azure into the rich internal format.
     *
     * This internal helper processes the raw string-based metadata retrieved from a blob.
     * It reconstructs the `ACL` object from its string representation and parses any
     * other JSON-stringified values back into their original object/data types. It then
     * calls the migration helper to ensure backward compatibility with legacy ACL formats.
     *
     * @param {Record<string, string>} metadata - The flat, string-only key-value metadata from the Azure SDK.
     * @returns {Record<string, any>} The rich internal metadata object with complex data types restored.
     * @private
     */
    private _deserializeAzureMetadata(metadata: Record<string, string>): Record<string, any> {
        // Use Object.entries and reduce for a modern, functional approach to object transformation.
        const deserialized = Object.entries(metadata).reduce((acc, [key, value]) => {
            if (key === 'azure-acl') {
                // Reconstruct the ACL object from its serialized string form.
                acc[key] = ACL.from(value).ACL;
            } else {
                // Try to parse the value as JSON, falling back to the raw string if it's not valid JSON.
                try {
                    acc[key] = JSON.parse(value);
                } catch {
                    acc[key] = value;
                }
            }
            return acc;
        }, {} as Record<string, any>);

        // Finally, run the result through the migration helper to handle any legacy formats.
        return this._migrateMetadata(deserialized);
    }


    /**
     * Private helper to fetch and deserialize metadata from Azure.
     * @private
     */
    private async _getAzureMetadata(resourceId: string): Promise<Record<string, any> | undefined> {
        const blockBlobClient = this.containerClient.getBlockBlobClient(resourceId);

        try {
            // getProperties() is an efficient HEAD request.
            const properties = await blockBlobClient.getProperties();
            const customMetadata = properties.metadata || {};
            const deserialized = this._deserializeAzureMetadata(customMetadata);
            deserialized['ContentType'] = properties.contentType || 'application/octet-stream';
            return deserialized;
        } catch (error) {
            // Gracefully handle the "not found" case by returning undefined.
            if (error.statusCode === 404) {
                return undefined;
            }
            // For all other errors, re-throw to be caught by the public-facing method.
            throw error;
        }
    }


    /**
     * Private helper to serialize and write metadata to Azure.
     * @private
     */
    private async _setAzureMetadata(resourceId: string, metadata: Record<string, any>): Promise<void> {
        const blockBlobClient = this.containerClient.getBlockBlobClient(resourceId);
        try {
            const serialized = this._serializeAzureMetadata(metadata);
            // This is an efficient HEAD request to update metadata without touching blob content.
            await blockBlobClient.setMetadata(serialized);
        } catch (error) {
            // Re-throw to be caught and logged by the public-facing method.
            throw error;
        }
    }
}