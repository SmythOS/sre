import Joi from 'joi';
import { IAgent as Agent } from '@sre/types/Agent.types';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { Component } from './Component.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

//TODO : better handling of context window exceeding max length

export class PromptGenerator extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(200).required(),
        prompt: Joi.string().required().max(8_000_000).label('Prompt'), // 2M tokens is around 8M characters
        temperature: Joi.number().min(0).max(5).label('Temperature'), // max temperature is 2 for OpenAI and togetherAI but 5 for cohere
        maxTokens: Joi.number().min(1).label('Maximum Tokens'),
        stopSequences: Joi.string().allow('').max(400).label('Stop Sequences'),
        topP: Joi.number().min(0).max(1).label('Top P'),
        topK: Joi.number().min(0).max(500).label('Top K'), // max top_k is 100 for togetherAI but 500 for cohere
        frequencyPenalty: Joi.number().min(0).max(2).label('Frequency Penalty'),
        presencePenalty: Joi.number().min(0).max(2).label('Presence Penalty'),
        responseFormat: Joi.string().valid('json', 'text').optional().label('Response Format'),
        passthrough: Joi.boolean().optional().label('Passthrough'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        //let debugLog = agent.agentRuntime?.debug ? [] : undefined;
        const logger = this.createComponentLogger(agent, config);

        try {
            logger.debug(`=== LLM Prompt Log ===`);
            let teamId = agent?.teamId;

            const passThrough: boolean = config.data.passthrough || false;
            const model: string = config.data.model || 'echo';
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

            // default to json response format
            config.data.responseFormat = config.data?.responseFormat || 'json';

            // request to LLM
            let response: any;
            if (passThrough) {
                const contentPromise = new Promise(async (resolve, reject) => {
                    let _content = '';
                    const eventEmitter: any = await llmInference
                        .streamRequest(
                            {
                                model: model,
                                messages: [{ role: 'user', content: prompt }],
                            },
                            agent.id,
                        )
                        .catch((error) => {
                            console.error('Error on streamRequest: ', error);
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
                response = await llmInference.promptRequest(prompt, config, agent).catch((error) => ({ error: error }));
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
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}
