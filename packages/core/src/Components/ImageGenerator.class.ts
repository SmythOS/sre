import { Runware } from '@runware/sdk-js';

import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { GenerateImageConfig } from '@sre/types/LLM.types';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import SystemEvents from '@sre/Core/SystemEvents';

import appConfig from '@sre/config';

export default class ImageGenerator extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(100).required(),
        prompt: Joi.string().optional().max(8_000_000).label('Prompt'), // 2M tokens is around 8M characters
        sizeDalle2: Joi.string().valid('256x256', '512x512', '1024x1024').optional(),
        sizeDalle3: Joi.string().valid('1024x1024', '1792x1024', '1024x1792').optional(),
        quality: Joi.string().valid('standard', 'hd').optional(),
        style: Joi.string().valid('vivid', 'natural').optional(),
        isRawInputPrompt: Joi.boolean().strict().optional(),

        width: Joi.number().min(128).max(2048).optional(),
        height: Joi.number().min(128).max(2048).optional(),
        outputFormat: Joi.string().valid('JPEG', 'PNG', 'WEBP').optional(),
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
            return { _error: 'Model Not Found: Either DALL·E 3 or DALL·E 2 is required!', _debug: logger.output };
        }

        let prompt = config.data?.prompt || input?.Prompt;
        prompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
        prompt = TemplateString(prompt).parse(input).result;

        if (!prompt) {
            return { _error: 'Please provide a prompt or Image', _debug: logger.output };
        }

        logger.debug(`Prompt: \n`, prompt);

        const provider = LLMRegistry.getProvider(model)?.toLowerCase();

        try {
            const output = await imageGenerator[provider]({ model, config, input, logger, agent, prompt });

            logger.debug(`Output: `, output);

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
        } else if (model === 'dall-e-2') {
            const size = config?.data?.sizeDalle2 || '256x256';
            const numberOfImages = parseInt(config?.data?.numberOfImages) || 1;
            args.size = size;
            args.n = numberOfImages;
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

        return output;
    },
    runware: async ({ model, prompt, config, agent }) => {
        // Initialize Runware client
        const runware = new Runware({ apiKey: appConfig.env.RUNWARE_API_KEY });
        await runware.ensureConnection();

        const modelId = LLMRegistry.getModelId(model);
        const width = +config?.data?.width || 1024;
        const height = +config?.data?.height || 1024;
        const outputFormat = config?.data?.outputFormat || 'JPEG';
        const numberResults = 1; // For Image Generation we only need 1 image
        const outputType = 'URL'; // For Image Generation we only need the URL

        try {
            const response = await runware.requestImages({
                positivePrompt: prompt,
                width: width,
                height: height,
                model: modelId,
                numberResults,
                outputType,
                outputFormat,
                includeCost: true,
            });

            // Get first image from response array
            const firstImage = response[0];

            // Map response to match expected format
            let output = firstImage.imageURL;

            SystemEvents.emit('USAGE:API', {
                sourceId: 'api:imageGen.smyth',
                costs: firstImage.cost,
                agentId: agent.id,
                teamId: agent.teamId,
            });

            return output;
        } catch (error: any) {
            throw new Error(`Runware Image Generation Error: ${error?.message || JSON.stringify(error)}`);
        } finally {
            // Clean up connection
            await runware.disconnect();
        }
    },
};
