import { IControlNetPreprocess, IRemoveImageBackground, IRequestImage, Runware } from '@runware/sdk-js';

import Agent from '@sre/AgentManager/Agent.class';
import Component from '@sre/Components/Component.class';
import Joi from 'joi';
import { APIKeySource } from '@sre/types/LLM.types';
import SystemEvents from '@sre/Core/SystemEvents';

import appConfig from '@sre/config';
import { normalizeImageInput } from '@sre/utils/data.utils';
import { ImageSettingsConfig } from './imageSettings.config';

export default class RestyleControlNet extends Component {
    protected configSchema = Joi.object({
        width: ImageSettingsConfig.width,
        height: ImageSettingsConfig.height,
        outputFormat: ImageSettingsConfig.outputFormat,
        outputQuality: ImageSettingsConfig.outputQuality,
        preProcessorType: ImageSettingsConfig.preProcessorType,
        ctaButton: Joi.string().optional().allow(''),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);

        logger.debug(`=== Restyle (ControlNet) Log ===`);

        let inputImage = Array.isArray(input?.InputImage) ? input?.InputImage[0] : input?.InputImage;
        inputImage = await normalizeImageInput(inputImage);

        const imageRequestArgs: IControlNetPreprocess = {
            inputImage,
            width: config?.data?.width || 512,
            height: config?.data?.height || 512,
            outputFormat: config?.data?.outputFormat || 'PNG',
            outputQuality: +config?.data?.outputQuality || 95,
            preProcessorType: config?.data?.preProcessorType || 'canny',

            includeCost: true,
        };

        // Initialize Runware client
        const runware = new Runware({ apiKey: appConfig.env.RUNWARE_API_KEY });
        await runware.ensureConnection();

        try {
            const response = await runware.controlNetPreProcess(imageRequestArgs);

            const output = response.guideImageURL;
            let cost = response.cost;

            logger.debug(`Output: `, output);

            if (output) {
                SystemEvents.emit('USAGE:API', {
                    sourceId: `api:restylecontrolnet.smyth`,
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
