import EventEmitter from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { FunctionCallingConfigMode, GenerationConfig, GoogleGenAI, UsageMetadata } from '@google/genai';

import { BUILT_IN_MODEL_PREFIX, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { uid } from '@sre/utils';

import { processWithConcurrencyLimit } from '@sre/utils';

import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import {
    APIKeySource,
    BasicCredentials,
    ILLMRequestContext,
    ILLMRequestFuncParams,
    LLMInterface,
    TGoogleAIRequestBody,
    TLLMChatResponse,
    TLLMEvent,
    TLLMMessageBlock,
    TLLMMessageRole,
    TLLMPreparedParams,
    TLLMToolResultMessageBlock,
    ToolData,
} from '@sre/types/LLM.types';

import { SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';

import { LLMConnector } from '../LLMConnector';

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
type UsageMetadataWithThoughtsToken = UsageMetadata & { thoughtsTokenCount?: number; cost?: number };

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

    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
            const prompt = body.messages;
            delete body.messages;

            const genAI = await this.getClient(context);
            const result = await genAI.models.generateContent({ model: body.model, contents: prompt });
            const candidate = result.candidates?.[0];
            const content = candidate?.content?.parts?.map((part) => part.text || '').join('') || '';
            const finishReason = candidate?.finishReason || 'stop';
            const usage = result?.usageMetadata as UsageMetadataWithThoughtsToken;
            this.reportUsage(usage, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            const toolCalls = candidate?.content?.parts?.filter((part) => part.functionCall);

            let toolsData: ToolData[] = [];
            let useTool = false;

            if (toolCalls && toolCalls.length > 0) {
                toolsData = toolCalls.map((toolCall, index) => ({
                    index,
                    id: `tool-${index}`,
                    type: 'function',
                    name: toolCall.functionCall.name,
                    arguments: JSON.stringify(toolCall.functionCall.args),
                    role: TLLMMessageRole.Assistant,
                }));
                useTool = true;
            }

            return {
                content,
                finishReason: finishReason.toLowerCase(),
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

    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
        const emitter = new EventEmitter();

        const prompt = body.messages;
        delete body.messages;

        const genAI = await this.getClient(context);
        try {
            const result = await genAI.models.generateContentStream({ model: body.model, contents: prompt });
            let toolsData: ToolData[] = [];
            let usage: UsageMetadataWithThoughtsToken;
            (async () => {
                for await (const chunk of result) {
                    const candidate = chunk.candidates?.[0];
                    const chunkText = candidate?.content?.parts?.map((part) => part.text || '').join('') || '';
                    emitter.emit('content', chunkText);
                    if (candidate?.content?.parts) {
                        const toolCalls = candidate.content.parts.filter((part) => part.functionCall);
                        if (toolCalls.length > 0) {
                            toolsData = toolCalls.map((toolCall, index) => ({
                                index,
                                id: `tool-${index}`,
                                type: 'function',
                                name: toolCall.functionCall.name,
                                arguments: JSON.stringify(toolCall.functionCall.args),
                                role: TLLMMessageRole.Assistant,
                            }));
                            emitter.emit(TLLMEvent.ToolInfo, toolsData);
                        }
                    }
                    usage = chunk?.usageMetadata as UsageMetadataWithThoughtsToken;
                }
                if (usage) {
                    this.reportUsage(usage, {
                        modelEntryName: context.modelEntryName,
                        keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId: context.agentId,
                        teamId: context.teamId,
                    });
                }
                setTimeout(() => {
                    emitter.emit('end', toolsData);
                }, 100);
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

            this.reportImageUsage({
                usage: {
                    cost: IMAGE_GEN_FIXED_PRICING[modelName],
                    usageMetadata,
                },
                context,
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
            this.reportImageUsage({
                usage: {
                    cost: IMAGE_GEN_FIXED_PRICING[modelName],
                    usageMetadata,
                },
                numberOfImages: config.numberOfImages,
                context,
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

        this.reportImageUsage({
            usage: {
                cost: IMAGE_GEN_FIXED_PRICING[modelName],
                usageMetadata,
            },
            context,
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

        let body: { model: string; messages: string | TLLMMessageBlock[]; systemInstruction?: string; generationConfig?: GenerationConfig } = {
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

        const config: GenerationConfig = {};

        if (params.maxTokens !== undefined) config.maxOutputTokens = params.maxTokens;
        if (params.temperature !== undefined) config.temperature = params.temperature;
        if (params.topP !== undefined) config.topP = params.topP;
        if (params.topK !== undefined) config.topK = params.topK;
        if (params.stopSequences?.length) config.stopSequences = params.stopSequences;
        if (responseMimeType) config.responseMimeType = responseMimeType;

        if (systemInstruction) body.systemInstruction = systemInstruction;
        if (Object.keys(config).length > 0) {
            body.generationConfig = config;
        }

        return body;
    }

    protected reportUsage(
        usage: UsageMetadataWithThoughtsToken,
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');
        let tier = '';
        const tierThresholds = {
            'gemini-1.5-pro': 128_000,
            'gemini-2.5-pro': 200_000,
        };

        const textInputTokens =
            usage?.['promptTokensDetails']?.find((detail) => detail.modality === 'TEXT')?.tokenCount || usage?.promptTokenCount || 0;
        const audioInputTokens = usage?.['promptTokensDetails']?.find((detail) => detail.modality === 'AUDIO')?.tokenCount || 0;

        // Find matching model and set tier based on threshold
        const modelWithTier = Object.keys(tierThresholds).find((model) => modelName.includes(model));
        if (modelWithTier) {
            tier = textInputTokens < tierThresholds[modelWithTier] ? 'tier1' : 'tier2';
        }

        // #endregion

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: textInputTokens,
            output_tokens: usage?.promptTokenCount || 0,
            input_tokens_audio: audioInputTokens,
            input_tokens_cache_read: usage?.cachedContentTokenCount || 0,
            input_tokens_cache_write: 0,
            reasoning_tokens: usage?.thoughtsTokenCount,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
            tier,
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

        if (messageBlock) {
            const content = [];
            if (typeof messageBlock.content === 'string') {
                content.push({ text: messageBlock.content });
            } else if (Array.isArray(messageBlock.content)) {
                content.push(...messageBlock.content);
            }

            if (messageBlock.parts) {
                const functionCalls = messageBlock.parts.filter((part) => part.functionCall);
                if (functionCalls.length > 0) {
                    content.push(
                        ...functionCalls.map((call) => ({
                            functionCall: {
                                name: call.functionCall.name,
                                args: JSON.parse(call.functionCall.args),
                            },
                        }))
                    );
                }
            }

            messageBlocks.push({
                role: messageBlock.role,
                parts: content,
            });
        }

        const transformedToolsData = toolsData.map(
            (toolData): TLLMToolResultMessageBlock => ({
                role: TLLMMessageRole.User,
                parts: [
                    {
                        functionResponse: {
                            name: toolData.name,
                            response: {
                                name: toolData.name,
                                content: typeof toolData.result === 'string' ? toolData.result : JSON.stringify(toolData.result),
                            },
                        },
                    },
                ],
            })
        );

        return [...messageBlocks, ...transformedToolsData];
    }

    public getConsistentMessages(messages: TLLMMessageBlock[]): TLLMMessageBlock[] {
        const _messages = LLMHelper.removeDuplicateUserMessages(messages);

        return _messages.map((message) => {
            const _message = { ...message };
            let textContent = '';

            // Map roles to valid Google AI roles
            switch (_message.role) {
                case TLLMMessageRole.Assistant:
                case TLLMMessageRole.System:
                    _message.role = TLLMMessageRole.Model;
                    break;
                case TLLMMessageRole.User:
                    // User role is already valid
                    break;
                default:
                    _message.role = TLLMMessageRole.User; // Default to user for unknown roles
            }

            // * empty text causes error that's why we added '...'

            if (_message?.parts) {
                textContent = _message.parts.map((textBlock) => textBlock?.text || '...').join(' ');
            } else if (Array.isArray(_message?.content)) {
                textContent = _message.content.map((textBlock) => textBlock?.text || '...').join(' ');
            } else if (_message?.content) {
                textContent = (_message.content as string) || '...';
            }

            _message.parts = [{ text: textContent || '...' }];

            delete _message.content; // Remove content to avoid error

            return _message;
        });
    }

    private async prepareMessages(params: TLLMPreparedParams): Promise<string | TLLMMessageBlock[]> {
        let messages: string | TLLMMessageBlock[] = params?.messages || '';

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

    private async prepareMessagesWithTools(params: TLLMPreparedParams): Promise<any> {
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

        const toolsPrompt: any = {
            contents: formattedMessages as any,
        };

        if (systemInstruction) {
            toolsPrompt.systemInstruction = systemInstruction;
        }

        if (params?.toolsConfig?.tools) toolsPrompt.tools = params?.toolsConfig?.tools as any;
        if (params?.toolsConfig?.tool_choice) {
            // Map tool choice to valid Google AI function calling modes
            let mode: FunctionCallingConfigMode = FunctionCallingConfigMode.AUTO; // default
            const toolChoice = params?.toolsConfig?.tool_choice;

            if (toolChoice === 'auto') {
                mode = FunctionCallingConfigMode.AUTO;
            } else if (toolChoice === 'required') {
                mode = FunctionCallingConfigMode.ANY;
            } else if (toolChoice === 'none') {
                mode = FunctionCallingConfigMode.NONE;
            } else if (typeof toolChoice === 'object' && toolChoice.type === 'function') {
                // Handle OpenAI-style named tool choice - force any function call
                mode = FunctionCallingConfigMode.ANY;
            }

            toolsPrompt.toolConfig = {
                functionCallingConfig: { mode },
            };
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

            // Create a temporary directory
            const tempDir = os.tmpdir();
            const fileName = uid();
            const tempFilePath = path.join(tempDir, fileName);

            const bufferData = await file.readData(AccessCandidate.agent(agentId));

            // Write buffer data to temp file
            await fs.promises.writeFile(tempFilePath, new Uint8Array(bufferData));

            // File upload for Gemini API is not supported in @google/genai Node SDK as of now
            // You may need to use Google Cloud Storage or another supported method for file uploads
            // Clean up temp file
            await fs.promises.unlink(tempFilePath);
            return {
                url: tempFilePath,
            };
        } catch (error) {
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
