import { EventEmitter } from 'events';
import { encodeChat } from 'gpt-tokenizer';
import { ChatMessage } from 'gpt-tokenizer/esm/GptEncoding';

import { isAgent } from '@sre/AgentManager/Agent.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { IAgent } from '@sre/types/Agent.types';
import { TLLMChatResponse, TLLMMessageRole, TLLMModel, TLLMParams, TLLMEvent, TLLMFinishReason } from '@sre/types/LLM.types';

import { LLMConnector } from './LLM.service/LLMConnector';
import { IModelsProviderRequest, ModelsProviderConnector } from './ModelsProvider.service/ModelsProviderConnector';

const logger = Logger('LLMInference');

type TPromptParams = { query?: string; contextWindow?: any[]; files?: any[]; params: TLLMParams; onFallback?: (data: any) => void };

export class LLMInference {
    private _model: string | TLLMModel;
    public get model() {
        return this._model;
    }
    public get modelId() {
        return typeof this._model === 'string' ? this._model : this._model?.modelId;
    }
    private _llmConnector: LLMConnector;
    public get llmConnector() {
        return this._llmConnector;
    }
    private _modelProviderReq: IModelsProviderRequest;
    public get modelProviderReq() {
        return this._modelProviderReq;
    }
    private _llmProviderName: string;
    public get llmProviderName() {
        return this._llmProviderName;
    }
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

        llmInference._modelProviderReq = modelsProvider.requester(candidate);

        llmInference._llmProviderName = await llmInference._modelProviderReq.getProvider(model);
        if (llmInference._llmProviderName) {
            llmInference._llmConnector = ConnectorService.getLLMConnector(llmInference._llmProviderName);
        }

        if (!llmInference._llmConnector) {
            logger.warn(`Model ${model} unavailable for team ${teamId}`);
        }

        llmInference._model = model;

