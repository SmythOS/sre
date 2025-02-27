import { IControlNetPreprocess, IRemoveImageBackground, IRequestImage, Runware } from '@runware/sdk-js';

import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { GenerateImageConfig, APIKeySource } from '@sre/types/LLM.types';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import SystemEvents from '@sre/Core/SystemEvents';

import appConfig from '@sre/config';

export default class RestyleControlNet extends Component {
    protected configSchema = Joi.object({
        inputImage: Joi.string()
            .required()
            .min(2)
            .max(10_485_760) // Approximately 10MB in base64
            .label('Input Image'),
        outputFormat: Joi.string().valid('JPG', 'PNG', 'WEBP').optional(),
        outputQuality: Joi.number().min(20).max(99).optional().label('Output Quality'),
        preProcessorType: Joi.string()
            .valid('canny', 'depth', 'mlsd', 'normalbae', 'openpose', 'tile', 'seg', 'lineart', 'lineart_anime', 'shuffle', 'scribble', 'softedge')
            .optional()
            .label('Pre-Processor Type'),
        width: Joi.number().min(128).max(2048).multiple(64).optional().messages({
            'number.multiple': '{{#label}} must be divisible by 64 (eg: 128...512, 576, 640...2048). Provided value: {{#value}}',
        }),
        height: Joi.number().min(128).max(2048).multiple(64).optional().messages({
            'number.multiple': '{{#label}} must be divisible by 64 (eg: 128...512, 576, 640...2048). Provided value: {{#value}}',
        }),
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

        const imageRequestArgs: IControlNetPreprocess = {
            inputImage: config?.data?.inputImage,
            outputFormat: config?.data?.outputFormat || 'PNG',
            outputQuality: config?.data?.outputQuality || 95,
            preProcessorType: config?.data?.preProcessorType || 'canny',
            width: config?.data?.width || 512,
            height: config?.data?.height || 512,
            includeCost: true,
        };

        try {
            const response = await runware.controlNetPreProcess(imageRequestArgs);

            const output = response[0].imageURL;
            let cost = response[0].cost;

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
