import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import Joi from 'joi';
import { validateCharacterSet } from '../utils';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';
import { JSONContent, JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { IStorageVectorDataSource } from '@sre/types/VectorDB.types';
import { VectorsHelper } from '@sre/helpers/Vectors.helper';
import { DataSourceIndexer } from './DataSourceIndexer.class';
import { SmythManagedVectorDB } from '@sre/IO/VectorDB.service/connectors/SmythManagedVectorDB.class';

export class DataSourceCleaner extends Component {
    protected configSchema = Joi.object({
        namespaceId: Joi.string().max(50).allow('').label('namespace'),
        id: Joi.string().custom(validateCharacterSet, 'custom validation characterSet').allow('').label('source identifier'),
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
            const configSchema = this.validateConfigData(config.data);
            if (configSchema.error) {
                throw new Error(`Config data validation error: ${configSchema.error}\n EXITING...`);
            }

            const outputs = {};
            for (let con of config.outputs) {
                if (con.default) continue;
                outputs[con.name] = con?.description ? `<${con?.description}>` : '';
            }

            const inputSchema = this.validateInput(input);
            if (inputSchema.error) {
                throw new Error(`Input validation error: ${inputSchema.error}\n EXITING...`);
            }

            const namespaceId = configSchema.value.namespaceId.split('_')?.slice(1).join('_') || configSchema.value.namespaceId;
            let vectorDBHelper = VectorsHelper.load();

            const customStorageConnector = await vectorDBHelper.getTeamConnector(teamId);
            let vectorDbConnector = customStorageConnector || ConnectorService.getVectorDBConnector();

            let existingnamespace = await vectorDbConnector.user(AccessCandidate.team(teamId)).getNamespace(namespaceId);
            if (!existingnamespace) {
                if (!vectorDBHelper.shouldCreateNsImplicitly) {
                    throw new Error(`Namespace ${namespaceId} does not exist`);
                }
                await vectorDbConnector.user(AccessCandidate.team(teamId)).createNamespace(namespaceId);
                debugOutput += `[Created namespace] \n${namespaceId}\n\n`;
            } else if (!existingnamespace.metadata.isOnCustomStorage) {
                // If the namespace exists but is not on custom storage, switch to the default connector.
                vectorDbConnector = ConnectorService.getVectorDBConnector();
            }

            const providedId = TemplateString(config.data.id).parse(input).result;
            const idRegex = /^[a-zA-Z0-9\-\_\.]+$/;
            if (!idRegex.test(providedId)) {
                throw new Error(`Invalid id. Accepted characters: 'a-z', 'A-Z', '0-9', '-', '_', '.'`);
            }
            debugOutput += `Searching for data source with id: ${providedId}\n`;

            const dsId = DataSourceIndexer.genDsId(providedId, teamId, namespaceId);

            await vectorDbConnector.user(AccessCandidate.team(teamId)).deleteDatasource(namespaceId, dsId);

            debugOutput += `Deleted data source with id: ${providedId}\n`;

            return {
                _debug: debugOutput,
                Success: true,
                // _error,
            };
        } catch (err: any) {
            debugOutput += `Failed to delete data source: \n Error: ${err?.message}\n`;

            return {
                _debug: debugOutput,
                _error: err?.message || "Couldn't delete data source",
            };
        }
    }

    validateInput(input: any) {
        return Joi.object({}).unknown(true).validate(input);
    }

    validateConfigData(data: any) {
        return Joi.object({
            namespaceId: Joi.string().required(),
            id: Joi.string().optional().allow('').allow(null),
        })
            .unknown(true)
            .validate(data);
    }
}
