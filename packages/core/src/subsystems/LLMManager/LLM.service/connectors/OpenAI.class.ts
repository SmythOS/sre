import EventEmitter from 'events';
import OpenAI, { toFile } from 'openai';
import { Uploadable } from 'openai/uploads';
import { encodeChat } from 'gpt-tokenizer';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import { JSON_RESPONSE_INSTRUCTION, SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';

import {
    TLLMParams,
    ToolData,
    TLLMMessageBlock,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    GenerateImageConfig,
    APIKeySource,
    TLLMParamsV2,
} from '@sre/types/LLM.types';

import { LLMChatResponse, LLMConnector } from '../LLMConnector';
import SystemEvents from '@sre/Core/SystemEvents';
import { ImageEditParams } from 'openai/resources/images';
import { CustomLLMRegistry } from '@sre/LLMManager/CustomLLMRegistry.class';

const console = Logger('OpenAIConnector');

const MODELS_WITH_JSON_RESPONSE = ['gpt-4.5-preview', 'gpt-4o-2024-08-06', 'gpt-4o-mini-2024-07-18', 'gpt-4-turbo', 'gpt-3.5-turbo'];
const reasoningModels = [
    'o4-mini',
    'o4-mini-2025-04-16',
    'o3',
    'o3-2025-04-16',
    'o3-mini',
    'o3-mini-2025-01-31',
    'o1',
    'o1-mini',
    'o1-preview',
    'o1-2024-12-17',
    'o1-mini-2024-09-12',
    'o1-preview-2024-09-12',
];

export class OpenAIConnector extends LLMConnector {
    public name = 'LLM:OpenAI';

    private validImageMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.image;
    private validDocumentMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.document;

    protected async chatRequest(acRequest: AccessRequest, params: TLLMParams, agent: string | Agent): Promise<LLMChatResponse> {
        const messages = params?.messages || [];

        const agentId = agent instanceof Agent ? agent.id : agent;

        //#region Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (reasoningModels.includes(params.model)) {
                // If the model doesn't support system prompt, then we need to add JSON response instruction to the last message
                if (messages?.[0]?.role === TLLMMessageRole.System) {
                    delete messages[0];
                    const lastIndex = messages.length - 1;
                    messages[lastIndex].content += JSON_RESPONSE_INSTRUCTION;
                } else {
                    const lastIndex = messages.length - 1;
                    messages[lastIndex].content += JSON_RESPONSE_INSTRUCTION;
                }
            } else {
                if (messages?.[0]?.role === TLLMMessageRole.System) {
                    messages[0].content += JSON_RESPONSE_INSTRUCTION;
                } else {
                    messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
                }
            }

            if (MODELS_WITH_JSON_RESPONSE.includes(params.model)) {
                params.responseFormat = { type: 'json_object' };
            } else {
                params.responseFormat = undefined; // We need to reset it, otherwise 'json' will be passed as a parameter to the OpenAI API
            }
        }
        //#endregion Handle JSON response format

        // Check if the team has their own API key, then use it
        const apiKey = params?.credentials?.apiKey;

        if (!apiKey) {
            throw new Error('An API key is required to use this model.');
        }

        const openai = new OpenAI({
            //FIXME: use config.env instead of process.env
            apiKey: apiKey,
            baseURL: params.baseURL,
        });

        const chatCompletionArgs: OpenAI.ChatCompletionCreateParams & { max_completion_tokens?: number } = {
            model: params.model,
            messages,
        };

        if (params?.maxTokens !== undefined) {
            const maxTokensKey = reasoningModels.includes(params.model) ? 'max_completion_tokens' : 'max_tokens';
            chatCompletionArgs[maxTokensKey] = params.maxTokens;
        }
        if (params?.temperature !== undefined) chatCompletionArgs.temperature = params.temperature;
        // Top P is not supported for o1 models
        if (params?.topP !== undefined && !reasoningModels.includes(params.model)) chatCompletionArgs.top_p = params.topP;
        if (params?.frequencyPenalty !== undefined) chatCompletionArgs.frequency_penalty = params.frequencyPenalty;
        if (params?.presencePenalty !== undefined) chatCompletionArgs.presence_penalty = params.presencePenalty;
        if (params?.stopSequences?.length) chatCompletionArgs.stop = params.stopSequences;

        if (params.responseFormat) {
            chatCompletionArgs.response_format = params.responseFormat;
        }

        try {
            // Validate token limit
            const promptTokens = encodeChat(messages, 'gpt-4')?.length;

            await LLMRegistry.validateTokensLimit({
                model: params?.model,
                promptTokens,
                completionTokens: params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const response = await openai.chat.completions.create(chatCompletionArgs);

            const content = response?.choices?.[0]?.message.content;
            const finishReason = response?.choices?.[0]?.finish_reason;
            const usage = response?.usage as any;

            this.reportUsage(usage, {
                modelEntryName: params.modelEntryName,
                keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId,
                teamId: params.teamId,
            });

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent: string | Agent) {
        const messages = params?.messages || [];

        //#region Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (messages?.[0]?.role === TLLMMessageRole.System) {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            if (MODELS_WITH_JSON_RESPONSE.includes(params.model)) {
                params.responseFormat = { type: 'json_object' };
            } else {
                params.responseFormat = undefined; // We need to reset it, otherwise 'json' will be passed as a parameter to the OpenAI API
            }
        }
        //#endregion Handle JSON response format

        const agentId = agent instanceof Agent ? agent.id : agent;

        const fileSources: BinaryInput[] = params?.fileSources || []; // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const validSources = this.getValidImageFileSources(fileSources);
        const imageData = await this.getImageData(validSources, agentId);

        // Add user message
        const promptData = [{ type: 'text', text: prompt || '' }, ...imageData];

        messages.push({ role: 'user', content: promptData });

        try {
            // Check if the team has their own API key, then use it
            const apiKey = params?.credentials?.apiKey;

            if (!apiKey) {
                throw new Error('An API key is required to use this model.');
            }

            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: params.baseURL,
            });

            const chatCompletionArgs: OpenAI.ChatCompletionCreateParams = {
                model: params.model,
                messages,
            };

            if (params?.maxTokens !== undefined) {
                const maxTokensKey = reasoningModels.includes(params.model) ? 'max_completion_tokens' : 'max_tokens';
                chatCompletionArgs[maxTokensKey] = params.maxTokens;
            }
            if (params?.temperature !== undefined) chatCompletionArgs.temperature = params.temperature;
            if (params?.topP !== undefined) chatCompletionArgs.top_p = params.topP;
            if (params?.frequencyPenalty !== undefined) chatCompletionArgs.frequency_penalty = params.frequencyPenalty;
            if (params?.presencePenalty !== undefined) chatCompletionArgs.presence_penalty = params.presencePenalty;
            if (params?.responseFormat !== undefined) chatCompletionArgs.response_format = params.responseFormat;
            if (params?.stopSequences?.length) chatCompletionArgs.stop = params.stopSequences;

            // Validate token limit
            const promptTokens = await LLMHelper.countVisionPromptTokens(promptData);

            await LLMRegistry.validateTokensLimit({
                model: params?.model,
                promptTokens,
                completionTokens: params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const response: any = await openai.chat.completions.create(chatCompletionArgs);

            const content = response?.choices?.[0]?.message.content;
            const usage = response?.usage;

            this.reportUsage(usage, {
                modelEntryName: params.modelEntryName,
                keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId,
                teamId: params.teamId,
            });

            return { content, finishReason: response?.choices?.[0]?.finish_reason };
        } catch (error) {
            throw error;
        }
    }

    private async processImageData(fileSources: BinaryInput[], agentId: string): Promise<any[]> {
        const validSources = this.getValidImageFileSources(fileSources);
        if (validSources.length === 0) {
            return [];
        }
        return await this.getImageData(validSources, agentId);
    }

    private getValidDocumentFileSources(fileSources: BinaryInput[]): BinaryInput[] {
        const validSources = [];
        for (let fileSource of fileSources) {
            if (this.validDocumentMimeTypes.includes(fileSource?.mimetype)) {
                validSources.push(fileSource);
            }
        }

        return validSources;
    }

    private async processDocumentData(fileSources: BinaryInput[], agentId: string): Promise<any[]> {
        const validSources = this.getValidDocumentFileSources(fileSources);
        if (validSources.length === 0) {
            return [];
        }
        return await this.getDocumentData(validSources, agentId);
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent: string | Agent): Promise<LLMChatResponse> {
        const messages = params?.messages || [];

        //#region Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (messages?.[0]?.role === TLLMMessageRole.System) {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            if (MODELS_WITH_JSON_RESPONSE.includes(params.model)) {
                params.responseFormat = { type: 'json_object' };
            } else {
                params.responseFormat = undefined; // We need to reset it, otherwise 'json' will be passed as a parameter to the OpenAI API
            }
        }
        //#endregion Handle JSON response format

        const agentId = agent instanceof Agent ? agent.id : agent;
        const fileSources: BinaryInput[] = params?.fileSources || [];
        const validImageFileSources = this.getValidImageFileSources(fileSources);
        const validDocumentFileSources = this.getValidDocumentFileSources(fileSources);

        // TODO: GenAILLM class already handles this, so we don't really need it. But in case it's needed, uncomment and
        // handle the invalid files in the prompt to let the user know that some files were not processed.

        // const areAllFilesValid = fileSources.length === validImageFileSources.length + validDocumentFileSources.length;
        // const invalidFileNames = areAllFilesValid
        //     ? []
        //     : // get all the original file sources that are not valid image or document
        //       fileSources
        //           .filter((file) => !validImageFileSources.includes(file) && !validDocumentFileSources.includes(file))
        //           .map(async (file) => await file.getName());

        const imageData = validImageFileSources.length > 0 ? await this.processImageData(validImageFileSources, agentId) : [];
        const documentData = validDocumentFileSources.length > 0 ? await this.processDocumentData(validDocumentFileSources, agentId) : [];

        const promptData = [{ type: 'text', text: prompt || '' }, ...imageData, ...documentData];

        messages.push({ role: 'user', content: promptData });

        try {
            // Check if the team has their own API key, then use it
            const apiKey = params?.credentials?.apiKey;

            if (!apiKey) {
                throw new Error('An API key is required to use this model.');
            }

            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: params.baseURL,
            });

            const chatCompletionArgs: OpenAI.ChatCompletionCreateParams = {
                model: params.model,
                messages,
            };

            if (params?.maxTokens !== undefined) {
                const maxTokensKey = reasoningModels.includes(params.model) ? 'max_completion_tokens' : 'max_tokens';
                chatCompletionArgs[maxTokensKey] = params.maxTokens;
            }
            if (params?.temperature !== undefined) chatCompletionArgs.temperature = params.temperature;
            if (params?.topP !== undefined) chatCompletionArgs.top_p = params.topP;
            if (params?.frequencyPenalty !== undefined) chatCompletionArgs.frequency_penalty = params.frequencyPenalty;
            if (params?.presencePenalty !== undefined) chatCompletionArgs.presence_penalty = params.presencePenalty;
            if (params?.responseFormat !== undefined) chatCompletionArgs.response_format = params.responseFormat;
            if (params?.stopSequences?.length) chatCompletionArgs.stop = params.stopSequences;

            // Validate token limit
            const promptTokens = await LLMHelper.countVisionPromptTokens(promptData);

            await LLMRegistry.validateTokensLimit({
                model: params?.model,
                promptTokens,
                completionTokens: params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const response = await openai.chat.completions.create(chatCompletionArgs);

            const content = response?.choices?.[0]?.message.content;
            const usage = response?.usage;
            this.reportUsage(usage, {
                modelEntryName: params.modelEntryName,
                keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId,
                teamId: params.teamId,
            });

            return { content, finishReason: response?.choices?.[0]?.finish_reason };
        } catch (error) {
            throw error;
        }
    }

    // #region Image Generation, will be moved to a different subsystem
    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent: string | Agent): Promise<OpenAI.ImagesResponse> {
        try {
            const { model, size, quality, n, responseFormat, style } = params;

            const args: GenerateImageConfig & { prompt: string } = {
                prompt,
                model,
                size,
                n: n || 1,
            };

            if (quality) {
                args.quality = quality;
            }

            // * Models like 'gpt-image-1' do not support the 'response_format' parameter, so we only set it when explicitly specified.
            if (responseFormat) {
                args.response_format = responseFormat;
            }

            if (style) {
                args.style = style;
            }

            const apiKey = params?.credentials?.apiKey;
            if (!apiKey) {
                throw new Error('OpenAI API key is missing. Please provide a valid API key in the vault to proceed with Image Generation.');
            }

            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: params?.baseURL,
            });

            const response = await openai.images.generate(args);

            return response;
        } catch (error: any) {
            console.warn('Error generating image(s) with DALL·E: ', error);

            throw error;
        }
    }

    protected async imageEditRequest(
        acRequest: AccessRequest,
        prompt,
        params: TLLMParams & { size: '256x256' | '512x512' | '1024x1024' },
        agent: string | Agent
    ): Promise<OpenAI.ImagesResponse> {
        try {
            const { model, size, quality, n, responseFormat, style } = params;

            const args: ImageEditParams = {
                prompt,
                model,
                size,
                n: n || 1,
                image: null,
            };

            // * Models like 'gpt-image-1' do not support the 'response_format' parameter, so we only set it when explicitly specified.
            if (responseFormat) {
                args.response_format = responseFormat;
            }

            const apiKey = params?.credentials?.apiKey;
            if (!apiKey) {
                throw new Error('OpenAI API key is missing. Please provide a valid API key in the vault to proceed with Image Generation.');
            }

            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: params?.baseURL,
            });

            const fileSources: BinaryInput[] = params?.fileSources || [];

            if (fileSources.length > 0) {
                const images = await Promise.all(
                    fileSources.map(
                        async (file) =>
                            await toFile(await file.getReadStream(), await file.getName(), {
                                type: file.mimetype,
                            })
                    )
                );

                args.image = images as unknown as Uploadable; // ! FIXME: This is a workaround to avoid type error, will be fixed in the next version of openai
            }

            const response = await openai.images.edit(args);

            return response;
        } catch (error: any) {
            console.warn('Error generating image(s) with DALL·E: ', error);

            throw error;
        }
    }
    // #endregion Image Generation
    protected async toolRequest(acRequest: AccessRequest, params: TLLMParams, agent: string | Agent): Promise<any> {
        const apiKey = params?.credentials?.apiKey;

        if (!apiKey) {
            throw new Error('An API key is required to use this model.');
        }

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: params.baseURL,
        });

        const messages = params?.messages || [];

        const agentId = agent instanceof Agent ? agent.id : agent;

        let chatCompletionArgs: OpenAI.ChatCompletionCreateParamsNonStreaming = {
            model: params.model,
            messages: messages,
        };

        if (params?.maxTokens !== undefined) {
            const maxTokensKey = reasoningModels.includes(params.model) ? 'max_completion_tokens' : 'max_tokens';
            chatCompletionArgs[maxTokensKey] = params.maxTokens;
        }

        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            chatCompletionArgs.tools = params?.toolsConfig?.tools as OpenAI.ChatCompletionTool[];
        }

        if (params?.toolsConfig?.tool_choice) {
            chatCompletionArgs.tool_choice = params?.toolsConfig?.tool_choice as OpenAI.ChatCompletionToolChoiceOption;
        }

        try {
            const result = await openai.chat.completions.create(chatCompletionArgs);
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
                modelEntryName: params.modelEntryName,
                keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId,
                teamId: params.teamId,
            });

            return {
                data: { useTool, message: message, content: message?.content ?? '', toolsData },
            };
        } catch (error: any) {
            throw error;
        }
    }

    // ! DEPRECATED: will be removed
    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '', baseURL = '' }
    ): Promise<any> {
        try {
            // We provide
            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: baseURL,
            });

            // sanity check
            if (!Array.isArray(messages) || !messages?.length) {
                throw new Error('Invalid messages argument for chat completion.');
            }

            console.debug('model', model);
            console.debug('messages', messages);
            let args: OpenAI.ChatCompletionCreateParamsStreaming = {
                model,
                messages,
                stream: true,
                stream_options: { include_usage: true },
            };

            if (tools && tools.length > 0) args.tools = tools;
            if (tool_choice) args.tool_choice = tool_choice;

            const stream = await openai.chat.completions.create(args);

            // consumed stream will not be available for further use, so we need to clone it
            const [toolCallsStream, contentStream] = stream.tee();

            let useTool = false;
            let delta: Record<string, any> = {};
            let toolsData: ToolData[] = [];
            let _stream;

            let message = {
                role: '',
                content: '',
                tool_calls: [],
            };

            const usage_data = [];
            for await (const part of toolCallsStream) {
                delta = part.choices[0].delta;

                message.role += delta?.role || '';
                message.content += delta?.content || '';

                const usage = part.usage;
                if (usage) {
                    usage_data.push(usage);
                }

                //if it's not a tools call, stop processing the stream immediately in order to allow streaming the text content
                //FIXME: OpenAI API returns empty content as first message for content reply, and null content for tool reply,
                //       this doesn't seem to be a very accurate way but it's the only solution to detect tool calls early enough (without reading the whole stream)
                if (!delta?.tool_calls && delta?.content === '') {
                    _stream = contentStream;
                    break;
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
                }
            }

            if (toolsData?.length > 0) {
                useTool = true;
            }

            // usage_data.forEach((usage) => {
            //     // probably we can acc them and send them as one event
            //
            //     this.reportUsage(usage, { model, keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth });
            // });

            message.tool_calls = toolsData.map((tool) => {
                return {
                    id: tool.id,
                    type: tool.type,
                    function: {
                        name: tool.name,
                        arguments: tool.arguments,
                    },
                };
            });

            //console.log('result', useTool, message, toolsData);

            return {
                data: { useTool, message, stream: _stream, toolsData },
            };
        } catch (error: any) {
            console.warn('Error on toolUseLLMRequest: ', error);
            return { error };
        }
    }

    private async streamRequestV1(acRequest: AccessRequest, params: TLLMParams, agent: string | Agent): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        const usage_data = [];
        const reportedUsage = [];
        const apiKey = params?.credentials?.apiKey;

        if (!apiKey) {
            throw new Error('An API key is required to use this model.');
        }
        const agentId = agent instanceof Agent ? agent.id : agent;

        const openai = new OpenAI({
            apiKey: apiKey, // we provide default API key for OpenAI with limited quota
            baseURL: params.baseURL,
        });

        //TODO: check token limits for non api key users

        let chatCompletionArgs: OpenAI.ChatCompletionCreateParamsStreaming = {
            model: params.model,
            messages: params.messages,

            stream_options: { include_usage: true }, //add usage statis //TODO: @Forhad check this
            stream: true,
        };

        if (params?.maxTokens !== undefined) {
            const maxTokensKey = reasoningModels.includes(params.model) ? 'max_completion_tokens' : 'max_tokens';
            chatCompletionArgs[maxTokensKey] = params.maxTokens;
        }

        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            chatCompletionArgs.tools = params?.toolsConfig?.tools as OpenAI.ChatCompletionTool[];
        }
        if (params?.toolsConfig?.tool_choice) {
            chatCompletionArgs.tool_choice = params?.toolsConfig?.tool_choice as OpenAI.ChatCompletionToolChoiceOption;
        }

        try {
            let finishReason = 'stop';
            const stream = await openai.chat.completions.create(chatCompletionArgs);

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
                    emitter.emit('toolsData', toolsData);
                }

                usage_data.forEach((usage) => {
                    // probably we can acc them and send them as one event
                    const _reported = this.reportUsage(usage, {
                        modelEntryName: params.modelEntryName,
                        keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId,
                        teamId: params.teamId,
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

    private async streamRequestV2(acRequest: AccessRequest, params: TLLMParamsV2, agent: string | Agent): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        const usage_data = [];
        const reportedUsage = [];
        const apiKey = params?.credentials?.apiKey;

        if (!apiKey) {
            throw new Error('An API key is required to use this model.');
        }
        const agentId = agent instanceof Agent ? agent.id : agent;

        const openai = new OpenAI({
            apiKey: apiKey, // we provide default API key for OpenAI with limited quota
            baseURL: params.baseURL,
        });

        // Prepare the request parameters
        const requestParams: OpenAI.Responses.ResponseCreateParams = {
            model: params.model,
            input: params.messages,
            stream: true,
        };

        if (params?.max_output_tokens !== undefined) {
            requestParams.max_output_tokens = params.max_output_tokens;
        }

        // #region Handle tools configuration
        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            requestParams.tools = params?.toolsConfig?.tools;
        }

        if (params?.toolsConfig?.tool_choice) {
            requestParams.tool_choice = params.toolsConfig.tool_choice;
        }
        // #endregion

        try {
            let finishReason = 'stop';
            const stream = await openai.responses.create(requestParams);

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
                usage_data.forEach((usage) => {
                    const _reported = this.reportUsage(usage, {
                        modelEntryName: params.modelEntryName,
                        keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId,
                        teamId: params.teamId,
                    });
                    reportedUsage.push(_reported);
                });

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

    protected async streamRequest(acRequest: AccessRequest, params: TLLMParams & TLLMParamsV2, agent: string | Agent): Promise<EventEmitter> {
        const team = AccessCandidate.team(params.teamId);
        let llmRegistry = LLMRegistry.isStandardLLM(params.modelEntryName) ? LLMRegistry : await CustomLLMRegistry.getInstance(team);
        const modelInfo = llmRegistry.getModelInfo(params.modelEntryName);

        // * Use streamRequestV2 for search to support the new OpenAI SDK; retain streamRequestV1 for legacy support.
        if (params?.useWebSearch && modelInfo?.features?.includes('search')) {
            const searchTool = this.getWebSearchTool(params);

            // TODO: Only support Web Search tool for now, need to implement other tools as well
            const _params = {
                ...params,
                toolsConfig: { tools: [searchTool] },
            };

            return this.streamRequestV2(acRequest, _params, agent);
        } else {
            return this.streamRequestV1(acRequest, params, agent);
        }
    }

    protected async multimodalStreamRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent: string | Agent): Promise<EventEmitter> {
        const messages = params?.messages || [];
        const emitter = new EventEmitter();
        const usage_data = [];

        //#region Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (messages?.[0]?.role === TLLMMessageRole.System) {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            if (MODELS_WITH_JSON_RESPONSE.includes(params.model)) {
                params.responseFormat = { type: 'json_object' };
            } else {
                params.responseFormat = undefined; // We need to reset it, otherwise 'json' will be passed as a parameter to the OpenAI API
            }
        }
        //#endregion Handle JSON response format

        const agentId = agent instanceof Agent ? agent.id : agent;

        const fileSources: BinaryInput[] = params?.fileSources || []; // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const validImageFileSources = this.getValidImageFileSources(fileSources);
        const validDocumentFileSources = this.getValidDocumentFileSources(fileSources);

        // TODO: GenAILLM class already handles this, so we don't really need it. But in case it's needed, uncomment and
        // handle the invalid files in the prompt to let the user know that some files were not processed.

        // const areAllFilesValid = fileSources.length === validImageFileSources.length + validDocumentFileSources.length;
        // const invalidFileNames = areAllFilesValid
        //     ? []
        //     : // get all the original file sources that are not valid image or document
        //       fileSources
        //           .filter((file) => !validImageFileSources.includes(file) && !validDocumentFileSources.includes(file))
        //           .map(async (file) => await file.getName());

        const imageData = validImageFileSources.length > 0 ? await this.processImageData(validImageFileSources, agentId) : [];
        const documentData = validDocumentFileSources.length > 0 ? await this.processDocumentData(validDocumentFileSources, agentId) : [];

        const promptData = [{ type: 'text', text: prompt || '' }, ...imageData, ...documentData];

        messages.push({ role: 'user', content: promptData });

        // Check if the team has their own API key, then use it
        const apiKey = params?.credentials?.apiKey;

        if (!apiKey) {
            throw new Error('An API key is required to use this model.');
        }

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: params.baseURL,
        });

        const chatCompletionArgs: OpenAI.ChatCompletionCreateParams = {
            model: params.model,
            messages,

            stream_options: { include_usage: true },
            stream: true,
        };

        if (params?.maxTokens !== undefined) chatCompletionArgs.max_tokens = params.maxTokens;
        if (params?.temperature !== undefined) chatCompletionArgs.temperature = params.temperature;
        if (params?.topP !== undefined) chatCompletionArgs.top_p = params.topP;
        if (params?.frequencyPenalty !== undefined) chatCompletionArgs.frequency_penalty = params.frequencyPenalty;
        if (params?.presencePenalty !== undefined) chatCompletionArgs.presence_penalty = params.presencePenalty;
        if (params?.responseFormat !== undefined) chatCompletionArgs.response_format = params.responseFormat;
        if (params?.stopSequences?.length) chatCompletionArgs.stop = params.stopSequences;

        // Validate token limit
        const promptTokens = await LLMHelper.countVisionPromptTokens(promptData);

        await LLMRegistry.validateTokensLimit({
            model: params?.model,
            promptTokens,
            completionTokens: params?.maxTokens,
            hasAPIKey: !!apiKey,
        });

        try {
            let finishReason = 'stop';
            const stream: any = await openai.chat.completions.create(chatCompletionArgs);

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
                    emitter.emit('toolsData', toolsData);
                }

                usage_data.forEach((usage) => {
                    // probably we can acc them and send them as one event
                    this.reportUsage(usage, {
                        modelEntryName: params.modelEntryName,
                        keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId,
                        teamId: params.teamId,
                    });
                });

                if (finishReason !== 'stop') {
                    emitter.emit('interrupted', finishReason);
                }

                setTimeout(() => {
                    emitter.emit('end', toolsData, usage_data, finishReason);
                }, 100);
            })();

            return emitter;
        } catch (error: any) {
            throw error;
        }
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        let tools: OpenAI.ChatCompletionTool[] = [];

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

    private getValidImageFileSources(fileSources: BinaryInput[]) {
        const validSources = [];

        for (let fileSource of fileSources) {
            if (this.validImageMimeTypes.includes(fileSource?.mimetype)) {
                validSources.push(fileSource);
            }
        }

        return validSources;
    }

    private async getImageData(
        fileSources: BinaryInput[],
        agentId: string
    ): Promise<
        {
            type: string;
            image_url: { url: string };
        }[]
    > {
        try {
            const imageData = [];

            for (let fileSource of fileSources) {
                const bufferData = await fileSource.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');
                const url = `data:${fileSource.mimetype};base64,${base64Data}`;

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
        fileSources: BinaryInput[],
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
            for (let fileSource of fileSources) {
                const bufferData = await fileSource.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');
                const fileData = `data:${fileSource.mimetype};base64,${base64Data}`;

                documentData.push({
                    type: 'file',
                    file: {
                        file_data: fileData,
                        filename: await fileSource.getName(),
                    },
                });
            }

            return documentData;
        } catch (error) {
            throw error;
        }
    }

    private getWebSearchTool(params: TLLMParamsV2) {
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

        const searchTool = {
            type: 'web_search_preview' as 'web_search_preview',
            search_context_size: params?.webSearchContextSize || 'medium',
            location,
        };

        // Add location only if any location field is provided. Since 'type' is always present, we check if the number of keys in the location object is greater than 1.
        if (Object.keys(location).length > 1) {
            searchTool.location = location;
        }

        return searchTool;
    }

    protected reportUsage(
        usage: OpenAI.Completions.CompletionUsage & { prompt_tokens_details?: { cached_tokens?: number } },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        let modelName = metadata.modelEntryName;
        // SmythOS models have a prefix, so we need to remove it to get the model name
        if (metadata.modelEntryName.startsWith('smythos/')) {
            modelName = metadata.modelEntryName.split('/').pop();
        }

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: usage?.prompt_tokens - (usage?.prompt_tokens_details?.cached_tokens || 0),
            output_tokens: usage?.completion_tokens,
            input_tokens_cache_write: 0,
            input_tokens_cache_read: usage?.prompt_tokens_details?.cached_tokens || 0,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }
}
