import Joi from 'joi';
import { Agent } from '@sre/AgentManager/Agent.class';
import { Logger } from '@sre/helpers/Log.helper';
import { performTypeInference } from '@sre/helpers/TypeChecker.helper';
import { hookAsync } from '@sre/Core/HookService';
export class Component {
    public hasReadOutput = false;
    public hasPostProcess = true;
    public alwaysActive = false; //for components like readable memories
    public exclusive = false; //for components like writable memories : when exclusive components are active, they are processed in a run cycle bofore other components
    protected configSchema;
    constructor() {}
    init() {}

    createComponentLogger(agent: Agent, configuration: any) {
        const logger = Logger(configuration.name || this.constructor.name, agent?.agentRuntime?.debug);

        logger.on('logged', (info: { level: string; message: string }) => {
            if (agent.sse && configuration.eventId) {
                agent.sse.send('component', {
                    eventId: configuration.eventId,
                    action: 'log',
                    name: configuration.name || this.constructor.name,
                    title: configuration.title,
                    logs: [{ level: info.level, message: info.message }],
                });
            }
        });
        return logger;
    }

    async validateConfig(config) {
        if (!this.configSchema) return {};
        if (config.data._templateVars) {
            //Accept dynamically added template data
            for (let tplVar in config.data._templateVars) {
                this.configSchema = this.configSchema.append({ [tplVar]: Joi.any() });
            }
        }
        const valid = await this.configSchema.validate(config.data);
        if (valid.error) {
            return {
                id: config.id,
                name: config.name,
                _error: `Schema Validation error: ${valid?.error?.message} on component ${config.displayName}:${config.title}`,
                _debug: `Schema Validation error: ${valid?.error?.message} on component ${config.displayName}:${config.title}`,
            };
        }

        return {};
    }

    @hookAsync('Component.process')
    async process(input, config, agent: Agent): Promise<any> {
        if (agent.isKilled()) {
            throw new Error('Agent killed');
        }
        const _input = await performTypeInference(input, config?.inputs, agent);

        // modify the input object for component's process method
        for (const [key, value] of Object.entries(_input)) {
            input[key] = value;
        }
    }
    async postProcess(output, config, agent: Agent): Promise<any> {
        if (output?.result) {
            delete output?.result?._debug;
            if (!output?.result?._error) delete output?.result?._error;
        }
        return output;
    }
    async enable(config, agent: Agent): Promise<any> {}
    async disable(config, agent: Agent): Promise<any> {}
    readOutput(id, config, agent: Agent): any {
        return null;
    }
    hasOutput(id, config, agent: Agent): any {
        return false;
    }
}
