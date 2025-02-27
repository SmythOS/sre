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

export default class RestyleIPAdapter extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(100).required(),
        prompt: Joi.string().optional().min(2).max(2000).label('Prompt'),

        negativePrompt: Joi.string().optional().allow('').min(2).max(2000).label('Negative Prompt'),
        width: Joi.number().min(128).max(2048).multiple(64).optional().messages({
            'number.multiple': '{{#label}} must be divisible by 64 (eg: 128...512, 576, 640...2048). Provided value: {{#value}}',
        }),
        height: Joi.number().min(128).max(2048).multiple(64).optional().messages({
            'number.multiple': '{{#label}} must be divisible by 64 (eg: 128...512, 576, 640...2048). Provided value: {{#value}}',
        }),
        outputFormat: Joi.string().valid('JPG', 'PNG', 'WEBP').optional(),
        numberResults: Joi.number().min(1).max(20).optional().label('Number of Results'),

        seedImage: Joi.string()
            .optional()
            .min(2)
            .max(10_485_760) // Approximately 10MB in base64
            .label('Seed Image'),
        strength: Joi.number().min(0).max(1).optional().label('Strength'),

        ipAdapters: Joi.array()
            .items(
                Joi.object({
                    model: Joi.string().required().label('IP Adapter Model'),
                    guideImage: Joi.string()
                        .required()
                        .min(2)
                        .max(10_485_760) // Approximately 10MB in base64
                        .label('Guide Image'),
                    weight: Joi.number().required().min(0).max(1).label('IP Adapter Weight'),
                })
            )
            .optional()
            .label('IP Adapters'),
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

        // Initialize Runware client
        const runware = new Runware({ apiKey: appConfig.env.RUNWARE_API_KEY });
        await runware.ensureConnection();

        const negativePrompt = config?.data?.negativePrompt || '';

        const imageRequestArgs: IRequestImage = {
            model: LLMRegistry.getModelId(model),
            positivePrompt: prompt,
            width: +config?.data?.width || 1024,
            height: +config?.data?.height || 1024,
            numberResults: +config?.data?.numberResults || 1,
            outputType: 'URL', // For Image Generation we only need the URL
            outputFormat: config?.data?.outputFormat || 'JPG',
            includeCost: true,

            seedImage: config?.data?.seedImage,
            strength: config?.data?.strength || 0.8,
            ipAdapters: config?.data?.ipAdapters,
        };

        // If a negative prompt is provided, add it to the request args
        if (negativePrompt) {
            imageRequestArgs.negativePrompt = negativePrompt;
        }

        try {
            const response = await runware.requestImages(imageRequestArgs);

            const output = [];
            let cost = 0;

            for (const image of response) {
                output.push(image.imageURL);
                cost += image.cost;
            }

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
        } finally {
            // Clean up connection
            await runware.disconnect();
        }
    }
}
