import Joi from 'joi';

import { TemplateString } from '@sre/helpers/TemplateString.helper';
import Component from './Component.class';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
export default class VisionLLM extends Component {
    protected configSchema = Joi.object({
        prompt: Joi.string().required().max(4000000).label('Prompt'), // 1M tokens is around 4M characters
        maxTokens: Joi.number().min(1).label('Maximum Tokens'),
        model: Joi.string().max(200).required(),
    });

    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);
        try {
            logger.debug(`=== Vision LLM Log ===`);
            const model: string = config.data?.model;

            const llmInference: LLMInference = await LLMInference.getInstance(model);
            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }
            let prompt: any = TemplateString(config.data.prompt).parse(input).result;

            logger.debug(` Parsed prompt\n`, prompt, '\n');

            const fileSources = Array.isArray(input.Images) ? input.Images : [input.Images];

            const response = await llmInference.visionRequest(prompt, fileSources, config, agent);
            logger.debug(` Enhanced prompt \n`, prompt, '\n');
            // in case we have the response but it's empty string, undefined or null
            if (!response) {
                return { _error: ' LLM Error = Empty Response!', _debug: logger.output };
            }

            if (response?.error) {
                logger.error(` LLM Error=${JSON.stringify(response.error)}`);

                return { Reply: response?.data, _error: response?.error + ' ' + response?.details, _debug: logger.output };
            }

            const result = { Reply: response };

            result['_debug'] = logger.output;

            return result;
        } catch (error: any) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}
