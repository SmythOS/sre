import Joi from 'joi';

import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { Component } from './Component.class';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

export class VisionLLM extends Component {
    protected configSchema = Joi.object({
        prompt: Joi.string().required().max(8_000_000).label('Prompt'), // 2M tokens is around 8M characters
        maxTokens: Joi.number().min(1).label('Maximum Tokens'),
        model: Joi.string().max(200).required(),
        passthrough: Joi.boolean().optional().label('Passthrough'),
    });

    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);
        try {
            logger.debug(`=== Vision LLM Log ===`);

            const passThrough: boolean = config.data.passthrough || false;
            const model: string = config.data?.model;

            const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.agent(agent.id));
            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            const modelId = await agent.modelsProvider.getModelId(model);
            logger.debug(` Model : ${modelId || model}`);

            let prompt: any = TemplateString(config.data.prompt).parse(input).result;

            logger.debug(` Prompt\n`, prompt, '\n');

            const files = Array.isArray(input.Images) ? input.Images : [input.Images];

            let response: any;
            if (passThrough) {
                const contentPromise = new Promise(async (resolve, reject) => {
                    let _content = '';
                    const eventEmitter: any = await llmInference.multimodalStreamRequestLegacy(prompt, files, config, agent).catch((error) => {
                        console.error('Error on multimodalStreamRequest: ', error);
                        reject(error);
                    });
                    eventEmitter.on('content', (content) => {
                        if (typeof agent.callback === 'function') {
                            agent.callback({ content });
                        }
                        agent.sse.send('llm/passthrough/content', content);
                        _content += content;
                    });
                    eventEmitter.on('thinking', (thinking) => {
                        if (typeof agent.callback === 'function') {
                            agent.callback({ thinking });
                        }
                        agent.sse.send('llm/passthrough/thinking', thinking);
                    });
                    eventEmitter.on('end', () => {
                        console.log('end');
                        resolve(_content);
                    });
                });
                response = await contentPromise;
            } else {
                response = await llmInference.prompt({ query: prompt, files, params: { ...config, agentId: agent.id } });
            }

            // in case we have the response but it's empty string, undefined or null
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
            return { _error: error.message, _debug: logger.output };
        }
    }
}
