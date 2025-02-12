import { IRequestImage, Runware } from '@runware/sdk-js';

import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { GenerateImageConfig, APIKeySource } from '@sre/types/LLM.types';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import SystemEvents from '@sre/Core/SystemEvents';

import appConfig from '@sre/config';

const IMAGE_GEN_COST_MAP = {
    'dall-e-3': {
        standard: {
            '1024x1024': '0.04',
            '1024x1792': '0.08',
            '1792x1024': '0.08',
        },
        hd: {
            '1024x1024': '0.08',
            '1024x1792': '0.12',
            '1792x1024': '0.12',
        },
    },
    'dall-e-2': {
        '256x256': '0.016',
        '512x512': '0.018',
        '1024x1024': '0.02',
    },
};

export default class ImageGenerator extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(100).required(),
        prompt: Joi.string().optional().min(2).max(2000).label('Prompt'),

        // #region OpenAI (DALL·E)
        sizeDalle2: Joi.string().valid('256x256', '512x512', '1024x1024').optional(),
        sizeDalle3: Joi.string().valid('1024x1024', '1792x1024', '1024x1792').optional(),
        quality: Joi.string().valid('standard', 'hd').optional(),
        style: Joi.string().valid('vivid', 'natural').optional(),
        isRawInputPrompt: Joi.boolean().strict().optional(),
        // #endregion

        // #region Runware
        negativePrompt: Joi.string().optional().allow('').min(2).max(2000).label('Negative Prompt'),
        width: Joi.number()
            .min(128)
            .max(2048)
            .custom((value, helpers) => {
                if (value % 64 !== 0) {
                    return helpers.error('any.invalid', { message: 'Width must be divisible by 64' });
                }
                return value;
            })
            .optional(),
        height: Joi.number()
            .min(128)
            .max(2048)
            .custom((value, helpers) => {
                if (value % 64 !== 0) {
                    return helpers.error('any.invalid', { message: 'Height must be divisible by 64' });
                }
                return value;
            })
            .optional(),
        outputFormat: Joi.string().valid('PNG', 'JPEG', 'WEBP').optional(),
        // #endregion
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);

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

        const provider = LLMRegistry.getProvider(model)?.toLowerCase();

        try {
            const { output, cost } = await imageGenerator[provider]({ model, config, input, logger, agent, prompt });

            logger.debug(`Output: `, output);

            if (output) {
                SystemEvents.emit('USAGE:API', {
                    sourceId: `api:imagegen.smyth`,
                    costs: cost,
                    agentId: agent.id,
                    teamId: agent.teamId,
                    keySource: provider === 'runware' ? APIKeySource.Smyth : APIKeySource.User,
                });
            }

            return { Output: output, _debug: logger.output };
        } catch (error: any) {
            return { _error: `Generating Image(s)\n${error?.message || JSON.stringify(error)}`, _debug: logger.output };
        }
    }
}

const imageGenerator = {
    openai: async ({ model, prompt, config, logger, agent }) => {
        let _finalPrompt = prompt;

        const responseFormat = config?.data?.responseFormat || 'url';

        let args: GenerateImageConfig & { responseFormat: 'url' | 'b64_json' } = {
            responseFormat,
            model,
        };

        let cost = 0;

        if (model === 'dall-e-3') {
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
        } else if (model === 'dall-e-2') {
            const size = config?.data?.sizeDalle2 || '256x256';
            const numberOfImages = parseInt(config?.data?.numberOfImages) || 1;
            args.size = size;
            args.n = numberOfImages;

            cost = IMAGE_GEN_COST_MAP[model][size];
        }

        const llmInference: LLMInference = await LLMInference.getInstance(model);

        // if the llm is undefined, then it means we removed the model from our system
        if (!llmInference.connector) {
            return {
                _error: `The model '${model}' is not available. Please try a different one.`,
                _debug: logger.output,
            };
        }

        const response: any = await llmInference.imageGenRequest(_finalPrompt, args, agent).catch((error) => ({ error: error }));

        let output = response?.data?.[0]?.[responseFormat];
        const revised_prompt = response?.data?.[0]?.revised_prompt;

        if (revised_prompt && prompt !== revised_prompt) {
            logger.debug(`Revised Prompt:\n${revised_prompt}`);
        }

        return { output, cost };
    },
    runware: async ({ model, prompt, config, agent }) => {
        // Initialize Runware client
        const runware = new Runware({ apiKey: appConfig.env.RUNWARE_API_KEY });
        await runware.ensureConnection();

        const negativePrompt = config?.data?.negativePrompt || '';

        const imageRequestArgs: IRequestImage = {
            model: LLMRegistry.getModelId(model),
            positivePrompt: prompt,
            width: +config?.data?.width || 1024,
            height: +config?.data?.height || 1024,
            numberResults: 1, // For Image Generation we only need 1 image
            outputType: 'URL', // For Image Generation we only need the URL
            outputFormat: config?.data?.outputFormat || 'JPEG',
            includeCost: true,
        };

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

            return { output, cost: firstImage.cost };
        } catch (error: any) {
            throw new Error(`Runware Image Generation Error: ${error?.message || JSON.stringify(error)}`);
        } finally {
            // Clean up connection
            await runware.disconnect();
        }
    },
};
