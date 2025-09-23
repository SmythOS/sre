import Joi from 'joi';

import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { ICacheRequest } from '@sre/MemoryManager/Cache.service/CacheConnector';

const memory = {};
export class MemoryReadKeyVal extends Component {
    protected configSchema = Joi.object({
        memoryName: Joi.string().max(255).allow('').label('Memory Name'),
        key: Joi.string().max(255).allow('').label('Key'),
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

            const key = TemplateString(config.data.key).parse(input).result;

            const sessionId = agent.sessionId;
            const workflowId = agent.agentRuntime.workflowReqId;

            logger.debug(`Reading Scope Data`);
            const scopeKeyId = `${agentId}:${memoryName}:${key}_scope`;
            const scopeStrData = await connectorRequester.get(scopeKeyId);

            if (!scopeStrData) {
                return { _warning: 'key not found', _debug: logger.output };
            }

            logger.debug(`Checking Scope`);
            const scopeData = JSON.parse(scopeStrData);
            const scopeKey = scopeData.value;
            if (scopeData.scope === 'session' && scopeKey !== sessionId) {
                return { _warning: 'key not found', _debug: logger.output };
            }

            if (scopeData.scope === 'request' && scopeKey !== workflowId) {
                return { _warning: 'key not found', _debug: logger.output };
            }

            logger.debug(`Reading Value`);

            const fullKey = `${agentId}:${scopeKey}:${memoryName}:${key}`;

            const value = await connectorRequester.get(fullKey);

            return { Value: value, _debug: logger.output };
        } catch (error: any) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}
