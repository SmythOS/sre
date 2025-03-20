import { IRequestImage, Runware } from '@runware/sdk-js';

import Agent from '@sre/AgentManager/Agent.class';
import Component from '@sre/Components/Component.class';
import Joi from 'joi';
import { APIKeySource } from '@sre/types/LLM.types';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import SystemEvents from '@sre/Core/SystemEvents';

import appConfig from '@sre/config';
import { ImageSettingsConfig } from './imageSettings.config';

export default class TextToImage extends Component {
    protected configSchema = Joi.object({
        model: ImageSettingsConfig.model,
        positivePrompt: ImageSettingsConfig.positivePrompt,
        negativePrompt: ImageSettingsConfig.negativePrompt,
        width: ImageSettingsConfig.width,
        height: ImageSettingsConfig.height,
        outputFormat: ImageSettingsConfig.outputFormat,
        outputQuality: ImageSettingsConfig.outputQuality,
        numberResults: ImageSettingsConfig.numberResults,
        steps: ImageSettingsConfig.steps,
        ctaButton: Joi.string().optional().allow(''),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);

        logger.debug(`=== Image To Image Log ===`);

        let model = config?.data?.model;

        if (!model) {
            return { _error: 'Model Not Found: ', _debug: logger.output };
        }

        logger.debug(`Model: ${model}`);

        let positivePrompt = config.data?.positivePrompt;
        positivePrompt = typeof positivePrompt === 'string' ? positivePrompt : JSON.stringify(positivePrompt);
        positivePrompt = TemplateString(positivePrompt).parse(input).result;

        logger.debug(`Positive Prompt: \n`, positivePrompt);

        const provider = LLMRegistry.getProvider(model)?.toLowerCase();

        const negativePrompt = config?.data?.negativePrompt || '';

        const imageRequestArgs: IRequestImage = {
            model: LLMRegistry.getModelId(model),
            positivePrompt: positivePrompt,
            width: +config?.data?.width || 1024,
            height: +config?.data?.height || 1024,
            numberResults: +config?.data?.numberResults || 1,
            outputFormat: config?.data?.outputFormat || 'JPG',
            steps: +config?.data?.steps || 20,

            outputType: 'URL', // For Image Generation we only need the URL
            includeCost: true,
        };

        // If a negative prompt is provided, add it to the request args
        if (negativePrompt) {
            imageRequestArgs.negativePrompt = negativePrompt;
        }

        // Initialize Runware client
        const runware = new Runware({ apiKey: appConfig.env.RUNWARE_API_KEY });
        await runware.ensureConnection();

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
                    sourceId: `api:texttoimage.smyth`,
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
