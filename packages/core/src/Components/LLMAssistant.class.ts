import Joi from 'joi';

import { Agent } from '@sre/AgentManager/Agent.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { DEFAULT_MAX_TOKENS_FOR_LLM } from '@sre/constants';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { encode } from 'gpt-tokenizer';
import Component from './Component.class';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import { CustomLLMRegistry } from '@sre/LLMManager/CustomLLMRegistry.class';
import { TLLMMessageRole } from '@sre/types/LLM.types';
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

    cacheConnector.user(AccessCandidate.agent(agentId)).set(conv_uid, JSON.stringify(messages), null, null, ttl);
}

async function readMessagesFromSession(agentId, userId, conversationId, maxTokens = DEFAULT_MAX_TOKENS_FOR_LLM) {
    if (!userId && !conversationId) return [];
    const cacheConnector = getCacheConnector();

    const conv_uid = `${agentId}:conv-u${userId}-c${conversationId}`;
    //read the last messages from a given session and ensure that the total chat tokens are within the limit
    //start from the last message and keep adding messages until the total tokens exceed the limit
    //if (!sessions[agentId]) return [];
    //if (!sessions[agentId][conv_uid]) return [];

    const sessionData = await cacheConnector.user(AccessCandidate.agent(agentId))?.get(conv_uid);

    let messages = sessionData ? JSONContent(sessionData).tryParse() : [];
    if (messages?.length == 0) {
        // if no messages found, try to search for a legacy session
        const migrationResult = await migrateLegacySession(agentId, userId, conversationId);
        messages = migrationResult?.messages || [];
    }
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

async function migrateLegacySession(agentId, userId, conversationId) {
    let migrated = false;
    if (!config.env.DATA_PATH) {
        console.warn('LLMAssistant : No data path found, skipping legacy session migration');
        return { migrated, messages: [] };
    }
    const cacheConnector = getCacheConnector();
    const legacy_conv_uid = `u${userId}c${conversationId}`;
    const legacySessionPath = path.join(config.env.DATA_PATH!, 'LLMAssistant', agentId, `${legacy_conv_uid}.json`);

    //check if the session file exists
    const fileExists = await fs
        .access(legacySessionPath)
        .then(() => true)
        .catch(() => false);
    if (!fileExists) return { migrated, messages: [] };

    const sessionData = await fs.readFile(legacySessionPath, 'utf8');
    let jsonData = JSONContent(sessionData).tryParse();

    if (typeof jsonData == 'object' && jsonData?.migrated) {
        console.warn(`LLMAssistant : Legacy session for agent ${agentId}, user ${userId}, conversation ${conversationId} already migrated.`);
        return { migrated, messages: [] };
    }

    console.warn(`LLMAssistant : Session file found for agent ${agentId}, user ${userId}, conversation ${conversationId}. Migrating to cache...`);

    const messages = typeof jsonData == 'object' ? jsonData?.messages : [];
    const cache_conv_uid = `${agentId}:conv-u${userId}-c${conversationId}`;
    await cacheConnector
        .user(AccessCandidate.agent(agentId))
        .set(cache_conv_uid, JSON.stringify(messages), null, null, null)
        .catch((error) => {
            console.error(
                `LLMAssistant : Error migrating legacy session to cache for agent ${agentId}, user ${userId}, conversation ${conversationId}. Error=${error}`,
            );
        });
    migrated = true;

    // add an entry in the legacy session file to indicate it has been migrated
    await fs.writeFile(legacySessionPath, JSON.stringify({ ...jsonData, migrated: true }), 'utf8');

    return { migrated, messages };
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

            const llmInference: LLMInference = await LLMInference.getInstance(model, teamId);
            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            const isStandardLLM = LLMRegistry.isStandardLLM(model);

            logger.debug(` Model : ${isStandardLLM ? LLMRegistry.getModelId(model) : model}`);

            const userInput = input.UserInput;
            const userId = input.UserId;
            const conversationId = input.ConversationId;

            let behavior = TemplateString(config.data.behavior).parse(input).result;
            logger.debug(`[Parsed Behavior] \n${behavior}\n\n`);

            //#region get max tokens
            let maxTokens = 2048;

            if (isStandardLLM) {
                const provider = LLMRegistry.getProvider(model);
                const apiKey = await VaultHelper.getAgentKey(provider, agent?.id);
                maxTokens = LLMRegistry.getMaxCompletionTokens(model, !!apiKey);
            } else {
                const team = AccessCandidate.team(teamId);
                const customLLMRegistry = await CustomLLMRegistry.getInstance(team);
                maxTokens = await customLLMRegistry.getMaxCompletionTokens(model);
            }
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
            if (passThrough) {
                const contentPromise = new Promise(async (resolve, reject) => {
                    let _content = '';
                    const eventEmitter: any = await llmInference
                        .streamRequest(
                            {
                                model: model,
                                messages,
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
                response = await llmInference.promptRequest(null, config, agent, customParams).catch((error) => ({ error: error }));
            }

            // in case we have the response but it's empty string, undefined or null
            if (!response) {
                return { _error: ' LLM Error = Empty Response!', _debug: logger.output };
            }

            if (response?.error) {
                const error = response?.error + ' ' + (response?.details || '');
                logger.error(` LLM Error=`, error);

                return { Response: response?.data, _error: error, _debug: logger.output };
            }

            messages.push({ role: 'assistant', content: response });
            saveMessagesToSession(agent.id, userId, conversationId, messages, ttl);

            logger.debug(' Response \n', response);

            const result = { Response: response };

            result['_debug'] = logger.output;

            return result;
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}

export default LLMAssistant;
