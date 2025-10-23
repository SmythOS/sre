import EventEmitter from 'events';
import { encodeChat } from 'gpt-tokenizer';
import OpenAI, { toFile } from 'openai';

import { BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';

import {
    APIKeySource,
    BasicCredentials,
    ILLMRequestContext,
    ILLMRequestFuncParams,
    TLLMChatResponse,
    TLLMMessageBlock,
    TLLMMessageRole,
    TLLMPreparedParams,
    TLLMToolResultMessageBlock,
    ToolData,
    TOpenAIRequestBody,
} from '@sre/types/LLM.types';

import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';
import { LLMConnector } from '../../LLMConnector';
import { OpenAIApiInterface, OpenAIApiInterfaceFactory } from './apiInterfaces';
import { HandlerDependencies } from './types';

const logger = Logger('OpenAIConnector');

export class OpenAIConnector extends LLMConnector {
    public name = 'LLM:OpenAI';

    private interfaceFactory: OpenAIApiInterfaceFactory;

    constructor() {
        super();

        this.interfaceFactory = new OpenAIApiInterfaceFactory();
    }

    /**
     * Get the appropriate API interface for the given interface type and context
     */
    private getApiInterface(interfaceType: string, context: ILLMRequestContext): OpenAIApiInterface {
        const deps: HandlerDependencies = {
            getClient: (context) => this.getClient(context),
            reportUsage: (usage, metadata) => this.reportUsage(usage, metadata),
        };

        return this.interfaceFactory.createInterface(interfaceType, context, deps);
    }

    /**
     * Determine the appropriate interface type based on context and capabilities
     */
    private getInterfaceType(context: ILLMRequestContext): string {
        // Start with model-specified interface or default
        let responseInterface = this.interfaceFactory.getInterfaceTypeFromModelInfo(context.modelInfo);

        // Auto-switch to Responses API when web search is enabled
        if (context.toolsInfo?.openai?.webSearch?.enabled === true) {
            responseInterface = 'responses';
        }

        return responseInterface;
    }

    protected async getClient(context: ILLMRequestContext): Promise<OpenAI> {
        const apiKey = (context.credentials as BasicCredentials)?.apiKey || '';
        const baseURL = context?.modelInfo?.baseURL;

        try {
            const openai = new OpenAI({ baseURL, apiKey });

            return openai;
        } catch (error) {
            console.error('Error: on OpenAI client initialization', error);
            throw error;
        }
    }

    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
            const _body = body as OpenAI.ChatCompletionCreateParams;

            // #region Validate the token limit only if it's a legacy model.
            if (context?.modelEntryName?.startsWith('legacy/')) {
                const messages = _body?.messages || [];
                const promptTokens = await this.computePromptTokens(messages, context);

                await this.validateTokenLimit({
                    acRequest,
                    promptTokens,
                    context,
                    maxTokens: _body.max_completion_tokens,
                });
            }
            // #endregion Validate token limit

            const responseInterface = this.getInterfaceType(context);
            const apiInterface = this.getApiInterface(responseInterface, context);

            const result = await apiInterface.createRequest(body, context);

            const message = result?.choices?.[0]?.message || { content: result?.output_text };
            const finishReason = result?.choices?.[0]?.finish_reason || result?.incomplete_details || 'stop';

            let toolsData: ToolData[] = [];
            let useTool = false;

            if (finishReason === 'tool_calls') {
                toolsData =
                    message?.tool_calls?.map((tool, index) => ({
                        index,
                        id: tool?.id,
                        type: tool?.type,
                        name: tool?.function?.name,
                        arguments: tool?.function?.arguments,
                        role: 'tool',
                    })) || [];

                useTool = true;
            }

            const usage = result?.usage;
            this.reportUsage(usage, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            return {
                content: message?.content ?? '',
                finishReason,
                useTool,
                toolsData,
                message,
                usage,
            };
        } catch (error) {
            logger.error(`request ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        try {
            logger.debug(`streamRequest ${this.name}`, acRequest.candidate);

            // #region Validate the token limit only if it's a legacy model.
            if (context?.modelEntryName?.startsWith('legacy/')) {
                const messages = body?.messages || body?.input || [];
                const promptTokens = await this.computePromptTokens(messages, context);

                await this.validateTokenLimit({
                    acRequest,
                    promptTokens,
                    context,
                    maxTokens: body.max_completion_tokens,
                });
            }
            // #endregion Validate token limit

            const responseInterface = this.getInterfaceType(context);
            const apiInterface = this.getApiInterface(responseInterface, context);

            const stream = await apiInterface.createStream(body, context);

            const emitter = apiInterface.handleStream(stream, context);

            return emitter;
        } catch (error) {
            logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    // #region Image Generation, will be moved to a different subsystem
    protected async imageGenRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<OpenAI.ImagesResponse> {
        const openai = await this.getClient(context);
        const response = await openai.images.generate(body as OpenAI.Images.ImageGenerateParams);

        return response as OpenAI.ImagesResponse;
    }

    protected async imageEditRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<OpenAI.ImagesResponse> {
        const _body = body as OpenAI.Images.ImageEditParams;

        const openai = await this.getClient(context);
        const response = await openai.images.edit(_body);

        return response as OpenAI.ImagesResponse;
    }
    // #endregion

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto', modelInfo = null }) {
        let tools = [];

        if (toolDefinitions && toolDefinitions.length > 0) {
            const interfaceType = modelInfo?.interface || 'chat.completions';

            const tempContext: ILLMRequestContext = {
                modelEntryName: '',
                agentId: '',
                teamId: '',
                isUserKey: false,
                modelInfo,
                credentials: null,
            } as ILLMRequestContext;

            const deps: HandlerDependencies = {
                getClient: (context) => this.getClient(context),
                reportUsage: (usage, metadata) => this.reportUsage(usage, metadata),
            };

            const apiInterface = this.interfaceFactory.createInterface(interfaceType, tempContext, deps);

            // Transform tools using the interface
            tools = apiInterface.transformToolsConfig({
                type,
                toolDefinitions,
                toolChoice: toolChoice as OpenAI.ChatCompletionToolChoiceOption,
                modelInfo,
            });
        }

        return tools?.length > 0 ? { tools, tool_choice: toolChoice || 'auto' } : {};
    }

    public transformToolMessageBlocks({
        messageBlock,
        toolsData,
    }: {
        messageBlock: TLLMMessageBlock;
        toolsData: ToolData[];
    }): TLLMToolResultMessageBlock[] {
        const messageBlocks: TLLMToolResultMessageBlock[] = [];

        if (messageBlock) {
            const transformedMessageBlock = {
                ...messageBlock,
                content: typeof messageBlock.content === 'object' ? JSON.stringify(messageBlock.content) : messageBlock.content,
            };
            if (transformedMessageBlock.tool_calls) {
                for (let toolCall of transformedMessageBlock.tool_calls) {
                    toolCall.function.arguments =
                        typeof toolCall.function.arguments === 'object' ? JSON.stringify(toolCall.function.arguments) : toolCall.function.arguments;
                }
            }
            messageBlocks.push(transformedMessageBlock);
        }

        const transformedToolsData = toolsData.map((toolData) => ({
            tool_call_id: toolData.id,
            role: TLLMMessageRole.Tool, // toolData.role as TLLMMessageRole, //should always be 'tool' for OpenAI
            name: toolData.name,
            content: typeof toolData.result === 'string' ? toolData.result : JSON.stringify(toolData.result), // Ensure content is a string
        }));

        return [...messageBlocks, ...transformedToolsData];
    }

    public getConsistentMessages(messages) {
        const _messages = LLMHelper.removeDuplicateUserMessages(messages);

        return _messages.map((message) => {
            const _message = { ...message };
            let textContent = '';

            if (message?.parts) {
                textContent = message.parts.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (Array.isArray(message?.content)) {
                textContent = message.content.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (message?.content) {
                textContent = message.content;
            }

            _message.content = textContent;

            return _message;
        });
    }

    private async validateTokenLimit({
        acRequest,
        maxTokens,
        promptTokens,
        context,
    }: {
        acRequest: AccessRequest;
        maxTokens: number;
        promptTokens: number;
        context: ILLMRequestContext;
    }): Promise<void> {
        const provider = await this.getProvider(acRequest, context.modelEntryName);

        await provider.validateTokensLimit({
            model: context.modelInfo,
            promptTokens,
            completionTokens: maxTokens,
            hasAPIKey: context.isUserKey,
        });
    }

    private async getProvider(acRequest: AccessRequest, modelEntryName: string) {
        const modelsProviderConnector = ConnectorService.getModelsProviderConnector();
        const modelsProvider = modelsProviderConnector.requester(acRequest.candidate as AccessCandidate);

        return modelsProvider;
    }

    /**
     * Safely compute prompt token count across different interfaces (Chat Completions, Responses)
     * - Normalizes message content to strings for encodeChat
     * - Handles vision prompts when files are present
     * - Never throws; defaults to 0 on failure
     */
    private async computePromptTokens(messages: any[], context: ILLMRequestContext): Promise<number> {
        try {
            if (context?.hasFiles) {
                const lastMessage = messages?.[messages?.length - 1] || {};
                const lastContent = lastMessage?.content ?? '';
                return await LLMHelper.countVisionPromptTokens(lastContent || '');
            }

            const normalized = (messages || [])
                .map((m) => {
                    if (!m || !m.role) return null;
                    let content = '';
                    if (Array.isArray(m.content)) {
                        content = m.content.map((b) => (typeof b?.text === 'string' ? b.text : '')).join(' ');
                    } else if (typeof m.content === 'string') {
                        content = m.content;
                    } else if (m.content !== undefined && m.content !== null) {
                        try {
                            content = JSON.stringify(m.content);
                        } catch (_) {
                            content = '';
                        }
                    }
                    return { role: m.role, content };
                })
                .filter(Boolean);

            return encodeChat(normalized as any, 'gpt-4')?.length || 0;
        } catch (_) {
            return 0;
        }
    }

    /**
     * Prepare request body for OpenAI Responses API
     * Uses MessageTransformer and ToolsTransformer for clean interface transformations
     */

    private async prepareImageGenerationBody(params: TLLMPreparedParams): Promise<OpenAI.Images.ImageGenerateParams> {
        const { model, size, quality, n, responseFormat, style } = params;

        const body: OpenAI.Images.ImageGenerateParams = {
            prompt: params.prompt,
            model: model as string,
            size: size as OpenAI.Images.ImageGenerateParams['size'],
            n: n || 1,
        };

        if (quality) {
            body.quality = quality;
        }

        if (style) {
            body.style = style;
        }

        return body;
    }

    private async prepareImageEditBody(params: TLLMPreparedParams): Promise<OpenAI.Images.ImageEditParams> {
        const { model, size, n, responseFormat } = params;

        const body: OpenAI.Images.ImageEditParams = {
            prompt: params.prompt,
            model: model as string,
            size: size as OpenAI.Images.ImageEditParams['size'],
            n: n || 1,
            image: null,
        };

        const files: BinaryInput[] = params?.files || [];

        if (files.length > 0) {
            const images = await Promise.all(
                files.map(
                    async (file) =>
                        await toFile(await file.getReadStream(), await file.getName(), {
                            type: file.mimetype,
                        })
                )
            );

            // Assign only the first image file as required by the OpenAI image-edit endpoint
            body.image = images[0];
        }

        return body;
    }

    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<TOpenAIRequestBody> {
        // Handle special capabilities first (these override interface type)
        if (params.capabilities?.imageGeneration === true) {
            const capabilityType = params?.files?.length > 0 ? 'image-edit' : 'image-generation';
            return this.prepareRequestBody(params, capabilityType);
        }

        // Create a minimal context to use the same interface selection logic
        const minimalContext: ILLMRequestContext = {
            modelInfo: params.modelInfo,
            toolsInfo: params.toolsInfo,
        } as ILLMRequestContext;

        const responseInterface = this.getInterfaceType(minimalContext);

        // Use interface-specific preparation
        return this.prepareRequestBody(params, responseInterface);
    }

    private async prepareRequestBody(params: TLLMPreparedParams, preparationType: string): Promise<TOpenAIRequestBody> {
        // Create a minimal context for body preparation - the interface may need access to model info
        const minimalContext: ILLMRequestContext = {
            modelInfo: params.modelInfo,
            modelEntryName: params.modelEntryName,
            agentId: params.agentId,
            teamId: params.teamId,
            isUserKey: params.isUserKey,
            credentials: params.credentials,
            hasFiles: params.files && params.files.length > 0,
            toolsInfo: params.toolsInfo,
        };

        const preparers = {
            'chat.completions': async () => {
                const apiInterface = this.getApiInterface('chat.completions', minimalContext);
                return apiInterface.prepareRequestBody(params);
            },
            responses: async () => {
                const apiInterface = this.getApiInterface('responses', minimalContext);
                return apiInterface.prepareRequestBody(params);
            },
            'image-generation': () => this.prepareImageGenerationBody(params),
            'image-edit': () => this.prepareImageEditBody(params),
            // Future interfaces can be added here
        };

        const preparer = preparers[preparationType];
        if (!preparer) {
            throw new Error(`Unsupported preparation type: ${preparationType}`);
        }

        return preparer();
    }

    protected reportUsage(
        usage: OpenAI.Completions.CompletionUsage & {
            input_tokens?: number;
            output_tokens?: number;
            input_tokens_details?: { cached_tokens?: number };
            prompt_tokens_details?: { cached_tokens?: number };
            cost?: number; // for web search tool
        },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const inputTokens = usage?.input_tokens || usage?.prompt_tokens - (usage?.prompt_tokens_details?.cached_tokens || 0); // Returned by the search tool

        const outputTokens =
            usage?.output_tokens || // Returned by the search tool
            usage?.completion_tokens ||
            0;

        const cachedInputTokens =
            usage?.input_tokens_details?.cached_tokens || // Returned by the search tool
            usage?.prompt_tokens_details?.cached_tokens ||
            0;

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            input_tokens_cache_write: 0,
            input_tokens_cache_read: cachedInputTokens,
            cost: usage?.cost || 0, // for web search tool
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }
}
