import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { VectorDBConnector } from './VectorDBConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import crypto from 'crypto';
import { IStorageVectorDataSource, IStorageVectorNamespace, IVectorDataSourceDto, QueryOptions, Source } from '@sre/types/VectorDB.types';
import { jsonrepair } from 'jsonrepair';
import { NKVConnector } from '../NKV.service/NKVConnector';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { PineconeVectorDB } from './connectors/PineconeVectorDB.class';

export class VectorsHelper {
    private _vectorDBconnector: VectorDBConnector;
    private embeddingsProvider: OpenAIEmbeddings;
    private _vectorDimention: number;
    private _nkvConnector: NKVConnector;
    private _vaultConnector: VaultConnector;
    public cusStorageKeyName: string;

    constructor(connectorName?: string) {
        this._vectorDBconnector = ConnectorService.getVectorDBConnector(connectorName);
        this.embeddingsProvider = new OpenAIEmbeddings();
        if (this._vectorDimention && !isNaN(this._vectorDimention)) {
            this.embeddingsProvider.dimensions = this._vectorDimention;
        }
        this._nkvConnector = ConnectorService.getNKVConnector();
        this._vaultConnector = ConnectorService.getVaultConnector();
        this.cusStorageKeyName = `vectorDB:customStorage:${this.getConnectorName(this._vectorDBconnector)}`;
    }

    public static load(options: { vectorDimention?: number; connectorName?: string } = {}) {
        const instance = new VectorsHelper(options.connectorName);
        options.vectorDimention && instance.setVectorDimention(options.vectorDimention);

        return instance;
    }

    public setVectorDimention(vectorDimention: number) {
        this._vectorDimention = vectorDimention;
    }

