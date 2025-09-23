import Joi from 'joi';

import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { ICacheRequest } from '@sre/MemoryManager/Cache.service/CacheConnector';

export class MemoryWriteObject extends Component {
    protected configSchema = Joi.object({
        memoryName: Joi.string().max(255).allow('').label('Memory Name'),
        scope: Joi.string().max(20).allow('').label('Scope'),
        ttl: Joi.number().min(300).max(604800).allow('').label('TTL'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);

        try {
            const cacheConnector = ConnectorService.getCacheConnector();
            const connectorRequester: ICacheRequest = cacheConnector.agent(agent.id);
            const teamId = agent.teamId;
            const agentId = agent.id;

            const memoryName = config.data.memoryName;
            const dataString = input.Data;
            const scope = config.data.scope;
            const ttl = scope === 'ttl' ? config?.data?.ttl : 3 * 60 * 60; // 3 hours default ttl

            // Parse the JSON data
            let dataObject;
            try {
                dataObject = typeof dataString === 'object' ? dataString : JSON.parse(dataString);
            } catch (parseError) {
                return { _error: 'Invalid JSON data provided', _debug: logger.output };
            }

            // Validate that the parsed data is an object
            if (typeof dataObject !== 'object' || dataObject === null || Array.isArray(dataObject)) {
                return { _error: 'Data must be a valid JSON object', _debug: logger.output };
            }

            const sessionId = agent.sessionId;
            const workflowId = agent.agentRuntime.workflowReqId;

            let scopeKey = '';
            if (scope === 'session') {
                scopeKey = sessionId;
            } else if (scope === 'request') {
                scopeKey = workflowId;
            } else if (scope === 'ttl') {
                scopeKey = 'ttl';
            }

            // Get all keys from the data object
            const keys = Object.keys(dataObject);
            logger.debug(`Writing ${keys.length} key-value pairs to memory`);

            // Create promises for parallel execution
            const writePromises = keys.map(async (key) => {
                const value = String(dataObject[key]); // Convert value to string

                // Write scope metadata
                const scopeKeyId = `${agentId}:${memoryName}:${key}_scope`;
                const scopePromise = connectorRequester.set(scopeKeyId, JSON.stringify({ scope, value: scopeKey }), null, null, ttl);

                // Write actual value
                const fullKey = `${agentId}:${scopeKey}:${memoryName}:${key}`;
                const valuePromise = connectorRequester.set(fullKey, value, null, null, ttl);

                // Wait for both operations to complete for this key
                await Promise.all([scopePromise, valuePromise]);

                return { key, success: true };
            });

            // Execute all write operations in parallel
            const results = await Promise.all(writePromises);
            const successfulKeys = results.filter((result) => result.success).map((result) => result.key);

            logger.debug(`Successfully wrote ${successfulKeys.length} keys to memory`);

            return {
                Keys: successfulKeys,
                Count: successfulKeys.length,
                _debug: logger.output,
            };
        } catch (error: any) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}
