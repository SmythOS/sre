// Base class for the RAG components that handle the shared logic for the RAG components
import { EmbeddingsFactory } from '@sre/IO/VectorDB.service/embed';
import { Component } from '../Component.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { getLLMCredentials } from '@sre/LLMManager/LLM.service/LLMCredentials.helper';
import { TEmbeddings } from '@sre/IO/VectorDB.service/embed/BaseEmbedding';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { VectorDBConnector } from '@sre/IO/VectorDB.service/VectorDBConnector';

export class DataSourceComponent extends Component {
    constructor() {
        super();
    }

    protected async resolveVectorDbConnector(namespaceId: string, teamId: string): Promise<VectorDBConnector> {
        // resolve the ns record, if not exist, throw an error (new in v2)
        // then we also need to resolve the credentials
        const nkvConnector = ConnectorService.getNKVConnector();
        const nkvClient = nkvConnector.requester(AccessCandidate.team(teamId));
        const rawNsRecord = await nkvClient.get(`vectorDB:namespaces`, namespaceId);

        if (!rawNsRecord) {
            throw new Error(`Namespace ${namespaceId} does not exist`);
        }

        // const { credentialId, embeddings: embeddingsOptions } = JSON.parse(rawNsRecord.toString());
        const namespaceRecord = JSON.parse(rawNsRecord.toString());
        const accountConnector = ConnectorService.getAccountConnector();
        const accountClient = accountConnector.requester(AccessCandidate.team(teamId));
        const rawCredRecord = await accountClient.getTeamSetting(namespaceRecord.credentialId, 'vector_db_creds');
        if (!rawCredRecord) {
            throw new Error(`Credential ${namespaceRecord.credentialId} does not exist`);
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

    protected async buildEmbeddingConfig(embedding: { dimensions: string; modelId: string }, teamId: string): Promise<TEmbeddings> {
        // we need to take this and return a proper TEmbeddings object

        const provider = EmbeddingsFactory.getProviderByModel(embedding.modelId as any);

        // based on the provider, we should be able to retreive the correct credentials
        const modelsProvider = ConnectorService.getModelsProviderConnector();
        const modelProviderCandidate = modelsProvider.requester(AccessCandidate.team(teamId));
        const modelInfo = await modelProviderCandidate.getModelInfo(embedding.modelId);

        const llmCreds = await getLLMCredentials(AccessCandidate.team(teamId), modelInfo);

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
