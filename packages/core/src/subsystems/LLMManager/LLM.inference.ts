import { encode, encodeChat } from 'gpt-tokenizer';
import { ChatMessage } from 'gpt-tokenizer/esm/GptEncoding';
import { Agent } from '@sre/AgentManager/Agent.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { LLMChatResponse, LLMConnector } from './LLM.service/LLMConnector';
import { EventEmitter } from 'events';
import { GenerateImageConfig, TLLMMessageBlock, TLLMMessageRole } from '@sre/types/LLM.types';
import { LLMRegistry } from './LLMRegistry.class';
import { CustomLLMRegistry } from './CustomLLMRegistry.class';
import _ from 'lodash';
import { ModelsProviderConnector } from './ModelsProvider.service/ModelsProviderConnector';

// TODO [Forhad]: apply proper typing
// TODO [Forhad]: Need to merge all the methods with LLMConnector

export class LLMInference {
    private model: string;
    private llmConnector: LLMConnector;
    public teamId?: string;

    public static async getInstance(model: string, teamId?: string) {
        const llmInference = new LLMInference();
        llmInference.teamId = teamId;

        const isStandardLLM = LLMRegistry.isStandardLLM(model);

        if (isStandardLLM) {
            const llmProvider = LLMRegistry.getProvider(model);

            if (llmProvider) {
                llmInference.llmConnector = ConnectorService.getLLMConnector(llmProvider);
            }
        } else if (teamId) {
            const team = AccessCandidate.team(teamId);
            const customLLMRegistry = await CustomLLMRegistry.getInstance(team);
            const llmProvider = customLLMRegistry.getProvider(model);

            if (llmProvider) {
                llmInference.llmConnector = ConnectorService.getLLMConnector(llmProvider);
            }
        }

        llmInference.model = model;

        return llmInference;
    }

    public get connector(): LLMConnector {
        return this.llmConnector;
    }

    public async promptRequest(prompt, config: any = {}, agent: string | Agent, customParams: any = {}) {
        const clonedConfig = _.cloneDeep(config);
        const messages = customParams?.messages || [];

        if (prompt) {
            const _prompt = this.llmConnector.enhancePrompt(prompt, config);
            messages.push({ role: TLLMMessageRole.User, content: _prompt });
        }

        if (!messages?.length) {
            throw new Error('Input prompt is required!');
        }

        // override params with customParams
        let params: any = Object.assign(clonedConfig.data, { ...customParams, messages });

        const agentId = agent instanceof Agent ? agent.id : agent;

        if (!this.llmConnector) {
            throw new Error(`Model ${params.model} not supported`);
        }

        if (!params.model) {
            params.model = this.model;
        }

        try {
            let response: LLMChatResponse = await this.llmConnector.user(AccessCandidate.agent(agentId)).chatRequest(params);

            const result = this.llmConnector.postProcess(response?.content);
            if (result.error) {
                // If the model stopped before completing the response, this is usually due to output token limit reached.
                if (response.finishReason !== 'stop') {
                    throw new Error('The model stopped before completing the response, this is usually due to output token limit reached.');
                }

                // If the model stopped due to other reasons, throw the error
                throw new Error(result.error);
            }
            return result;
        } catch (error: any) {
            console.error('Error in chatRequest: ', error);

            throw error;
        }
    }

    public async visionRequest(prompt, fileSources: string[], config: any = {}, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;

        const promises = [];
        const _fileSources = [];

        for (let image of fileSources) {
            const binaryInput = BinaryInput.from(image);
            _fileSources.push(binaryInput);
            promises.push(binaryInput.upload(AccessCandidate.agent(agentId)));
        }

        await Promise.all(promises);

        const params = config.data;

        params.fileSources = _fileSources;

        if (!params.model) {
            params.model = this.model;
        }

        try {
            prompt = this.llmConnector.enhancePrompt(prompt, config);
            let response: LLMChatResponse = await this.llmConnector.user(AccessCandidate.agent(agentId)).visionRequest(prompt, params);

            const result = this.llmConnector.postProcess(response?.content);

            if (result.error) {
                if (response.finishReason !== 'stop') {
                    throw new Error('The model stopped before completing the response, this is usually due to output token limit reached.');
                }

                // If the model stopped due to other reasons, throw the error
                throw new Error(result.error);
            }

            return result;
        } catch (error: any) {
            console.error('Error in visionRequest: ', error);

            throw error;
        }
    }

