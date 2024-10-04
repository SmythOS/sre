import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import { validateCharacterSet } from '@sre/utils/validation.utils';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { isUrl, detectURLSourceType } from '../utils';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { IStorageVectorDataSource } from '@sre/types/VectorDB.types';

export default class DataSourceIndexer extends Component {
    private MAX_ALLOWED_URLS_PER_INPUT = 20;
    protected configSchema = Joi.object({
        namespace: Joi.string().max(50).allow(''),
        id: Joi.string().custom(validateCharacterSet, 'id custom validation').allow('').label('source identifier'),
        name: Joi.string().max(50).allow('').label('label'),
        metadata: Joi.string().allow(null).allow('').max(10000).label('metadata'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
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

            const namespaceId = _config.namespace;
            debugOutput += `[Selected namespace id] \n${namespaceId}\n\n`;

            const vectorDBHelper = VectorsHelper.load();
            const vectorDbConnector = ConnectorService.getVectorDBConnector();
            const nsExists = await vectorDbConnector.user(AccessCandidate.team(teamId)).namespaceExists(namespaceId);

            if (!nsExists) {
                throw new Error(`Namespace ${namespaceId} does not exist`);
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

            // check if the datasource already exists with the same id
            // await this.checkForRecordDuplicate(dsId, token);

            let indexRes: any = null;
            let parsedUrlArray: string[] | null = null;

            //! DISABLE URL ARRAY PARSING FOR NOW UNTIL WE HAVE A GOOD WAY TO HANDLE BULK INDEXING
            // if ((parsedUrlArray = parseUrlArray(inputSchema.value.Source))) {
            //     debugOutput += `STEP: Parsing input as url array\n\n`;
            //     if (parsedUrlArray.length > this.MAX_ALLOWED_URLS_PER_INPUT) {
            //         throw new Error(`Too many urls in input. Max allowed: ${this.MAX_ALLOWED_URLS_PER_INPUT}`);
            //     }

            //     for (let url of parsedUrlArray) {
            //         indexRes = await this.addDSFromUrl({
            //             teamId,
            //             namespaceId,
            //             dsId, // WILL OVERRIDE EACH OTHER
            //             type: detectURLSourceType(url),
            //             url,
            //             name: _config.name || 'Untitled',
            //         });

            //         debugOutput += `STEP: Created datasource for url: ${url}\n\n`;
            //     }
            // } else

            const dsId = DataSourceIndexer.genDsId(providedId, teamId, namespaceId);

            if (isUrl(inputSchema.value.Source)) {
                debugOutput += `STEP: Parsing input as url\n\n`;
                throw new Error('URLs are not supported yet');
                // indexRes = await this.addDSFromUrl({
                //     teamId,
                //     namespaceId,
                //     dsId,
                //     type: detectURLSourceType(inputSchema.value.Source),
                //     url: inputSchema.value.Source,
                //     name: _config.name || 'Untitled',
                //     metadata: _config.metadata || null,
                // });
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

    validateInput(input: any) {
        return Joi.object({
            Source: Joi.any().required(),
        })
            .unknown(true)
            .validate(input);
    }

    private async addDSFromText({ teamId, sourceId, namespaceId, text, name, metadata }) {
        let vectorDBHelper = VectorsHelper.load();
        let vectorDbConnector = ConnectorService.getVectorDBConnector();
        const isOnCustomStorage = await vectorDBHelper.isNamespaceOnCustomStorage(teamId, namespaceId);
        if (isOnCustomStorage) {
            vectorDbConnector = await vectorDBHelper.getTeamConnector(teamId);
        }
        const id = await vectorDbConnector.user(AccessCandidate.team(teamId)).createDatasource(namespaceId, {
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
