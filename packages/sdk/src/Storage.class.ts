import {
    ConnectorService,
    IStorageRequest,
    Connector,
    StorageConnector,
    AccessCandidate,
    DEFAULT_TEAM_ID,
    TAccessRole,
    SmythFS,
    TConnectorService,
} from '@smythos/sre';
import { EventEmitter } from 'events';
import { TStorageProvider, TStorageProviderInstances } from './types/generated/Storage.types';

export class StorageInstance extends EventEmitter {
    private _candidate: AccessCandidate;
    //private _storageRequest: IStorageRequest;
    private _teamId: string;

    private _fs: SmythFS;

    public get fs() {
        return this._fs;
    }

    constructor(providerId?: TStorageProvider, storageSettings: any = {}, candidate?: AccessCandidate) {
        super();
        this._candidate = candidate || AccessCandidate.team(DEFAULT_TEAM_ID);
        let connector = ConnectorService.getStorageConnector(providerId || '');

        if (!connector?.valid) {
            connector = ConnectorService.init(TConnectorService.Storage, providerId, providerId, {});

            if (!connector?.valid) {
                console.error(`Storage connector ${providerId} is not available`);

                throw new Error(`Storage connector ${providerId} is not available`);
            }
        }

        const instance: StorageConnector = connector.instance(storageSettings || connector.settings);

        //this._storageRequest = connector.user(this._candidate);
        this._fs = SmythFS.getInstance(instance);
    }
    private async getResourceId(resourceName: string) {
        if (!this._teamId) {
            const accountConnector = ConnectorService.getAccountConnector();
            this._teamId = await accountConnector.getCandidateTeam(this._candidate);
        }
        return `teams/${this._teamId}/${resourceName}`;
    }

    private async getResourceUri(resourceName: string) {
        if (!this._teamId) {
            const accountConnector = ConnectorService.getAccountConnector();
            this._teamId = await accountConnector.getCandidateTeam(this._candidate);
        }

        let tld = '';

        switch (this._candidate.role) {
            case TAccessRole.Agent:
                tld = '.agent';

                break;
            case TAccessRole.User:
                tld = '.user';

                break;
            default:
                tld = '.team';
        }

        return `smythfs://${this._candidate.id}${tld}/${resourceName}`;
    }
    async read(resourceName: string) {
        const uri = resourceName.startsWith('smythfs://') ? resourceName : await this.getResourceUri(resourceName);
        try {
            return await this.fs.read(uri, this._candidate);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async write(resourceName: string, data: any) {
        const uri = resourceName.startsWith('smythfs://') ? resourceName : await this.getResourceUri(resourceName);
        try {
            await this.fs.write(uri, data, this._candidate);
            return uri;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async delete(resourceName: string) {
        const uri = resourceName.startsWith('smythfs://') ? resourceName : await this.getResourceUri(resourceName);
        try {
            await this.fs.delete(uri, this._candidate);
            return uri;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async exists(resourceName: string) {
        const uri = resourceName.startsWith('smythfs://') ? resourceName : await this.getResourceUri(resourceName);
        try {
            await this.fs.exists(uri, this._candidate);
            return uri;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

const Storage: TStorageProviderInstances = {} as TStorageProviderInstances;

//generate a storage instance entry for every available storage provider
for (const provider of Object.keys(TStorageProvider)) {
    Storage[provider] = (storageSettings?: any, candidate?: AccessCandidate) =>
        new StorageInstance(TStorageProvider[provider], storageSettings, candidate);
}

export { Storage };
