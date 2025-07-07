import EventEmitter from 'events';
import { encodeChat } from 'gpt-tokenizer';
import type { Stream } from 'openai/streaming';

import { BUILT_IN_MODEL_PREFIX, JSON_RESPONSE_INSTRUCTION, SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';
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
    TLLMEvent,
    TLLMMessageBlock,
    TLLMMessageRole,
    TLLMParams,
    TLLMToolResultMessageBlock,
    ToolData,
    TOpenAIRequestBody,
    TOpenAIResponseToolChoice,
} from '@sre/types/LLM.types';

import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { LLMConnector } from '../LLMConnector';

//import OpenAI, { toFile } from 'openai';

import { LazyLoadFallback } from '@sre/utils/lazy-client';
import type * as OpenAITypes from 'openai';

let OpenAIModule: typeof OpenAITypes | undefined;
//#IFDEF STATIC OPENAI_STATIC
import * as _OpenAIModule from 'openai';
OpenAIModule = _OpenAIModule;
//#ENDIF

const MODELS_WITH_JSON_RESPONSE = ['gpt-4.5-preview', 'gpt-4o-2024-08-06', 'gpt-4o-mini-2024-07-18', 'gpt-4-turbo', 'gpt-3.5-turbo'];

type TSearchTool = 'web_search_preview';
type TSearchContextSize = 'low' | 'medium' | 'high';
type TSearchLocation = {
    type: 'approximate';
    city?: string;
    country?: string;
    region?: string;
    timezone?: string;
};

// per 1k requests
const costForNormalModels = {
    low: 30 / 1000,
    medium: 35 / 1000,
    high: 50 / 1000,
};
const costForMiniModels = {
    low: 25 / 1000,
    medium: 27.5 / 1000,
    high: 30 / 1000,
};

const SEARCH_TOOL = {
    type: 'web_search_preview' as TSearchTool,
    cost: {
        'gpt-4.1': costForNormalModels,
        'gpt-4o': costForNormalModels,
        'gpt-4o-search': costForNormalModels,

        'gpt-4.1-mini': costForMiniModels,
        'gpt-4o-mini': costForMiniModels,
        'gpt-4o-mini-search': costForMiniModels,
    },
};

export class OpenAIConnector extends LLMConnector {
    public name = 'LLM:OpenAI';

    //private openai: OpenAI;
    private validImageMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.image;
    private validDocumentMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.document;

    private async getClient(params: ILLMRequestContext): Promise<OpenAITypes.OpenAI> {
        const { OpenAI } = await LazyLoadFallback<typeof OpenAIModule>(OpenAIModule, 'openai');
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;
        const baseURL = params?.modelInfo?.baseURL;

        if (!apiKey) throw new Error('Please provide an API key for OpenAI');

        return new OpenAI({ baseURL, apiKey });
    }

    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        const _body = body as OpenAITypes.OpenAI.ChatCompletionCreateParams;

