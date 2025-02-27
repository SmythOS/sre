import { IRemoveImageBackground, IRequestImage, Runware, TImageMasking } from '@runware/sdk-js';

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

export default class Inpainting extends Component {
    protected configSchema = Joi.object({
        model: ImageSettingsConfig.model,
        outputFormat: ImageSettingsConfig.outputFormat,
        outputQuality: ImageSettingsConfig.outputQuality,
        confidence: ImageSettingsConfig.confidence,
        maxDetections: ImageSettingsConfig.maxDetections,
        maskPadding: ImageSettingsConfig.maskPadding,
        maskBlur: ImageSettingsConfig.maskBlur,
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

        let inputImage = Array.isArray(input?.InputImage) ? input?.InputImage[0] : input?.InputImage;
        inputImage = await normalizeImageInput(inputImage);

        const imageRequestArgs: TImageMasking = {
            model: LLMRegistry.getModelId(model),
            inputImage,
            outputFormat: config?.data?.outputFormat || 'PNG',
            outputQuality: config?.data?.outputQuality || 95,
            confidence: config?.data?.confidence || 0.25,
            maxDetections: config?.data?.maxDetections || 6,
            maskPadding: config?.data?.maskPadding || 4,
            maskBlur: config?.data?.maskBlur || 4,
            includeCost: true,
        };
        // Initialize Runware client
        const runware = new Runware({ apiKey: appConfig.env.RUNWARE_API_KEY });
        await runware.ensureConnection();

        try {
            const response = await runware.imageMasking(imageRequestArgs);

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
