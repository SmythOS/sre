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
import { isUrl } from '@sre/utils/data.utils';

type SupportedSources = 'text' | 'vector' | 'url';

export class VectorsHelper {
    private _vectorDBconnector: VectorDBConnector;
    private embeddingsProvider: OpenAIEmbeddings;
    private _vectorDimention: number;
    private _nkvConnector: NKVConnector;
    private _vaultConnector: VaultConnector;
    public cusStorageKeyName: string;
    private isCustomStorageInstance: boolean = false;
    private openaiApiKey: string;
    constructor(connectorName?: string, options: { openaiApiKey?: string } = {}) {
        this._vectorDBconnector = ConnectorService.getVectorDBConnector(connectorName);
        this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
        this.embeddingsProvider = new OpenAIEmbeddings({ apiKey: this.openaiApiKey });
        if (this._vectorDimention && !isNaN(this._vectorDimention)) {
            this.embeddingsProvider.dimensions = this._vectorDimention;
        }
        this._nkvConnector = ConnectorService.getNKVConnector();
        this._vaultConnector = ConnectorService.getVaultConnector();
        this.cusStorageKeyName = `vectorDB:customStorage:${this._vectorDBconnector.id}`;
    }

    public static load(options: { vectorDimention?: number; connectorName?: string; openaiApiKey?: string } = {}) {
        const instance = new VectorsHelper(options.connectorName, { openaiApiKey: options.openaiApiKey });
        options.vectorDimention && instance.setVectorDimention(options.vectorDimention);

        return instance;
    }

    /**
     * Loads a VectorsHelper instance for a team. If the team has a custom storage, it will use the custom storage.
     * @param teamId - The team ID.
     * @param options - The options.
     * @returns The VectorsHelper instance.
     */
    public static async forTeam(teamId: string, options: { vectorDimention?: number; connectorName?: string } = {}) {
        const instance = new VectorsHelper(options.connectorName);
        options.vectorDimention && instance.setVectorDimention(options.vectorDimention);

        let teamVectorDB = await instance.getTeamVectorDB(teamId);
        if (teamVectorDB && teamVectorDB instanceof VectorDBConnector) {
            instance._vectorDBconnector = teamVectorDB;
            instance.isCustomStorageInstance = true;
        }
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
            .exists(`vectorDB:${this._vectorDBconnector.id}:namespaces`, VectorDBConnector.constructNsName(teamId, namespace));
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
            .set(`vectorDB:${this._vectorDBconnector.id}:namespaces:${formattedNs}:datasources`, dsId, JSON.stringify(dsData));
        return dsId;
    }

