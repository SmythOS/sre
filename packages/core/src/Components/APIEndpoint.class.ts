import Joi from 'joi';

import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';

import { jsonrepair } from 'jsonrepair';
import { AgentRequest } from '@sre/AgentManager/AgentRequest.class';
import { performTypeInference } from '@sre/helpers/TypeChecker.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { uid } from '../utils';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';

// Utility function to check for empty values
function isEmpty(value: any): boolean {
    return (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' && value !== null && Object.keys(value).length === 0)
    );
}
function isTemplateVar(str: string = ''): boolean {
    if (!str || typeof str !== 'string') return false;
    return (str?.match(/{{(.*?)}}/g) ?? []).length > 0;
}
function isKeyTemplateVar(str: string = ''): boolean {
    if (!str || typeof str !== 'string') return false;
    return (str?.match(/{{KEY\((.*?)\)}}/g) ?? []).length > 0;
}

function parseKey(str: string = '', teamId: string): string {
    return str.replace(/{{KEY\((.*?)\)}}/g, (match, key) => {
        return key === 'teamid' ? teamId : '';
    });
}

export class APIEndpoint extends Component {
    protected configSchema = Joi.object({
        endpoint: Joi.string()
            .pattern(/^[a-zA-Z0-9_]+([-_][a-zA-Z0-9_]+)*$/)
            .max(50)
            .required(),
        method: Joi.string().valid('POST', 'GET').allow(''), //we're accepting empty value because we consider it POST by default.
        description: Joi.string().max(5000).allow(''),
        summary: Joi.string().max(1000).allow(''),
        doc: Joi.string().max(1000).allow(''),
        ai_exposed: Joi.boolean().default(true),
        advancedModeEnabled: Joi.boolean().optional(),
        endpointLabel: Joi.string().max(100).allow('').optional(),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        if (typeof config.process === 'function') {
            //special case, APIEndpoint has a custom process method.
            //the inputs are not passed directly to APIEndpoints, we need to read them from the context.
            const contextData = agent?.agentRuntime?.getComponentData(config.id);

            const inputs = Array.isArray(contextData?.input) ? contextData?.input : [contextData?.input];

            const result = await config.process.apply(null, inputs);
            return result;
        }

        const req: AgentRequest = agent.agentRequest;
        const logger = this.createComponentLogger(agent, config);

        const isTrigger = req.path.startsWith(agent.triggerBasePath);
        const headers = req ? req.headers : {};
        let body = req && !isTrigger ? req.body : input; //handle debugger injection
        const params = req && !isTrigger ? req.params : {};
        let query = req && !isTrigger ? req.query : {};
        const _authInfo = req ? req._agent_authinfo : undefined;

        // set default value and agent variables
        const inputsWithDefaultValue = config.inputs.filter(
            (input) => input.defaultVal !== undefined && input.defaultVal !== '' && input.defaultVal !== null
        );

        const bodyInputNames: string[] = [];
        const queryInputNames: string[] = [];

        for (const output of config.outputs) {
            const outputName = output?.expression || output?.name;
            const inputName = outputName?.split('.')[1];

            if (inputName) {
                if (outputName?.includes('body')) {
                    bodyInputNames.push(inputName);
                }

                if (outputName?.includes('query')) {
                    queryInputNames.push(inputName);
                }
            }
        }

        for (const _inputWithDefaultValue of inputsWithDefaultValue) {
            const inputName = _inputWithDefaultValue?.name;

            let inputValue = input[inputName];

            // We provide a default value for the OpenAPI Schema, which can detected by Anthropic. So we need to check if the default value is an Agent Variable. This is necessary for interactions with the Chatbot.

            if (bodyInputNames.includes(inputName) && isEmpty(body[inputName])) {
                body[inputName] = inputValue;
            }

            if (queryInputNames.includes(inputName) && isEmpty(query[inputName])) {
                query[inputName] = inputValue;
            }
        }

        //override debugger injection
        // if (agent.agentRuntime.debug && body?.[0]?.dbg) { // ! 'dbg' is DEPRECATED
        const isDbgInjection = req.header('X-Debug-Inj') !== undefined;
        if (isDbgInjection && agent.agentRuntime.debug && Object.values(input).length > 0) {
            switch (config.data.method) {
                case 'GET':
                    for (const [key, value] of Object.entries(input)) {
                        if (value instanceof BinaryInput) {
                            logger.debug('[WARNING] Binary files are not supported for GET requests. Key:', key);
                        } else {
                            query[key] = value as string;
                        }
                    }
                    break;
                case 'POST':
                default:
                    body = input;
                    break;
            }
            //body = input;
        }

        // #region parse all template variables (after debugger injection and defaults are set)
        body = await resolveTemplateVariables(body, input, agent);
        query = await resolveTemplateVariables(query, input, agent);
        // #endregion parse all template variables

        // #region ensure strong data type
        body = await performTypeInference(body, config.inputs, agent);
        query = await performTypeInference(query, config.inputs, agent);
        // #endregion ensure strong data type

        // #region log inputs
        logger.debug('Parsing inputs');
        logger.debug(' Headers', headers);
        logger.debug(' Body', body);
        logger.debug(' Params', params);
        logger.debug(' Query', query);
        // #endregion log inputs

        //Handle JSON Data
        //FIXME : this is a workaround that parses any json string in the body, we should only parse the json string in the body if the data type is explicitely set to JSON
        //TODO : Add data types to APIEndpoint inputs
        logger.debug('Parsing body json input');
        for (let key in body) {
            const value = body[key];
            if (typeof value === 'string' && value.trim().startsWith('{') && value.trim().endsWith('}')) {
                try {
                    const obj = JSON.parse(jsonrepair(body[key]));
                    body[key] = obj;
                } catch {
                    //skip it if it's not a valid json
                }
            }
        }
        logger.debug('Parsed body json input', body);

        logger.debug('Parsing query json input');
        for (let key in query) {
            const value = query[key];
            if (typeof value === 'string' && value.trim().startsWith('{') && value.trim().endsWith('}')) {
                try {
                    const obj = JSON.parse(jsonrepair(query[key] as string));
                    query[key] = obj;
                } catch {
                    //skip it if it's not a valid json
                }
            }
        }
        logger.debug('Parsed query json input', query);

        //Handle binary data
        for (let input of config.inputs) {
            if (!input.isFile && !['image', 'audio', 'video', 'binary'].includes(input?.type?.toLowerCase())) continue;

            const fieldname = input.name;

            logger.debug('Parsing file input ', fieldname);

            let binaryInputs = body[fieldname];

            // Ensure we're working with an array
            if (!Array.isArray(binaryInputs)) {
                binaryInputs = [binaryInputs];
            }

            // Process each binary input
            const processedInputs = await Promise.all(
                binaryInputs.map(async (binaryInput) => {
                    if (!(binaryInput instanceof BinaryInput)) {
                        // * when data sent with 'multipart/form-data' content type, we expect the files to be in req.files
                        if (req.files?.length > 0) {
                            const file = req.files.find((file) => file.fieldname === fieldname);
                            if (!file) return null;
                            binaryInput = new BinaryInput(file.buffer, uid() + '-' + file.originalname, file.mimetype);
                        }
                    }

                    if (binaryInput instanceof BinaryInput) {
                        return await binaryInput.getJsonData(AccessCandidate.agent(agent.id));
                    }
                    return null;
                })
            );

            // Filter out null values and handle single/multiple results
            const validResults = processedInputs.filter((result) => result !== null);
            if (validResults.length > 0) {
                body[fieldname] = validResults.length === 1 ? validResults[0] : validResults;
            }
            //console.log('file', fieldname, body[fieldname]);
        }

        return { headers, body, query, params, _authInfo, _debug: logger.output };
    }

    async postProcess(output, config, agent: Agent): Promise<any> {
        if (typeof config.process === 'function') {
            return output?.result;
        }
        return output;
    }
}

async function resolveTemplateVariables(data: any, input: any, agent: Agent): Promise<any> {
    for (const [key, value] of Object.entries(data)) {
        if (isKeyTemplateVar(value as string)) {
            data[key] = await parseKey(value as string, agent.teamId);
        } else if (isTemplateVar(value as string)) {
            data[key] = TemplateString(value as string).parse(input).result;
        }
    }

    return data;
}
