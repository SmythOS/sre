import Joi from 'joi';

import { TemplateString } from '@sre/helpers/TemplateString.helper';

import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import Component from './Component.class';

export default class VisionLLM extends Component {
    protected configSchema = Joi.object({
        prompt: Joi.string().required().label('Prompt'),
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
            const model: string = config.data.model || 'gpt-4-vision-preview';
            const llmHelper: LLMHelper = LLMHelper.load(model);
            // if the llm is undefined, then it means we removed the model from our system
            if (!llmHelper.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }
            let prompt: any = TemplateString(config.data.prompt).parse(input).result;

            logger.debug(` Parsed prompt\n`, prompt, '\n');

            //prompt = llmConnector.enhancePrompt(prompt, config);

            //logger.debug(` Enhanced prompt \n`, prompt, '\n');

            const sources = [];
            const images = Array.isArray(input.Images) ? input.Images : [input.Images];
            const promises = [];
            for (let image of images) {
                const binaryInput = BinaryInput.from(image);
                sources.push(binaryInput);
                promises.push(binaryInput.upload(AccessCandidate.agent(agent.id)));
            }

            await Promise.all(promises);

            const response = await llmHelper.visionRequest(prompt, sources, config, agent);
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
