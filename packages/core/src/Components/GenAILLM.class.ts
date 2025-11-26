import Joi from 'joi';
import { IAgent as Agent } from '@sre/types/Agent.types';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';
import { getMimeType } from '@sre/utils/data.utils';
import { Component } from './Component.class';
import { formatDataForDebug } from '@sre/utils/data.utils';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TLLMEvent } from '@sre/types/LLM.types';

//TODO : better handling of context window exceeding max length

export class GenAILLM extends Component {
    protected schema = {
        name: 'GenAILLM',
        description: 'Use this component to generate a responses from an LLM',
        settings: {
            model: {
                type: 'string',
                max: 200,
                required: true,
            },
            prompt: {
                type: 'string',
                max: 8_000_000,
                label: 'Prompt',
            },
            temperature: {
                type: 'number',
                min: 0,
                max: 5,
                label: 'Temperature',
            },
            maxTokens: {
                type: 'number',
                min: 1,
                label: 'Maximum Tokens',
            },
            stopSequences: {
                type: 'string',
                max: 400,
                label: 'Stop Sequences',
                allowEmpty: true,
            },
            topP: {
                type: 'number',
                min: 0,
                max: 1,
                label: 'Top P',
            },
            topK: {
                type: 'number',
                min: 0,
                max: 500,
                label: 'Top K',
            },
            frequencyPenalty: {
                type: 'number',
                min: 0,
                max: 2,
                label: 'Frequency Penalty',
            },
            presencePenalty: {
                type: 'number',
                min: 0,
                max: 2,
                label: 'Presence Penalty',
            },
            responseFormat: {
                type: 'string',
                valid: ['json', 'text'],
                label: 'Response Format',
            },
            passthrough: {
                type: 'boolean',
                description: 'If true, the LLM response will be returned as is by the agent',
                label: 'Passthrough',
            },
            useSystemPrompt: {
                type: 'boolean',
                description: 'If true, the component will use parent agent system prompt',
                label: 'Use System Prompt',
            },
            useContextWindow: {
                type: 'boolean',
                description: 'If true, the component will use parent agent context window',
                label: 'Use Context Window',
            },
            maxContextWindowLength: {
                type: 'number',
                min: 0,
                description: 'The maximum number of messages to use from this component context window (if useContextWindow is true)',
                label: 'Maximum Context Window Length',
            },

            // #region Web Search
            useWebSearch: {
                type: 'boolean',
                description: 'If true, the component will use web search for additional context',
                label: 'Use Web Search',
            },
            webSearchContextSize: {
                type: 'string',
                valid: ['high', 'medium', 'low'],
                label: 'Web Search Context Size',
            },
            webSearchCity: {
                type: 'string',
                max: 100,
                label: 'Web Search City',
                allowEmpty: true,
            },
            webSearchCountry: {
                type: 'string',
                max: 2,
                label: 'Web Search Country',
                allowEmpty: true,
            },
            webSearchRegion: {
                type: 'string',
                max: 100,
                label: 'Web Search Region',
                allowEmpty: true,
            },
            webSearchTimezone: {
                type: 'string',
                max: 100,
                label: 'Web Search Timezone',
                allowEmpty: true,
            },
            // #endregion

            // #region xAI Search
            useSearch: {
                type: 'boolean',
                description: 'If true, the component will use xAI live search capabilities',
                label: 'Use Search',
                allowEmpty: true,
            },
            searchMode: {
                type: 'string',
                valid: ['auto', 'on', 'off'],
                label: 'Search Mode',
                allowEmpty: true,
            },
            returnCitations: {
                type: 'boolean',
                description: 'If true, include citations and sources in the response',
                label: 'Return Citations',
                allowEmpty: true,
            },
            maxSearchResults: {
                type: 'number',
                min: 1,
                max: 50,
                label: 'Max Search Results',
                allowEmpty: true,
            },
            searchDataSources: {
                type: 'array',
                max: 4,
                label: 'Search Data Sources',
                allowEmpty: true,
            },
            searchCountry: {
                type: 'string',
                max: 2,
                label: 'Search Country',
                allowEmpty: true,
            },
            excludedWebsites: {
                type: 'string',
                max: 10000,
                label: 'Excluded Websites',
                allowEmpty: true,
            },
            allowedWebsites: {
                type: 'string',
                max: 10000,
                label: 'Allowed Websites',
                allowEmpty: true,
            },
            includedXHandles: {
                type: 'string',
                max: 1000,
                label: 'Included X Handles',
                allowEmpty: true,
            },
            excludedXHandles: {
                type: 'string',
                max: 1000,
                label: 'Excluded X Handles',
                allowEmpty: true,
            },
            postFavoriteCount: {
                type: 'number',
                min: 0,
                max: 1000000000,
                label: 'Post Favorite Count',
                allowEmpty: true,
            },
            postViewCount: {
                type: 'number',
                min: 0,
                max: 1000000000,
                label: 'Post View Count',
                allowEmpty: true,
            },
            link: {
                type: 'string',
                max: 5000,
                label: 'RSS Link',
                allowEmpty: true,
            },
            safeSearch: {
                type: 'boolean',
                description: 'If true, enable safe search filtering',
                label: 'Safe Search',
                allowEmpty: true,
            },
            fromDate: {
                type: 'string',
                max: 10,
                label: 'From Date',
                allowEmpty: true,
            },
            toDate: {
                type: 'string',
                max: 10,
                label: 'To Date',
                allowEmpty: true,
            },
            // #endregion

            // #region Reasoning
            useReasoning: {
                type: 'boolean',
                description: 'If true, the component will use reasoning capabilities for complex problem-solving',
                label: 'Use Reasoning',
            },
            verbosity: {
                type: 'string',
                valid: ['low', 'medium', 'high'],
                label: 'Verbosity',
                allowEmpty: true,
            },
            reasoningEffort: {
                type: 'string',
                valid: ['none', 'default', 'low', 'medium', 'high'],
                description: 'Controls the level of effort the model will put into reasoning',
                label: 'Reasoning Effort',
            },
            maxThinkingTokens: {
                type: 'number',
                min: 1,
                label: 'Maximum Thinking Tokens',
            },
            // #endregion
        },
        inputs: {
            Input: {
                type: 'Any',
                description: 'An input that you can pass to the LLM',
            },
            Attachment: {
                type: 'Binary',
                description: 'An attachment that you can pass to the LLM',
                optional: true,
            },
        },
        outputs: {
            Reply: {
                default: true,
            },
        },
    };
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
        responseFormat: Joi.string().valid('json', 'text').allow('').optional().label('Response Format'),
        passthrough: Joi.boolean().optional().label('Passthrough'),
        useSystemPrompt: Joi.boolean().optional().label('Use System Prompt'),
        useContextWindow: Joi.boolean().optional().label('Use Context Window'),
        maxContextWindowLength: Joi.number().optional().min(0).label('Maximum Context Window Length'),
        verbosity: Joi.string().valid('low', 'medium', 'high').optional().allow('').allow(null).label('Verbosity'),

