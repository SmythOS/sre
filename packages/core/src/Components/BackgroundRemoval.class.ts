import { IRemoveImageBackground, IRequestImage, Runware } from '@runware/sdk-js';

import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import { APIKeySource } from '@sre/types/LLM.types';
import SystemEvents from '@sre/Core/SystemEvents';
import { isBase64, isBase64DataUrl, isUrl } from '../utils';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import appConfig from '@sre/config';

export default class BackgroundRemoval extends Component {
    protected configSchema = Joi.object({
        outputFormat: Joi.string().valid('JPG', 'PNG', 'WEBP').optional(),
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
            .allow('')
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

        logger.debug(`=== Background Removal Log ===`);

        // Initialize Runware client
        const runware = new Runware({ apiKey: appConfig.env.RUNWARE_API_KEY });
        await runware.ensureConnection();

        const inputImage = await getBase64DataUrl(Array.isArray(input?.InputImage) ? input?.InputImage[0] : input?.InputImage);

        const imageRequestArgs: IRemoveImageBackground = {
            inputImage,
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

async function getBase64DataUrl(inputImage: string | BinaryInput): Promise<string> {
    let dataUrl: string;

    if (typeof inputImage === 'string' && (isBase64(inputImage) || isBase64DataUrl(inputImage))) {
        inputImage = `data:image/png;base64,${inputImage}`;
    } else if (typeof inputImage === 'string' && isUrl(inputImage)) {
        const response = await fetch(inputImage);
        const blob = await response.blob();
        const reader = new FileReader();
        dataUrl = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } else if (inputImage instanceof BinaryInput) {
        const buffer = await inputImage.getBuffer();
        const base64Data = buffer.toString('base64');
        dataUrl = `data:image/png;base64,${base64Data}`;
    }

    return dataUrl;
}
