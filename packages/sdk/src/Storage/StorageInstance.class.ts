import {
    AccessCandidate,
    ConnectorService,
    DEFAULT_TEAM_ID,
    SmythFS,
    StorageConnector,
    StorageData,
    TAccessRole,
    TConnectorService,
} from '@smythos/sre';

import { SDKObject } from '../Core/SDKObject.class';
import { TStorageProvider } from '../types/generated/Storage.types';

export class StorageInstance extends SDKObject {
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

        if (providerId === TStorageProvider.default) {
            this._fs = SmythFS.Instance;
            return;
        }

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

    /**
     * Read a resource from the storage
     * @param resourceName - The name or smythfs:// uri of the resource to read
     * @returns the resource data
     */
    async read(resourceName: string): Promise<Buffer> {
        const uri = resourceName.startsWith('smythfs://') ? resourceName : await this.getResourceUri(resourceName);
        try {
            return await this.fs.read(uri, this._candidate);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    /**
     * Write a resource to the storage
     * @param resourceName - The name or smythfs:// uri of the resource to write
     * @param data - The data to write to the resource
     * @returns SmythFS URI of the written resource in the format (smythfs://<candidateId>.<role>/<resourceName>)
     */
    async write(resourceName: string, data: StorageData) {
        const uri = resourceName.startsWith('smythfs://') ? resourceName : await this.getResourceUri(resourceName);
        try {
            await this.fs.write(uri, data, this._candidate);
            return uri;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    /**
     * Delete a resource from the storage
     * @param resourceName - The name or smythfs:// uri of the resource to delete
     * @returns SmythFS URI of the deleted resource in the format (smythfs://<candidateId>.<role>/<resourceName>)
     */
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

    /**
     * Check if a resource exists in the storage
     * @param resourceName - The name or smythfs:// uri of the resource to check
     * @returns true if the resource exists, false otherwise
     */
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
