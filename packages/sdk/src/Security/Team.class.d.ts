import { TStorageProviderInstances } from '../types/generated/Storage.types';
import { Agent, TAgentSettings } from '../Agent/Agent.class';
import { TVectorDBProviderInstances } from '../types/generated/VectorDB.types';
export declare class Team {
    id: string;
    constructor(id: string);
    addAgent(settings: TAgentSettings): Agent;
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
    private _storageProviders;
    get storage(): TStorageProviderInstances;
    private _vectorDBProviders;
    get vectorDB(): TVectorDBProviderInstances;
}
