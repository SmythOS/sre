import Joi from 'joi';

import Agent from '@sre/AgentManager/Agent.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { CacheConnector } from '@sre/MemoryManager/Cache.service';
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

    const messages = sessionData ? JSONContent(sessionData).tryParse() : [];
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
export default class LLMAssistant extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(200).required(),
        behavior: Joi.string().max(30000).allow('').label('Behavior'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config.name);
        try {
            logger.debug('== LLM Assistant Log ==\n');

            const model: string = config.data.model || 'echo';
            const ttl = config.data.ttl || undefined;
            const llmInference: LLMInference = await LLMInference.getInstance(model);
            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            logger.debug(` Model : ${model}`);

            const userInput = input.UserInput;
            const userId = input.UserId;
            const conversationId = input.ConversationId;

            let behavior = TemplateString(config.data.behavior).parse(input).result;
            logger.debug(`[Parsed Behavior] \n${behavior}\n\n`);

            //#region get max tokens
            let maxTokens = 2048;
            const teamId = agent.teamId;
            const isStandardLLM = LLMRegistry.isStandardLLM(model);

            if (isStandardLLM) {
                const provider = LLMRegistry.getProvider(model);
                const vaultConnector = ConnectorService.getVaultConnector();
                const apiKey = await vaultConnector
                    .user(AccessCandidate.agent(agent.id))
                    .get(provider)
                    .catch(() => '');
                AccessCandidate.agent(agent.id);
                maxTokens = LLMRegistry.getMaxCompletionTokens(model, !!apiKey);
            } else {
                const customLLMRegistry = await CustomLLMRegistry.getInstance(teamId);
                maxTokens = await customLLMRegistry.getMaxCompletionTokens(model);
            }
            //#endregion get max tokens

            const messages: any[] = await readMessagesFromSession(agent.id, userId, conversationId, Math.round(maxTokens / 2));

            messages.push({ role: TLLMMessageRole.User, content: userInput });

            const consistentMessages = await llmInference.getConsistentMessages(messages);

            if (consistentMessages[0]?.role != TLLMMessageRole.System) {
                consistentMessages.unshift({ role: TLLMMessageRole.System, content: behavior });
            }

            const customParams = {
                messages: consistentMessages,
            };

            const response: any = await llmInference.promptRequest(null, config, agent, customParams).catch((error) => ({ error: error }));

            // in case we have the response but it's empty string, undefined or null
            if (!response) {
                return { _error: ' LLM Error = Empty Response!', _debug: logger.output };
            }

            if (response?.error) {
                logger.error(` LLM Error=${JSON.stringify(response.error)}`);

                return { Response: response?.data, _error: response?.error + ' ' + response?.details, _debug: logger.output };
            }

            messages.push({ role: 'assistant', content: response });
            saveMessagesToSession(agent.id, userId, conversationId, messages, ttl);

            const result = { Response: response };

            result['_debug'] = logger.output;

            return result;
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}
