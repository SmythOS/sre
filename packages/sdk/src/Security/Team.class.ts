import { TStorageProvider, TStorageProviderInstances } from '../types/generated/Storage.types';
import { Agent, TAgentSettings } from '../Agent/Agent.class';
import { StorageInstance } from '../Storage/StorageInstance.class';
import { AccessCandidate } from '@smythos/sre';
import { TVectorDBProvider, TVectorDBProviderInstances } from '../types/generated/VectorDB.types';
import { VectorDBInstance } from '../VectorDB/VectorDBInstance.class';

export class Team {
    constructor(public id: string) {}
    public addAgent(settings: TAgentSettings) {
        settings.teamId = this.id;
        return new Agent(settings);
    }

    /**
     * Access to storage instances from the agent for direct storage interactions.
     *
     * When using storage from the agent, the agent id will be used as data owner
     *
     * **Supported providers and calling patterns:**
     * - `team.storage.default()` - Default storage provider
     * - `team.storage.LocalStorage()` - Local storage
     * - `team.storage.S3()` - S3 storage
     *
     * @example
     * ```typescript
     * // Direct storage access
     * const defaultStorage = team.storage.default();
     * const local = team.storage.LocalStorage();
     * const s3 = team.storage.S3();
     * ```
     */
    private _storageProviders: TStorageProviderInstances;

    public get storage() {
        if (!this._storageProviders) {
            this._storageProviders = {} as TStorageProviderInstances;
            for (const provider of Object.values(TStorageProvider)) {
                this._storageProviders[provider] = (storageSettings?: any) =>
                    new StorageInstance(provider as TStorageProvider, storageSettings, AccessCandidate.team(this.id));
            }
        }
        return this._storageProviders;
    }

    private _vectorDBProviders: TVectorDBProviderInstances;
    public get vectorDB() {
        if (!this._vectorDBProviders) {
            this._vectorDBProviders = {} as TVectorDBProviderInstances;
            for (const provider of Object.values(TVectorDBProvider)) {
                this._vectorDBProviders[provider] = (namespace: string, vectorDBSettings?: any) =>
                    new VectorDBInstance(provider as TVectorDBProvider, { ...vectorDBSettings, namespace }, AccessCandidate.team(this.id));
            }
        }
        return this._vectorDBProviders;
    }
}
