import { IRequestImage, Runware } from '@runware/sdk-js';

import Agent from '@sre/AgentManager/Agent.class';
import Component from '@sre/Components/Component.class';
import Joi from 'joi';
import { APIKeySource } from '@sre/types/LLM.types';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import SystemEvents from '@sre/Core/SystemEvents';
import { normalizeImageInput } from '@sre/utils/data.utils';
import { ImageSettingsConfig } from './imageSettings.config';

import appConfig from '@sre/config';

export default class RestyleIPAdapter extends Component {
    protected configSchema = Joi.object({
        model: ImageSettingsConfig.model,
        positivePrompt: ImageSettingsConfig.positivePrompt,
        negativePrompt: ImageSettingsConfig.negativePrompt,
        width: ImageSettingsConfig.width,
        height: ImageSettingsConfig.height,
        outputFormat: ImageSettingsConfig.outputFormat,
        outputQuality: ImageSettingsConfig.outputQuality,
        numberResults: ImageSettingsConfig.numberResults,
        strength: ImageSettingsConfig.strength,
        ipAdapters: ImageSettingsConfig.ipAdapters,
        ctaButton: Joi.string().optional().allow(''),
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

        const negativePrompt = config?.data?.negativePrompt || '';

        let seedImage = Array.isArray(input?.SeedImage) ? input?.SeedImage[0] : input?.SeedImage;
        seedImage = await normalizeImageInput(seedImage);

        const imageRequestArgs: IRequestImage = {
            model: LLMRegistry.getModelId(model),
            seedImage,
            positivePrompt: prompt,
            width: +config?.data?.width || 1024,
            height: +config?.data?.height || 1024,
            numberResults: +config?.data?.numberResults || 1,
            outputFormat: config?.data?.outputFormat || 'JPG',
            outputQuality: +config?.data?.outputQuality || 95,
            strength: +config?.data?.strength || 0.8,
            ipAdapters: config?.data?.ipAdapters,

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