        return llmInference;
    }

    public static user(candidate: AccessCandidate): any {}

    public get connector(): LLMConnector {
        return this._llmConnector;
    }

    public async prompt({ query, contextWindow, files, params, onFallback = () => {} }: TPromptParams, isInFallback: boolean = false) {
        let messages = contextWindow || [];

        if (query) {
            const content = this._llmConnector.enhancePrompt(query, params);
            messages.push({ role: TLLMMessageRole.User, content });
        }

        // Reset the model, since the fallback model may change — especially when using user custom models.
        params.model = this._model;

        params.messages = messages;
        params.files = files;

        // If a fallback model is used, trigger the onFallback callback to notify the caller.
        if (isInFallback && typeof onFallback === 'function') {
            onFallback({ model: this._model });
        }

        try {
            let response: TLLMChatResponse = await this._llmConnector.requester(AccessCandidate.agent(params.agentId)).request(params);

            const result = this._llmConnector.postProcess(response?.content);
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
                const isCustomModel = await this._modelProviderReq.isUserCustomLLM(this._model);
                if (isCustomModel) {
                    try {
                        const fallbackParams = await this.getSafeFallbackParams(params);
                        const fallbackResult = await this.executeFallback('prompt', { query, contextWindow, files, params: fallbackParams, onFallback });

                        // If fallback succeeded, return the result
                        if (fallbackResult !== null) {
                            return fallbackResult;
                        }
                    } catch (fallbackError) {
                        // If fallback also failed, log it but continue to throw original error
                        logger.warn('Fallback also failed:', fallbackError);
                    }
                }
            }

            // If fallback was not attempted or failed, throw the original error
            logger.error('Error in chatRequest: ', error);
            throw error;
        }
    }

    public async promptStream({ query, contextWindow, files, params, onFallback = () => {} }: TPromptParams, isInFallback: boolean = false) {
        let messages = contextWindow || [];

        if (query) {
            const content = this._llmConnector.enhancePrompt(query, params);
            messages.push({ role: TLLMMessageRole.User, content });
        }

        // Reset the model, since the fallback model may change — especially when using user custom models.
        params.model = this._model;

        params.messages = messages;
        params.files = files;

        // If a fallback model is used, trigger the onFallback callback to notify the caller.
        if (isInFallback && typeof onFallback === 'function') {
            onFallback({ model: this._model });
        }

        // Connectors now always return emitters (they don't throw errors)
        const primaryEmitter = await this._llmConnector.user(AccessCandidate.agent(params.agentId)).streamRequest(params);

        // Only wrap with fallback capability if this is a custom model (not already in fallback)
        // For regular models, return the emitter directly - errors flow naturally to the caller
        if (!isInFallback) {
            const isCustomModel = await this._modelProviderReq.isUserCustomLLM(this._model);
            
            if (isCustomModel) {
                return this.wrapWithFallback(primaryEmitter, { query, contextWindow, files, params, onFallback });
            }
        }

        return primaryEmitter;
    }

    /**
     * Creates a safe, minimal set of parameters when switching to a fallback LLM provider.
     *
     * **Why this exists:**
     * Model settings persist in the component's configuration data, even when you switch models.
     * This can cause issues when fallback models run with settings the user can't see or track.
     *
     * **Real-world scenario:**
     * 1. User configures a GPT-5 model and sets `reasoning_effort: "high"`
     * 2. This setting gets saved to the component's configuration
     * 3. User switches to a custom model (e.g., for cost savings)
     * 4. The UI now shows custom model options - GPT-5 options are hidden
     * 5. **BUT**: `reasoning_effort: "high"` is STILL in the config data!
     * 6. Custom model has GPT-5 as its fallback
     * 7. Primary custom model fails → automatically switches to GPT-5 fallback
     * 8. GPT-5 fallback runs with the hidden `reasoning_effort: "high"` setting
     * 9. `reasoning_effort: "high"` requires a high `max_tokens` value
     * 10. If `max_tokens` is too low → the request fails
     *
     * **The impact:**
     * Users can't track response quality properly because they don't know what configuration
     * the fallback model is using. The UI doesn't show fallback model settings, so users have
     * no visibility into how responses are being generated.
     *
     * **What this function does:**
     * Strips out provider-specific settings when falling back, using only universal parameters.
     * This ensures predictable behavior. (Note: A more robust solution would be showing fallback
     * configuration in the UI, but for now this handles it at the parameter level.)
     *
     * @param params - The full set of LLM parameters from the original request
     * @returns A filtered parameter object with only provider-agnostic, safe parameters
     */
    private async getSafeFallbackParams(params: TLLMParams): Promise<TLLMParams> {
        const fallbackParams = {
            agentId: params.agentId,
            model: params.model,
            maxContextWindowLength: params.maxContextWindowLength,
            maxTokens: params.maxTokens,
            messages: params.messages,
            passthrough: params.passthrough,
            useContextWindow: params.useContextWindow,
        };

        return fallbackParams;
    }

    /**
     * Executes fallback logic for custom models when the primary model fails.
     * Checks if a fallback model is configured and switches to it.
     * Prevents infinite loops by passing a flag to indicate we're in a fallback attempt.
     *
     * **Important**: This method should only be called for custom models (already verified by caller).
     *
     * @param methodName - The name of the method being called ('prompt' or 'promptStream')
     * @param args - The original arguments passed to the method
     * @returns The result from the fallback execution, or null if no fallback is configured
     */
    private async executeFallback(methodName: 'prompt' | 'promptStream', args: TPromptParams): Promise<any> {
        const fallbackModel = await this._modelProviderReq.getFallbackLLM(this._model);

        // Only execute fallback if a fallback model is configured
        if (!fallbackModel) {
            return null;
        }

        logger.info(`Attempting fallback from ${this._model} to ${fallbackModel}`);

        // Mutate the model and connector to use fallback
        this._model = fallbackModel;

        const llmProvider = await this._modelProviderReq.getProvider(fallbackModel);
        if (llmProvider) {
            this._llmConnector = ConnectorService.getLLMConnector(llmProvider);
        }

        // Call the appropriate method with isInFallback=true to prevent further fallbacks
        if (methodName === 'prompt') {
            return await this.prompt(args, true);
        } else {
            return await this.promptStream(args, true);
        }
    }

    /**
     * Wraps an emitter with fallback capability using a proxy pattern.
     * This creates a transparent proxy that forwards all events from the source emitter.
     * On error, it attempts to switch to a fallback model and seamlessly redirects events.
     *
     * **Important**: This method is only called for custom models that have fallback configured.
     * Regular models return their emitters directly without wrapping, so errors flow naturally.
     *
     * **Design Pattern**: Proxy/Decorator with listener-based event forwarding
     * **Coupling**: Minimal - reads event types from TLLMEvent enum (single source of truth)
     * **Reliability**: Uses listeners (not emit interception) to avoid timing issues with async emits
     *
     * Note: We use the TLLMEvent enum as the source of truth for all event types.
     * This provides a good balance between decoupling and reliability. The enum already
     * defines all possible LLM events, and connectors emit these standard events.
     *
     * @param sourceEmitter - The custom model's event emitter
     * @param args - The original prompt arguments for fallback execution
     * @returns A proxy emitter that transparently handles primary/fallback switching
     */
    private wrapWithFallback(sourceEmitter: EventEmitter, args: TPromptParams): EventEmitter {
        const proxyEmitter = new EventEmitter();
        let fallbackAttempted = false;

        /**
         * Attaches forwarding listeners for all event types in TLLMEvent.
         * Uses listeners instead of emit() interception to avoid timing issues with setImmediate.
         * 
         * @param source - The emitter to forward events from
         * @param skipErrors - If true, skips forwarding error events (handled separately)
         */
        const forwardAllEvents = (source: EventEmitter, skipErrors: boolean) => {
            // Get all event types from TLLMEvent enum
            const eventTypes = Object.values(TLLMEvent);
            
            for (const eventType of eventTypes) {
                // Skip error events if we're intercepting them
                if (skipErrors && eventType === TLLMEvent.Error) {
                    continue;
                }
                
                // Attach listener to forward this event type
                source.on(eventType, (...eventArgs: any[]) => {
                    proxyEmitter.emit(eventType, ...eventArgs);
                });
            }
        };

        // Handle error events for fallback logic
        const handleError = async (error: Error) => {
            if (fallbackAttempted) return;
            fallbackAttempted = true;

            // Stop forwarding from primary emitter
            sourceEmitter.removeAllListeners();

            try {
                const fallbackParams = await this.getSafeFallbackParams(args.params);
                const fallbackEmitter = await this.executeFallback('promptStream', {
                    ...args,
                    params: fallbackParams,
                });

                if (fallbackEmitter) {
                    // Forward all events from fallback emitter (including errors)
                    forwardAllEvents(fallbackEmitter, false);
                    logger.info('Successfully switched to fallback stream');
                    return;
                }
            } catch (fallbackError) {
                logger.warn('Fallback attempt failed:', fallbackError);
            }

            // If we get here, fallback failed or was not available - emit error on proxy
            proxyEmitter.emit(TLLMEvent.Error, error);
            proxyEmitter.emit(TLLMEvent.End, [], [], TLLMFinishReason.Error);
        };

        // Attach error handler FIRST to intercept errors
        sourceEmitter.once(TLLMEvent.Error, handleError);

        // Forward all non-error events from primary emitter
        forwardAllEvents(sourceEmitter, true);

        return proxyEmitter;
    }

    public async imageGenRequest({ query, files, params }: TPromptParams) {
        params.prompt = query;
        return this._llmConnector.user(AccessCandidate.agent(params.agentId)).imageGenRequest(params);
    }

    public async imageEditRequest({ query, files, params }: TPromptParams) {
        params.prompt = query;
        params.files = files;
        return this._llmConnector.user(AccessCandidate.agent(params.agentId)).imageEditRequest(params);
    }

    //@deprecated
    public async streamRequest(params: any, agent: string | IAgent) {
        const agentId = isAgent(agent) ? (agent as IAgent).id : agent;
        if (!params.messages || !params.messages?.length) {
            // Return an emitter with error/end events for validation errors
            const errorEmitter = new EventEmitter();
            const validationError = new Error('Input messages are required.');
            process.nextTick(() => {
                errorEmitter.emit(TLLMEvent.Error, validationError);
                errorEmitter.emit(TLLMEvent.End, [], [], TLLMFinishReason.Error);
            });
            return errorEmitter;
        }

        const model = params.model || this._model;

        // Connectors now always return emitters (they don't throw errors)
        return await this._llmConnector.user(AccessCandidate.agent(agentId)).streamRequest({ ...params, model });
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
            const model = params.model || this._model;

            return await this._llmConnector.user(AccessCandidate.agent(agentId)).multimodalStreamRequest(prompt, { ...params, model });
        } catch (error: any) {
            logger.error('Error in multimodalRequest: ', error);

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
            prompt = this._llmConnector.enhancePrompt(prompt, config);
            const model = params.model || this._model;

            return await this._llmConnector.user(AccessCandidate.agent(agentId)).multimodalStreamRequest(prompt, { ...params, model });
        } catch (error: any) {
            logger.error('Error in multimodalRequest: ', error);

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

        const modelInfo = await this._modelProviderReq.getModelInfo(this._model, true);
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
            logger.warn('Max input context is 0, returning empty context window, This usually indicates a wrong model configuration');
        }

        logger.debug(
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
        logger.warn('Error in countTokens: ', error);
        return 0;
    }
}