    // multimodalRequest is the same as visionRequest. visionRequest will be deprecated in the future.
    public async multimodalRequest(prompt, fileSources: string[], config: any = {}, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;

        const promises = [];
        const _fileSources = [];

        // TODO [Forhad]: For models from Google AI, we currently store files twice — once here and once in the GoogleAIConnector. We need to optimize this process.
        for (let file of fileSources) {
            const binaryInput = BinaryInput.from(file);
            _fileSources.push(binaryInput);
            promises.push(binaryInput.upload(AccessCandidate.agent(agentId)));
        }

        await Promise.all(promises);

        const params = config.data;

        params.fileSources = _fileSources;

        if (!params.model) {
            params.model = this.model;
        }

        try {
            prompt = this.llmConnector.enhancePrompt(prompt, config);
            let response: LLMChatResponse = await this.llmConnector.user(AccessCandidate.agent(agentId)).multimodalRequest(prompt, params);

            const result = this.llmConnector.postProcess(response?.content);

            if (result.error) {
                if (response.finishReason !== 'stop') {
                    throw new Error('The model stopped before completing the response, this is usually due to output token limit reached.');
                }

                // If the model stopped due to other reasons, throw the error
                throw new Error(result.error);
            }

            return result;
        } catch (error: any) {
            console.error('Error in multimodalRequest: ', error);

            throw error;
        }
    }

    public async imageGenRequest(prompt: string, params: GenerateImageConfig, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;

        return this.llmConnector.user(AccessCandidate.agent(agentId)).imageGenRequest(prompt, params);
    }

    public async imageEditRequest(prompt: string, params: GenerateImageConfig, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;

        return this.llmConnector.user(AccessCandidate.agent(agentId)).imageEditRequest(prompt, params);
    }

    public async toolRequest(params: any, agent: string | Agent) {
        if (!params.messages || !params.messages?.length) {
            throw new Error('Input messages are required.');
        }

        const model = params.model || this.model;

        try {
            const agentId = agent instanceof Agent ? agent.id : agent;

            return this.llmConnector.user(AccessCandidate.agent(agentId)).toolRequest({ ...params, model });
        } catch (error: any) {
            console.error('Error in toolRequest: ', error);

            throw error;
        }
    }

    public async streamToolRequest(params: any, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;

        return this.llmConnector.user(AccessCandidate.agent(agentId)).streamToolRequest(params);
    }

    public async streamRequest(params: any, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        try {
            if (!params.messages || !params.messages?.length) {
                throw new Error('Input messages are required.');
            }

            const model = params.model || this.model;

            return await this.llmConnector.user(AccessCandidate.agent(agentId)).streamRequest({ ...params, model });
        } catch (error) {
            console.error('Error in streamRequest:', error);

            const dummyEmitter = new EventEmitter();
            process.nextTick(() => {
                dummyEmitter.emit('error', error);
                dummyEmitter.emit('end');
            });
            return dummyEmitter;
        }
    }

    public async multimodalStreamRequest(params: any, fileSources, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;

        const promises = [];
        const _fileSources = [];

        // TODO [Forhad]: For models from Google AI, we currently store files twice — once here and once in the GoogleAIConnector. We need to optimize this process.
        for (let file of fileSources) {
            const binaryInput = BinaryInput.from(file);
            _fileSources.push(binaryInput);
            promises.push(binaryInput.upload(AccessCandidate.agent(agentId)));
        }

        await Promise.all(promises);

        params.fileSources = _fileSources;

        try {
            //FIXME we need to update the connector multimediaStreamRequest in order to ignore prompt param if not provided
            const userMessage = Array.isArray(params.messages) ? params.messages.pop() : {};
            const prompt = userMessage?.content || '';
            const model = params.model || this.model;

            return await this.llmConnector.user(AccessCandidate.agent(agentId)).multimodalStreamRequest(prompt, { ...params, model });
        } catch (error: any) {
            console.error('Error in multimodalRequest: ', error);

            throw error;
        }
    }

