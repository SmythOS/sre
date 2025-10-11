import { EventEmitter } from 'events';
import { encodeChat } from 'gpt-tokenizer';
import { ChatMessage } from 'gpt-tokenizer/esm/GptEncoding';

import { isAgent } from '@sre/AgentManager/Agent.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { IAgent } from '@sre/types/Agent.types';
import { TLLMChatResponse, TLLMMessageRole, TLLMModel, TLLMParams } from '@sre/types/LLM.types';

import { LLMConnector } from './LLM.service/LLMConnector';
import { IModelsProviderRequest, ModelsProviderConnector } from './ModelsProvider.service/ModelsProviderConnector';

const console = Logger('LLMInference');

type TPromptParams = { query?: string; contextWindow?: any[]; files?: any[]; params: TLLMParams };

export class LLMInference {
    private model: string | TLLMModel;
    private llmConnector: LLMConnector;
    private modelProviderReq: IModelsProviderRequest;
    public teamId?: string;

    public static async getInstance(model: string | TLLMModel, candidate: AccessCandidate) {
        const modelsProvider: ModelsProviderConnector = ConnectorService.getModelsProviderConnector();
        if (!modelsProvider.valid) {
            throw new Error(`Model provider Not available, cannot create LLM instance`);
        }
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.requester(candidate).getTeam();

        const llmInference = new LLMInference();
        llmInference.teamId = teamId;

        llmInference.modelProviderReq = modelsProvider.requester(candidate);

        const llmProvider = await llmInference.modelProviderReq.getProvider(model);
        if (llmProvider) {
            llmInference.llmConnector = ConnectorService.getLLMConnector(llmProvider);
        }

        if (!llmInference.llmConnector) {
            console.error(`Model ${model} unavailable for team ${teamId}`);
        }

        llmInference.model = model;

        return llmInference;
    }

    public static user(candidate: AccessCandidate): any {}


    public get connector(): LLMConnector {
        return this.llmConnector;
    }

    public async prompt({ query, contextWindow, files, params }: TPromptParams, isInFallback: boolean = false) {
        let messages = contextWindow || [];

        if (query) {
            const content = this.llmConnector.enhancePrompt(query, params);
            messages.push({ role: TLLMMessageRole.User, content });
        }

        // Reset the model, since the fallback model may change — especially when using user custom models.
        params.model = this.model;

        params.messages = messages;
        params.files = files;

        try {
            let response: TLLMChatResponse = await this.llmConnector.requester(AccessCandidate.agent(params.agentId)).request(params);

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
            // Attempt fallback for custom models (only if not already in fallback)
            if (!isInFallback) {
                try {
                    const fallbackResult = await this.executeFallback('prompt', { query, contextWindow, files, params });
                    
                    // If fallback succeeded, return the result
                    if (fallbackResult !== null) {
                        return fallbackResult;
                    }
                } catch (fallbackError) {
                    // If fallback also failed, log it but continue to throw original error
                    console.warn('Fallback also failed:', fallbackError);
                }
            }

            // If fallback was not attempted or failed, throw the original error
            console.error('Error in chatRequest: ', error);
            throw error;
        }
    }

    public async promptStream({ query, contextWindow, files, params }: TPromptParams, isInFallback: boolean = false) {
        let messages = contextWindow || [];

        if (query) {
            const content = this.llmConnector.enhancePrompt(query, params);
            messages.push({ role: TLLMMessageRole.User, content });
        }

        // Reset the model, since the fallback model may change — especially when using user custom models.
        params.model = this.model;

        params.messages = messages;
        params.files = files;

        try {
            return await this.llmConnector.user(AccessCandidate.agent(params.agentId)).streamRequest(params);
        } catch (error) {
            // Attempt fallback for custom models (only if not already in fallback)
            if (!isInFallback) {
                try {
                    const fallbackResult = await this.executeFallback('promptStream', { query, contextWindow, files, params });
                    
                    // If fallback succeeded, return the result
                    if (fallbackResult !== null) {
                        return fallbackResult;
                    }
                } catch (fallbackError) {
                    // If fallback also failed, log it but continue to return error emitter
                    console.warn('Fallback also failed:', fallbackError);
                }
            }

            // If fallback was not attempted or failed, return error emitter
            console.error('Error in streamRequest:', error);

            const dummyEmitter = new EventEmitter();
            process.nextTick(() => {
                dummyEmitter.emit('error', error);
                dummyEmitter.emit('end');
            });
            return dummyEmitter;
        }
    }


