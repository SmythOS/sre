import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';
import Joi from 'joi';
import { validateCharacterSet } from '@sre/utils/validation.utils';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { isUrl, detectURLSourceType } from '../utils';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';

import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TEmbeddings } from '@sre/IO/VectorDB.service/embed/BaseEmbedding';
import { EmbeddingsFactory, SupportedModels } from '@sre/IO/VectorDB.service/embed';
import { getLLMCredentials } from '@sre/LLMManager/LLM.service/LLMCredentials.helper';

export class DataSourceIndexer extends Component {
    private MAX_ALLOWED_URLS_PER_INPUT = 20;
    protected configSchema = Joi.object({
        namespace: Joi.string().max(50).allow(''),
        id: Joi.string().custom(validateCharacterSet, 'id custom validation').allow('').label('source identifier'),
        name: Joi.string().max(50).allow('').label('label'),
        metadata: Joi.string().allow(null).allow('').max(10000).label('metadata'),
        chunkSize: Joi.number().optional(),
        chunkOverlap: Joi.number().optional(),
        version: Joi.string().valid('v1', 'v2').default('v1'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        let response: any = null;
        if (!config.data.version || config.data.version === 'v1') {
            response = await this.processV1(input, config, agent);
        } else if (config.data.version === 'v2') {
            response = await this.processV2(input, config, agent);
        }

        return response;
    }

    private async processV1(input, config, agent: Agent) {
        const teamId = agent.teamId;
        const agentId = agent.id;
        let debugOutput = agent.agentRuntime?.debug ? '== Source Indexer Log ==\n' : null;

        try {
            const _config = {
                ...config.data,
                name: TemplateString(config.data.name).parse(input).result,
                id: TemplateString(config.data.id).parse(input).result,
                metadata: TemplateString(config.data.metadata).parse(input).result,
            };

            const outputs = {};
            for (let con of config.outputs) {
                if (con.default) continue;
                outputs[con.name] = con?.description ? `<${con?.description}>` : '';
            }

            const namespaceId = _config.namespace.split('_').slice(1).join('_') || _config.namespace;
            debugOutput += `[Selected namespace id] \n${namespaceId}\n\n`;

            const vectorDbConnector =
                // (await vectorDBHelper.getTeamConnector(teamId)) ||
                ConnectorService.getVectorDBConnector();
            const nsExists = await vectorDbConnector.requester(AccessCandidate.team(teamId)).namespaceExists(namespaceId);

            if (!nsExists) {
                const newNs = await vectorDbConnector.requester(AccessCandidate.team(teamId)).createNamespace(namespaceId);
                debugOutput += `[Created namespace] \n${newNs}\n\n`;
            }

            const inputSchema = this.validateInput(input);
            if (inputSchema.error) {
                throw new Error(`Input validation error: ${inputSchema.error}\n EXITING...`);
            }

            const providedId = _config.id;
            // const isAutoId = _config.isAutoId;
            const idRegex = /^[a-zA-Z0-9\-\_\.]+$/;

            if (!providedId) {
                // Assign a new ID if it's set to auto-generate or not provided
                // _config.id = crypto.randomBytes(16).toString('hex');
                throw new Error(`Id is required`);
            } else if (!idRegex.test(providedId)) {
                // Validate the provided ID if it's not auto-generated
                throw new Error(`Invalid id. Accepted characters: 'a-z', 'A-Z', '0-9', '-', '_', '.'`);
            }

            let indexRes: any = null;
            let parsedUrlArray: string[] | null = null;
            const dsId = DataSourceIndexer.genDsId(providedId, teamId, namespaceId);

            if (isUrl(inputSchema.value.Source)) {
                debugOutput += `STEP: Parsing input as url\n\n`;
                throw new Error('URLs are not supported yet');
            } else {
                debugOutput += `STEP: Parsing input as text\n\n`;
                indexRes = await this.addDSFromText({
                    teamId,
                    namespaceId: namespaceId,
                    text: inputSchema.value.Source,
                    name: _config.name || 'Untitled',
                    metadata: _config.metadata || null,
                    sourceId: dsId,
                });
            }

            debugOutput += `Created datasource successfully\n\n`;

            return {
                _debug: debugOutput,
                Success: {
                    result: indexRes?.data?.dataSource || true,
                    id: _config.id,
                },
                // _error,
            };
        } catch (err: any) {
            debugOutput += `Error: ${err?.message || "Couldn't index data source"}\n\n`;
            return {
                _debug: debugOutput,
                _error: err?.message || "Couldn't index data source",
            };
        }
    }

    private async processV2(input, config, agent: Agent) {
        const teamId = agent.teamId;
        const agentId = agent.id;
        let debugOutput = agent.agentRuntime?.debug ? '== Source Indexer Log ==\n' : null;

        try {
            const _config = {
                ...config.data,
                name: TemplateString(config.data.name).parse(input).result,
                id: TemplateString(config.data.id).parse(input).result,
                metadata: TemplateString(config.data.metadata).parse(input).result,
            };

            const outputs = {};
            for (let con of config.outputs) {
                if (con.default) continue;
                outputs[con.name] = con?.description ? `<${con?.description}>` : '';
            }

            // we try to get the namespace without the prefix teamId, if not exist, we use the full namespace id
            const namespaceLabel = _config.namespace.split('_').slice(1).join('_') || _config.namespace;
            const namespaceId = _config.namespace;
            debugOutput += `[Selected namespace] \n${namespaceLabel}\n\n`;

            // resolve the ns record, if not exist, throw an error (new in v2)
            // then we also need to resolve the credentials
            const nkvConnector = ConnectorService.getNKVConnector();
            const nkvClient = nkvConnector.requester(AccessCandidate.team(teamId));
            const rawNsRecord = await nkvClient.get(`vectorDB:namespaces`, namespaceId);

            if (!rawNsRecord) {
                return {
                    _debug: debugOutput,
                    _error: `Namespace ${namespaceLabel} does not exist`,
                };
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
                embeddings: await this.transformEmbedding(namespaceRecord.embeddings, config.data, teamId),
            });
            const vecDbClient = vecDbConnector.requester(AccessCandidate.team(teamId));

            const inputSchema = this.validateInput(input);
            if (inputSchema.error) {
                throw new Error(`Input validation error: ${inputSchema.error}\n EXITING...`);
            }

            const providedId = _config.id;
            // const isAutoId = _config.isAutoId;
            const idRegex = /^[a-zA-Z0-9\-\_\.]+$/;

            if (!providedId) {
                // Assign a new ID if it's set to auto-generate or not provided
                // _config.id = crypto.randomBytes(16).toString('hex');
                throw new Error(`Id is required`);
            } else if (!idRegex.test(providedId)) {
                // Validate the provided ID if it's not auto-generated
                throw new Error(`Invalid id. Accepted characters: 'a-z', 'A-Z', '0-9', '-', '_', '.'`);
            }

            const dsId = DataSourceIndexer.genDsId(providedId, teamId, namespaceLabel);

            debugOutput += `STEP: Parsing input as text\n\n`;

            const response = await vecDbClient.createDatasource(namespaceLabel, {
                text: inputSchema.value.Source,
                metadata: _config.metadata || null,
                id: dsId,
                label: _config.name || 'Untitled',
            });

            debugOutput += `Created datasource successfully\n\n`;

            return {
                _debug: debugOutput,
                Success: {
                    result: response || true,
                    id: _config.id,
                },
                // _error,
            };
        } catch (err: any) {
            debugOutput += `Error: ${err?.message || "Couldn't index data source"}\n\n`;
            return {
                _debug: debugOutput,
                _error: err?.message || "Couldn't index data source",
            };
        }
    }

    private async transformEmbedding(embedding: { dimensions: string; modelId: string }, data: any, teamId: string): Promise<TEmbeddings> {
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
                chunkSize: data.chunkSize,
            },
        };
    }

    validateInput(input: any) {
        return Joi.object({
            Source: Joi.any().required(),
        })
            .unknown(true)
            .validate(input);
    }

    private async addDSFromText({ teamId, sourceId, namespaceId, text, name, metadata }) {
        let vectorDbConnector = ConnectorService.getVectorDBConnector();
        // const isOnCustomStorage = await vectorDBHelper.isNamespaceOnCustomStorage(teamId, namespaceId);
        // if (isOnCustomStorage) {
        // const customTeamConnector = await vectorDBHelper.getTeamConnector(teamId);
        // if (customTeamConnector) {
        // vectorDbConnector = customTeamConnector;
        // }
        // }
        const id = await vectorDbConnector.requester(AccessCandidate.team(teamId)).createDatasource(namespaceId, {
            text,
            metadata,
            id: sourceId,
            label: name,
        });

        return id;
    }

    public static genDsId(providedId: string, teamId: string, namespaceId: string) {
        return `${teamId}::${namespaceId}::${providedId}`;
    }

    private async addDSFromUrl({ teamId, namespaceId, dsId, type, url, name, metadata }) {
        throw new Error('URLs are not supported yet');
    }
}
