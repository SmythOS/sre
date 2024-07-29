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
            // await this.checkIfTeamOwnsNamespace(teamId, namespaceId, token);

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

            const dsId = this.generateContextUID(_config.id, teamId, namespaceId);

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
                    namespaceId,
                    dsId,
                    text: inputSchema.value.Source,
                    name: _config.name || 'Untitled',
                    metadata: _config.metadata || null,
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

    public generateContextUID(providedId: string, teamId: string, namespaceId: string) {
        return `${teamId}::${namespaceId}::${providedId}`;
    }

    private parseContextUID(uid: string) {
        if (!uid) return null;
        const parts = uid.split('::');
        if (parts.length != 3) return null;
        return {
            teamId: parts[0],
            agentId: parts[1],
            providedId: parts[2],
        };
    }

    private async addDSFromText({ teamId, namespaceId, dsId, text, name, metadata }) {
        const ids = await VectorsHelper.load().ingestText(text, namespaceId, {
            teamId,
            metadata,
        });

        const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        const dsData: IStorageVectorDataSource = {
            namespaceId,
            teamId,
            name,
            metadata,
            text,
            embeddingIds: ids,
        };
        await SmythFS.Instance.write(url, JSON.stringify(dsData), AccessCandidate.team(teamId));
    }

    private async addDSFromUrl({ teamId, namespaceId, dsId, type, url, name, metadata }) {
        throw new Error('URLs are not supported yet');
        // try {
        //     const res = await SmythAPIHelper.fromAuth(token).mwSysAPI.post(`/vectors/datasources`, {
        //         type,
        //         url,
        //         name,
        //         metadata,
        //         id: dsId,
        //         namespaceId,
        //         teamId,
        //     });

        //     return res;
        // } catch (err: any) {
        //     console.log(err?.response?.data);
        //     throw new Error(err?.response?.data?.message || 'Error creating datasource');
        // }
    }

    // private async checkIfTeamOwnsNamespace(teamId: string, namespaceId: string, token: string) {
    //     try {
    //         const res = await SmythAPIHelper.fromAuth({ token }).mwSysAPI.get(`/vectors/namespaces/${namespaceId}`);
    //         if (res.data?.namespace?.teamId !== teamId) {
    //             throw new Error(`Namespace does not exist`);
    //         }
    //         return true;
    //     } catch (err) {
    //         throw new Error(`Namespace does not exist`);
    //     }
    // }

    // private async checkForRecordDuplicate(dsId: string, token: string) {
    //     try {
    //         // try to delete the datasource if it exists
    //         const res = await SmythAPIHelper.fromAuth({ token }).mwSysAPI.delete(`/vectors/datasources/${dsId}`);
    //     } catch (err) {}
    // }
}