        // #region Web Search
        useWebSearch: Joi.boolean().optional().label('Use Web Search'),
        webSearchContextSize: Joi.string().valid('high', 'medium', 'low').optional().label('Web Search Context Size'),
        webSearchCity: Joi.string().max(100).optional().allow('').label('Web Search City'),
        webSearchCountry: Joi.string().max(2).optional().allow('').label('Web Search Country'),
        webSearchRegion: Joi.string().max(100).optional().allow('').label('Web Search Region'),
        webSearchTimezone: Joi.string().max(100).optional().allow('').label('Web Search Timezone'),
        // #endregion

        // #region xAI Search
        useSearch: Joi.boolean().optional().allow('').label('Use Search'),
        searchMode: Joi.string().valid('auto', 'on', 'off').optional().allow('').label('Search Mode'),
        returnCitations: Joi.boolean().optional().allow('').label('Return Citations'),
        maxSearchResults: Joi.number().min(1).max(100).optional().allow('').label('Max Search Results'),
        searchDataSources: Joi.array().items(Joi.string().valid('web', 'x', 'news', 'rss')).max(4).optional().allow('').label('Search Data Sources'),
        searchCountry: Joi.string().length(2).optional().allow('').label('Search Country'),
        excludedWebsites: Joi.string().max(10000).optional().allow('').label('Excluded Websites'),
        allowedWebsites: Joi.string().max(10000).optional().allow('').label('Allowed Websites'),
        includedXHandles: Joi.string().max(1000).optional().allow('').label('Included X Handles'),
        excludedXHandles: Joi.string().max(1000).optional().allow('').label('Excluded X Handles'),
        postFavoriteCount: Joi.number().min(0).max(1000000000).optional().allow('').label('Post Favorite Count'),
        postViewCount: Joi.number().min(0).max(1000000000).optional().allow('').label('Post View Count'),
        rssLinks: Joi.string().max(10000).optional().allow('').label('RSS Link'),
        safeSearch: Joi.boolean().optional().allow('').label('Safe Search'),
        fromDate: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .allow('')
            .label('From Date'),
        toDate: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .allow('')
            .label('To Date'),
        // #endregion