    /**
     * Executes fallback logic for custom models when the primary model fails.
     * This method checks if a fallback model is configured and invokes the appropriate LLM method.
     * Prevents infinite loops by passing a flag to indicate we're in a fallback attempt.
     * 
     * @param methodName - The name of the method being called ('prompt' or 'promptStream')
     * @param args - The original arguments passed to the method
     * @returns The result from the fallback execution, or null if fallback should not be attempted
     */
    private async executeFallback(
        methodName: 'prompt' | 'promptStream',
        args: TPromptParams
    ): Promise<any> {
        const isCustomModel = await this.modelProviderReq.isUserCustomLLM(this.model);
        const fallbackModel = await this.modelProviderReq.getFallbackLLM(this.model);
        
        // Only execute fallback if it's a custom model with a configured fallback
        if (!isCustomModel || !fallbackModel) {
            return null;
        }

        console.info(`Attempting fallback from ${this.model} to ${fallbackModel}`);
        
        // Mutate the model and connector to use fallback
        this.model = fallbackModel;
        
        const llmProvider = await this.modelProviderReq.getProvider(fallbackModel);
        if (llmProvider) {
            this.llmConnector = ConnectorService.getLLMConnector(llmProvider);
        }
        
        // Call the appropriate method with isInFallback=true to prevent further fallbacks
        if (methodName === 'prompt') {
            return await this.prompt(args, true);
        } else {
            return await this.promptStream(args, true);
        }
    }

    public async imageGenRequest({ query, files, params }: TPromptParams) {
        params.prompt = query;
        return this.llmConnector.user(AccessCandidate.agent(params.agentId)).imageGenRequest(params);
    }

    public async imageEditRequest({ query, files, params }: TPromptParams) {
        params.prompt = query;
        params.files = files;
        return this.llmConnector.user(AccessCandidate.agent(params.agentId)).imageEditRequest(params);
    }

    //@deprecated
    public async streamRequest(params: any, agent: string | IAgent) {
        const agentId = isAgent(agent) ? (agent as IAgent).id : agent;
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

    //@deprecated
    public async multimodalStreamRequest(params: any, fileSources, agent: string | IAgent) {
        const agentId = isAgent(agent) ? (agent as IAgent).id : agent;

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

    //@deprecated
    public async multimodalStreamRequestLegacy(prompt, files: string[], config: any = {}, agent: string | IAgent) {
        const agentId = isAgent(agent) ? (agent as IAgent).id : agent;

        const promises = [];
        const _files = [];

        // TODO [Forhad]: For models from Google AI, we currently store files twice — once here and once in the GoogleAIConnector. We need to optimize this process.
        for (let file of files) {
            const binaryInput = BinaryInput.from(file);
            _files.push(binaryInput);
            promises.push(binaryInput.upload(AccessCandidate.agent(agentId)));
        }

        await Promise.all(promises);

        const params = config.data;

        params.files = _files;

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

        const modelInfo = await this.modelProviderReq.getModelInfo(this.model, true);
        let maxModelContext = modelInfo?.tokens;
        let maxModelOutputTokens = modelInfo?.completionTokens || modelInfo?.tokens;
        // const isStandardLLM = LLMRegistry.isStandardLLM(this.model);

        // if (isStandardLLM) {
        //     maxModelContext = LLMRegistry.getMaxContextTokens(this.model, true); // we just provide true for hasAPIKey to get the original max context
        // } else {
        //     const team = AccessCandidate.team(this.teamId);
        //     const customLLMRegistry = await CustomLLMRegistry.getInstance(team);
        //     maxModelContext = customLLMRegistry.getMaxContextTokens(this.model);
        //     maxModelOutputTokens = customLLMRegistry.getMaxCompletionTokens(this.model);
        // }
        //#endregion get max model context

        let maxInputContext = Math.min(maxTokens, maxModelContext);
        let maxOutputContext = Math.min(maxOutputTokens, maxModelOutputTokens || 0);

        if (maxInputContext + maxOutputContext > maxModelContext) {
            maxInputContext -= maxInputContext + maxOutputContext - maxModelContext;
        }

        if (maxInputContext <= 0) {
            console.warn('Max input context is 0, returning empty context window, This usually indicates a wrong model configuration');
        }

        console.debug(
            `Context Window Configuration: Max Input Tokens: ${maxInputContext}, Max Output Tokens: ${maxOutputContext}, Max Model Tokens: ${maxModelContext}`
        );
        const systemMessage = { role: 'system', content: systemPrompt };

        let smythContextWindow = [];

        //loop through messages from last to first and use encodeChat to calculate token lengths
        //we will use fake chatMessages to calculate the token lengths, these are not used by the LLM, but just for token counting
        let tokensCount = encodeChat([systemMessage as ChatMessage], 'gpt-4o').length;
        for (let i = _messages?.length - 1; i >= 0; i--) {
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
