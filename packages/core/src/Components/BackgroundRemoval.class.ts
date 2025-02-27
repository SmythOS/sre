import { IRemoveImageBackground, IRequestImage, Runware } from '@runware/sdk-js';

import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { GenerateImageConfig, APIKeySource } from '@sre/types/LLM.types';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import SystemEvents from '@sre/Core/SystemEvents';

import appConfig from '@sre/config';

export default class BackgroundRemoval extends Component {
    protected configSchema = Joi.object({
        inputImage: Joi.string()
            .required()
            .min(2)
            .max(10_485_760) // Approximately 10MB in base64
            .label('Input Image'),
        outputFormat: Joi.string().valid('PNG', 'JPEG', 'WEBP').optional(),
        rgba: Joi.array()
            .items(
                Joi.number()
                    .when('$index', {
                        is: 3, // when it's the alpha channel (4th item)
                        then: Joi.number().min(0).max(1), // alpha validation
                        otherwise: Joi.number().min(0).max(255).integer(), // RGB validation
                    })
                    .required()
            )
            .length(4)
            .optional()
            .label('Background Color')
            .description('RGBA color array [red, green, blue, alpha]. RGB values must be between 0-255, alpha must be between 0-1'),
        outputQuality: Joi.number().min(20).max(99).optional().label('Output Quality'),
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

        const imageRequestArgs: IRemoveImageBackground = {
            inputImage: config?.data?.inputImage,
            rgba: config?.data?.rgba || [255, 255, 255, 0],
            outputFormat: config?.data?.outputFormat || 'PNG',
            outputQuality: config?.data?.outputQuality || 95,
            includeCost: true,
        };

        try {
            const response = await runware.removeImageBackground(imageRequestArgs);

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
