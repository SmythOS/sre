import { HfInference } from '@huggingface/inference';
import { Component } from './Component.class';
import { IAgent as Agent } from '@sre/types/Agent.types';
import hfParams from '../data/hugging-face.params.json';
import Joi from 'joi';
import { TemplateStringHelper } from '@sre/helpers/TemplateString.helper';
import { convertStringToRespectiveType, delay, isBase64, kebabToCapitalize, kebabToCamel } from '../utils';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

function shouldNestInputs(formatRequestPattern) {
    const trimmedPattern = formatRequestPattern?.trim();
    return /^(inputs|data):\s*{(?![{])/.test(trimmedPattern);
}

function validateAndParseJson(value, helpers) {
    let parsedJson: any = null;

    // Try parsing the JSON string
    try {
        parsedJson = JSON.parse(value);
    } catch (error) {
        // If parsing fails, return an error
        return helpers.error('string.invalidJson', { value });
    }

    // Check if the result is an object
    if (typeof parsedJson !== 'object' || parsedJson === null) {
        return helpers.error('string.notJsonObject', { value });
    }

    // Check for empty keys
    for (const key in parsedJson) {
        if (key.trim() === '') {
            return helpers.error('object.emptyKey', { value });
        }
    }

    // Return the parsed JSON if all validations pass
    return parsedJson;
}

export class HuggingFace extends Component {
    protected configSchema = Joi.object({
        accessToken: Joi.string().max(350).required().label('Access Token'),
        modelName: Joi.string().max(100).required(),
        modelTask: Joi.string().max(100).required(),
        inputConfig: Joi.string().allow(''),
        parameters: Joi.string().custom(validateAndParseJson, 'custom JSON validation').allow(''),
        name: Joi.string().max(100).required(),
        displayName: Joi.string().max(100).required(),
        desc: Joi.string().max(5000).required().allow(''),
        logoUrl: Joi.string().max(500).allow(''),
        disableCache: Joi.boolean().strict(),
    });
    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);

        logger.debug(`=== Hugging Face Log ===`);

        const agentId = agent?.id;

        const teamId = agent?.teamId;
        // const accessToken = await parseKey(config?.data?.accessToken, teamId);
        const accessToken = (await TemplateStringHelper.create(config?.data?.accessToken).parseTeamKeysAsync(teamId).asyncResult) as string;

        if (!accessToken) {
            return { _error: 'Please provide a valid Hugging Face Access Token', _debug: logger.output };
        }

        const hf = new HfInference(accessToken);

        const task = config?.data?.modelTask;

        if (!task) {
            return { _error: 'Hugging Face Task is required!', _debug: logger.output };
        }

        logger.debug(`Task: ${kebabToCapitalize(task)}`);

        let hfFunc = kebabToCamel(task);

        // * Right now 'text2textGeneration' function is not available, so we are using 'textGeneration' for it.
        // Reference - https://huggingface.co/docs/api-inference/en/detailed_parameters#text2text-generation-task
        if (hfFunc === 'text2textGeneration') {
            hfFunc = 'textGeneration';
        }

        if (!hf?.[hfFunc]) {
            return { _error: `Inference API does not support for this task - ${kebabToCapitalize(task)}`, _debug: logger.output };
        }

        const modelName = config?.data?.modelName;

        if (!modelName) {
            return { _error: 'Hugging Face Model is required!', _debug: logger.output };
        }

        logger.debug(`Model Name: ${modelName}`);

        //const inputConfig = JSON.parse(config?.data?.inputConfig || '{}');

        let inputConfig: any = {};
        const formatRequest = hfParams?.[task]?.formatRequest;
        const _hfParams = hfParams?.[task]?.inputs;
        if (_hfParams && Object.keys(_hfParams).length > 0) {
            for (const key in _hfParams) {
                const config = _hfParams[key];
                inputConfig[key] = config;
            }
            if (typeof inputConfig === 'object' && inputConfig !== null) {
                inputConfig = { ...inputConfig, formatRequest };
            }
        }

        if (!inputConfig || Object.keys(inputConfig)?.length === 0) {
            console.log('No inputs config found for Hugging Face Model!');
        }

        let inputs = {};

        if (!input || Object.keys(input)?.length === 0) {
            return { _error: 'Please provide a valid input!', _debug: logger.output };
        }

        if (typeof input !== 'object') {
            return { _error: 'Invalid input!', _debug: logger.output };
        }

        if (typeof input == 'object' && Object.keys(input)?.length > 0) {
            for (const key in input) {
                if (inputConfig?.[key]) {
                    let value = input[key];
                    let name = inputConfig[key]['request_parameter_name'];
                    let type = inputConfig[key]['request_parameter_type'];

                    if (type && type?.includes('Blob')) {
                        try {
                            // const file = new SmythFile(value);
                            // const blob = await file.toBlob(); // Converts to Blob for file inputs
                            // inputs[name] = blob;
                            const binaryFile = BinaryInput.from(value, undefined, undefined, AccessCandidate.agent(agentId));
                            // const buffer = await binaryFile.readData(AccessCandidate.agent(agentId));
                            const buffer = await binaryFile.getBuffer();
                            const blob = new Blob([buffer as any]);
                            inputs[name] = blob;
                        } catch (error: any) {
                            return { _error: error?.message || JSON.stringify(error), _debug: logger.output };
                        }
                    } else {
                        inputs[name] = value;
                    }
                }
            }
        }
        // Determine if inputs should be nested based on formatRequest
        const nestInputs = shouldNestInputs(inputConfig.formatRequest);
        // Apply the determined structure to newInputs
        const structuredInputs = nestInputs ? { inputs } : inputs;

        // Blob data will be converted to an empty object '{}', when stringified during logging. We need log something so that user can understand that it is a Blob
        let inputsLog;

        if (structuredInputs['inputs'] && typeof structuredInputs['inputs'] === 'object') {
            inputsLog = { ...structuredInputs['inputs'] };

            for (const [key, value] of Object.entries(structuredInputs['inputs'] || {})) {
                if (value instanceof Blob) {
                    inputsLog[key] = `Blob size=${value.size}`;
                }
            }
        } else {
            inputsLog = structuredInputs;
        }

        logger.debug('Inputs: ', inputsLog);

        let params = JSON.parse(config?.data?.parameters || '{}');
        params = convertStringToRespectiveType(params);

        let parameters = {};

        if (params && Object.keys(params)?.length > 0) {
            for (const key in params) {
                const value = params[key];

                if (typeof value === 'string') {
                    // if value is 'None' then skip it
                    if (value?.toLowerCase() === 'none') continue;

                    parameters[key] = TemplateStringHelper.create(value).parse(input).result;
                } else {
                    parameters[key] = value;
                }
            }
        }

        let args = { model: modelName, ...structuredInputs };

        const options = {};

        // default value of use_cache is true, make it false if disableCache is true
        if (config?.data?.disableCache) {
            options['use_cache'] = false;
        }

        if (Object.keys(parameters)?.length > 0) {
            args['parameters'] = parameters;

            logger.debug('Parameters: \n', parameters);
        }

        const modelCallWithRetry = async ({ retryCount = 0, retryLimit = 2, retryDelay = 1000 }) => {
            try {
                /*
                Provide the 'request' method when the method is not found and as a fallback for the following error:
                InferenceOutputError: Invalid inference output: Expected Array<{summary_text: string}>. Use the 'request' method with the same parameters to do a custom call with no type checking.
                */
                if (typeof hf[hfFunc] !== 'function' || retryCount === retryLimit) {
                    hfFunc = 'request';
                }
                const result = await hf[hfFunc](args, options);
                let output;

                if (result instanceof Blob) {
                    // Handle case where result is directly a Blob
                    // const file = new SmythFile(result);
                    // const fileObj = await file.toSmythFileObject({
                    //     metadata: {
                    //         teamid: teamId,
                    //         agentid: agentId,
                    //     },
                    //     baseUrl: agent?.baseUrl,
                    // });
                    // output = fileObj;
                    // convert blob to base64

                    const obj = await BinaryInput.from(result).getJsonData(AccessCandidate.agent(agent.id));
                    output = obj;
                } else if (Array.isArray(result)) {
                    // Handle case where result is an array of objects containing Blobs or base64 strings
                    output = await Promise.all(
                        result.map(async (item) => {
                            if (item.blob instanceof Blob || (typeof item.blob === 'string' && isBase64(item.blob))) {
                                let binaryInput: BinaryInput;

                                if (item.blob instanceof Blob) {
                                    // file = new SmythFile(item.blob);

                                    binaryInput = BinaryInput.from(item.blob);
                                } else {
                                    // file = new SmythFile(item.blob, item['content-type']);
                                    binaryInput = BinaryInput.from(item.blob, undefined, item['content-type']);
                                }
                                // const fileObj = await file.toSmythFileObject({
                                //     metadata: {
                                //         teamid: teamId,
                                //         agentid: agentId,
                                //     },
                                //     baseUrl: agent?.baseUrl,
                                // });
                                const fileObj = await binaryInput.getJsonData(AccessCandidate.agent(agent.id));
                                return { ...item, blob: fileObj };
                            } else {
                                return item;
                            }
                        }),
                    );
                } else {
                    // Handle case where result is neither a Blob nor an array of Blob-containing objects
                    output = result;
                }
                return output;
            } catch (error) {
                if (retryCount < retryLimit) {
                    await delay(retryDelay);

                    return modelCallWithRetry({
                        retryCount: retryCount + 1,
                        retryLimit,
                        retryDelay: retryDelay * 2,
                    });
                }

                throw error;
            }
        };

        try {
            const output = await modelCallWithRetry({
                retryCount: 0,
                retryLimit: 2,
                retryDelay: 5000,
            });

            logger.debug('Output: \n', output);

            return { Output: output, _debug: logger.output };
        } catch (error: any) {
            console.log(`Error on running Hugging Face Model!`, error);
            console.log('Error: args, options ', args, options);

            return { _error: `Error from Hugging Face: \n${error?.message || JSON.stringify(error)}`, _debug: logger.output };
        }
    }
}