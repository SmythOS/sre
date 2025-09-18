//TODO: this component need to be fully refactored to use the same approach as GenAI LLM

import { IRequestImage, Runware } from '@runware/sdk-js';
import { OpenAI } from 'openai';

import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { IAgent } from '@sre/types/Agent.types';
import { APIKeySource, GenerateImageConfig } from '@sre/types/LLM.types';
import Joi from 'joi';
import { Component } from './Component.class';

import { SystemEvents } from '@sre/Core/SystemEvents';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

import { BUILT_IN_MODEL_PREFIX, SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { normalizeImageInput } from '@sre/utils/data.utils';
import { ImageSettingsConfig } from './Image/imageSettings.config';
import { getCredentials } from '../subsystems/Security/Credentials.helper';

enum DALL_E_MODELS {
    DALL_E_2 = 'dall-e-2',
    DALL_E_3 = 'dall-e-3',
}

const IMAGE_GEN_COST_MAP = {
    [DALL_E_MODELS.DALL_E_3]: {
        standard: {
            '1024x1024': 0.04,
            '1024x1792': 0.08,
            '1792x1024': 0.08,
        },
        hd: {
            '1024x1024': 0.08,
            '1024x1792': 0.12,
            '1792x1024': 0.12,
        },
    },
    [DALL_E_MODELS.DALL_E_2]: {
        '256x256': 0.016,
        '512x512': 0.018,
        '1024x1024': 0.02,
    },
};

export class ImageGenerator extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(100).required(),
        prompt: Joi.string().optional().min(2).max(2000).label('Prompt'),

        // #region OpenAI (DALL·E)
        sizeDalle2: Joi.string().valid('256x256', '512x512', '1024x1024').optional(),
        sizeDalle3: Joi.string().valid('1024x1024', '1792x1024', '1024x1792').optional(),
        quality: Joi.string().valid('standard', 'hd', 'auto', 'high', 'medium', 'low').allow('').optional(),
        style: Joi.string().valid('vivid', 'natural').optional(),
        isRawInputPrompt: Joi.boolean().strict().optional(),
        // #endregion

        // #region Runware
        negativePrompt: Joi.string().optional().allow('').min(2).max(2000).label('Negative Prompt'),
        width: Joi.number().min(128).max(2048).multiple(64).optional().messages({
            'number.multiple': '{{#label}} must be divisible by 64 (eg: 128...512, 576, 640...2048). Provided value: {{#value}}',
        }),
        height: Joi.number().min(128).max(2048).multiple(64).optional().messages({
            'number.multiple': '{{#label}} must be divisible by 64 (eg: 128...512, 576, 640...2048). Provided value: {{#value}}',
        }),
        outputFormat: Joi.string().valid('PNG', 'JPEG', 'WEBP', 'auto', 'jpeg', 'png', 'webp').optional(),
        strength: ImageSettingsConfig.strength,
        // #endregion

        // #region GPT model
        size: Joi.string().optional().allow('').max(100).label('Size'),
        // #endregion

        // #region Google AI model
        aspectRatio: Joi.string().valid('1:1', '3:4', '4:3', '9:16', '16:9').optional().allow('').label('Aspect Ratio'),
        personGeneration: Joi.string().valid('dont_allow', 'allow_adult', 'allow_all').optional().allow('').label('Person Generation'),
        // #endregion
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: IAgent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);

        logger.debug(`=== Image Generator Log ===`);

        let model = config?.data?.model;

        if (!model) {
            return { _error: 'Model Not Found: ', _debug: logger.output };
        }

        logger.debug(`Model: ${model}`);

        let prompt = config.data?.prompt || input?.Prompt;
        prompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
        prompt = TemplateString(prompt).parse(input).result;

        if (!prompt) {
            return { _error: 'Please provide a prompt or Image', _debug: logger.output };
        }

        logger.debug(`Prompt: \n`, prompt);

        const modelFamily = await getModelFamily(model, agent);

        if (typeof imageGenerator[modelFamily] !== 'function') {
            return { _error: `The model '${model}' is not available. Please try a different one.`, _debug: logger.output };
        }

        try {
            const { output } = await imageGenerator[modelFamily]({ model, config, input, logger, agent, prompt });

            logger.debug(`Output: `, output);

            return { Output: output, _debug: logger.output };
        } catch (error: any) {
            return { _error: `Generating Image(s)\n${error?.message || JSON.stringify(error)}`, _debug: logger.output };
        }
    }
}