    public async listDatasources(teamId: string, namespace: string) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        return (
            await this._nkvConnector
                .user(AccessCandidate.team(teamId))
                .list(`vectorDB:${this._vectorDBconnector.id}:namespaces:${formattedNs}:datasources`)
        ).map((ds) => {
            return {
                id: ds.key,
                data: JSONContentHelper.create(ds.data?.toString()).tryParse() as IStorageVectorDataSource,
            };
        });
    }

    public async getDatasource(teamId: string, namespace: string, dsId: string) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        return JSONContentHelper.create(
            (
                await this._nkvConnector
                    .user(AccessCandidate.team(teamId))
                    .get(`vectorDB:${this._vectorDBconnector.id}:namespaces:${formattedNs}:datasources`, dsId)
            )?.toString()
        ).tryParse() as IStorageVectorDataSource;
    }

    public async deleteDatasource(teamId: string, namespace: string, dsId: string) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.delete(url, AccessCandidate.team(teamId));
        let ds: IStorageVectorDataSource = JSONContentHelper.create(
            (
                await this._nkvConnector
                    .user(AccessCandidate.team(teamId))
                    .get(`vectorDB:${this._vectorDBconnector.id}:namespaces:${formattedNs}:datasources`, dsId)
            )?.toString()
        ).tryParse();

        if (!ds || typeof ds !== 'object') {
            throw new Error(`Data source not found with id: ${dsId}`);
        }

        const nsExists = await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .exists(`vectorDB:${this._vectorDBconnector.id}:namespaces`, VectorDBConnector.constructNsName(teamId, namespace));
        if (!nsExists) {
            throw new Error('Namespace does not exist');
        }

        await this._vectorDBconnector.user(AccessCandidate.team(teamId)).delete(namespace, ds.embeddingIds || []);

        await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .delete(`vectorDB:${this._vectorDBconnector.id}:namespaces:${formattedNs}:datasources`, dsId);
    }

    public async createNamespace(teamId: string, name: string, metadata: { [key: string]: any } = {}) {
        const preparedNs = VectorDBConnector.constructNsName(teamId, name);

        const candidate = AccessCandidate.team(teamId);
        const nsExists = await this._nkvConnector.user(candidate).exists(`vectorDB:${this._vectorDBconnector.id}`, `namespace:${preparedNs}`);
        const nsSysMetadata = await this._vectorDBconnector.user(candidate).getNsMetadata(preparedNs);

        if (!nsExists) {
            const nsData: IStorageVectorNamespace = {
                namespace: preparedNs,
                displayName: name,
                teamId,
                metadata: {
                    ...metadata,
                    isOnCustomStorage: this.isCustomStorageInstance,
                    ...nsSysMetadata,
                },
            };
            await this._nkvConnector.user(candidate).set(`vectorDB:${this._vectorDBconnector.id}:namespaces`, preparedNs, JSON.stringify(nsData));
        }

        await this._vectorDBconnector.user(candidate).createNamespace(name, { ...metadata, isOnCustomStorage: this.isCustomStorageInstance });
    }

    public async deleteNamespace(teamId: string, name: string) {
        const candidate = AccessCandidate.team(teamId);
        await this._vectorDBconnector.user(candidate).deleteNamespace(name);
        const preparedNs = VectorDBConnector.constructNsName(teamId, name);
        await this._nkvConnector.user(candidate).delete('vectorDB:pinecone:namespaces', preparedNs);
    }

    public async listNamespaces(teamId: string) {
        const candidate = AccessCandidate.team(teamId);
        const nsKeys = await this._nkvConnector.user(candidate).list(`vectorDB:${this._vectorDBconnector.id}:namespaces`);
        return nsKeys.map((k) => JSONContentHelper.create(k.data?.toString()).tryParse() as IStorageVectorNamespace);
    }

    public async namespaceExists(teamId: string, name: string) {
        return await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .exists(`vectorDB:${this._vectorDBconnector.id}:namespaces`, VectorDBConnector.constructNsName(teamId, name));
    }

    public async search(teamId: string, namespace: string, query: string | number[], options: QueryOptions = {}) {
        let ns = await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .get(`vectorDB:${this._vectorDBconnector.id}:namespaces`, VectorDBConnector.constructNsName(teamId, namespace));

        if (!ns) {
            throw new Error('Namespace does not exist');
        }

        const nsData = JSONContentHelper.create(ns.toString()).tryParse() as IStorageVectorNamespace;
        if (nsData.metadata?.isOnCustomStorage && !this.isCustomStorageInstance) {
            throw new Error('Tried to access namespace on custom storage.');
        } else if (!nsData.metadata?.isOnCustomStorage && this.isCustomStorageInstance) {
            throw new Error('Tried to access namespace that is not on custom storage.');
        }

        return this._vectorDBconnector.user(AccessCandidate.team(teamId)).search(namespace, query, options);
    }

    public async getNamespace(teamId: string, name: string) {
        const preparedNs = VectorDBConnector.constructNsName(teamId, name);
        const nsData = await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .get(`vectorDB:${this._vectorDBconnector.id}:namespaces`, preparedNs);
        return JSONContentHelper.create(nsData?.toString()).tryParse() as IStorageVectorNamespace;
    }

    public async isNewNs(ac: AccessCandidate, namespace: string): Promise<boolean> {
        return !(await this._nkvConnector
            .user(AccessCandidate.clone(ac))
            .exists(`vectorDB:${this._vectorDBconnector.id}`, `namespace:${namespace}:acl`));
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

    public detectSourceType(source: Source): SupportedSources | 'unknown' {
        if (typeof source === 'string') {
            return isUrl(source) ? 'url' : 'text';
        } else if (Array.isArray(source) && source.every((v) => typeof v === 'number')) {
            return 'vector';
        } else {
            return 'unknown';
        }
    }

    public transformSource(source: IVectorDataSourceDto[], sourceType: SupportedSources) {
        //* as the accepted sources increases, you will need to implement the strategy pattern instead of a switch case
        switch (sourceType) {
            case 'text': {
                const texts = source.map((s) => s.source as string);

                return VectorsHelper.load({ openaiApiKey: this.openaiApiKey })
                    .embedTexts(texts)
                    .then((vectors) => {
                        return source.map((s, i) => ({
                            ...s,
                            source: vectors[i],
                            metadata: { ...s.metadata, text: texts[i] },
                        }));
                    });
            }
            case 'vector': {
                return source;
            }
        }
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
