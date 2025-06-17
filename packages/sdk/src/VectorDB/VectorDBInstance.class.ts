import { AccessCandidate, ConnectorService, DEFAULT_TEAM_ID, IVectorDBRequest, TConnectorService } from '@smythos/sre';

import { TVectorDBProvider, TVectorDBProviderInstances } from '../types/generated/VectorDB.types';
import { SDKObject } from '../SDKObject.class';
import { TParsedDocument } from '../DocParser/DocParser.class';
import { Scope } from '../types/SDKTypes';
import { HELP } from '../help';
//import { TVectorDBProviderInstances } from './types/generated/VectorDB.types';

export type TVectorDBSearchOptions = {
    topK?: number;
    includeEmbeddings?: boolean;
};
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

    public async insertDoc(name: string, data: string | TParsedDocument, metadata?: Record<string, string>) {
        await this.ready;
        await this.ensureNamespaceExists();
        if (typeof data === 'string') {
            return await this._VectorDBRequest.createDatasource(this._namespace, {
                text: data,
                id: this._normalizeName(name),
                label: name,
                metadata,
            });
        } else {
            const doc = data as TParsedDocument;
            const promises = [];
            for (let page of doc.pages) {
                let rawPageText = '';
                for (let content of page.content) {
                    if (content.text) {
                        rawPageText += content.text + ' ';
                    }
                }
                promises.push(
                    this._VectorDBRequest.createDatasource(this._namespace, {
                        text: rawPageText,
                        id: this._normalizeName(name),
                        label: name,
                        metadata: { ...metadata, pageNumber: page.metadata?.pageNumber, docTitle: doc.title, author: doc.metadata?.author },
                    })
                );
            }
            const ids = await Promise.all(promises);
            return ids;
        }
    }

    public async updateDoc(name: string, data: string | TParsedDocument, metadata?: Record<string, string>) {
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
    public async search(query: string, options?: TVectorDBSearchOptions) {
        await this.ready;

        if (!(await this.namespaceExists())) {
            return [];
        }
        const results = await this._VectorDBRequest.search(this._namespace, query, { topK: options?.topK || 10, includeMetadata: true });
        return results.map((result) => ({
            embedding: options?.includeEmbeddings ? result.values : undefined,
            text: result.metadata?.text,
            metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
        }));
    }

    public async purge() {
        await this.ready;
        await this._VectorDBRequest.deleteNamespace(this._namespace);
    }
}