        // #region Reasoning
        useReasoning: Joi.boolean().optional().label('Use Reasoning'),
        reasoningEffort: Joi.string().valid('none', 'default', 'minimal', 'low', 'medium', 'high').optional().allow('').label('Reasoning Effort'),
        maxThinkingTokens: Joi.number().min(1).optional().label('Maximum Thinking Tokens'),
        // #endregion
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
            logger.debug(`=== GenAILLM Log ===`);
            let teamId = agent?.teamId;

            const passThrough: boolean = config.data.passthrough || false;
            const useContextWindow: boolean = config.data.useContextWindow || false;
            const useSystemPrompt: boolean = config.data.useSystemPrompt || false;
            const useWebSearch: boolean = config.data.useWebSearch || false;
            const maxTokens: number = parseInt(config.data.maxTokens) || 1024;
            const maxContextWindowLength: number = parseInt(config.data.maxContextWindowLength) || 1024;
            const model: string = config.data.model || 'echo';
            const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.agent(agent.id));

            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            //const team = AccessCandidate.team(teamId);
            //const llmRegistry = isStandardLLM ? LLMRegistry : await CustomLLMRegistry.getInstance(team);
            const modelId = await agent.modelsProvider.getModelId(model);

            logger.debug(` Model : ${modelId || model}`);

            let prompt: any = TemplateString(config.data.prompt).parse(input).result;

            let files: any[] = parseFiles(input, config);
            let isMultimodalRequest = false;
            const provider = await agent.modelsProvider.getProvider(model);
            const isEcho = provider === 'Echo';

            // Ignore files for Echo model
            if (files?.length > 0 && !isEcho) {
                // TODO: simplify the valid files checking logic
                const supportedFileTypes = SUPPORTED_MIME_TYPES_MAP?.[provider] || {};
                const modelInfo = await agent.modelsProvider.getModelInfo(model);
                const features = modelInfo?.features || [];
                const fileTypes = new Set(); // Set to avoid duplicates

                const validFiles = await Promise.all(
                    files.map(async (file) => {
                        const mimeType = file?.mimetype || (await getMimeType(file));
                        const [requestFeature = ''] =
                            Object.entries(supportedFileTypes).find(([key, value]) => (value as string[]).includes(mimeType)) || [];

                        if (mimeType) {
                            fileTypes.add(mimeType);
                        }

                        return features?.includes(requestFeature) ? file : null;
                    })
                );

                files = validFiles.filter(Boolean);

                if (files.length === 0) {
                    return {
                        _error: `Model does not support ${fileTypes?.size > 0 ? Array.from(fileTypes).join(', ') : 'File(s)'}`,
                        _debug: logger.output,
                    };
                }

                isMultimodalRequest = true;
            }

            logger.debug(` Prompt\n`, prompt, '\n');

            if (!isEcho) {
                logger.debug(' Files\n', await Promise.all(files.map((file) => formatDataForDebug(file, AccessCandidate.agent(agent.id)))));
            }

            // default to json response format
            const hasCustomOutputs = config?.outputs?.some((output) => !output.default);
            config.data.responseFormat = config.data?.responseFormat || (hasCustomOutputs ? 'json' : '');

            // request to LLM
            let response: any;

            const _prompt = llmInference.connector.enhancePrompt(prompt, config);
            let messages = [];

            let systemPrompt = '';
            if (useSystemPrompt) {
                //first we try to grab the system prompt from llmCache (in case of a ConversationHelper implementing dynamic system prompt)
                const cachedPrompt = await agent.agentRuntime.llmCache.get('systemPrompt', 'text');
                //if not found, we can read the system prompt from agent data.
                systemPrompt = cachedPrompt || agent.data?.behavior || '';

                if (systemPrompt) {
                    logger.debug(' Using Agent System Prompt\n', systemPrompt);
                }
                if (systemPrompt) {
                    messages = [{ role: 'system', content: systemPrompt }];
                }
            }

            if (useContextWindow) {
                const cachedMessages = await agent.agentRuntime.llmCache.get('messages', 'json');
                try {
                    const messagesJSON = typeof cachedMessages === 'string' ? JSON.parse(cachedMessages) : cachedMessages;
                    //const contextWindow = messagesJSON.filter((message) => message.role !== 'user');

                    const convMessages = await llmInference.getContextWindow(systemPrompt, messagesJSON, maxContextWindowLength, maxTokens);

                    if (convMessages.length > 0) {
                        logger.debug(` Using Agent Context Window : ${convMessages.length - 1} messages will be used`);
                    }

                    messages = [...convMessages];
                    //messages.push(...contextWindowJSON);
                } catch (error) {
                    logger.warn('Error on parsing context window: ', error);
                    console.warn(cachedMessages);
                }
            }

            if (messages[messages.length - 1]?.role == 'user') {
                messages[messages.length - 1].content = _prompt;
            } else {
                messages.push({ role: 'user', content: _prompt });
            }
            let finishReason = 'stop';
            const contentPromise = new Promise(async (resolve, reject) => {
                let _content = '';
                let eventEmitter;

                eventEmitter = await llmInference
                    .promptStream({
                        contextWindow: messages,
                        files,
                        params: {
                            ...config.data,
                            agentId: agent.id,
                        },
                        onFallback: (fallbackInfo) => {
                            logger.debug(`\n ↩️ Using fallback model: ${fallbackInfo.model}`);
                        },
                    })
                    .catch((error) => {
                        console.error('Error on promptStream: ', error);
                        reject(error);
                    });

                eventEmitter.on(TLLMEvent.Content, (content) => {
                    if (passThrough) {
                        if (typeof agent.callback === 'function') {
                            agent.callback({ content });
                        }
                        agent.sse.send('llm/passthrough/content', content.replace(/\n/g, '\\n'));
                    }
                    _content += content;
                });

                eventEmitter.on(TLLMEvent.Thinking, (thinking) => {
                    if (passThrough) {
                        if (typeof agent.callback === 'function') {
                            agent.callback({ thinking });
                        }
                        agent.sse.send('llm/passthrough/thinking', thinking.replace(/\n/g, '\\n'));
                    }
                });
                eventEmitter.on(TLLMEvent.End, () => {
                    if (passThrough) {
                        if (typeof agent.callback === 'function') {
                            agent.callback({ content: '\n' });
                        }
                        agent.sse.send('llm/passthrough/content', '\\n');
                    }
                    resolve(_content);
                });
                eventEmitter.on(TLLMEvent.Interrupted, (reason) => {
                    finishReason = reason || 'stop';
                });

                eventEmitter.on(TLLMEvent.Error, (error) => {
                    reject(error);
                });
            });
            response = await contentPromise.catch((error) => {
                return { error: error.message || error };
            });

            // #region Handle Response Errors
            if (response?.error) {
                const error = response?.error + ' ' + (response?.details || '');
                logger.error(` LLM Error=`, error);

                return { Output: response?.data, _error: error, _debug: logger.output };
            }

            const emptyResponseErrorMsg =
                'Empty response. This is usually due to output token limit reached. Please try again with a higher max tokens limit.';

            // If the finish reason is not "stop", it means the model stopped before completing the response.
            if (finishReason !== 'stop') {
                let errMsg = `The model stopped before completing the response.
                \nReason: ${finishReason}.
                \n${!response ? emptyResponseErrorMsg : ''}`;

                return {
                    Reply: response,
                    _error: errMsg,
                    _debug: logger.output,
                };
            }

            // If the finish reason is "stop" but there is still no response, it is usually caused by reaching the output token limit.
            if (!response) {
                return { _error: emptyResponseErrorMsg, _debug: logger.output };
            }
            // #endregion

            const Reply = llmInference.connector.postProcess(response);
            if (Reply.error) {
                logger.error(` LLM Error=`, Reply.error);
                return { _error: Reply.error, _debug: logger.output };
            }

            logger.debug('\n Reply \n', Reply);

            const result = { Reply };

            result['_debug'] = logger.output;

            return result;
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        }
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
