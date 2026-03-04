import { TStorageProvider, TStorageProviderInstances } from '../types/generated/Storage.types';
import { Agent, TAgentSettings } from '../Agent/Agent.class';
import { StorageInstance } from '../Storage/StorageInstance.class';
import { AccessCandidate } from '@smythos/sre';
import { TVectorDBProvider, TVectorDBProviderInstances } from '../types/generated/VectorDB.types';
import { VectorDBInstance } from '../VectorDB/VectorDBInstance.class';
import { TSchedulerProvider, TSchedulerProviderInstances } from '../types/generated/Scheduler.types';
import { SchedulerInstance } from '../Scheduler/SchedulerInstance.class';
import { TCacheProvider, TCacheProviderInstances } from '../types/generated/Cache.types';
import { CacheInstance } from '../Cache/CacheInstance.class';

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

    private _cacheProviders: TCacheProviderInstances;
    public get cache() {
        if (!this._cacheProviders) {
            this._cacheProviders = {} as TCacheProviderInstances;
            for (const provider of Object.values(TCacheProvider)) {
                this._cacheProviders[provider] = (cacheSettings?: any) =>
                    new CacheInstance(provider as TCacheProvider, cacheSettings, AccessCandidate.team(this.id));
            }
        }
        return this._cacheProviders;
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

    /**
     * Access to scheduler instances from the team for team-scoped scheduler interactions.
     *
     * When using scheduler from the team, the team id will be used as job owner (shared across team)
     *
     * **Supported providers and calling patterns:**
     * - `team.scheduler.default()` - Default scheduler provider
     * - `team.scheduler.LocalScheduler()` - Local scheduler
     *
     * @example
     * ```typescript
     * // Direct scheduler access
     * const teamScheduler = team.scheduler.default();
     *
     * // Add a team-wide scheduled job
     * await teamScheduler.add('team-backup',
     *   Schedule.every('6h'),
     *   new Job(async () => {
     *     console.log('Team backup running...');
     *   }, { name: 'Team Backup' })
     * );
     * ```
     */
    private _schedulerProviders: TSchedulerProviderInstances;
    public get scheduler() {
        if (!this._schedulerProviders) {
            this._schedulerProviders = {} as TSchedulerProviderInstances;
            for (const provider of Object.values(TSchedulerProvider)) {
                this._schedulerProviders[provider] = (schedulerSettings?: any) =>
                    new SchedulerInstance(provider as TSchedulerProvider, schedulerSettings, AccessCandidate.team(this.id));
            }
        }
        return this._schedulerProviders;
    }
}