// TODO: Create a separate service for image generation, similar to LLM.service.

// TODO: Hopefully we will have the proper type with new OpenAI SDK, then we can use their type
type TokenUsage = OpenAI.Completions.CompletionUsage & {
    prompt_tokens_details?: { cached_tokens?: number };
    input_tokens_details: { image_tokens?: number; text_tokens?: number };
    output_tokens: number;
};

enum MODEL_FAMILY {
    GPT = 'gpt',
    RUNWARE = 'runware',
    DALL_E = 'dall-e',
    IMAGEN = 'imagen',
}

const imageGenerator = {
    [MODEL_FAMILY.GPT]: async ({ model, prompt, config, logger, agent, input }) => {
        let args: GenerateImageConfig & { files?: BinaryInput[] } = {
            model,
            size: config?.data?.size || 'auto',
            quality: config?.data?.quality || 'auto',
        };

        try {
            const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.agent(agent.id));

            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            const provider = await agent.modelsProvider.getProvider(model);

            const files: any[] = parseFiles(input, config);
            const validFiles = files.filter((file) => imageGenerator.isValidImageFile(provider, file.mimetype));

            if (files.length > 0 && validFiles.length === 0) {
                throw new Error('Supported image file types are: ' + SUPPORTED_MIME_TYPES_MAP[provider]?.imageGen?.join(', '));
            }

            let response;

            if (validFiles.length > 0) {
                response = await llmInference.imageEditRequest({ query: prompt, files: validFiles, params: { ...args, agentId: agent.id } });
            } else {
                response = await llmInference.imageGenRequest({ query: prompt, params: { ...args, agentId: agent.id } });
            }

            if (response?.usage) {
                imageGenerator.reportTokenUsage(response.usage, {
                    modelEntryName: model,
                    keySource: model.startsWith(BUILT_IN_MODEL_PREFIX) ? APIKeySource.Smyth : APIKeySource.User,
                    agentId: agent.id,
                    teamId: agent.teamId,
                });
            }

            let output = response?.data?.[0]?.b64_json;

            const binaryInput = BinaryInput.from(output);
            const agentId = typeof agent == 'object' && agent.id ? agent.id : agent;
            const smythFile = await binaryInput.getJsonData(AccessCandidate.agent(agentId));

            return { output: smythFile };
        } catch (error: any) {
            throw new Error(`OpenAI Image Generation Error: ${error?.message || JSON.stringify(error)}`);
        }
    },
    [MODEL_FAMILY.DALL_E]: async ({ model, prompt, config, logger, agent, input }) => {
        let _finalPrompt = prompt;

        const files: any[] = parseFiles(input, config);

        if (files.length > 0) {
            throw new Error('OpenAI Image Generation Error: DALL-E models do not support image editing or variations. Please use a different model.');
        }

        const responseFormat = config?.data?.responseFormat || 'url';

        let args: GenerateImageConfig & { responseFormat: 'url' | 'b64_json' } = {
            responseFormat,
            model,
        };

        let cost = 0;

        if (model === DALL_E_MODELS.DALL_E_3) {
            const size = config?.data?.sizeDalle3 || '1024x1024';
            const quality = config?.data?.quality || 'standard';
            const style = config?.data?.style || 'vivid';
            args.size = size;
            args.quality = quality;
            args.style = style;

            const isRawInputPrompt = config?.data?.isRawInputPrompt || false;

            if (isRawInputPrompt) {
                _finalPrompt = `I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS: ${prompt}`;
            }

            cost = IMAGE_GEN_COST_MAP[model][quality][size];
        } else if (model === DALL_E_MODELS.DALL_E_2) {
            const size = config?.data?.sizeDalle2 || '256x256';
            const numberOfImages = parseInt(config?.data?.numberOfImages) || 1;
            args.size = size;
            args.n = numberOfImages;

            cost = IMAGE_GEN_COST_MAP[model][size];
        }

        const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.agent(agent.id));

        // if the llm is undefined, then it means we removed the model from our system
        if (!llmInference.connector) {
            return {
                _error: `The model '${model}' is not available. Please try a different one.`,
                _debug: logger.output,
            };
        }

        const response: any = await llmInference.imageGenRequest({ query: _finalPrompt, params: { ...args, agentId: agent.id } });

        let output = response?.data?.[0]?.[responseFormat];
        const revised_prompt = response?.data?.[0]?.revised_prompt;

        if (revised_prompt && prompt !== revised_prompt) {
            logger.debug(`Revised Prompt:\n${revised_prompt}`);
        }

        imageGenerator.reportUsage({ cost }, { modelEntryName: model, keySource: APIKeySource.Smyth, agentId: agent.id, teamId: agent.teamId });

        return { output };
    },
    [MODEL_FAMILY.RUNWARE]: async ({ model, prompt, config, agent, input }) => {
        // Initialize Runware client
        const teamId = agent.teamId;
        const apiKey = (await getCredentials(AccessCandidate.team(teamId), 'runware')) as string;

        if (!apiKey) {
            throw new Error('Runware API key is missing. Please provide a valid key to continue.');
        }

        const runware = new Runware({ apiKey });
        await runware.ensureConnection();

        const negativePrompt = config?.data?.negativePrompt || '';

        const files: any[] = parseFiles(input, config);
        let seedImage = Array.isArray(files) ? files[0] : files;
        seedImage = await normalizeImageInput(seedImage);

        const modelId = await agent.modelsProvider.getModelId(model);
        const imageRequestArgs: IRequestImage = {
            model: modelId,
            positivePrompt: prompt,
            width: +config?.data?.width || 1024,
            height: +config?.data?.height || 1024,
            numberResults: 1, // For Image Generation we only need 1 image
            outputType: 'URL', // For Image Generation we only need the URL
            outputFormat: config?.data?.outputFormat || 'JPEG',
            includeCost: true,
        };

        if (seedImage) {
            imageRequestArgs.seedImage = seedImage;
            imageRequestArgs.strength = +config?.data?.strength || 0.5;
        }

        // If a negative prompt is provided, add it to the request args
        if (negativePrompt) {
            imageRequestArgs.negativePrompt = negativePrompt;
        }

        try {
            const response = await runware.requestImages(imageRequestArgs);

            // Get first image from response array
            const firstImage = response[0];

            // Map response to match expected format
            let output = firstImage.imageURL;

            imageGenerator.reportUsage(
                { cost: firstImage.cost },
                { modelEntryName: model, keySource: APIKeySource.Smyth, agentId: agent.id, teamId: agent.teamId }
            );

            return { output };
        } catch (error: any) {
            throw new Error(`Runware Image Generation Error: ${error?.message || JSON.stringify(error)}`);
        } finally {
            // Clean up connection
            await runware.disconnect();
        }
    },
    [MODEL_FAMILY.IMAGEN]: async ({ model, prompt, config, logger, agent, input }) => {
        try {
            const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.agent(agent.id));

            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            const files: any[] = parseFiles(input, config);

            let args: GenerateImageConfig & {
                aspectRatio?: string;
                numberOfImages?: number;
                personGeneration?: string;
            } = {
                model,
                aspectRatio: config?.data?.aspectRatio || config?.data?.size || '1:1',
                numberOfImages: config?.data?.numberOfImages || 1,
                personGeneration: config?.data?.personGeneration || 'allow_adult',
            };

            let response;

            // Check if files are provided for image editing
            if (files.length > 0) {
                const validFiles = files.filter((file) => imageGenerator.isValidImageFile('GoogleAI', file.mimetype));
                if (validFiles.length === 0) {
                    throw new Error('Supported image file types are: ' + SUPPORTED_MIME_TYPES_MAP.GoogleAI?.image?.join(', '));
                }
                response = await llmInference.imageEditRequest({ query: prompt, files: validFiles, params: { ...args, agentId: agent.id } });
            } else {
                response = await llmInference.imageGenRequest({ query: prompt, params: { ...args, agentId: agent.id } });
            }

            // Usage reporting is now handled in the GoogleAI connector

            let output = response?.data?.[0]?.b64_json;

            if (output) {
                const binaryInput = BinaryInput.from(output);
                const agentId = typeof agent == 'object' && agent.id ? agent.id : agent;
                const smythFile = await binaryInput.getJsonData(AccessCandidate.agent(agentId));
                return { output: smythFile };
            } else {
                // Handle URL response format
                output = response?.data?.[0]?.url;
                return { output };
            }
        } catch (error: any) {
            throw new Error(`Google AI Image Generation Error: ${error?.message || JSON.stringify(error)}`);
        }
    },
    reportTokenUsage(usage: TokenUsage, metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const usageData = {
            sourceId: `api:imagegen.${modelName}`,
            keySource: metadata.keySource,

            input_tokens_txt: usage?.input_tokens_details?.text_tokens || 0,
            input_tokens_img: usage?.input_tokens_details?.image_tokens || 0,
            output_tokens: usage?.output_tokens,
            input_tokens_cache_read: usage?.prompt_tokens_details?.cached_tokens || 0,

            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:API', usageData);

        return usageData;
    },
    reportUsage(usage: { cost: number }, metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }) {
        const usageData = {
            sourceId: `api:imagegen.smyth`,
            keySource: metadata.keySource,

            cost: usage?.cost,

            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:API', usageData);

        return usageData;
    },
    isValidImageFile(provider: string, mimetype: string) {
        return SUPPORTED_MIME_TYPES_MAP[provider]?.imageGen?.includes(mimetype);
    },
};