    public async multimodalStreamRequestLegacy(prompt, fileSources: string[], config: any = {}, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;

        const promises = [];
        const _fileSources = [];

        // TODO [Forhad]: For models from Google AI, we currently store files twice — once here and once in the GoogleAIConnector. We need to optimize this process.
        for (let file of fileSources) {
            const binaryInput = BinaryInput.from(file);
            _fileSources.push(binaryInput);
            promises.push(binaryInput.upload(AccessCandidate.agent(agentId)));
        }

        await Promise.all(promises);

        const params = config.data;

        params.fileSources = _fileSources;

        try {
            prompt = this.llmConnector.enhancePrompt(prompt, config);
            const model = params.model || this.model;

            return await this.llmConnector.user(AccessCandidate.agent(agentId)).multimodalStreamRequest(prompt, { ...params, model });
        } catch (error: any) {
            console.error('Error in multimodalRequest: ', error);

            throw error;
        }
    }

    //Not needed
    // public getConsistentMessages(messages: TLLMMessageBlock[]) {
    //     if (!messages?.length) {
    //         throw new Error('Input messages are required.');
    //     }

    //     try {
    //         return this.llmConnector.getConsistentMessages(messages);
    //     } catch (error) {
    //         console.warn('Something went wrong in getConsistentMessages: ', error);

    //         return messages; // if something went wrong then we return the original messages
    //     }
    // }

