import { Component } from './Component.class';
import { IAgent as Agent } from '@sre/types/Agent.types';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

/**
 * This component allows running components that are not natively shiped with SRE
 * it can be used to extend SRE components by registering custom component using ComponentService
 */
export class ComponentHost extends Component {
    protected configSchema = null;
    constructor() {
        super();
    }
    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        //let debugLog = agent.agentRuntime?.debug ? [] : undefined;
        const logger = this.createComponentLogger(agent, config);

        try {
            const componentName = config.data._component;
            const componentConnector = ConnectorService.getComponentConnector(componentName);

            const component = await componentConnector.user(AccessCandidate.agent(agent.id)).get(componentName);

            if (!component) {
                logger.debug(`Component ${componentName} not found`);
                return { _error: `Component ${componentName} not found`, _debug: logger.output };
            }

            return await component.process(input, config, agent);
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}
