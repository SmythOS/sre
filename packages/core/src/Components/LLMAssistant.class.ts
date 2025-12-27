import Joi from 'joi';

import { IAgent as Agent } from '@sre/types/Agent.types';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { DEFAULT_MAX_TOKENS_FOR_LLM } from '@sre/constants';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { encode } from 'gpt-tokenizer';
import { Component } from './Component.class';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { TLLMMessageRole, TLLMEvent } from '@sre/types/LLM.types';
import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';
import path from 'path';
import config from '@sre/config';
import fs from 'fs/promises';

//const sessions = {};
let cacheConnector: CacheConnector;
function getCacheConnector() {
    if (!cacheConnector) {
        cacheConnector = ConnectorService.getCacheConnector();
    }
    return cacheConnector;
}

async function saveMessagesToSession(agentId, userId, conversationId, messages, ttl?) {
    if (!userId && !conversationId) return;
    const cacheConnector = getCacheConnector();
    const conv_uid = `${agentId}:conv-u${userId}-c${conversationId}`;

    cacheConnector.requester(AccessCandidate.agent(agentId)).set(conv_uid, JSON.stringify(messages), null, null, ttl);
}

async function readMessagesFromSession(agentId, userId, conversationId, maxTokens = DEFAULT_MAX_TOKENS_FOR_LLM) {
    if (!userId && !conversationId) return [];
    const cacheConnector = getCacheConnector();

    const conv_uid = `${agentId}:conv-u${userId}-c${conversationId}`;
    //read the last messages from a given session and ensure that the total chat tokens are within the limit
    //start from the last message and keep adding messages until the total tokens exceed the limit
    //if (!sessions[agentId]) return [];
    //if (!sessions[agentId][conv_uid]) return [];

    const sessionData = await cacheConnector.requester(AccessCandidate.agent(agentId))?.get(conv_uid);

    let messages = sessionData ? JSONContent(sessionData).tryParse() : [];

    //const messages = sessions[agentId][conv_uid].messages;

    const filteredMessages: any[] = [];

    let tokens = 0;
    if (messages[0]?.role == 'system') {
        const encoded = encode(messages[0]?.content);
        const messageTokens = encoded.length + 3;
        tokens += messageTokens;
    }

    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role == 'system') continue;
        const message = messages[i];
        const encoded = encode(message?.content);
        const messageTokens = encoded.length + 3;
        if (tokens + messageTokens > maxTokens) break;
        filteredMessages.unshift(message);
        tokens += messageTokens;
    }

    if (messages[0]?.role == 'system') filteredMessages.unshift(messages[0]);

    return filteredMessages;
}

//TODO : update this implementation to use ConversationManager
//        This will allow better context management and support for tool calls
export class LLMAssistant extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(200).required(),
        behavior: Joi.string().max(30000).allow('').label('Behavior'),
        passthrough: Joi.boolean().optional().label('Passthrough'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        try {
            logger.debug('== LLM Assistant Log ==\n');

            const passThrough: boolean = config.data.passthrough || false;
            const model: string = config.data.model || 'echo';
            const ttl = config.data.ttl || undefined;
            let teamId = agent?.teamId;

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

            const userInput = input.UserInput;
            const userId = input.UserId;
            const conversationId = input.ConversationId;

            let behavior = TemplateString(config.data.behavior).parse(input).result;
            logger.debug(` [Parsed Behavior] \n${behavior}`);

            //#region get max tokens
            let maxTokens = 2048;

            const isStandardLLM = await agent.modelsProvider.isStandardLLM(model);
            const hasKey = true; //TODO : check if the user has a key
            //const modelInfo = await agent.modelsProvider.getModelInfo(model, hasKey);
            maxTokens = await agent.modelsProvider.getMaxCompletionTokens(model, hasKey);

            // if (isStandardLLM) {
            //     const provider = LLMRegistry.getProvider(model);
            //     const apiKey = await VaultHelper.getAgentKey(provider, agent?.id);
            //     maxTokens = LLMRegistry.getMaxCompletionTokens(model, !!apiKey);
            // } else {
            //     const team = AccessCandidate.team(teamId);
            //     const customLLMRegistry = await CustomLLMRegistry.getInstance(team);
            //     maxTokens = await customLLMRegistry.getMaxCompletionTokens(model);
            // }
            //#endregion get max tokens

            const messages: any[] = await readMessagesFromSession(agent.id, userId, conversationId, Math.round(maxTokens / 2));

            messages.push({ role: TLLMMessageRole.User, content: userInput });

            if (messages[0]?.role != TLLMMessageRole.System) {
                messages.unshift({ role: TLLMMessageRole.System, content: behavior });
            }

            const customParams = {
                messages,
            };

            let response: any;
            const isClaude4 = LLMHelper.isClaude4Family(modelId || model);

            // Use streaming for passthrough OR Claude 4 family models
            if (passThrough || isClaude4) {
                if (isClaude4) {
                    logger.debug(`\n ⚡ Using streaming for Claude 4 family model`);
                }

                const contentPromise = new Promise(async (resolve, reject) => {
                    let _content = '';
                    const eventEmitter: any = await llmInference
                        .promptStream({
                            contextWindow: messages,
                            params: { ...config, model, agentId: agent.id },
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
                            agent.sse.send('llm/passthrough/content', content);
                        }
                        _content += content;
                    });

                    eventEmitter.on(TLLMEvent.Thinking, (thinking) => {
                        if (passThrough) {
                            if (typeof agent.callback === 'function') {
                                agent.callback({ thinking });
                            }
                            agent.sse.send('llm/passthrough/thinking', thinking);
                        }
                    });

                    eventEmitter.on(TLLMEvent.End, () => {
                        resolve(_content);
                    });

                    eventEmitter.on(TLLMEvent.Error, (error) => {
                        reject(error);
                    });
                });

                response = await contentPromise.catch((error) => {
                    return { error: error.message || error };
                });

                // Handle streaming errors
                if (response?.error) {
                    const error = response?.error + ' ' + (response?.details || '');
                    logger.error(` LLM Error=`, error);
                    return { Response: response?.data, _error: error, _debug: logger.output };
                }

                // Post-process the streaming response
                const postProcessed = llmInference.connector.postProcess(response);
                if (postProcessed.error) {
                    logger.error(` LLM Post-process Error=`, postProcessed.error);
                    return { _error: postProcessed.error, _debug: logger.output };
                }
                response = postProcessed;
            } else {
                response = await llmInference
                    .prompt({
                        contextWindow: messages,
                        params: { ...config, agentId: agent.id },
                        onFallback: (fallbackInfo) => {
                            logger.debug(`\n ↩️ Using fallback model: ${fallbackInfo.model}`);
                        },
                    })
                    .catch((error) => ({ error: error }));

                if (response?.error) {
                    const error = response?.error + ' ' + (response?.details || '');
                    logger.error(` LLM Error=`, error);
                    return { Response: response?.data, _error: error, _debug: logger.output };
                }
            }

            // in case we have the response but it's empty string, undefined or null
            if (!response) {
                return { _error: ' LLM Error = Empty Response!', _debug: logger.output };
            }

            messages.push({ role: 'assistant', content: response });
            saveMessagesToSession(agent.id, userId, conversationId, messages, ttl);

            logger.debug('\n Response \n', response);

            const result = { Response: response };

            result['_debug'] = logger.output;

            return result;
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}
