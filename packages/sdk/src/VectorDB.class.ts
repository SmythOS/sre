import { AccessCandidate, ConnectorService, DEFAULT_TEAM_ID, IVectorDBRequest, TConnectorService } from '@smythos/sre';
import { EventEmitter } from 'events';
import { TVectorDBProvider, TVectorDBProviderInstances } from './types/generated/VectorDB.types';
//import { TVectorDBProviderInstances } from './types/generated/VectorDB.types';

export class VectorDBInstance extends EventEmitter {
    private _candidate: AccessCandidate;
    private _VectorDBRequest: IVectorDBRequest;
    private _namespace: string;
    private _teamId: string;

    constructor(providerId: TVectorDBProvider, VectorDBSettings?: any, candidate?: AccessCandidate) {
        super();
        this._candidate = candidate || AccessCandidate.team(DEFAULT_TEAM_ID);
        let connector = ConnectorService.getVectorDBConnector(providerId);

        if (!connector?.valid) {
            connector = ConnectorService.init(TConnectorService.VectorDB, providerId, providerId, VectorDBSettings);

            if (!connector.valid) {
                console.error(`VectorDB connector ${providerId} is not available`);

                throw new Error(`VectorDB connector ${providerId} is not available`);
            }
        }

        const instance = connector.instance(VectorDBSettings);
        console.log('instance', instance);

        this._VectorDBRequest = instance.requester(this._candidate);

        this._namespace = VectorDBSettings.namespace;
    }
    private async namespaceExists() {
        return await this._VectorDBRequest.namespaceExists(this._namespace);
    }
    private async ensureNamespaceExists() {
        const namespaceExists = await this._VectorDBRequest.namespaceExists(this._namespace);
        if (!namespaceExists) {
            await this._VectorDBRequest.createNamespace(this._namespace);
        }
    }
    private _normalizeName(name: string) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    public async insertDoc(name: string, data: string, metadata?: Record<string, string>) {
        await this.ensureNamespaceExists();
        return await this._VectorDBRequest.createDatasource(this._namespace, { text: data, id: this._normalizeName(name), label: name });
    }

    public async updateDoc(name: string, data: string, metadata?: Record<string, string>) {
        await this.ensureNamespaceExists();
        await this.deleteDoc(name);
        return await this.insertDoc(name, data, metadata);
    }

    public async deleteDoc(name: string) {
        if (!(await this.namespaceExists())) {
            return false;
        }
        await this._VectorDBRequest.deleteDatasource(this._namespace, this._normalizeName(name));
        return true;
    }
    public async search(query: string, { topK = 10, includeMetadata = true }: { topK?: number; includeMetadata?: boolean }) {
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
