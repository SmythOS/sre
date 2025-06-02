import { ConnectorService } from '@sre/Core/ConnectorsService';
import { VectorDBConnector } from '../../subsystems/IO/VectorDB.service/VectorDBConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { IVectorDataSourceDto, Source } from '@sre/types/VectorDB.types';
import { jsonrepair } from 'jsonrepair';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { isUrl } from '@sre/utils/data.utils';
import { SmythManagedVectorDB } from '../../subsystems/IO/VectorDB.service/connectors/SmythManagedVectorDB.class';
import { RecursiveTextSplitter } from './TextSplitter';
import { OpenAIEmbeds } from './OpenAIEmbeds';

type SupportedSources = 'text' | 'vector' | 'url';

export class VectorsHelper {
    private _vectorDBconnector: VectorDBConnector;
    private embeddingsProvider: OpenAIEmbeds;
    private _vectorDimention: number;
    private _vaultConnector: VaultConnector;
    public cusStorageKeyName: string;
    private isCustomStorageInstance: boolean = false;
    private openaiApiKey: string;
    constructor(connectorName?: string, options: { openaiApiKey?: string } = {}) {
        this._vectorDBconnector = ConnectorService.getVectorDBConnector(connectorName);
        this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
        this.embeddingsProvider = new OpenAIEmbeds({ apiKey: this.openaiApiKey });
        if (this._vectorDimention && !isNaN(this._vectorDimention)) {
            this.embeddingsProvider.dimensions = this._vectorDimention;
        }
        this._vaultConnector = ConnectorService.getVaultConnector();
        this.cusStorageKeyName = `vectorDB:customStorage:${this._vectorDBconnector.id}`;
    }

    public static load(options: { vectorDimention?: number; connectorName?: string; openaiApiKey?: string } = {}) {
        const instance = new VectorsHelper(options.connectorName, { openaiApiKey: options.openaiApiKey });
        options.vectorDimention && instance.setVectorDimention(options.vectorDimention);

        return instance;
    }

    public setVectorDimention(vectorDimention: number) {
        this._vectorDimention = vectorDimention;
    }

    public get shouldCreateNsImplicitly() {
        return !(this._vectorDBconnector instanceof SmythManagedVectorDB); // we do not create namespaces on behalf of the user on Smyth Managed VectorDB
    }

    public static async chunkText(
        text: string,
        {
            chunkSize = 4000,
            chunkOverlap = 500,
        }: {
            chunkSize?: number;
            chunkOverlap?: number;
        } = {},
    ): Promise<string[]> {
        const textSplitter = new RecursiveTextSplitter({
            chunkSize,
            chunkOverlap,
        });
        let output = await textSplitter.splitText(text);

        return output;
    }

    public async isNewNs(ac: AccessCandidate, namespace: string): Promise<boolean> {
        return !(await this._vectorDBconnector.user(ac).namespaceExists(namespace));
    }

    public async embedText(text: string) {
        return this.embeddingsProvider.embedText(text);
    }

    public async embedTexts(texts: string[]) {
        return this.embeddingsProvider.embedTexts(texts);
    }

    public static stringifyMetadata(metadata: any) {
        try {
            return jsonrepair(JSON.stringify(metadata));
        } catch (err) {
            return metadata;
        }
    }
    public static parseMetadata(metadata: any) {
        try {
            return JSON.parse(metadata);
        } catch (err) {
            return metadata;
        }
    }

    async getTeamConnector(teamId: string): Promise<VectorDBConnector | null> {
        const config = await this.getCustomStorageConfig(teamId).catch((e) => null);
        if (!config) return null;
        return this._vectorDBconnector.instance({ ...config, isCustomStorageInstance: true });
    }

    async getCustomStorageConfig(teamId: string) {
        const config = await this._vaultConnector.user(AccessCandidate.team(teamId)).get(this.cusStorageKeyName);
        if (!config) {
            // if (this._vectorDBconnector instanceof PineconeVectorDB) {
            //     // TODO: try to grab the keys from the middleware team settings (legacy storage) (required for backward compatibility)
            // }
            return null;
        }

        return JSONContentHelper.create(config).tryParse();
    }

    public async isNamespaceOnCustomStorage(teamId: string, namespace: string) {
        const ns = await this._vectorDBconnector.user(AccessCandidate.team(teamId)).getNamespace(namespace);
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
