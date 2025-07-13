import { AccessCandidate, StorageData } from '@smythos/sre';
import { SDKObject } from '../Core/SDKObject.class';
import { TStorageProvider } from '../types/generated/Storage.types';
export declare class StorageInstance extends SDKObject {
    private _candidate;
    private _teamId;
    private _fs;
    get fs(): SmythFS;
    constructor(providerId?: TStorageProvider, storageSettings?: any, candidate?: AccessCandidate);
    private getResourceId;
    private getResourceUri;
    /**
     * Read a resource from the storage
     * @param resourceName - The name or smythfs:// uri of the resource to read
     * @returns the resource data
     */
    read(resourceName: string): Promise<Buffer>;
    /**
     * Write a resource to the storage
     * @param resourceName - The name or smythfs:// uri of the resource to write
     * @param data - The data to write to the resource
     * @returns SmythFS URI of the written resource in the format (smythfs://<candidateId>.<role>/<resourceName>)
     */
    write(resourceName: string, data: StorageData): Promise<string>;
    /**
     * Delete a resource from the storage
     * @param resourceName - The name or smythfs:// uri of the resource to delete
     * @returns SmythFS URI of the deleted resource in the format (smythfs://<candidateId>.<role>/<resourceName>)
     */
    delete(resourceName: string): Promise<string>;
    /**
     * Check if a resource exists in the storage
     * @param resourceName - The name or smythfs:// uri of the resource to check
     * @returns true if the resource exists, false otherwise
     */
    exists(resourceName: string): Promise<string>;
}
