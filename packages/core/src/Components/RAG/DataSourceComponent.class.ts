// Base class for the RAG components that handle the shared logic for the RAG components
import { EmbeddingsFactory } from '@sre/IO/VectorDB.service/embed';
import { Component } from '../Component.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { getLLMCredentials } from '@sre/LLMManager/LLM.service/LLMCredentials.helper';
import { TEmbeddings } from '@sre/IO/VectorDB.service/embed/BaseEmbedding';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { VectorDBConnector } from '@sre/IO/VectorDB.service/VectorDBConnector';
import { TLLMCredentials } from '@sre/types/LLM.types';

export type NsRecord = {
    credentialId: string;
    embeddings: { dimensions: string; modelId: string };
    label: string;
    createdAt: string;
};

export enum TDataSourceCompErrorCodes {
    NAMESPACE_NOT_FOUND = 1,
    CREDENTIAL_NOT_FOUND = 2,
    EMBEDDING_CONFIG_ERROR = 3,
}
export class DataSourceCompError extends Error {
    public code: TDataSourceCompErrorCodes;
    constructor(message: string, code: TDataSourceCompErrorCodes) {
        super(message);
        this.name = 'DataSourceCompError';
        this.code = code;
    }
}
export class DataSourceComponent extends Component {
    constructor() {
        super();
    }

    public async resolveVectorDbConnector(namespace: string | NsRecord, teamId: string): Promise<VectorDBConnector> {
        // resolve the ns record, if not exist, throw an error (new in v2)
        // then we also need to resolve the credentials
        let namespaceRecord = namespace as NsRecord;

        if (typeof namespace === 'string') {
            // if it's a string, we need to get the namespace record from the NKV
            const nkvConnector = ConnectorService.getNKVConnector();
            const nkvClient = nkvConnector.requester(AccessCandidate.team(teamId));
            const rawNsRecord = await nkvClient.get(`vectorDB:namespaces`, namespace);

            if (!rawNsRecord) {
                throw new DataSourceCompError(`Namespace ${namespace} does not exist`, TDataSourceCompErrorCodes.NAMESPACE_NOT_FOUND);
            }

            // const { credentialId, embeddings: embeddingsOptions } = JSON.parse(rawNsRecord.toString());
            namespaceRecord = JSON.parse(rawNsRecord.toString()) as NsRecord;
        }

        const accountConnector = ConnectorService.getAccountConnector();
        const accountClient = accountConnector.requester(AccessCandidate.team(teamId));
        const rawCredRecord = await accountClient.getTeamSetting(namespaceRecord.credentialId, 'vector_db_creds');
        if (!rawCredRecord) {
            throw new DataSourceCompError(
                `Credential ${namespaceRecord.credentialId} does not exist`,
                TDataSourceCompErrorCodes.CREDENTIAL_NOT_FOUND
            );
        }
        const credRecord = JSON.parse(rawCredRecord);
        await Promise.all(
            Object.keys(credRecord.credentials).map(async (key) => {
                if (typeof credRecord.credentials[key] !== 'string') return;
                credRecord.credentials[key] = await TemplateString(credRecord.credentials[key]).parseTeamKeysAsync(teamId).asyncResult;
            })
        );

        const vecDbConnector = ConnectorService.getVectorDBConnector(credRecord.provider).instance({
            credentials: credRecord.credentials,
            embeddings: await this.buildEmbeddingConfig(namespaceRecord.embeddings, teamId),
        });

        return vecDbConnector;
    }

    public async buildEmbeddingConfig(embedding: { dimensions: string; modelId: string }, teamId: string): Promise<TEmbeddings> {
        // we need to take this and return a proper TEmbeddings object

        const provider = EmbeddingsFactory.getProviderByModel(embedding.modelId as any);

        // based on the provider, we should be able to retreive the correct credentials
        const modelsProvider = ConnectorService.getModelsProviderConnector();
        const modelProviderCandidate = modelsProvider.requester(AccessCandidate.team(teamId));
        // const modelInfo = await modelProviderCandidate.getModelInfo(embedding.modelId);

        const llmCreds = await getLLMCredentials(AccessCandidate.team(teamId), {
            provider,
            modelId: embedding.modelId,
            credentials: [TLLMCredentials.Vault],
        });

        return {
            provider,
            model: embedding.modelId,
            credentials: llmCreds,
            params: {
                dimensions: parseInt(embedding.dimensions),
            },
        };
    }

    public static normalizeDsId(providedId: string, teamId: string, namespaceId: string) {
        return `${teamId}::${namespaceId}::${providedId}`;
    }
}
