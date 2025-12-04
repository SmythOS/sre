import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from '../Component.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import Joi from 'joi';
import { validateCharacterSet } from '../../utils';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

import { DataSourceIndexer } from './DataSourceIndexer.class';
import { DataSourceComponent } from './DataSourceComponent.class';
import { VectorDBConnector } from '@sre/IO/VectorDB.service/VectorDBConnector';

export class DataSourceCleaner extends DataSourceComponent {
    protected configSchema = Joi.object({
        namespaceId: Joi.string().max(50).allow('').label('namespace'),
        id: Joi.string().custom(validateCharacterSet, 'custom validation characterSet').allow('').label('source identifier'),
        version: Joi.string().valid('v1', 'v2').default('v1'),
    });
    constructor() {
        super();
    }
    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        if (!config.data.version || config.data.version === 'v1') {
            return await this.processV1(input, config, agent);
        } else if (config.data.version === 'v2') {
            return await this.processV2(input, config, agent);
        }
    }
    async processV1(input, config, agent: Agent) {
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

            // const namespaceId = configSchema.value.namespaceId.split('_')?.slice(1).join('_') || configSchema.value.namespaceId;
            const namespaceId = /^c[a-z0-9]{24}.+$/.test(configSchema.value.namespaceId)
                ? configSchema.value.namespaceId.split('_').slice(1).join('_')
                : configSchema.value.namespaceId;

            let vectorDbConnector = ConnectorService.getVectorDBConnector();

            let existingnamespace = await vectorDbConnector.requester(AccessCandidate.team(teamId)).namespaceExists(namespaceId);
            if (!existingnamespace) {
                throw new Error(`Namespace ${namespaceId} does not exist`);
            }

            const providedId = TemplateString(config.data.id).parse(input).result;
            const idRegex = /^[a-zA-Z0-9\-\_\.]+$/;
            if (!idRegex.test(providedId)) {
                throw new Error(`Invalid id. Accepted characters: 'a-z', 'A-Z', '0-9', '-', '_', '.'`);
            }
            debugOutput += `Searching for data source with id: ${providedId}\n`;

            const dsId = DataSourceIndexer.normalizeDsId(providedId, teamId, namespaceId);

            await vectorDbConnector.requester(AccessCandidate.team(teamId)).deleteDatasource(namespaceId, dsId);

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

    async processV2(input, config, agent: Agent) {
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

            // const namespaceId = configSchema.value.namespaceId.split('_')?.slice(1).join('_') || configSchema.value.namespaceId;
            const namespaceLabel = /^c[a-z0-9]{24}.+$/.test(configSchema.value.namespaceId)
                ? configSchema.value.namespaceId.split('_').slice(1).join('_')
                : configSchema.value.namespaceId;
            const namespaceId = configSchema.value.namespaceId;

            let vecDbConnector: VectorDBConnector = null;
            try {
                vecDbConnector = await this.resolveVectorDbConnector(namespaceId, teamId);
            } catch (err: any) {
                debugOutput += `Error: ${err?.message || "Couldn't get vector database connector"}\n\n`;
                return {
                    _debug: debugOutput,
                    _error: err?.message || "Couldn't get vector database connector",
                };
            }

            // let existingnamespace = await vecDbConnector.requester(AccessCandidate.team(teamId)).namespaceExists(namespaceId);
            // if (!existingnamespace) {
            //     throw new Error(`Namespace ${namespaceId} does not exist`);
            // }

            const providedId = TemplateString(config.data.id).parse(input).result;
            const idRegex = /^[a-zA-Z0-9\-\_\.]+$/;
            if (!idRegex.test(providedId)) {
                throw new Error(`Invalid id. Accepted characters: 'a-z', 'A-Z', '0-9', '-', '_', '.'`);
            }
            debugOutput += `Searching for data source with id: ${providedId}\n`;

            const dsId = DataSourceComponent.normalizeDsId(providedId, teamId, namespaceLabel);

            await vecDbConnector.requester(AccessCandidate.team(teamId)).deleteDatasource(namespaceLabel, dsId);

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
