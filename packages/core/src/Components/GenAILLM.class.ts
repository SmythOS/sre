import Joi from 'joi';
import Agent from '@sre/AgentManager/Agent.class';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';

import Component from './Component.class';

export default class GenAILLM extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(200).required(),
        prompt: Joi.string().required().max(4000000).label('Prompt'), // 1M tokens is around 4M characters
        temperature: Joi.number().min(0).max(5).label('Temperature'),
        maxTokens: Joi.number().min(1).label('Maximum Tokens'),
        stopSequences: Joi.string().allow('').max(400).label('Stop Sequences'),
        topP: Joi.number().min(0).max(1).label('Top P'),
        topK: Joi.number().min(0).max(500).label('Top K'),
        frequencyPenalty: Joi.number().min(0).max(2).label('Frequency Penalty'),
        presencePenalty: Joi.number().min(0).max(2).label('Presence Penalty'),
        processingType: Joi.string().valid('Text', 'Image', 'Audio', 'Video', 'Document').default('Text'),
    });

    constructor() {
        super();
    }

    init() { }

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);

        try {
            logger.debug(`=== GenAI LLM Log ===`);
            const model: string = config.data.model || 'gpt-4o-mini';
            const processingType: string = config.data.processingType || 'Text';
            const teamId = agent?.teamId;

            const llmInference: LLMInference = await LLMInference.getInstance(model, teamId);

            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            const isStandardLLM = LLMRegistry.isStandardLLM(model);
            logger.debug(` Model : ${isStandardLLM ? LLMRegistry.getModelId(model) : model}`);
            logger.debug(` Processing Type : ${processingType}`);

            let prompt: any = TemplateString(config.data.prompt).parse(input).result;
            logger.debug(` Parsed prompt\n`, prompt, '\n');

            // Setup output format if needed
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

            // Choose the appropriate request type based on processingType
            let response;
            switch (processingType) {
                case 'Text':
                    config.data.responseFormat = config.data?.responseFormat || 'json';
                    response = await llmInference.promptRequest(prompt, config, agent);
                    break;
                case 'Image':
                    const imageFiles = Array.isArray(input.Input) ? input.Input : [input.Input];
                    response = await llmInference.visionRequest(prompt, imageFiles, config, agent);
                    break;
                case 'Audio':
                case 'Video':
                case 'Document':
                    const files = Array.isArray(input.Input) ? input.Input : [input.Input];
                    response = await llmInference.multimodalRequest(prompt, files, config, agent);
                    break;
            }

            logger.debug(` Enhanced prompt \n`, prompt, '\n');

            if (!response) {
                return { _error: ' LLM Error = Empty Response!', _debug: logger.output };
            }

            if (response?.error) {
                logger.error(` LLM Error=${JSON.stringify(response.error)}`);
                return { Reply: response?.data, _error: response?.error + ' ' + (response?.details || ''), _debug: logger.output };
            }

            const result = { Reply: response };
            result['_debug'] = logger.output;

            return result;
        } catch (error: any) {
            logger.error(`Error processing input!\n${JSON.stringify(error)}`);
            return {
                _error: `${error?.error || ''} ${error?.details || ''}`.trim() || error?.message || 'Something went wrong!',
                _debug: logger.output,
            };
        }
    }
}