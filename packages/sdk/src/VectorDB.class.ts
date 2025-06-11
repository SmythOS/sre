import { AccessCandidate, ConnectorService, DEFAULT_TEAM_ID, IVectorDBRequest, TConnectorService } from '@smythos/sre';

import { TVectorDBProvider, TVectorDBProviderInstances } from './types/generated/VectorDB.types';
import { SDKObject } from './SDKObject.class';
//import { TVectorDBProviderInstances } from './types/generated/VectorDB.types';

export class VectorDBInstance extends SDKObject {
    private _candidate: AccessCandidate;
    private _VectorDBRequest: IVectorDBRequest;
    private _namespace: string;
    private _teamId: string;

    constructor(private providerId: TVectorDBProvider, private VectorDBSettings?: any, candidate?: AccessCandidate) {
        super();
        this._candidate = candidate || AccessCandidate.team(DEFAULT_TEAM_ID);
    }

    protected async init() {
        await super.init();

        let connector = ConnectorService.getVectorDBConnector(this.providerId);

        if (!connector?.valid) {
            //no valid default connector, we just create a dummy one
            connector = ConnectorService.init(TConnectorService.VectorDB, this.providerId, this.providerId, {});

            if (!connector.valid) {
                console.error(`VectorDB connector ${this.providerId} is not available`);

                throw new Error(`VectorDB connector ${this.providerId} is not available`);
            }
        }

        const instance = connector.instance(this.VectorDBSettings);
        this._VectorDBRequest = instance.requester(this._candidate);

        this._namespace = this.VectorDBSettings.namespace;
    }

    private async namespaceExists() {
        await this.ready;

        return await this._VectorDBRequest.namespaceExists(this._namespace);
    }
    private async ensureNamespaceExists() {
        await this.ready;

        const namespaceExists = await this._VectorDBRequest.namespaceExists(this._namespace);
        if (!namespaceExists) {
            await this._VectorDBRequest.createNamespace(this._namespace);
        }
    }
    private _normalizeName(name: string) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    public async insertDoc(name: string, data: string, metadata?: Record<string, string>) {
        await this.ready;
        await this.ensureNamespaceExists();
        return await this._VectorDBRequest.createDatasource(this._namespace, { text: data, id: this._normalizeName(name), label: name });
    }

    public async updateDoc(name: string, data: string, metadata?: Record<string, string>) {
        await this.ready;
        await this.ensureNamespaceExists();
        await this.deleteDoc(name);
        return await this.insertDoc(name, data, metadata);
    }

    public async deleteDoc(name: string) {
        await this.ready;
        if (!(await this.namespaceExists())) {
            return false;
        }
        await this._VectorDBRequest.deleteDatasource(this._namespace, this._normalizeName(name));
        return true;
    }
    public async search(query: string, { topK = 10, includeMetadata = true }: { topK?: number; includeMetadata?: boolean }) {
        await this.ready;

        if (!(await this.namespaceExists())) {
            return [];
        }
        return await this._VectorDBRequest.search(this._namespace, query, { topK, includeMetadata });
    }
}

const VectorDB: TVectorDBProviderInstances = {} as TVectorDBProviderInstances;

//generate a VectorDB instance entry for every available VectorDB provider
for (const provider of Object.keys(TVectorDBProvider)) {
    VectorDB[provider] = (namespace: string, VectorDBSettings?: any) =>
        new VectorDBInstance(TVectorDBProvider[provider], { ...VectorDBSettings, namespace });
}

export { VectorDB };