enum PROVIDERS {
    OPENAI = 'OpenAI',
    RUNWARE = 'Runware',
    GOOGLEAI = 'GoogleAI',
}

/**
 * Gets the model family from a model identifier
 * @param model The model identifier
 * @returns The model family or null if not recognized
 */
async function getModelFamily(model: string, agent: IAgent): Promise<string | null> {
    if (await isGPTModel(model)) return MODEL_FAMILY.GPT;
    if (await isRunwareModel(model, agent)) return MODEL_FAMILY.RUNWARE;
    if (await isDallEModel(model)) return MODEL_FAMILY.DALL_E;
    if (await isGoogleAIModel(model, agent)) return MODEL_FAMILY.IMAGEN;

    return null;
}

function isGPTModel(model: string) {
    return model?.replace(BUILT_IN_MODEL_PREFIX, '')?.startsWith(MODEL_FAMILY.GPT);
}

async function isRunwareModel(model: string, agent: IAgent): Promise<boolean> {
    const provider = await agent.modelsProvider.getProvider(model);
    return provider === PROVIDERS.RUNWARE || provider?.toLowerCase() === PROVIDERS.RUNWARE.toLowerCase();
}

function isDallEModel(model: string) {
    return model?.replace(BUILT_IN_MODEL_PREFIX, '')?.startsWith(MODEL_FAMILY.DALL_E);
}

async function isGoogleAIModel(model: string, agent: IAgent): Promise<boolean> {
    const provider = await agent.modelsProvider.getProvider(model);
    return (
        provider === PROVIDERS.GOOGLEAI ||
        provider?.toLowerCase() === PROVIDERS.GOOGLEAI.toLowerCase() ||
        model?.replace(BUILT_IN_MODEL_PREFIX, '')?.includes('imagen')
    );
}

function parseFiles(input: any, config: any) {
    const mediaTypes = ['Image', 'Audio', 'Video', 'Binary'];

    // Parse media inputs from config
    const inputFiles =
        config.inputs
            ?.filter((_input) => mediaTypes.includes(_input.type))
            ?.flatMap((_input) => {
                const value = input[_input.name];

                if (Array.isArray(value)) {
                    return value.map((item) => TemplateString(item).parseRaw(input).result);
                } else {
                    return TemplateString(value).parseRaw(input).result;
                }
            })
            ?.filter((file) => file) || [];

    return inputFiles;
}
