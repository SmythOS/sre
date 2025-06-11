import { TStorageProvider, TStorageProviderInstances } from './types/generated/Storage.types';
import { Agent, TAgentSettings } from './Agent.class';
import { StorageInstance } from './Storage.class';
import { AccessCandidate } from '@smythos/sre';

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
     * - `agent.storage.LocalStorage()` - Local storage
     * - `agent.storage.S3()` - S3 storage
     *
     * @example
     * ```typescript
     * // Direct storage access
     * const local = agent.storage.LocalStorage();
     * const s3 = agent.storage.S3();
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
}