    /**
     * Get the context window for the given messages
     * @param _messages - The messages to get the context window for (the messages are in smythos generic format)
     * @param maxTokens - The maximum number of tokens to use for the context window
     * @param maxOutputTokens - The maximum number of tokens to use for the output
     * @returns The context window for the given messages
     */
    public async getContextWindow(systemPrompt: string, _messages: any[], maxTokens: number, maxOutputTokens: number = 1024): Promise<any[]> {
        //TODO: handle non key accounts (limit tokens)
        // const maxModelContext = this._llmHelper?.modelInfo?.keyOptions?.tokens || this._llmHelper?.modelInfo?.tokens || 256;

        //#region get max model context
        let maxModelContext;
        let maxModelOutputTokens;
        const isStandardLLM = LLMRegistry.isStandardLLM(this.model);

        if (isStandardLLM) {
            maxModelContext = LLMRegistry.getMaxContextTokens(this.model, true); // we just provide true for hasAPIKey to get the original max context
        } else {
            const team = AccessCandidate.team(this.teamId);
            const customLLMRegistry = await CustomLLMRegistry.getInstance(team);
            maxModelContext = customLLMRegistry.getMaxContextTokens(this.model);
            maxModelOutputTokens = customLLMRegistry.getMaxCompletionTokens(this.model);
        }
        //#endregion get max model context

        let maxInputContext = Math.min(maxTokens, maxModelContext);
        let maxOutputContext = Math.min(maxOutputTokens, maxModelOutputTokens || 0);

        if (maxInputContext + maxOutputContext > maxModelContext) {
            maxInputContext -= maxInputContext + maxOutputContext - maxModelContext;
        }

        // let systemPrompt = '';
        // if (_messages[0]?.role === 'system') {
        //     systemPrompt = _messages[0]?.content;
        //     _messages.shift();
        // }
        const systemMessage = { role: 'system', content: systemPrompt };

        let smythContextWindow = [];

        //loop through messages from last to first and use encodeChat to calculate token lengths
        //we will use fake chatMessages to calculate the token lengths, these are not used by the LLM, but just for token counting
        let tokensCount = encodeChat([systemMessage as ChatMessage], 'gpt-4o').length;
        for (let i = _messages.length - 1; i >= 0; i--) {
            const curMessage = _messages[i];
            if (curMessage.role === 'system') continue;

            tokensCount = 0;
            if (curMessage?.content) {
                // tokensCount += encodeChat([{ role: 'user', content: curMessage.content } as ChatMessage], 'gpt-4o').length;
                tokensCount += countTokens(curMessage.content);
            }

            if (curMessage?.messageBlock?.content) {
                // tokensCount += encodeChat([{ role: 'user', content: curMessage.messageBlock.content } as ChatMessage], 'gpt-4o').length;
                tokensCount += countTokens(curMessage.messageBlock.content);
            }
            if (curMessage.toolsData) {
                for (let tool of curMessage.toolsData) {
                    // tokensCount += encodeChat([{ role: 'user', content: tool.result } as ChatMessage], 'gpt-4o').length;
                    tokensCount += countTokens(tool.result);
                }
            }

            //did the last message exceed the context window ?
            if (tokensCount > maxInputContext) {
                break;
            }

            smythContextWindow.unshift(curMessage);
        }
        smythContextWindow.unshift(systemMessage);

        let modelContextWindow = [];
        //now transform the messages to the model format
        for (let message of smythContextWindow) {
            if (message.role && message.content) {
                modelContextWindow.push({ role: message.role, content: message.content });
            }

            if (message.messageBlock && message.toolsData) {
                const internal_message = this.connector.transformToolMessageBlocks({
                    messageBlock: message?.messageBlock,
                    toolsData: message?.toolsData,
                });

                modelContextWindow.push(...internal_message);
            }
        }

        modelContextWindow = this.connector.getConsistentMessages(modelContextWindow);

        return modelContextWindow;

        /* // ! DEPRECATED: will be removed in the future
        let modelMessages = [];
        let tokens = encodeChat([systemMessage as ChatMessage], 'gpt-4o').length;
        for (let i = _messages.length - 1; i >= 0; i--) {
            // internal_messages are smythOS specific intermediate formats that enable us to store certain data and only convert them when needed
            let internal_message: any;

            //delete _messages?.[i]?.['__smyth_data__']; //remove smyth data entry, this entry may hold smythOS specific data

            //parse specific tools messages
            if (_messages[i]?.messageBlock && _messages[i]?.toolsData) {
                internal_message = this.connector
                    .transformToolMessageBlocks({
                        messageBlock: _messages[i]?.messageBlock,
                        toolsData: _messages[i]?.toolsData,
                    })
                    .reverse(); //need to reverse because we are iterating from last to first
            } else {
                internal_message = [{ role: _messages[i]?.role, content: _messages[i]?.content, name: _messages[i]?.name } as ChatMessage];
            }

            let messageTruncated = false;

            for (let message of internal_message) {
                //skip system messages because we will add our own

                if (message.role === 'system') continue;

                //skip empty messages
                if (!message.content) {
                    //FIXME: tool call messages does not have a content but have a tool field do we need to count them as tokens ?
                    modelMessages.unshift(message);
                    continue;
                }

                const textContent = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
                const encoded = encode(textContent);
                tokens += encoded.length;
                if (tokens > maxInputContext) {
                    if (typeof message.content !== 'string') {
                        //FIXME: handle this case for object contents (used by Anthropic for tool calls for example)
                        break;
                    }
                    //handle context window overflow
                    //FIXME: the logic here is weak, we need a better one
                    const diff = tokens - maxInputContext;
                    const excessPercentage = diff / encoded.length;

                    //truncate message content
                    //const textContent = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

                    message.content = message.content.slice(0, Math.floor(message.content.length * (1 - excessPercentage)) - 200);

                    // We need to find out another way to report this
                    // message.content += '...\n\nWARNING : The context window has been truncated to fit the maximum token limit.';

                    tokens -= encoded.length;
                    tokens += encodeChat([message], 'gpt-4').length;

                    messageTruncated = true;
                    break;
                }
                modelMessages.unshift(message);
            }

            // If the message is truncated, it indicates we've reached the maximum context window. At this point, we need to stop and provide only the messages collected so far.
            if (messageTruncated) break;
        }
        //add system message as first message in the context window
        modelMessages.unshift(systemMessage);

        return modelMessages;

        */
    }
}

function countTokens(content: any, model: 'gpt-4o' | 'gpt-4o-mini' = 'gpt-4o') {
    try {
        // Content must be stringified since some providers like Anthropic use object content
        const _stringifiedContent = typeof content === 'string' ? content : JSON.stringify(content);

        const tokens = encodeChat([{ role: 'user', content: _stringifiedContent } as ChatMessage], model);
        return tokens.length;
    } catch (error) {
        console.warn('Error in countTokens: ', error);
        return 0;
    }
}