        try {
            const openai = await this.getClient(context);
            // #region Validate token limit
            const messages = _body?.messages || [];
            const lastMessage = messages[messages.length - 1];

            const promptTokens = context?.hasFiles
                ? await LLMHelper.countVisionPromptTokens(lastMessage?.content)
                : encodeChat(messages as any, 'gpt-4')?.length;

            await this.validateTokenLimit({
                acRequest,
                promptTokens,
                context,
                maxTokens: _body.max_completion_tokens,
            });
            // #endregion Validate token limit

            const result = (await openai.chat.completions.create(_body)) as OpenAITypes.OpenAI.ChatCompletion;
            const message = result?.choices?.[0]?.message;
            const finishReason = result?.choices?.[0]?.finish_reason;

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
        } catch (error: any) {
            throw error;
        }
    }

    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        const _body = body as OpenAITypes.OpenAI.ChatCompletionCreateParams;

        const emitter = new EventEmitter();
        const usage_data: any[] = [];
        const reportedUsage: any[] = [];

        try {
            const openai = await this.getClient(context);
            // #region Validate token limit
            const messages = _body?.messages || [];
            const lastMessage = messages[messages.length - 1];

            const promptTokens = context?.hasFiles
                ? await LLMHelper.countVisionPromptTokens(lastMessage?.content)
                : encodeChat(messages as any, 'gpt-4')?.length;

            await this.validateTokenLimit({
                acRequest,
                promptTokens,
                context,
                maxTokens: _body.max_completion_tokens,
            });
            // #endregion Validate token limit

            let finishReason = 'stop';

            const stream = await openai.chat.completions.create({ ..._body, stream: true, stream_options: { include_usage: true } });

            // Process stream asynchronously while as we need to return emitter immediately
            (async () => {
                let delta: Record<string, any> = {};

                let toolsData: any = [];

                for await (const part of stream) {
                    delta = part.choices[0]?.delta;
                    const usage = part.usage;

                    if (usage) {
                        usage_data.push(usage);
                    }
                    emitter.emit('data', delta);

                    if (!delta?.tool_calls && delta?.content) {
                        emitter.emit('content', delta?.content, delta?.role);
                    }
                    //_stream = toolCallsStream;
                    if (delta?.tool_calls) {
                        const toolCall = delta?.tool_calls?.[0];
                        const index = toolCall?.index;

                        toolsData[index] = {
                            index,
                            role: 'tool',
                            id: (toolsData?.[index]?.id || '') + (toolCall?.id || ''),
                            type: (toolsData?.[index]?.type || '') + (toolCall?.type || ''),
                            name: (toolsData?.[index]?.name || '') + (toolCall?.function?.name || ''),
                            arguments: (toolsData?.[index]?.arguments || '') + (toolCall?.function?.arguments || ''),
                        };

                        continue;
                    }
                    if (part.choices[0]?.finish_reason) {
                        finishReason = part.choices[0]?.finish_reason;
                    }
                }
                if (toolsData?.length > 0) {
                    for (let tool of toolsData) {
                        if (tool.type.includes('functionfunction')) {
                            tool.type = 'function'; //path wrong tool call generated by LM Studio
                            //FIXME: use cleaner method to fix wrong tool call formats
                        }
                    }
                    emitter.emit(TLLMEvent.ToolInfo, toolsData);
                }

                usage_data.forEach((usage) => {
                    // probably we can acc them and send them as one event
                    const _reported = this.reportUsage(usage, {
                        modelEntryName: context.modelEntryName,
                        keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId: context.agentId,
                        teamId: context.teamId,
                    });

                    reportedUsage.push(_reported);
                });
                if (finishReason !== 'stop') {
                    emitter.emit('interrupted', finishReason);
                }

                setTimeout(() => {
                    emitter.emit('end', toolsData, reportedUsage, finishReason);
                }, 100);
            })();
            return emitter;
        } catch (error: any) {
            throw error;
        }
    }

    protected async webSearchRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        const _body = body as OpenAITypes.OpenAI.Responses.ResponseCreateParams;

        const emitter = new EventEmitter();
        const usage_data = [];
        const reportedUsage = [];

        try {
            const openai = await this.getClient(context);
            let finishReason = 'stop';
            const stream = (await openai.responses.create(_body)) as Stream<OpenAITypes.OpenAI.Responses.ResponseStreamEvent>;

            // Process stream asynchronously while we need to return emitter immediately
            (async () => {
                let toolsData: any = [];
                let currentToolCall = null;

                for await (const part of stream) {
                    // Handle different event types from the stream
                    if ('type' in part) {
                        const event = part.type;

                        switch (event) {
                            case 'response.output_text.delta': {
                                if (part?.delta) {
                                    // Emit content in delta format for compatibility
                                    const deltaMsg = {
                                        role: 'assistant',
                                        content: part.delta,
                                    };
                                    emitter.emit('data', deltaMsg);
                                    emitter.emit('content', part.delta, 'assistant');
                                }
                                break;
                            }
                            // TODO: Handle other events
                            default: {
                                break;
                            }
                        }
                    }

                    if ('response' in part) {
                        // Handle usage statistics
                        if (part.response?.usage) {
                            usage_data.push(part.response.usage);
                        }
                    }
                }

                // Report usage statistics
                const modelName = context.modelEntryName?.replace(BUILT_IN_MODEL_PREFIX, '');

                const searchTool = _body.tools?.[0] as OpenAITypes.OpenAI.Responses.WebSearchTool;
                const cost = SEARCH_TOOL.cost?.[modelName]?.[searchTool?.search_context_size] || 0;

                this.reportUsage(
                    {
                        cost,

                        // 👇 Just to avoid a TypeScript error.
                        completion_tokens: 0,
                        prompt_tokens: 0,
                        total_tokens: 0,
                        // 👆 Just to avoid a TypeScript error.
                    },
                    {
                        modelEntryName: context.modelEntryName,
                        keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId: context.agentId,
                        teamId: context.teamId,
                    }
                );

                // Emit interrupted event if finishReason is not 'stop'
                if (finishReason !== 'stop') {
                    emitter.emit('interrupted', finishReason);
                }

                // Emit end event with same data structure as v1
                setTimeout(() => {
                    emitter.emit('end', toolsData, reportedUsage, finishReason);
                }, 100);
            })();

            return emitter;
        } catch (error: any) {
            throw error;
        }
    }

    // #region Image Generation, will be moved to a different subsystem
    protected async imageGenRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<OpenAITypes.OpenAI.ImagesResponse> {
        try {
            const openai = await this.getClient(context);
            const response = await openai.images.generate(body as OpenAITypes.OpenAI.Images.ImageGenerateParams);

            return response;
        } catch (error: any) {
            throw error;
        }
    }

    protected async imageEditRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<OpenAITypes.OpenAI.ImagesResponse> {
        const _body = body as OpenAITypes.OpenAI.Images.ImageEditParams;

        try {
            const openai = await this.getClient(context);
            const response = await openai.images.edit(_body);

            return response;
        } catch (error: any) {
            throw error;
        }
    }

    private async processImageData(files: BinaryInput[], agentId: string): Promise<any[]> {
        const validSources = this.getValidImageFiles(files);
        if (validSources.length === 0) {
            return [];
        }
        return await this.getImageData(validSources, agentId);
    }

    private getValidDocumentFiles(files: BinaryInput[]): BinaryInput[] {
        const validSources = [];
        for (let file of files) {
            if (this.validDocumentMimeTypes.includes(file?.mimetype)) {
                validSources.push(file);
            }
        }

        return validSources;
    }

    private async processDocumentData(files: BinaryInput[], agentId: string): Promise<any[]> {
        const validSources = this.getValidDocumentFiles(files);
        if (validSources.length === 0) {
            return [];
        }
        return await this.getDocumentData(validSources, agentId);
    }

    protected async reqBodyAdapter(params: TLLMParams): Promise<TOpenAIRequestBody> {
        // if it's web search request and the model has search capability, then we need to prepare the request body for the web search request
        if (params?.useWebSearch && params.capabilities?.search === true) {
            return this.prepareBodyForWebSearchRequest(params);
        }

        if (params.capabilities?.imageGeneration === true) {
            if (params?.files?.length > 0) {
                return this.prepareBodyForImageEditRequest(params);
            } else {
                return this.prepareBodyForImageGenRequest(params);
            }
        }

        if (params.capabilities?.imageEditing === true) {
        }

        // In default, we will prepare the request body
        return this.prepareBody(params);
    }

    protected reportUsage(
        usage: OpenAITypes.OpenAI.Completions.CompletionUsage & {
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

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        let tools: OpenAITypes.OpenAI.ChatCompletionTool[] = [];

        if (type === 'function') {
            tools = toolDefinitions.map((tool) => {
                const { name, description, properties, requiredFields } = tool;

                return {
                    type: 'function',
                    function: {
                        name,
                        description,
                        parameters: {
                            type: 'object',
                            properties,
                            required: requiredFields,
                        },
                    },
                };
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

    private getValidImageFiles(files: BinaryInput[]) {
        const validSources = [];

        for (let file of files) {
            if (this.validImageMimeTypes.includes(file?.mimetype)) {
                validSources.push(file);
            }
        }

        return validSources;
    }

    private async getImageData(
        files: BinaryInput[],
        agentId: string
    ): Promise<
        {
            type: string;
            image_url: { url: string };
        }[]
    > {
        try {
            const imageData = [];

            for (let file of files) {
                const bufferData = await file.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');
                const url = `data:${file.mimetype};base64,${base64Data}`;

                imageData.push({
                    type: 'image_url',
                    image_url: { url },
                });
            }

            return imageData;
        } catch (error) {
            throw error;
        }
    }

    private async getDocumentData(
        files: BinaryInput[],
        agentId: string
    ): Promise<
        {
            type: string;
            file: {
                filename: string;
                file_data: string;
            };
        }[]
    > {
        try {
            const documentData = [];

            // Note: We're embedding the file data in the prompt, but we should ideally be uploading the files to OpenAI first
            // in case we start to support bigger files. Refer to this guide: https://platform.openai.com/docs/guides/pdf-files?api-mode=chat
            for (let file of files) {
                const bufferData = await file.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');
                const fileData = `data:${file.mimetype};base64,${base64Data}`;

                documentData.push({
                    type: 'file',
                    file: {
                        file_data: fileData,
                        filename: await file.getName(),
                    },
                });
            }

            return documentData;
        } catch (error) {
            throw error;
        }
    }

    private getWebSearchTool(params: TLLMParams) {
        const searchCity = params?.webSearchCity;
        const searchCountry = params?.webSearchCountry;
        const searchRegion = params?.webSearchRegion;
        const searchTimezone = params?.webSearchTimezone;

        const location: {
            type: 'approximate';
            city?: string;
            country?: string;
            region?: string;
            timezone?: string;
        } = {
            type: 'approximate', // Required, always be 'approximate' when we implement location
        };

        if (searchCity) location.city = searchCity;
        if (searchCountry) location.country = searchCountry;
        if (searchRegion) location.region = searchRegion;
        if (searchTimezone) location.timezone = searchTimezone;

        const searchTool: {
            type: TSearchTool;
            search_context_size: TSearchContextSize;
            user_location?: TSearchLocation;
        } = {
            type: SEARCH_TOOL.type,
            search_context_size: params?.webSearchContextSize || 'medium',
        };

        // Add location only if any location field is provided. Since 'type' is always present, we check if the number of keys in the location object is greater than 1.
        if (Object.keys(location).length > 1) {
            searchTool.user_location = location;
        }

        return searchTool;
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
            model: context.modelEntryName,
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

    private async prepareBodyForWebSearchRequest(params: TLLMParams): Promise<OpenAITypes.OpenAI.Responses.ResponseCreateParams> {
        const body: OpenAITypes.OpenAI.Responses.ResponseCreateParams = {
            model: params.model as string,
            input: params.messages,
            stream: true,
        };

        if (params?.max_output_tokens !== undefined) {
            body.max_output_tokens = params.max_output_tokens;
        }

        // #region Handle tools configuration

        const searchTool = this.getWebSearchTool(params);
        body.tools = [searchTool];

        if (params?.toolsConfig?.tool_choice) {
            body.tool_choice = params.toolsConfig.tool_choice as TOpenAIResponseToolChoice;
        }

        return body;
    }

    private async prepareBodyForImageGenRequest(params: TLLMParams): Promise<OpenAITypes.OpenAI.Images.ImageGenerateParams> {
        const { model, size, quality, n, responseFormat, style } = params;

        const body: OpenAITypes.OpenAI.Images.ImageGenerateParams = {
            prompt: params.prompt,
            model: model as string,
            size: size as OpenAITypes.OpenAI.Images.ImageGenerateParams['size'],
            n: n || 1,
        };

        if (quality) {
            body.quality = quality;
        }

        // * Models like 'gpt-image-1' do not support the 'response_format' parameter, so we only set it when explicitly specified.
        if (responseFormat) {
            body.response_format = responseFormat;
        }

        if (style) {
            body.style = style;
        }

        return body;
    }

    private async prepareBodyForImageEditRequest(params: TLLMParams): Promise<OpenAITypes.OpenAI.Images.ImageEditParams> {
        const { model, size, n, responseFormat } = params;

        const { toFile } = await LazyLoadFallback<typeof OpenAIModule>(OpenAIModule, 'openai');

        const body: OpenAITypes.OpenAI.Images.ImageEditParams = {
            prompt: params.prompt,
            model: model as string,
            size: size as OpenAITypes.OpenAI.Images.ImageEditParams['size'],
            n: n || 1,
            image: null,
        };

        // * Models like 'gpt-image-1' do not support the 'response_format' parameter, so we only set it when explicitly specified.
        if (responseFormat) {
            body.response_format = responseFormat;
        }

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

            body.image = images;
        }

        return body;
    }

    private async prepareBody(params: TLLMParams): Promise<OpenAITypes.OpenAI.ChatCompletionCreateParams> {
        const messages = await this.prepareMessages(params);

        //#region Handle JSON response format
        // TODO: We have better parameter to have structured response, need to implement it.
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (messages?.[0]?.role === TLLMMessageRole.System) {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            if (MODELS_WITH_JSON_RESPONSE.includes(params.model as string)) {
                params.responseFormat = { type: 'json_object' };
            } else {
                params.responseFormat = undefined; // We need to reset it, otherwise 'json' will be passed as a parameter to the OpenAI API
            }
        }
        //#endregion Handle JSON response format

        const body: OpenAITypes.OpenAI.ChatCompletionCreateParams = {
            model: params.model as string,
            messages,
        };

        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            body.tools = params?.toolsConfig?.tools as OpenAITypes.OpenAI.ChatCompletionTool[];
        }

        if (params?.toolsConfig?.tool_choice) {
            body.tool_choice = params?.toolsConfig?.tool_choice as OpenAITypes.OpenAI.ChatCompletionToolChoiceOption;
        }

        if (params?.maxTokens !== undefined) body.max_completion_tokens = params.maxTokens;
        if (params?.temperature !== undefined) body.temperature = params.temperature;
        if (params?.topP !== undefined) body.top_p = params.topP;
        if (params?.frequencyPenalty !== undefined) body.frequency_penalty = params.frequencyPenalty;
        if (params?.presencePenalty !== undefined) body.presence_penalty = params.presencePenalty;
        if (params?.responseFormat) body.response_format = params.responseFormat;
        if (params?.stopSequences?.length) body.stop = params.stopSequences;

        return body;
    }

    private async prepareMessages(params: TLLMParams) {
        const messages = params?.messages || [];

        const files: BinaryInput[] = params?.files || []; // Assign file from the original parameters to avoid overwriting the original constructor

        if (files.length > 0) {
            // #region Upload files
            const promises = [];
            const _files = [];

            for (let image of files) {
                const binaryInput = BinaryInput.from(image);
                promises.push(binaryInput.upload(AccessCandidate.agent(params.agentId)));

                _files.push(binaryInput);
            }

            await Promise.all(promises);
            // #endregion Upload files

            const validImageFiles = this.getValidImageFiles(_files);
            const validDocumentFiles = this.getValidDocumentFiles(_files);

            const imageData = validImageFiles.length > 0 ? await this.processImageData(validImageFiles, params.agentId) : [];
            const documentData = validDocumentFiles.length > 0 ? await this.processDocumentData(validDocumentFiles, params.agentId) : [];

            const userMessage = Array.isArray(messages) ? messages.pop() : {};
            const prompt = userMessage?.content || '';

            const promptData = [{ type: 'text', text: prompt || '' }, ...imageData, ...documentData];

            messages.push({ role: 'user', content: promptData });
        }

        return messages;
    }
}
