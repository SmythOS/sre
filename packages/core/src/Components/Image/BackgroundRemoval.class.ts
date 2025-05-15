import { IRemoveImageBackground, IRequestImage, Runware } from '@runware/sdk-js';

import Agent from '@sre/AgentManager/Agent.class';
import Component from '@sre/Components/Component.class';
import Joi from 'joi';
import { APIKeySource } from '@sre/types/LLM.types';
import SystemEvents from '@sre/Core/SystemEvents';
import { normalizeImageInput } from '@sre/utils/data.utils';
import appConfig from '@sre/config';
import { ImageSettingsConfig } from './imageSettings.config';

export class BackgroundRemoval extends Component {
    protected configSchema = Joi.object({
        outputFormat: ImageSettingsConfig.outputFormat,
        backgroundColor: ImageSettingsConfig.backgroundColor,
        outputQuality: ImageSettingsConfig.outputQuality,
        ctaButton: Joi.string().optional().allow(''),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);

        logger.debug(`=== Background Removal Log ===`);

        let inputImage = Array.isArray(input?.InputImage) ? input?.InputImage[0] : input?.InputImage;
        inputImage = await normalizeImageInput(inputImage);

        const imageRequestArgs: IRemoveImageBackground = {
            inputImage,
            rgba: config?.data?.backgroundColor || [255, 255, 255, 0],
            outputFormat: config?.data?.outputFormat || 'PNG',
            outputQuality: +config?.data?.outputQuality || 95,
            includeCost: true,
        };

        // Initialize Runware client
        const runware = new Runware({ apiKey: appConfig.env.RUNWARE_API_KEY });
        await runware.ensureConnection();

        try {
            const response = await runware.removeImageBackground(imageRequestArgs);

            const output = response[0].imageURL;
            let cost = response[0].cost;

            logger.debug(`Output: `, output);

            if (output) {
                SystemEvents.emit('USAGE:API', {
                    sourceId: `api:backgroundremoval.smyth`,
                    cost,
                    agentId: agent.id,
                    teamId: agent.teamId,
                    keySource: APIKeySource.Smyth,
                });
            }

            return { Output: output, _debug: logger.output };
        } catch (error: any) {
            return { _error: `Removing Background\n${error?.message || JSON.stringify(error)}`, _debug: logger.output };
        } finally {
            // Clean up connection
            await runware.disconnect();
        }
    }
}

export default BackgroundRemoval;
