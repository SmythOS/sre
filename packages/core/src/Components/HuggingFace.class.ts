import { InferenceClient } from '@huggingface/inference';
import { Component } from './Component.class';
import { IAgent as Agent } from '@sre/types/Agent.types';
import hfParams from '../data/hugging-face.params.json';
import Joi from 'joi';
import { TemplateStringHelper } from '@sre/helpers/TemplateString.helper';
import { convertStringToRespectiveType, delay, isBase64, kebabToCapitalize, kebabToCamel } from '../utils';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

// HF-specific param names that map to their OpenAI-compatible equivalents
const HF_TO_OPENAI_PARAM_MAP: Record<string, string> = {
    max_new_tokens: 'max_tokens',
    max_length: 'max_tokens',
};

// Parameters that are HF-specific and invalid for the OpenAI chat completions API
const HF_ONLY_PARAMS = new Set(['do_sample', 'return_full_text', 'num_return_sequences', 'truncate', 'max_time', 'min_length', 'repetition_penalty']);

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

        const hf = new InferenceClient(accessToken);

        const task = config?.data?.modelTask;

        if (!task) {
            return { _error: 'Hugging Face Task is required!', _debug: logger.output };
        }

        const modelName = config?.data?.modelName;

        if (!modelName) {
            return { _error: 'Hugging Face Model is required!', _debug: logger.output };
        }

        logger.debug(`Model Name: ${modelName}`);

        // Query the HF Hub API to resolve the provider's actual supported task for this model.
        // Most modern LLMs (Llama, Qwen, DeepSeek, etc.) only support "conversational" (chatCompletion)
        // even when configured as "text-generation". This detects the correct method to use.
        let effectiveTask = task;
        try {
            const mappingRes = await fetch(`https://huggingface.co/api/models/${modelName}?expand[]=inferenceProviderMapping`, {
                headers: accessToken?.startsWith('hf_') ? { Authorization: `Bearer ${accessToken}` } : {},
            });
            if (mappingRes.ok) {
                const payload = await mappingRes.json();
                const mappings = payload?.inferenceProviderMapping;
                if (mappings) {
                    const mappingArray = Array.isArray(mappings)
                        ? mappings
                        : Object.entries(mappings).map(([provider, mapping]: [string, any]) => ({ provider, task: mapping.task }));
                    const exactMatch = mappingArray.find((m) => m.task === task);
                    if (!exactMatch && mappingArray.length > 0) {
                        effectiveTask = mappingArray[0].task;
                        logger.debug(`Task "${task}" not available for model, using provider task: "${effectiveTask}"`);
                    }
                }
            }
        } catch {
            // If the Hub API call fails, proceed with the original task
        }

        logger.debug(`Task: ${kebabToCapitalize(effectiveTask)}`);

        // Map HF task slugs to InferenceClient method names.
        // Most tasks follow kebabToCamel (e.g. "text-classification" → "textClassification"),
        // but some diverge in the new SDK and need explicit overrides.
        const taskToMethod: Record<string, string> = {
            conversational: 'chatCompletion',
            text2textGeneration: 'textGeneration',
        };

        let hfFunc = taskToMethod[kebabToCamel(effectiveTask)] ?? kebabToCamel(effectiveTask);

        if (!hf?.[hfFunc]) {
            return { _error: `Inference API does not support for this task - ${kebabToCapitalize(effectiveTask)}`, _debug: logger.output };
        }

        //const inputConfig = JSON.parse(config?.data?.inputConfig || '{}');

        // Always load input params from the user's configured task so that input mapping
        // matches what the user designed in their agent (e.g. "Text" → "inputs" for text-generation).
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
                            const binaryFile = BinaryInput.from(value, undefined, undefined, AccessCandidate.agent(agentId));
                            const buffer = await binaryFile.getBuffer();
                            const blob = new Blob([buffer as any], binaryFile.mimetype ? { type: binaryFile.mimetype } : undefined);
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
        let structuredInputs = nestInputs ? { inputs } : inputs;

        // When the effective task resolved to chatCompletion but the user configured a non-chat task
        // (e.g. text-generation), the inputs will be in the old format ({ inputs: "text" }).
        // Convert them to the OpenAI messages format that chatCompletion expects.
        if (hfFunc === 'chatCompletion' && !structuredInputs['messages']) {
            const textInput = structuredInputs['inputs'] ?? (structuredInputs as any)?.inputs;
            if (typeof textInput === 'string') {
                structuredInputs = { messages: [{ role: 'user', content: textInput }] };
            } else if (typeof textInput === 'object' && textInput !== null && !Array.isArray(textInput)) {
                // Nested inputs like { question, context } — join into a single user message
                const content = Object.values(textInput)
                    .filter((v) => typeof v === 'string')
                    .join('\n');
                structuredInputs = { messages: [{ role: 'user', content }] };
            }
        }

        // Blob data will be converted to an empty object '{}', when stringified during logging. We need log something so that user can understand that it is a Blob
        let inputsLog: any;

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

        if (Object.keys(parameters)?.length > 0) {
            const useOpenAIParams = hfFunc === 'chatCompletion' || hfFunc === 'textGeneration';
            if (useOpenAIParams) {
                // Remap HF param names to OpenAI equivalents (e.g. max_new_tokens → max_tokens).
                // chatCompletion drops HF-only params; textGeneration still accepts them.
                for (const [key, value] of Object.entries(parameters)) {
                    if (hfFunc === 'chatCompletion' && HF_ONLY_PARAMS.has(key)) continue;
                    const mappedKey = HF_TO_OPENAI_PARAM_MAP[key] ?? key;
                    if (!(mappedKey in args)) {
                        args[mappedKey] = value;
                    }
                }
            } else {
                args['parameters'] = parameters;
            }

            logger.debug('Parameters: \n', parameters);
        }

        // textGeneration requires max_tokens — provide a sensible default if not set
        if (hfFunc === 'textGeneration' && !('max_tokens' in args)) {
            args['max_tokens'] = 256;
        }

        const modelCallWithRetry = async ({ retryCount = 0, retryLimit = 2, retryDelay = 1000 }) => {
            try {
                if (typeof hf[hfFunc] !== 'function' || retryCount === retryLimit) {
                    hfFunc = 'request';
                }
                // Named SDK methods (chatCompletion, textGeneration, etc.) hardcode their own task,
                // but the generic `request` fallback needs the task passed via options.
                const result = hfFunc === 'request' ? await hf[hfFunc](args, { task: effectiveTask }) : await hf[hfFunc](args);

                let output;

                if (result instanceof Blob) {
                    const obj = await BinaryInput.from(result).getJsonData(AccessCandidate.agent(agent.id));
                    output = obj;
                } else if (Array.isArray(result)) {
                    output = await Promise.all(
                        result.map(async (item) => {
                            if (item.blob instanceof Blob || (typeof item.blob === 'string' && isBase64(item.blob))) {
                                const binaryInput =
                                    item.blob instanceof Blob
                                        ? BinaryInput.from(item.blob)
                                        : BinaryInput.from(item.blob, undefined, item['content-type']);
                                const fileObj = await binaryInput.getJsonData(AccessCandidate.agent(agent.id));
                                return { ...item, blob: fileObj };
                            }
                            return item;
                        }),
                    );
                } else {
                    // Extract the primary content from known SDK response shapes
                    output = extractTaskOutput(hfFunc, result);
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
            console.log('Error: args ', args);

            return { _error: `Error from Hugging Face: \n${error?.message || JSON.stringify(error)}`, _debug: logger.output };
        }
    }
}

