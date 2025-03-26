import { EventEmitter } from 'events';
import Joi from 'joi';
import Agent from '@sre/AgentManager/Agent.class';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import { CustomLLMRegistry } from '@sre/LLMManager/CustomLLMRegistry.class';
import { SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';
import { getMimeType } from '@sre/utils/data.utils';
import Component from './Component.class';
import { formatDataForDebug } from '@sre/utils/data.utils';

//TODO : better handling of context window exceeding max length

export default class GenAILLM extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(200).required(),
        prompt: Joi.string().required().max(8_000_000).label('Prompt'), // 2M tokens is around 8M characters
        temperature: Joi.number().min(0).max(5).label('Temperature'), // max temperature is 2 for OpenAI and togetherAI but 5 for cohere
        maxTokens: Joi.number().min(1).label('Maximum Tokens'),
        maxThinkingTokens: Joi.number().min(1).label('Maximum Thinking Tokens'),
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
            const llmInference: LLMInference = await LLMInference.getInstance(model, teamId);

            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            const isStandardLLM = LLMRegistry.isStandardLLM(model);
            const llmRegistry = isStandardLLM ? LLMRegistry : await CustomLLMRegistry.getInstance(teamId);

            logger.debug(` Model : ${llmRegistry.getModelId(model)}`);

            let prompt: any = TemplateString(config.data.prompt).parse(input).result;

            let fileSources: any[] = parseFiles(input, config);
            let isMultimodalRequest = false;
            const provider = llmRegistry.getProvider(model);
            const isEcho = provider === 'Echo';

            // Ignore files for Echo model
            if (fileSources?.length > 0 && !isEcho) {
                const supportedFileTypes = SUPPORTED_MIME_TYPES_MAP?.[provider] || {};
                const features = llmRegistry.getModelFeatures(model);
                const fileTypes = new Set(); // Set to avoid duplicates

                const validFiles = await Promise.all(
                    fileSources.map(async (file) => {
                        const mimeType = file?.mimetype || (await getMimeType(file));
                        const [requestFeature = ''] =
                            Object.entries(supportedFileTypes).find(([key, value]) => (value as string[]).includes(mimeType)) || [];

                        if (mimeType) {
                            fileTypes.add(mimeType);
                        }

                        return features?.includes(requestFeature) ? file : null;
                    })
                );

                fileSources = validFiles.filter(Boolean);

                if (fileSources.length === 0) {
                    return {
                        _error: `Model does not support ${fileTypes?.size > 0 ? Array.from(fileTypes).join(', ') : 'File(s)'}`,
                        _debug: logger.output,
                    };
                }

                isMultimodalRequest = true;
            }

            logger.debug(` Prompt\n`, prompt, '\n');

            if (!isEcho) {
                logger.debug(' Files\n', await Promise.all(fileSources.map((file) => formatDataForDebug(file))));
            }

            // default to json response format
            config.data.responseFormat = config.data?.responseFormat || 'json';

            // request to LLM
            let response: any;
            if (passThrough) {
                const contentPromise = new Promise(async (resolve, reject) => {
                    let _content = '';
                    let eventEmitter;

                    if (isMultimodalRequest && fileSources.length > 0) {
                        eventEmitter = await llmInference.multimodalStreamRequest(prompt, fileSources, config, agent).catch((error) => {
                            console.error('Error on multimodalStreamRequest: ', error);
                            reject(error);
                        });
                    } else {
                        eventEmitter = await llmInference
                            .streamRequest(
                                {
                                    model: model,
                                    messages: [{ role: 'user', content: prompt }],
                                },
                                agent.id
                            )
                            .catch((error) => {
                                console.error('Error on streamRequest: ', error);
                                reject(error);
                            });
                    }

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
                if (isMultimodalRequest && fileSources.length > 0) {
                    response = await llmInference.multimodalRequest(prompt, fileSources, config, agent);
                } else {
                    response = await llmInference.promptRequest(prompt, config, agent).catch((error) => ({ error: error }));
                }
            }

            // in case we have the response but it's empty string, undefined or null
            if (!response) {
                return { _error: ' LLM Error = Empty Response!', _debug: logger.output };
            }

            if (response?.error) {
                const error = response?.error + ' ' + (response?.details || '');
                logger.error(` LLM Error=`, error);

                return { Output: response?.data, _error: error, _debug: logger.output };
            }

            logger.debug(' Reply \n', response);

            const result = { Reply: response };

            result['_debug'] = logger.output;

            return result;
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        }
    }

    public async streamPrompt(prompt: string, config: any, agent: Agent) {
        const model: string = config.data.model || 'echo';
        const llmInference: LLMInference = await LLMInference.getInstance(model, agent?.teamId);
        return llmInference.streamRequest(prompt, agent);
    }
}

function parseFiles(input: any, config: any) {
    const mediaTypes = ['Image', 'Audio', 'Video', 'Binary'];

    // Parse media inputs from config
    const inputFiles =
        config.inputs
            ?.filter((_input) => mediaTypes.includes(_input.type))
            ?.flatMap((_input) => {
                const value = input[_input.name];

                if (Array.isArray(value)) {
                    return value.map((item) => TemplateString(item).parseRaw(input).result);
                } else {
                    return TemplateString(value).parseRaw(input).result;
                }
            })
            ?.filter((file) => file) || [];

    return inputFiles;
}
