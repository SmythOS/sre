import os from 'os';
import path from 'path';
import EventEmitter from 'events';
import fs from 'fs';

import { GoogleGenAI, FunctionCallingConfigMode, FileState, type GenerateContentResponseUsageMetadata } from '@google/genai/node';

import { JSON_RESPONSE_INSTRUCTION, BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { uid } from '@sre/utils';

import { processWithConcurrencyLimit } from '@sre/utils';

import {
    TLLMMessageBlock,
    ToolData,
    TLLMMessageRole,
    TLLMToolResultMessageBlock,
    APIKeySource,
    TLLMEvent,
    BasicCredentials,
    ILLMRequestFuncParams,
    TLLMChatResponse,
    TGoogleAIRequestBody,
    TGoogleAIToolPrompt,
    ILLMRequestContext,
    TLLMPreparedParams,
    LLMInterface,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { SystemEvents } from '@sre/Core/SystemEvents';
import { SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';

import { LLMConnector } from '../LLMConnector';
import { hookAsync } from '@sre/Core/HookService';

const logger = Logger('GoogleAIConnector');

const MODELS_SUPPORT_SYSTEM_INSTRUCTION = [
    'gemini-1.5-pro-exp-0801',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
    'gemini-1.5-pro-001',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash',
];
const MODELS_SUPPORT_JSON_RESPONSE = MODELS_SUPPORT_SYSTEM_INSTRUCTION;

// Supported file MIME types for Google AI's Gemini models
const VALID_MIME_TYPES = [
    ...SUPPORTED_MIME_TYPES_MAP.GoogleAI.image,
    ...SUPPORTED_MIME_TYPES_MAP.GoogleAI.audio,
    ...SUPPORTED_MIME_TYPES_MAP.GoogleAI.video,
    ...SUPPORTED_MIME_TYPES_MAP.GoogleAI.document,
];

// will be removed after updating the SDK
type UsageMetadataWithThoughtsToken = GenerateContentResponseUsageMetadata & { thoughtsTokenCount?: number; cost?: number };

const IMAGE_GEN_FIXED_PRICING = {
    'imagen-3.0-generate-001': 0.04, // Fixed cost per image
    'imagen-4.0-generate-001': 0.04, // Fixed cost per image
    'imagen-4': 0.04, // Standard Imagen 4
    'imagen-4-ultra': 0.06, // Imagen 4 Ultra
    'gemini-2.5-flash-image': 0.039,
};

export class GoogleAIConnector extends LLMConnector {
    public name = 'LLM:GoogleAI';

    private validMimeTypes = {
        all: VALID_MIME_TYPES,
        image: SUPPORTED_MIME_TYPES_MAP.GoogleAI.image,
    };

    private async getClient(params: ILLMRequestContext): Promise<GoogleGenAI> {
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;

        if (!apiKey) throw new Error('Please provide an API key for Google AI');

        return new GoogleGenAI({ apiKey });
    }

    @hookAsync('LLMConnector.request')
    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);

            const promptSource = body.messages ?? body.contents ?? '';
            const { contents, config: promptConfig } = this.normalizePrompt(promptSource as any);
            const requestConfig = this.buildRequestConfig({
                generationConfig: body.generationConfig,
                systemInstruction: body.systemInstruction,
                promptConfig,
            });

            const genAI = await this.getClient(context);
            const requestPayload: Record<string, any> = {
                model: body.model,
                contents: contents ?? '',
            };

            if (requestConfig) {
                requestPayload.config = requestConfig;
            }

            const response = await genAI.models.generateContent(requestPayload as any);
            const content = response.text ?? '';
            const finishReason = (response.candidates?.[0]?.finishReason || 'stop').toLowerCase();
            const usage = response.usageMetadata as UsageMetadataWithThoughtsToken | undefined;

            if (usage) {
                this.reportUsage(usage, {
                    modelEntryName: context.modelEntryName,
                    keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                    agentId: context.agentId,
                    teamId: context.teamId,
                });
            }

            const toolCalls = response.candidates?.[0]?.content?.parts?.filter((part) => part.functionCall);

            let toolsData: ToolData[] = [];
            let useTool = false;

            if (toolCalls && toolCalls.length > 0) {
                toolsData = toolCalls.map((toolCall, index) => ({
                    index,
                    id: `tool-${index}`,
                    type: 'function',
                    name: toolCall.functionCall?.name,
                    arguments:
                        typeof toolCall.functionCall?.args === 'string'
                            ? toolCall.functionCall?.args
                            : JSON.stringify(toolCall.functionCall?.args ?? {}),
                    role: TLLMMessageRole.Assistant,
                    thoughtSignature: (toolCall as any).thoughtSignature, // Preserve Google AI's reasoning context
                }));
                useTool = true;
            }

            return {
                content,
                finishReason,
                useTool,
                toolsData,
                message: { content, role: 'assistant' },
                usage,
            };
        } catch (error: any) {
            logger.error(`request ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    @hookAsync('LLMConnector.streamRequest')
    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
        const emitter = new EventEmitter();

        const promptSource = body.messages ?? body.contents ?? '';
        const { contents, config: promptConfig } = this.normalizePrompt(promptSource as any);
        const requestConfig = this.buildRequestConfig({
            generationConfig: body.generationConfig,
            systemInstruction: body.systemInstruction,
            promptConfig,
        });

        const genAI = await this.getClient(context);

        try {
            const stream = await genAI.models.generateContentStream({
                model: body.model,
                contents: contents ?? '',
                ...(requestConfig ? { config: requestConfig } : {}),
            } as any);

            let toolsData: ToolData[] = [];
            let usage: UsageMetadataWithThoughtsToken | undefined;

            (async () => {
                try {
                    for await (const chunk of stream) {
                        emitter.emit(TLLMEvent.Data, chunk);

                        const chunkText = chunk.text ?? '';
                        if (chunkText) {
                            emitter.emit(TLLMEvent.Content, chunkText);
                        }

                        const toolCalls = chunk.candidates?.[0]?.content?.parts?.filter((part) => part.functionCall);
                        if (toolCalls && toolCalls.length > 0) {
                            toolsData = toolCalls.map((toolCall, index) => ({
                                index,
                                id: `tool-${index}`,
                                type: 'function',
                                name: toolCall.functionCall?.name,
                                arguments:
                                    typeof toolCall.functionCall?.args === 'string'
                                        ? toolCall.functionCall?.args
                                        : JSON.stringify(toolCall.functionCall?.args ?? {}),
                                role: TLLMMessageRole.Assistant,
                                thoughtSignature: (toolCall as any).thoughtSignature, // Preserve Google AI's reasoning context
                            }));
                            emitter.emit(TLLMEvent.ToolInfo, toolsData);
                        }

                        if (chunk.usageMetadata) {
                            usage = chunk.usageMetadata as UsageMetadataWithThoughtsToken;
                        }
                    }

                    const finishReason = 'stop'; // GoogleAI doesn't provide finishReason in streaming
                    const reportedUsage: any[] = [];

                    if (usage) {
                        const reported = this.reportUsage(usage, {
                            modelEntryName: context.modelEntryName,
                            keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                            agentId: context.agentId,
                            teamId: context.teamId,
                        });
                        reportedUsage.push(reported);
                    }

                    // Note: GoogleAI stream doesn't provide explicit finish reasons
                    // If we had a non-stop finish reason, we would emit Interrupted here

                    setTimeout(() => {
                        emitter.emit(TLLMEvent.End, toolsData, reportedUsage, finishReason);
                    }, 100);
                } catch (error) {
                    logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
                    emitter.emit(TLLMEvent.Error, error);
                }
            })();

            return emitter;
        } catch (error: any) {
            logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }
    // #region Image Generation, will be moved to a different subsystem/service

    protected async imageGenRequest({ body, context }: ILLMRequestFuncParams): Promise<any> {
        const apiKey = (context.credentials as BasicCredentials)?.apiKey;
        if (!apiKey) throw new Error('Please provide an API key for Google AI');

        const model = body.model || 'imagen-3.0-generate-001';
        const modelName = context.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        // Use traditional Imagen models
        const config = {
            numberOfImages: body.n || 1,
            aspectRatio: body.aspect_ratio || body.size || '1:1',
            personGeneration: body.person_generation || 'allow_adult',
        };

        const ai = new GoogleGenAI({ apiKey });

        // Default to GenerateImages interface if not specified
        const modelInterface = context.modelInfo?.interface || LLMInterface.GenerateImages;

        let response: any;

        if (modelInterface === LLMInterface.GenerateContent) {
            // Use Gemini image generation API
            response = await ai.models.generateContent({
                model,
                contents: body.prompt,
            });

            // Extract image data from Gemini response format
            const imageData: any[] = [];
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData?.data) {
                        imageData.push({
                            url: `data:image/png;base64,${part.inlineData.data}`,
                            b64_json: part.inlineData.data,
                            revised_prompt: body.prompt,
                        });
                    }
                }
            }

            // Report input tokens and image cost pricing based on the official pricing page:
            // https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-image-preview
            const usageMetadata = response?.usageMetadata as UsageMetadataWithThoughtsToken;

            // ! Deprecated: use reportUsage instead
            // this.reportImageUsage({
            //     usage: {
            //         cost: IMAGE_GEN_FIXED_PRICING[modelName],
            //         usageMetadata,
            //     },
            //     context,
            // });

            this.reportUsage(usageMetadata, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            if (imageData.length === 0) {
                throw new Error(
                    'Please enter a valid prompt — for example: "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme."'
                );
            }

            return {
                created: Math.floor(Date.now() / 1000),
                data: imageData,
            };
        } else if (modelInterface === LLMInterface.GenerateImages) {
            response = await ai.models.generateImages({
                model,
                prompt: body.prompt,
                config,
            });

            // Report input tokens and image cost pricing based on the official pricing page:
            // https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-image-preview
            const usageMetadata = response?.usageMetadata as UsageMetadataWithThoughtsToken;

            // ! Deprecated: use reportUsage instead
            // this.reportImageUsage({
            //     usage: {
            //         cost: IMAGE_GEN_FIXED_PRICING[modelName],
            //         usageMetadata,
            //     },
            //     numberOfImages: config.numberOfImages,
            //     context,
            // });

            this.reportUsage(usageMetadata, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            return {
                created: Math.floor(Date.now() / 1000),
                data:
                    response.generatedImages?.map((generatedImage: any) => ({
                        url: generatedImage.image.imageBytes ? `data:image/png;base64,${generatedImage.image.imageBytes}` : undefined,
                        b64_json: generatedImage.image.imageBytes,
                        revised_prompt: body.prompt,
                    })) || [],
            };
        } else {
            throw new Error(`Unsupported interface: ${modelInterface}`);
        }
    }

    protected async imageEditRequest({ body, context }: ILLMRequestFuncParams): Promise<any> {
        const apiKey = (context.credentials as BasicCredentials)?.apiKey;
        if (!apiKey) throw new Error('Please provide an API key for Google AI');

        // A model supports image editing if it implements the `generateContent` interface.
        const supportsEditing = context.modelInfo?.interface === LLMInterface.GenerateContent;
        if (!supportsEditing) {
            throw new Error(`Image editing is not supported for model: ${body.model}. This model only supports image generation.`);
        }

        const ai = new GoogleGenAI({ apiKey });
        const modelName = context.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        // Use the prepared body which already contains processed files and contents
        const response = await ai.models.generateContent({
            model: body.model,
            contents: body.contents,
        });

        // Extract image data from Gemini response format
        const imageData: any[] = [];
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                    imageData.push({
                        url: `data:image/png;base64,${part.inlineData.data}`,
                        b64_json: part.inlineData.data,
                        revised_prompt: body._metadata?.prompt || body.prompt,
                    });
                }
            }
        }

        // Report pricing for input tokens and image costs
        const usageMetadata = response?.usageMetadata as UsageMetadataWithThoughtsToken;

        // ! Deprecated: use reportUsage instead
        // this.reportImageUsage({
        //     usage: {
        //         cost: IMAGE_GEN_FIXED_PRICING[modelName],
        //         usageMetadata,
        //     },
        //     context,
        // });

        this.reportUsage(usageMetadata, {
            modelEntryName: context.modelEntryName,
            keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
            agentId: context.agentId,
            teamId: context.teamId,
        });

        return {
            created: Math.floor(Date.now() / 1000),
            data: imageData,
        };
    }

    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<TGoogleAIRequestBody> {
        const model = params?.model;

        // Check if this is an image generation request based on capabilities
        if (params?.capabilities?.imageGeneration) {
            // Determine if this is image editing (has files) or generation
            const hasFiles = params?.files?.length > 0;
            if (hasFiles) {
                return this.prepareImageEditBody(params) as any;
            } else {
                return this.prepareBodyForImageGenRequest(params) as any;
            }
        }

        const messages = await this.prepareMessages(params);

        const body: TGoogleAIRequestBody = {
            model: model as string,
            messages,
        };

        const responseFormat = params?.responseFormat || '';
        let responseMimeType = '';
        let systemInstruction = '';

        if (responseFormat === 'json') {
            systemInstruction += JSON_RESPONSE_INSTRUCTION;

            if (MODELS_SUPPORT_JSON_RESPONSE.includes(model as string)) {
                responseMimeType = 'application/json';
            }
        }

        const config: Record<string, any> = {};

        if (params.maxTokens !== undefined) config.maxOutputTokens = params.maxTokens;
        if (params.temperature !== undefined) config.temperature = params.temperature;
        if (params.topP !== undefined) config.topP = params.topP;
        if (params.topK !== undefined) config.topK = params.topK;
        if (params.stopSequences?.length) config.stopSequences = params.stopSequences;
        if (responseMimeType) config.responseMimeType = responseMimeType;

        // #region Gemini 3 specific fields
        const isGemini3Model = params.modelEntryName?.includes('gemini-3');

        if (isGemini3Model) {
            if (params?.reasoningEffort) config.thinkingConfig = { thinkingLevel: params.reasoningEffort };
        }

        if (systemInstruction) body.systemInstruction = systemInstruction;
        if (Object.keys(config).length > 0) {
            body.generationConfig = config;
        }

        return body;
    }

    private normalizePrompt(prompt: TGoogleAIRequestBody['messages'] | TGoogleAIRequestBody['contents']): {
        contents: any;
        config?: Record<string, any>;
    } {
        if (prompt == null) {
            return { contents: '' };
        }

        if (typeof prompt === 'string' || Array.isArray(prompt)) {
            return { contents: prompt };
        }

        if (typeof prompt === 'object' && 'contents' in (prompt as TGoogleAIToolPrompt)) {
            const { contents, systemInstruction, tools, toolConfig } = prompt as TGoogleAIToolPrompt;
            const config: Record<string, any> = {};

            if (systemInstruction) config.systemInstruction = systemInstruction;
            if (tools) config.tools = tools;
            if (toolConfig) config.toolConfig = toolConfig;

            return {
                contents,
                config: Object.keys(config).length > 0 ? config : undefined,
            };
        }

        return { contents: prompt };
    }

    private buildRequestConfig({
        generationConfig,
        systemInstruction,
        promptConfig,
    }: {
        generationConfig?: TGoogleAIRequestBody['generationConfig'];
        systemInstruction?: TGoogleAIRequestBody['systemInstruction'];
        promptConfig?: Record<string, any>;
    }): Record<string, any> | undefined {
        const config: Record<string, any> = {};

        if (generationConfig) {
            for (const [key, value] of Object.entries(generationConfig)) {
                if (value !== undefined) {
                    config[key] = value;
                }
            }
        }

        if (promptConfig?.tools) {
            config.tools = promptConfig.tools;
        }

        if (promptConfig?.toolConfig) {
            config.toolConfig = promptConfig.toolConfig;
        }

        if (promptConfig?.systemInstruction) {
            config.systemInstruction = promptConfig.systemInstruction;
        } else if (systemInstruction) {
            config.systemInstruction = systemInstruction;
        }

        return Object.keys(config).length > 0 ? config : undefined;
    }

    protected reportUsage(
        usage: UsageMetadataWithThoughtsToken,
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        // Initially, all input tokens – such as text, audio, image, video, document, etc. – were included in promptTokenCount.
        let inputTokens = usage?.promptTokenCount || 0;

        // The pricing is the same for output and thinking tokens, so we can add them together.
        let outputTokens = (usage?.candidatesTokenCount || 0) + (usage?.thoughtsTokenCount || 0);

        // If cached input tokens are available, we need to subtract them from the input tokens.
        let cachedInputTokens = usage?.cachedContentTokenCount || 0;

        if (cachedInputTokens) {
            inputTokens = inputTokens - cachedInputTokens;
        }

        // #region Find matching model and set tier based on threshold
        const tierThresholds = {
            'gemini-1.5-pro': 128_000,
            'gemini-2.5-pro': 200_000,
            'gemini-3-pro': 200_000,
        };

        let inTier = '';
        let outTier = '';
        let crTier = '';

        const modelWithTier = Object.keys(tierThresholds).find((model) => modelName.includes(model));
        if (modelWithTier) {
            inTier = inputTokens <= tierThresholds[modelWithTier] ? 'tier1' : 'tier2';
            outTier = outputTokens <= tierThresholds[modelWithTier] ? 'tier1' : 'tier2';
            crTier = cachedInputTokens <= tierThresholds[modelWithTier] ? 'tier1' : 'tier2';
        }
        // #endregion

        // #region Calculate audio input tokens
        // Since Gemini 2.5 Flash has a different pricing model for audio input tokens, we need to report audio input tokens separately.
        let audioInputTokens = 0;
        let cachedAudioInputTokens = 0;
        const isFlashModel = ['gemini-2.5-flash'].includes(modelName);

        if (isFlashModel) {
            // There is no concept of different pricing for Flash models based on token tiers (e.g., less than or greater than 200k),
            // so we don't need to provide tier information for audio input tokens.
            audioInputTokens = usage?.promptTokensDetails?.find((detail) => detail.modality === 'AUDIO')?.tokenCount || 0;

            // subtract the audio cached input tokens from the audio input tokens and total cached input tokens.
            cachedAudioInputTokens = usage?.cacheTokensDetails?.find((detail) => detail.modality === 'AUDIO')?.tokenCount || 0;
            if (cachedAudioInputTokens) {
                audioInputTokens = audioInputTokens - cachedAudioInputTokens;
                cachedInputTokens = cachedInputTokens - cachedAudioInputTokens;
            }

            inputTokens = inputTokens - audioInputTokens;
        }
        // #endregion

        // #region Calculate image tokens
        const imageOutputTokens = usage?.candidatesTokensDetails?.find((detail) => detail.modality === 'IMAGE')?.tokenCount || 0;

        // Gemini models does not return output text tokens right now, so we need to subtract the output image tokens from the output tokens.
        if (!imageOutputTokens) {
            outputTokens = outputTokens - imageOutputTokens;
        }
        // #endregion Calculate image tokens

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            output_tokens_image: imageOutputTokens,
            input_tokens_audio: audioInputTokens,
            input_tokens_cache_read: cachedInputTokens,
            input_tokens_cache_read_audio: cachedAudioInputTokens,
            input_tokens_cache_write: 0,
            // reasoning_tokens: usage?.thoughtsTokenCount, // * reasoning tokens are included in the output tokens.
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
            inTier,
            outTier,
            crTier,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }

    /**
     * Extract text and image tokens from Google AI usage metadata
     */
    private extractTokenCounts(usage: UsageMetadataWithThoughtsToken): { textTokens: number; imageTokens: number } {
        const textTokens = usage?.['promptTokensDetails']?.find((detail) => detail.modality === 'TEXT')?.tokenCount || 0;
        const imageTokens = usage?.['promptTokensDetails']?.find((detail) => detail.modality === 'IMAGE')?.tokenCount || 0;

        return { textTokens, imageTokens };
    }

    /**
     * @deprecated use reportUsage instead
     */
    protected reportImageUsage({
        usage,
        context,
        numberOfImages = 1,
    }: {
        usage: { cost?: number; usageMetadata?: UsageMetadataWithThoughtsToken };
        context: ILLMRequestContext;
        numberOfImages?: number;
    }) {
        // Extract text and image tokens from rawUsage if available
        let input_tokens_txt = 0;
        let input_tokens_img = 0;

        if (usage.usageMetadata) {
            const { textTokens, imageTokens } = this.extractTokenCounts(usage.usageMetadata);
            input_tokens_txt = textTokens;
            input_tokens_img = imageTokens;
        }

        const imageUsageData = {
            sourceId: `api:imagegen.smyth`,
            keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,

            cost: usage.cost * numberOfImages,
            input_tokens_txt,
            input_tokens_img,

            agentId: context.agentId,
            teamId: context.teamId,
        };
        SystemEvents.emit('USAGE:API', imageUsageData);
    }

    public formatToolsConfig({ toolDefinitions, toolChoice = 'auto' }) {
        const tools = toolDefinitions.map((tool) => {
            const { name, description, properties, requiredFields } = tool;

            // Ensure the function name is valid
            const validName = this.sanitizeFunctionName(name);

            // Ensure properties are non-empty for OBJECT type
            const validProperties = properties && Object.keys(properties).length > 0 ? properties : { dummy: { type: 'string' } };

            return {
                functionDeclarations: [
                    {
                        name: validName,
                        description: description || '',
                        parameters: {
                            type: 'OBJECT',
                            properties: validProperties,
                            required: requiredFields || [],
                        },
                    },
                ],
            };
        });

        return {
            tools,
            toolChoice: {
                type: toolChoice,
            },
        };
    }

    public transformToolMessageBlocks({
        messageBlock,
        toolsData,
    }: {
        messageBlock: TLLMMessageBlock;
        toolsData: ToolData[];
    }): TLLMToolResultMessageBlock[] {
        const messageBlocks: TLLMToolResultMessageBlock[] = [];

        const parseFunctionArgs = (args: unknown) => {
            if (typeof args === 'string') {
                try {
                    return JSON.parse(args);
                } catch {
                    return args;
                }
            }
            return args ?? {};
        };

        const parseFunctionResponse = (response: unknown): any => {
            if (typeof response === 'string') {
                try {
                    const parsed = JSON.parse(response);
                    if (typeof parsed === 'string' && parsed !== response) {
                        return parseFunctionResponse(parsed);
                    }
                    return parsed;
                } catch {
                    return response;
                }
            }
            return response ?? {};
        };

        if (messageBlock) {
            const content: any[] = [];

            if (Array.isArray(messageBlock.parts) && messageBlock.parts.length > 0) {
                for (const part of messageBlock.parts) {
                    if (!part) continue;

                    if (typeof part.text === 'string' && part.text.trim()) {
                        content.push({ text: part.text.trim() });
                        continue;
                    }

                    if (part.functionCall) {
                        const functionCallPart: any = {
                            functionCall: {
                                name: part.functionCall.name,
                                args: parseFunctionArgs(part.functionCall.args),
                            },
                        };
                        // Preserve thoughtSignature if present for Google AI reasoning context
                        if ((part as any).thoughtSignature) {
                            functionCallPart.thoughtSignature = (part as any).thoughtSignature;
                        }
                        content.push(functionCallPart);
                        continue;
                    }

                    if (part.functionResponse) {
                        content.push({
                            functionResponse: {
                                name: part.functionResponse.name,
                                response: parseFunctionResponse(part.functionResponse.response),
                            },
                        });
                        continue;
                    }

                    if ((part as any).inlineData) {
                        content.push({ inlineData: (part as any).inlineData });
                    }
                }
            } else {
                if (typeof messageBlock.content === 'string' && messageBlock.content.trim()) {
                    content.push({ text: messageBlock.content.trim() });
                } else if (Array.isArray(messageBlock.content) && messageBlock.content.length > 0) {
                    content.push(...messageBlock.content);
                }
            }

            const hasFunctionCall = content.some((part) => part.functionCall);
            if (!hasFunctionCall && toolsData.length > 0) {
                toolsData.forEach((toolCall) => {
                    const functionCallPart: any = {
                        functionCall: {
                            name: toolCall.name,
                            args: parseFunctionArgs(toolCall.arguments),
                        },
                    };
                    // Preserve thoughtSignature if present for Google AI reasoning context
                    if (toolCall.thoughtSignature) {
                        functionCallPart.thoughtSignature = toolCall.thoughtSignature;
                    }
                    content.push(functionCallPart);
                });
            }

            if (content.length > 0) {
                let role = messageBlock.role;
                if (role === TLLMMessageRole.Assistant) {
                    role = TLLMMessageRole.Model;
                }

                messageBlocks.push({
                    role,
                    parts: content,
                });
            }
        }

        const functionResponseParts = toolsData
            .filter((toolData) => toolData.result !== undefined)
            .map((toolData) => ({
                functionResponse: {
                    name: toolData.name,
                    response: parseFunctionResponse(toolData.result),
                },
            }));

        if (functionResponseParts.length > 0) {
            messageBlocks.push({
                role: TLLMMessageRole.Function,
                parts: functionResponseParts,
            });
        }

        return messageBlocks;
    }

    public getConsistentMessages(messages: TLLMMessageBlock[]): TLLMMessageBlock[] {
        const _messages = LLMHelper.removeDuplicateUserMessages(messages);

        return _messages.map((message) => {
            const _message: TLLMMessageBlock = { ...message };

            const parseFunctionArgs = (args: unknown) => {
                if (typeof args === 'string') {
                    try {
                        return JSON.parse(args);
                    } catch {
                        return args;
                    }
                }

                return args ?? {};
            };

            const parseFunctionResponse = (response: unknown) => {
                if (typeof response === 'string') {
                    try {
                        return JSON.parse(response);
                    } catch {
                        return response;
                    }
                }

                return response;
            };

            const pushTextPart = (parts: any[], text?: string) => {
                const value = typeof text === 'string' && text.trim() ? text : undefined;
                if (value) {
                    parts.push({ text: value });
                }
            };

            const normalizedParts: any[] = [];

            // Map roles to valid Google AI roles
            switch (_message.role) {
                case TLLMMessageRole.Assistant:
                case TLLMMessageRole.System:
                case TLLMMessageRole.Model:
                    _message.role = TLLMMessageRole.Model;
                    break;
                case TLLMMessageRole.Function:
                case TLLMMessageRole.Tool:
                    _message.role = TLLMMessageRole.Function;
                    break;
                case TLLMMessageRole.User:
                    break;
                default:
                    _message.role = TLLMMessageRole.User;
            }

            if (Array.isArray(message?.parts)) {
                for (const part of message.parts) {
                    if (!part) continue;

                    const normalizedPart: any = { ...part };

                    if (typeof normalizedPart.text === 'string') {
                        normalizedPart.text = normalizedPart.text.trim() || '...';
                    }

                    if (part.functionCall) {
                        normalizedPart.functionCall = {
                            name: part.functionCall.name,
                            args: parseFunctionArgs(part.functionCall.args),
                        };
                        // Preserve thoughtSignature if present for Google AI reasoning context
                        if ((part as any).thoughtSignature) {
                            normalizedPart.thoughtSignature = (part as any).thoughtSignature;
                        }
                    }

                    if (part.functionResponse) {
                        normalizedPart.functionResponse = {
                            name: part.functionResponse.name,
                            response: parseFunctionResponse(part.functionResponse.response),
                        };
                    }

                    const hasMeaningfulContent = Object.values(normalizedPart).some((value) => value !== undefined && value !== null && value !== '');

                    if (hasMeaningfulContent) {
                        normalizedParts.push(normalizedPart);
                    }
                }
            }

            if (!normalizedParts.length && Array.isArray(message?.content)) {
                for (const contentPart of message.content) {
                    if (!contentPart) continue;

                    if (typeof contentPart === 'string') {
                        pushTextPart(normalizedParts, contentPart);
                    } else if (typeof contentPart === 'object') {
                        if ('text' in contentPart && typeof contentPart.text === 'string') {
                            pushTextPart(normalizedParts, contentPart.text);
                        } else if ('functionCall' in contentPart && (contentPart as any).functionCall) {
                            const functionCallPart = (contentPart as any).functionCall;
                            const normalizedFunctionCall: any = {
                                functionCall: {
                                    name: functionCallPart.name,
                                    args: parseFunctionArgs(functionCallPart.args),
                                },
                            };
                            // Preserve thoughtSignature if present for Google AI reasoning context
                            if ((contentPart as any).thoughtSignature) {
                                normalizedFunctionCall.thoughtSignature = (contentPart as any).thoughtSignature;
                            }
                            normalizedParts.push(normalizedFunctionCall);
                        } else if ('functionResponse' in contentPart && (contentPart as any).functionResponse) {
                            const functionResponsePart = (contentPart as any).functionResponse;
                            normalizedParts.push({
                                functionResponse: {
                                    name: functionResponsePart.name,
                                    response: parseFunctionResponse(functionResponsePart.response),
                                },
                            });
                        } else {
                            const fallbackText = typeof (contentPart as any)?.toString === 'function' ? (contentPart as any).toString() : '';
                            if (fallbackText && fallbackText !== '[object Object]') {
                                pushTextPart(normalizedParts, fallbackText);
                            }
                        }
                    }
                }
            }

            if (!normalizedParts.length) {
                if (typeof message?.content === 'string') {
                    pushTextPart(normalizedParts, message.content);
                } else if (message?.content && typeof message.content === 'object') {
                    if ('text' in (message.content as any)) {
                        pushTextPart(normalizedParts, (message.content as any).text);
                    } else {
                        const fallbackText = typeof (message.content as any)?.toString === 'function' ? (message.content as any).toString() : '';
                        if (fallbackText && fallbackText !== '[object Object]') {
                            pushTextPart(normalizedParts, fallbackText);
                        }
                    }
                }
            }

            if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
                for (const toolCall of message.tool_calls) {
                    if (!toolCall?.function?.name) continue;

                    const normalizedFunctionCall: any = {
                        functionCall: {
                            name: toolCall.function.name,
                            args: parseFunctionArgs(toolCall.function.arguments),
                        },
                    };
                    // Preserve thoughtSignature if present for Google AI reasoning context
                    if ((toolCall as any).thoughtSignature) {
                        normalizedFunctionCall.thoughtSignature = (toolCall as any).thoughtSignature;
                    }
                    normalizedParts.push(normalizedFunctionCall);
                }
            }

            if (!normalizedParts.length) {
                normalizedParts.push({ text: '...' });
            }

            _message.parts = normalizedParts as any;

            delete _message.content; // Remove content to avoid error
            delete (_message as any).tool_calls;

            return _message;
        });
    }

    private async prepareMessages(params: TLLMPreparedParams): Promise<string | TLLMMessageBlock[] | TGoogleAIToolPrompt> {
        let messages: string | TLLMMessageBlock[] | TGoogleAIToolPrompt = (params?.messages as any) || '';

        const files: BinaryInput[] = params?.files || [];

        if (files.length > 0) {
            messages = await this.prepareMessagesWithFiles(params);
        } else if (params?.toolsConfig?.tools?.length > 0) {
            messages = await this.prepareMessagesWithTools(params);
        } else {
            messages = await this.prepareMessagesWithTextQuery(params);
        }

        return messages;
    }

    private async prepareMessagesWithFiles(params: TLLMPreparedParams): Promise<string> {
        const model = params.model;

        let messages: string | TLLMMessageBlock[] = params?.messages || '';
        let systemInstruction = '';
        const files: BinaryInput[] = params?.files || [];

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

        // If user provide mix of valid and invalid files, we will only process the valid files
        const validFiles = this.getValidFiles(_files, 'all');

        const hasVideo = validFiles.some((file) => file?.mimetype?.includes('video'));

        // GoogleAI only supports one video file at a time
        if (hasVideo && validFiles.length > 1) {
            throw new Error('Only one video file is supported at a time.');
        }

        const fileUploadingTasks = validFiles.map((file) => async () => {
            try {
                const uploadedFile = await this.uploadFile({
                    file,
                    apiKey: (params.credentials as BasicCredentials).apiKey,
                    agentId: params.agentId,
                });

                return { url: uploadedFile.url, mimetype: file.mimetype };
            } catch {
                return null;
            }
        });

        const uploadedFiles = await processWithConcurrencyLimit(fileUploadingTasks);

        // We throw error when there are no valid uploaded files,
        if (uploadedFiles && uploadedFiles?.length === 0) {
            throw new Error(`There is an issue during upload file in Google AI Server!`);
        }

        const fileData = this.getFileData(uploadedFiles);

        const userMessage: TLLMMessageBlock = Array.isArray(messages) ? messages.pop() : { role: TLLMMessageRole.User, content: '' };
        let prompt = userMessage?.content || '';

        // if the the model does not support system instruction, we will add it to the prompt
        if (!MODELS_SUPPORT_SYSTEM_INSTRUCTION.includes(model as string)) {
            prompt = `${prompt}\n${systemInstruction}`;
        }
        //#endregion Separate system message and add JSON response instruction if needed

        // Adjust input structure handling for multiple image files to accommodate variations.
        messages = fileData.length === 1 ? ([...fileData, { text: prompt }] as any) : ([prompt, ...fileData] as any);

        return messages as string;
    }

    private async prepareMessagesWithTools(params: TLLMPreparedParams): Promise<TGoogleAIToolPrompt> {
        let formattedMessages: TLLMMessageBlock[];
        let systemInstruction = '';

        let messages = params?.messages || [];

        const hasSystemMessage = LLMHelper.hasSystemMessage(messages);

        if (hasSystemMessage) {
            const separateMessages = LLMHelper.separateSystemMessages(messages);
            const systemMessageContent = (separateMessages.systemMessage as TLLMMessageBlock)?.content;
            systemInstruction = typeof systemMessageContent === 'string' ? systemMessageContent : '';
            formattedMessages = separateMessages.otherMessages;
        } else {
            formattedMessages = messages;
        }

        const toolsPrompt: TGoogleAIToolPrompt = {
            contents: formattedMessages as any,
        };

        if (systemInstruction) {
            toolsPrompt.systemInstruction = systemInstruction;
        }

        if (params?.toolsConfig?.tools) toolsPrompt.tools = params?.toolsConfig?.tools as any;
        if (params?.toolsConfig?.tool_choice) {
            // Map tool choice to valid Google AI function calling modes
            const toolConfig = toolsPrompt.toolConfig ?? { functionCallingConfig: {} };
            const functionConfig = toolConfig.functionCallingConfig ?? {};
            const toolChoice = params?.toolsConfig?.tool_choice;

            if (toolChoice === 'auto') {
                functionConfig.mode = FunctionCallingConfigMode.AUTO;
            } else if (toolChoice === 'required') {
                functionConfig.mode = FunctionCallingConfigMode.ANY;
            } else if (toolChoice === 'none') {
                functionConfig.mode = FunctionCallingConfigMode.NONE;
            } else if (typeof toolChoice === 'object' && toolChoice.type === 'function') {
                // Handle OpenAI-style named tool choice - force any function call
                functionConfig.mode = FunctionCallingConfigMode.ANY;
                const functionName = this.sanitizeFunctionName(toolChoice.function?.name ?? '');
                if (functionName) {
                    functionConfig.allowedFunctionNames = [functionName];
                }
            } else {
                functionConfig.mode = FunctionCallingConfigMode.AUTO;
            }

            toolConfig.functionCallingConfig = functionConfig;
            toolsPrompt.toolConfig = toolConfig;
        }

        return toolsPrompt;
    }

    private async prepareMessagesWithTextQuery(params: TLLMPreparedParams): Promise<string> {
        const model = params.model;
        let systemInstruction = '';
        let prompt = '';

        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(params?.messages as TLLMMessageBlock[]);

        if ('content' in systemMessage) {
            systemInstruction = systemMessage.content as string;
        }

        const responseFormat = params?.responseFormat || '';
        let responseMimeType = '';

        if (responseFormat === 'json') {
            systemInstruction += JSON_RESPONSE_INSTRUCTION;

            if (MODELS_SUPPORT_JSON_RESPONSE.includes(model as string)) {
                responseMimeType = 'application/json';
            }
        }

        if (otherMessages?.length > 0) {
            // Concatenate messages with prompt and remove messages from params as it's not supported
            prompt += otherMessages.map((message) => message?.parts?.[0]?.text || '').join('\n');
        }

        // if the the model does not support system instruction, we will add it to the prompt
        if (!MODELS_SUPPORT_SYSTEM_INSTRUCTION.includes(model as string)) {
            prompt = `${prompt}\n${systemInstruction}`;
        }
        //#endregion Separate system message and add JSON response instruction if needed

        return prompt;
    }

    private async prepareBodyForImageGenRequest(params: TLLMPreparedParams): Promise<any> {
        return {
            prompt: params.prompt,
            model: params.model,
            aspectRatio: (params as any).aspectRatio,
            personGeneration: (params as any).personGeneration,
        };
    }

    private async prepareImageEditBody(params: TLLMPreparedParams): Promise<any> {
        const model = params.model || 'gemini-2.5-flash-image-preview';

        // Construct edit prompt with image and instructions
        let editPrompt = params.prompt || 'Edit this image';
        if ((params as any).instruction) {
            editPrompt += `. ${(params as any).instruction}`;
        }

        // For image editing, we need to include the original image in the contents
        const contents: any[] = [];
        const files: BinaryInput[] = params?.files || [];

        if (files.length > 0) {
            // Get only valid image files for editing
            const validImageFiles = this.getValidFiles(files, 'image');

            if (validImageFiles.length === 0) {
                throw new Error('No valid image files found for editing. Please provide at least one image file.');
            }

            // Process each image file
            for (const file of validImageFiles) {
                try {
                    // Read the file data as base64
                    const bufferData = await file.getBuffer();
                    const base64Image = Buffer.from(bufferData).toString('base64');

                    contents.push({
                        inlineData: {
                            mimeType: file.mimetype,
                            data: base64Image,
                        },
                    });
                } catch (error) {
                    throw new Error(`Failed to process image file: ${error.message}`);
                }
            }
        } else {
            throw new Error('No image provided for editing. Please include an image file.');
        }

        // Add the edit instruction
        contents.push({ text: editPrompt });

        // Return the complete request body that can be used directly in imageEditRequest
        return {
            model,
            contents,
            // Additional metadata for usage reporting
            _metadata: {
                prompt: editPrompt,
                numberOfImages: (params as any).n || 1,
                aspectRatio: (params as any).aspect_ratio || (params as any).size || '1:1',
                personGeneration: (params as any).person_generation || 'allow_adult',
            },
        };
    }

    // Add this helper method to sanitize function names
    private sanitizeFunctionName(name: string): string {
        // Check if name is undefined or null
        if (name == null) {
            return '_unnamed_function';
        }

        // Remove any characters that are not alphanumeric, underscore, dot, or dash
        let sanitized = name.replace(/[^a-zA-Z0-9_.-]/g, '');

        // Ensure the name starts with a letter or underscore
        if (!/^[a-zA-Z_]/.test(sanitized)) {
            sanitized = '_' + sanitized;
        }

        // If sanitized is empty after removing invalid characters, use a default name
        if (sanitized === '') {
            sanitized = '_unnamed_function';
        }

        // Truncate to 64 characters if longer
        sanitized = sanitized.slice(0, 64);

        return sanitized;
    }

    private async uploadFile({ file, apiKey, agentId }: { file: BinaryInput; apiKey: string; agentId: string }): Promise<{ url: string }> {
        try {
            if (!apiKey || !file?.mimetype) {
                throw new Error('Missing required parameters to save file for Google AI!');
            }

            const tempDir = os.tmpdir();
            const fileName = uid();
            const tempFilePath = path.join(tempDir, fileName);

            const bufferData = await file.readData(AccessCandidate.agent(agentId));
            await fs.promises.writeFile(tempFilePath, new Uint8Array(bufferData));

            const ai = new GoogleGenAI({ apiKey });

            const uploadResponse = await ai.files.upload({
                file: tempFilePath,
                config: {
                    mimeType: file.mimetype,
                    displayName: fileName,
                },
            });

            const name = uploadResponse.name;
            if (!name) {
                throw new Error('File upload did not return a file name.');
            }

            let uploadedFile = uploadResponse;
            while (uploadedFile.state === FileState.PROCESSING) {
                process.stdout.write('.');
                await new Promise((resolve) => setTimeout(resolve, 10_000));
                uploadedFile = await ai.files.get({ name });
            }

            if (uploadedFile.state === FileState.FAILED) {
                throw new Error('File processing failed.');
            }

            await fs.promises.unlink(tempFilePath);

            return {
                url: uploadedFile.uri || '',
            };
        } catch (error: any) {
            throw new Error(`Error uploading file for Google AI: ${error.message}`);
        }
    }

    private getValidFiles(files: BinaryInput[], type: 'image' | 'all') {
        const validSources = [];

        for (let file of files) {
            if (this.validMimeTypes[type].includes(file?.mimetype)) {
                validSources.push(file);
            }
        }

        if (validSources?.length === 0) {
            throw new Error(`Unsupported file(s). Please make sure your file is one of the following types: ${this.validMimeTypes[type].join(', ')}`);
        }

        return validSources;
    }

    private getFileData(
        files: {
            url: string;
            mimetype: string;
        }[]
    ): {
        fileData: {
            mimeType: string;
            fileUri: string;
        };
    }[] {
        try {
            const imageData = [];

            for (let file of files) {
                imageData.push({
                    fileData: {
                        mimeType: file.mimetype,
                        fileUri: file.url,
                    },
                });
            }

            return imageData;
        } catch (error) {
            throw error;
        }
    }
}
