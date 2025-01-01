import Joi from 'joi';
import Component from './Component.class';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
export default class MultimodalLLM extends Component {
    protected configSchema = Joi.object({
        prompt: Joi.string().required().max(8_000_000).label('Prompt'), // 2M tokens is around 8M characters
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

        logger.debug(`=== Multimodal LLM Log ===`);

        try {
            const model: string = config.data.model || 'gpt-4o-mini';
            const llmInference: LLMInference = await LLMInference.getInstance(model, agent.teamId);

            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            const isStandardLLM = LLMRegistry.isStandardLLM(model);

            logger.debug(` Model : ${isStandardLLM ? LLMRegistry.getModelId(model) : model}`);

            let prompt: any = TemplateString(config.data.prompt).parse(input).result;

            logger.debug(` Parsed prompt\n`, prompt, '\n');

            const outputs = {};
            for (let con of config.outputs) {
                if (con.default) continue;
                outputs[con.name] = con?.description ? `<${con?.description}>` : '';
            }

            const excludedKeys = ['_debug', '_error'];
            const outputKeys = Object.keys(outputs).filter((key) => !excludedKeys.includes(key));

            if (outputKeys.length > 0) {
                const outputFormat = {};
                outputKeys.forEach((key) => (outputFormat[key] = '<value>'));

                prompt +=
                    '\n\nExpected output format = ' +
                    JSON.stringify(outputFormat) +
                    '\n\n The output JSON should only use the entries from the output format.';

                logger.debug(`[Component enhanced prompt]\n${prompt}\n\n`);
            }

            const fileSources = Array.isArray(input.Input) ? input.Input : [input.Input];

            const response = await llmInference.multimodalRequest(prompt, fileSources, config, agent);

            logger.debug(` Enhanced prompt \n`, prompt, '\n');

            if (!response) {
                return { _error: ' LLM Error = Empty Response!', _debug: logger.output };
            }

            if (response?.error) {
                const error = response?.error + ' ' + (response?.details || '');
                logger.error(` LLM Error=`, error);
                return { Reply: response?.data, _error: error, _debug: logger.output };
            }

            logger.debug(' Response \n', response);

            const result = { Reply: response };
            result['_debug'] = logger.output;

            return result;
        } catch (error: any) {
            const _error = `${error?.error || ''} ${error?.details || ''}`.trim() || error?.message || 'Something went wrong!';
            logger.error(`Error processing File(s)!`, _error);
            return {
                _error,
                _debug: logger.output,
            };
        }
    }
}
