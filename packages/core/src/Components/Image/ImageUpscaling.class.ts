import { IUpscaleGan, Runware } from '@runware/sdk-js';

import Agent from '@sre/AgentManager/Agent.class';
import Component from '@sre/Components/Component.class';
import Joi from 'joi';
import { APIKeySource } from '@sre/types/LLM.types';

import SystemEvents from '@sre/Core/SystemEvents';
import { normalizeImageInput } from '@sre/utils/data.utils';
import { ImageSettingsConfig } from './imageSettings.config';

import appConfig from '@sre/config';

export default class ImageUpscaling extends Component {
    protected configSchema = Joi.object({
        outputFormat: ImageSettingsConfig.outputFormat,
        outputQuality: ImageSettingsConfig.outputQuality,
        upscaleFactor: ImageSettingsConfig.upscaleFactor,
        ctaButton: Joi.string().optional().allow(''),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);

        logger.debug(`=== Image Upscaling Log ===`);

        let inputImage = Array.isArray(input?.InputImage) ? input?.InputImage[0] : input?.InputImage;
        inputImage = await normalizeImageInput(inputImage);

        const imageRequestArgs: IUpscaleGan = {
            inputImage,
            outputFormat: config?.data?.outputFormat || 'JPG',
            outputQuality: +config?.data?.outputQuality || 95,
            upscaleFactor: +config?.data?.upscaleFactor || 2,

            includeCost: true,
        };

        // Initialize Runware client
        const runware = new Runware({ apiKey: appConfig.env.RUNWARE_API_KEY });
        await runware.ensureConnection();

        try {
            const response = await runware.upscaleGan(imageRequestArgs);

            const output = response.imageURL;
            let cost = response.cost;

            logger.debug(`Output: `, output);

            if (output) {
                SystemEvents.emit('USAGE:API', {
                    sourceId: `api:imageupscaling.smyth`,
                    costs: cost,
                    agentId: agent.id,
                    teamId: agent.teamId,
                    keySource: APIKeySource.Smyth,
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