// --- Helper functions ---

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

/**
 * Extracts the primary content from HF SDK response objects based on the method used.
 * Each SDK method returns a different shape — this normalizes them to their useful payload.
 */
function extractTaskOutput(hfFunc: string, result: any): any {
    if (result == null) return result;

    switch (hfFunc) {
        // OpenAI-compatible chat completions: { choices: [{ message: { content } }] }
        case 'chatCompletion':
            return result?.choices?.[0]?.message?.content ?? result;

        // Text generation: { generated_text: "..." }
        case 'textGeneration':
            return result?.generated_text ?? result;

        // Translation: { translation_text: "..." }
        case 'translation':
            return result?.translation_text ?? result;

        // Summarization: { summary_text: "..." }
        case 'summarization':
            return result?.summary_text ?? result;

        // Image-to-text / captioning: { generated_text: "..." }
        case 'imageToText':
            return result?.generated_text ?? result;

        // Speech recognition: { text: "...", chunks?: [...] }
        case 'automaticSpeechRecognition':
            return result?.text ?? result;

        // Question answering: { answer: "...", score, start, end }
        case 'questionAnswering':
        case 'documentQuestionAnswering':
        case 'visualQuestionAnswering':
            return result?.answer ?? result;

        // Table QA: { answer: "...", cells, coordinates, aggregator }
        case 'tableQuestionAnswering':
            return result?.answer ?? result;

        // All other tasks (classification arrays, detection, segmentation, feature-extraction, etc.)
        // already handled by the Array.isArray/Blob branches, or are fine as-is.
        default:
            return result;
    }
}