    public static async chunkText(
        text: string,
        {
            chunkSize = 4000,
            chunkOverlap = 500,
        }: {
            chunkSize?: number;
            chunkOverlap?: number;
        } = {}
    ): Promise<string[]> {
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap,
        });
        let output = await textSplitter.splitText(text);

        return output;
    }

    public async createDatasource(
        text: string,
        namespace: string,
        {
            teamId,
            metadata,
            chunkSize = 4000,
            chunkOverlap = 500,
            label,
            id,
        }: {
            teamId?: string;
            metadata?: Record<string, string>;
            chunkSize?: number;
            chunkOverlap?: number;
            label?: string;
            id?: string;
        } = {}
    ) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        const chunkedText = await VectorsHelper.chunkText(text, { chunkSize, chunkOverlap });
        const ids = Array.from({ length: chunkedText.length }, (_, i) => crypto.randomUUID());
        const source: IVectorDataSourceDto[] = chunkedText.map((doc, i) => {
            return {
                id: ids[i],
                source: doc,
                metadata: {
                    user: VectorsHelper.stringifyMetadata(metadata), // user-speficied metadata
                },
            };
        });
        const nsExists = await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .exists('vectorDB:pinecone:namespaces', VectorDBConnector.constructNsName(teamId, namespace));
        if (!nsExists) {
            throw new Error('Namespace does not exist');
        }

        const _vIds = await this._vectorDBconnector.user(AccessCandidate.team(teamId)).insert(namespace, source);

        const dsId = id || crypto.randomUUID();

        const dsData: IStorageVectorDataSource = {
            namespaceId: formattedNs,
            teamId,
            name: label || 'Untitled',
            metadata: VectorsHelper.stringifyMetadata(metadata),
            text,
            embeddingIds: _vIds,
        };
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.write(url, JSON.stringify(dsData), AccessCandidate.team(teamId));
        await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .set(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId, JSON.stringify(dsData));
        return dsId;
    }

    public async listDatasources(teamId: string, namespace: string) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        return (await this._nkvConnector.user(AccessCandidate.team(teamId)).list(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`)).map(
            (ds) => {
                return {
                    id: ds.key,
                    data: JSONContentHelper.create(ds.data?.toString()).tryParse() as IStorageVectorDataSource,
                };
            }
        );
    }

    public async getDatasource(teamId: string, namespace: string, dsId: string) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        return JSONContentHelper.create(
            (
                await this._nkvConnector.user(AccessCandidate.team(teamId)).get(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId)
            )?.toString()
        ).tryParse() as IStorageVectorDataSource;
    }

    public async deleteDatasource(teamId: string, namespace: string, dsId: string) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.delete(url, AccessCandidate.team(teamId));
        let ds: IStorageVectorDataSource = JSONContentHelper.create(
            (
                await this._nkvConnector.user(AccessCandidate.team(teamId)).get(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId)
            )?.toString()
        ).tryParse();

        if (!ds || typeof ds !== 'object') {
            throw new Error(`Data source not found with id: ${dsId}`);
        }

        const nsExists = await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .exists('vectorDB:pinecone:namespaces', VectorDBConnector.constructNsName(teamId, namespace));
        if (!nsExists) {
            throw new Error('Namespace does not exist');
        }

        await this._vectorDBconnector.user(AccessCandidate.team(teamId)).delete(namespace, ds.embeddingIds || []);

        await this._nkvConnector.user(AccessCandidate.team(teamId)).delete(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId);
    }

    public async createNamespace(teamId: string, name: string, metadata: { isOnCustomStorage?: boolean } = {}) {
        let _connector = this._vectorDBconnector;
        if (metadata?.isOnCustomStorage) {
            const config = await this.getCustomStorageConfig(teamId);
            if (!config) {
                throw new Error('Custom storage is not configured');
            }
            _connector = this._vectorDBconnector.instance(config);
        }

        // return _connector.user(AccessCandidate.team(teamId)).createNamespace(name, { isOnCustomStorage });
        const preparedNs = VectorDBConnector.constructNsName(teamId, name);

        const candidate = AccessCandidate.team(teamId);
        const nsExists = await this._nkvConnector.user(candidate).exists('vectorDB:pinecone', `namespace:${preparedNs}`);
        if (!nsExists) {
            const nsData: IStorageVectorNamespace = {
                namespace: preparedNs,
                displayName: name,
                indexName: this._vectorDBconnector.indexName,
                teamId,
                metadata,
            };
            await this._nkvConnector.user(candidate).set('vectorDB:pinecone:namespaces', preparedNs, JSON.stringify(nsData));
        }

        await _connector.user(candidate).createNamespace(name, { isOnCustomStorage: metadata?.isOnCustomStorage });
    }

    public async deleteNamespace(teamId: string, name: string) {
        const candidate = AccessCandidate.team(teamId);
        await this._vectorDBconnector.user(candidate).deleteNamespace(name);
        const preparedNs = VectorDBConnector.constructNsName(teamId, name);
        await this._nkvConnector.user(candidate).delete('vectorDB:pinecone:namespaces', preparedNs);
    }

    public async listNamespaces(teamId: string) {
        const candidate = AccessCandidate.team(teamId);
        const nsKeys = await this._nkvConnector.user(candidate).list('vectorDB:pinecone:namespaces');
        return nsKeys.map((k) => JSONContentHelper.create(k.data?.toString()).tryParse() as IStorageVectorNamespace);
    }

    public async namespaceExists(teamId: string, name: string) {
        return await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .exists('vectorDB:pinecone:namespaces', VectorDBConnector.constructNsName(teamId, name));
    }

    public async search(teamId: string, namespace: string, query: string | number[], options: QueryOptions = {}) {
        const nsExists = await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .exists('vectorDB:pinecone:namespaces', VectorDBConnector.constructNsName(teamId, namespace));
        if (!nsExists) {
            throw new Error('Namespace does not exist');
        }
        return this._vectorDBconnector.user(AccessCandidate.team(teamId)).search(namespace, query, options);
    }

    public async getNamespace(teamId: string, name: string) {
        const preparedNs = VectorDBConnector.constructNsName(teamId, name);
        const nsData = await this._nkvConnector.user(AccessCandidate.team(teamId)).get('vectorDB:pinecone:namespaces', preparedNs);
        return JSONContentHelper.create(nsData?.toString()).tryParse() as IStorageVectorNamespace;
    }

    public async isNewNs(ac: AccessCandidate, namespace: string): Promise<boolean> {
        return !(await this._nkvConnector.user(AccessCandidate.clone(ac)).exists('vectorDB:pinecone', `namespace:${namespace}:acl`));
    }

    public async embedText(text: string) {
        return this.embeddingsProvider.embedQuery(text);
    }

    public async embedTexts(texts: string[]) {
        return this.embeddingsProvider.embedDocuments(texts);
    }

    public static stringifyMetadata(metadata: any) {
        try {
            return jsonrepair(JSON.stringify(metadata));
        } catch (err) {
            return metadata;
        }
    }

    async getTeamVectorDB(teamId: string): Promise<VectorDBConnector | null> {
        const config = await this.getCustomStorageConfig(teamId).catch((e) => null);
        if (!config) return null;
        return this._vectorDBconnector.instance(config);
    }

    async getCustomStorageConfig(teamId: string) {
        const config = await this._vaultConnector.user(AccessCandidate.team(teamId)).get(this.cusStorageKeyName);
        if (!config) {
            if (this._vectorDBconnector instanceof PineconeVectorDB) {
                // TODO: try to grab the keys from the middleware team settings (legacy storage) (required for backward compatibility)
            }
            return null;
        }

        return JSONContentHelper.create(config).tryParse();
    }

    public async isNamespaceOnCustomStorage(teamId: string, namespace: string) {
        const ns = await this.getNamespace(teamId, namespace);
        return (ns.metadata?.isOnCustomStorage as boolean) ?? false;
    }

    private getConnectorName(connector: VectorDBConnector) {
        if (connector instanceof PineconeVectorDB) {
            return 'Pinecone';
        }

        throw new Error('Unable to determine custom storage key name for vector DB connector');
    }

    // async configureCustomStorage(teamId: string, config: any) {
    //     const exists = !!(await this.getCustomStorageConfig(teamId));

    //     if (exists) {
    //         throw new Error('Custom storage is already configured');
    //     }
    //     const preparedConfig = typeof config === 'string' ? config : JSON.stringify(config);
    //     return this._vaultConnector.user(AccessCandidate.team(teamId)).set(this._cusStorageKeyName(teamId), preparedConfig);
    // }

    // async deleteCustomStorage(teamId: string) {
    //     const exists = !!(await this.getCustomStorageConfig(teamId));
    //     if (!exists) {
    //         throw new Error('Custom storage is not configured');
    //     }
    //     // load the team vectorDB connector that has the custom storage
    //     const _connector = await this.getTeamVectorDB(teamId);
    //     const namespaces = _connector.user(AccessCandidate.team(teamId)).listNamespaces();
    //     // TODO: delete all namespaces who are stored in the custom storage (isOnCustomStorage: true)
    //     return this._vaultConnector.user(AccessCandidate.team(teamId)).delete(this._cusStorageKeyName(teamId));
    // }
}
