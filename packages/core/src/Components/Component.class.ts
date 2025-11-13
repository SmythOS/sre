import Joi from 'joi';
import { IAgent as Agent } from '@sre/types/Agent.types';
import { Logger } from '@sre/helpers/Log.helper';
import { performTypeInference } from '@sre/helpers/TypeChecker.helper';
import { hookableClass, hookAsync } from '@sre/Core/HookService';

export type TComponentSchema = {
    name: string;
    settings?: Record<string, any>;
    inputs?: Record<string, any>;
    outputs?: Record<string, any>;
};

export enum ComponentInputType {
    Any = 'Any',
    Binary = 'Binary',
    String = 'Text',
    Text = 'Text',
    Image = 'Image',
    Video = 'Video',
    Number = 'Number',
    Integer = 'Integer',
    Boolean = 'Boolean',
    Date = 'Date',
    Array = 'Array',
    Object = 'Object',
}

@hookableClass
export class Component {
    public hasReadOutput = false;
    public hasPostProcess = true;
    public alwaysActive = false; //for components like readable memories
    public exclusive = false; //for components like writable memories : when exclusive components are active, they are processed in a run cycle bofore other components
    protected schema: TComponentSchema = {
        name: 'Component',
        settings: {},
        inputs: {},
        //outputs: {},
    };
    protected configSchema;
    constructor() {}
    init() {}

    createComponentLogger(agent: Agent, configuration: any) {
        const logger = Logger((configuration.name || this.constructor.name) + `,agent<${agent.id}>`, agent?.agentRuntime?.debug);

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

    /**
     * Filters config data to only include properties that are defined in the schema
     */
    private filterConfigBySchema(data: any, schema: any): any {
        if (!schema || !data) return data;

        const schemaDescription = schema.describe();

        // If it's not an object schema, return data as-is
        if (schemaDescription.type !== 'object' || !schemaDescription.keys) {
            return data;
        }

        const allowedKeys = Object.keys(schemaDescription.keys);
        const filteredData: any = {};

        // Only include properties that are defined in the schema
        for (const key of allowedKeys) {
            if (key in data) {
                filteredData[key] = data[key];
            }
        }

        // Preserve _templateVars if it exists (special case)
        if (data._templateVars) {
            filteredData._templateVars = data._templateVars;
        }

        return filteredData;
    }

    async validateConfig(config) {
        if (!this.configSchema) return {};

        let workingSchema = this.configSchema;

        if (config.data._templateVars) {
            //Accept dynamically added template data
            for (let tplVar in config.data._templateVars) {
                workingSchema = workingSchema.append({ [tplVar]: Joi.any() });
            }
        }

        // Filter config.data to only include properties defined in the schema
        const filteredData = this.filterConfigBySchema(config.data, workingSchema);

        const valid = await workingSchema.validate(filteredData);
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
            if (!agent.agentRuntime?.debug) delete output?.result?._debug;

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

    /**
     * A generic registration function that can be overridden by child classes to register the trigger with providers
     * this function is usually called outside of a workflow in order to register the trigger with providers
     * @param componentId the id of the component to register (in SRE a single trigger instance handles all the triggers of the same type)
     * @param agent the agent instance
     * @param payload any additional payload to pass to the trigger
     */
    async register(componentId: string, componentSettings: any, payload?: any) {}

    async unregister(componentId: string, componentSettings: any, payload?: any) {}
}
