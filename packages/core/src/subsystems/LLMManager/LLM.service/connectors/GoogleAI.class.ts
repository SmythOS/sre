import os from 'os';
import path from 'path';
import EventEmitter from 'events';
import fs from 'fs';

import { GoogleGenerativeAI, ModelParams, GenerationConfig, GenerateContentRequest, UsageMetadata } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { uid } from '@sre/utils';

import { processWithConcurrencyLimit } from '@sre/utils';

import { TLLMMessageBlock, ToolData, TLLMMessageRole, TLLMToolResultMessageBlock, APIKeySource } from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import SystemEvents from '@sre/Core/SystemEvents';
import { SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';

import { LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('GoogleAIConnector');

const DEFAULT_MODEL = 'gemini-1.5-pro';

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
type UsageMetadataWithThoughtsToken = UsageMetadata & { thoughtsTokenCount: number };

export class GoogleAIConnector extends LLMConnector {
    public name = 'LLM:GoogleAI';

    private validMimeTypes = {
        all: VALID_MIME_TYPES,
        image: SUPPORTED_MIME_TYPES_MAP.GoogleAI.image,
    };

    protected async chatRequest(acRequest: AccessRequest, params, agent: string | Agent): Promise<LLMChatResponse> {
        let prompt = '';

        const model = params?.model || DEFAULT_MODEL;

        const apiKey = params?.credentials?.apiKey;

        let messages = params?.messages || [];

        const agentId = agent instanceof Agent ? agent.id : agent;

        //#region Separate system message and add JSON response instruction if needed
        let systemInstruction = '';
        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

        if ('content' in systemMessage) {
            systemInstruction = systemMessage.content as string;
        }

        messages = otherMessages;

        const responseFormat = params?.responseFormat || '';
        let responseMimeType = '';

        if (responseFormat === 'json') {
            systemInstruction += JSON_RESPONSE_INSTRUCTION;

            if (MODELS_SUPPORT_JSON_RESPONSE.includes(model)) {
                responseMimeType = 'application/json';
            }
        }

        if (messages?.length > 0) {
            // Concatenate messages with prompt and remove messages from params as it's not supported
            prompt += messages.map((message) => message?.parts?.[0]?.text || '').join('\n');
        }

        // if the the model does not support system instruction, we will add it to the prompt
        if (!MODELS_SUPPORT_SYSTEM_INSTRUCTION.includes(model)) {
            prompt = `${prompt}\n${systemInstruction}`;
        }
        //#endregion Separate system message and add JSON response instruction if needed

        if (!prompt) throw new Error('Prompt is required!');

        // TODO: implement claude specific token counting to validate token limit
        // this.validateTokenLimit(params);

        const modelParams: ModelParams = {
            model,
        };

        const generationConfig: GenerationConfig = {};

        if (params.maxTokens !== undefined) generationConfig.maxOutputTokens = params.maxTokens;
        if (params.temperature !== undefined) generationConfig.temperature = params.temperature;
        if (params.topP !== undefined) generationConfig.topP = params.topP;
        if (params.topK !== undefined) generationConfig.topK = params.topK;
        if (params.stopSequences?.length) generationConfig.stopSequences = params.stopSequences;

        if (systemInstruction) modelParams.systemInstruction = systemInstruction;
        if (responseMimeType) generationConfig.responseMimeType = responseMimeType;

        if (Object.keys(generationConfig).length > 0) {
            modelParams.generationConfig = generationConfig;
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const $model = genAI.getGenerativeModel(modelParams);

            const { totalTokens: promptTokens } = await $model.countTokens(prompt);

            // * the function will throw an error if the token limit is exceeded
            await LLMRegistry.validateTokensLimit({
                model,
                promptTokens,
                completionTokens: params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const result = await $model.generateContent(prompt);
            const response = await result?.response;
            const content = response?.text();
            const finishReason = response.candidates[0].finishReason;
            const usage = response?.usageMetadata as UsageMetadataWithThoughtsToken;
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

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent: string | Agent) {
        const model = params?.model || 'gemini-pro-vision';
        const apiKey = params?.credentials?.apiKey;
        const fileSources = params?.fileSources || []; // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const agentId = agent instanceof Agent ? agent.id : agent;
        let _prompt = prompt;

        const validFiles = this.getValidFileSources(fileSources, 'image');

        const fileUploadingTasks = validFiles.map((fileSource) => async () => {
            try {
                const uploadedFile = await this.uploadFile({ fileSource, apiKey, agentId });

                return { url: uploadedFile.url, mimetype: fileSource.mimetype };
            } catch {
                return null;
            }
        });
        try {
            const uploadedFiles = await processWithConcurrencyLimit(fileUploadingTasks);

            // We throw error when there are no valid uploaded files,
            if (!uploadedFiles || uploadedFiles?.length === 0) {
                throw new Error(`There is an issue during upload file in Google AI Server!`);
            }

            const imageData = this.getFileData(uploadedFiles);

            //#region Separate system message and add JSON response instruction if needed
            let systemInstruction = '';

            const responseFormat = params?.responseFormat || '';
            let responseMimeType = '';

            if (responseFormat === 'json') {
                systemInstruction += JSON_RESPONSE_INSTRUCTION;

                if (MODELS_SUPPORT_JSON_RESPONSE.includes(model)) {
                    responseMimeType = 'application/json';
                }
            }

            // if the the model does not support system instruction, we will add it to the prompt
            if (!MODELS_SUPPORT_SYSTEM_INSTRUCTION.includes(model)) {
                _prompt = `${_prompt}\n${systemInstruction}`;
            }
            //#endregion Separate system message and add JSON response instruction if needed

            // Adjust input structure handling for multiple image files to accommodate variations.
            const promptWithFiles = imageData.length === 1 ? [...imageData, { text: _prompt }] : [_prompt, ...imageData];

            const modelParams: ModelParams = {
                model,
            };

            const generationConfig: GenerationConfig = {};

            if (params.maxTokens !== undefined) generationConfig.maxOutputTokens = params.maxTokens;
            if (params.temperature !== undefined) generationConfig.temperature = params.temperature;
            if (params.topP !== undefined) generationConfig.topP = params.topP;
            if (params.topK !== undefined) generationConfig.topK = params.topK;
            if (params.stopSequences?.length) generationConfig.stopSequences = params.stopSequences;
            if (responseMimeType) generationConfig.responseMimeType = responseMimeType;

            if (Object.keys(generationConfig).length > 0) {
                modelParams.generationConfig = generationConfig;
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const $model = genAI.getGenerativeModel(modelParams);

            // Check token limit
            const { totalTokens: promptTokens } = await $model.countTokens(promptWithFiles);

            // * the function will throw an error if the token limit is exceeded
            await LLMRegistry.validateTokensLimit({
                model,
                promptTokens,
                completionTokens: params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const result = await $model.generateContent(promptWithFiles);
            const response = await result?.response;
            const content = response?.text();
            const finishReason = response.candidates[0].finishReason;
            const usage = response?.usageMetadata as UsageMetadataWithThoughtsToken;
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

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params, agent: string | Agent) {
        const model = params?.model || DEFAULT_MODEL;
        const apiKey = params?.credentials?.apiKey;
        const fileSources = params?.fileSources || []; // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const agentId = agent instanceof Agent ? agent.id : agent;
        let _prompt = prompt;

        // If user provide mix of valid and invalid files, we will only process the valid files
        const validFiles = this.getValidFileSources(fileSources, 'all');

        const hasVideo = validFiles.some((file) => file?.mimetype?.includes('video'));

        // GoogleAI only supports one video file at a time
        if (hasVideo && validFiles.length > 1) {
            throw new Error('Only one video file is supported at a time.');
        }

        const fileUploadingTasks = validFiles.map((fileSource) => async () => {
            try {
                const uploadedFile = await this.uploadFile({ fileSource, apiKey, agentId });

                return { url: uploadedFile.url, mimetype: fileSource.mimetype };
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

        //#region Separate system message and add JSON response instruction if needed
        let systemInstruction = '';

        const responseFormat = params?.responseFormat || '';
        let responseMimeType = '';

        if (responseFormat === 'json') {
            systemInstruction += JSON_RESPONSE_INSTRUCTION;

            if (MODELS_SUPPORT_JSON_RESPONSE.includes(model)) {
                responseMimeType = 'application/json';
            }
        }

        // if the the model does not support system instruction, we will add it to the prompt
        if (!MODELS_SUPPORT_SYSTEM_INSTRUCTION.includes(model)) {
            _prompt = `${_prompt}\n${systemInstruction}`;
        }
        //#endregion Separate system message and add JSON response instruction if needed

        // Adjust input structure handling for multiple image files to accommodate variations.
        const promptWithFiles = fileData.length === 1 ? [...fileData, { text: _prompt }] : [_prompt, ...fileData];

        const modelParams: ModelParams = {
            model,
        };

        const generationConfig: GenerationConfig = {};

        if (params.maxTokens !== undefined) generationConfig.maxOutputTokens = params.maxTokens;
        if (params.temperature !== undefined) generationConfig.temperature = params.temperature;
        if (params.topP !== undefined) generationConfig.topP = params.topP;
        if (params.topK !== undefined) generationConfig.topK = params.topK;
        if (params.stopSequences?.length) generationConfig.stopSequences = params.stopSequences;
        if (responseMimeType) generationConfig.responseMimeType = responseMimeType;

        if (Object.keys(generationConfig).length > 0) {
            modelParams.generationConfig = generationConfig;
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const $model = genAI.getGenerativeModel(modelParams);

            // Check token limit
            const { totalTokens: promptTokens } = await $model.countTokens(promptWithFiles);

            // * the function will throw an error if the token limit is exceeded
            await LLMRegistry.validateTokensLimit({
                model,
                promptTokens,
                completionTokens: params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const result = await $model.generateContent(promptWithFiles);

            const response = await result?.response;
            const content = response?.text();
            const finishReason = response.candidates[0].finishReason;
            const usage = response?.usageMetadata as UsageMetadataWithThoughtsToken;
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

    protected async toolRequest(acRequest: AccessRequest, params, agent: string | Agent): Promise<any> {
        const agentId = agent instanceof Agent ? agent.id : agent;

        try {
            let systemInstruction = '';
            let formattedMessages;

            const messages = params?.messages || [];

            const hasSystemMessage = LLMHelper.hasSystemMessage(messages);

            if (hasSystemMessage) {
                const separateMessages = LLMHelper.separateSystemMessages(messages);
                const systemMessageContent = (separateMessages.systemMessage as TLLMMessageBlock)?.content;
                systemInstruction = typeof systemMessageContent === 'string' ? systemMessageContent : '';
                formattedMessages = separateMessages.otherMessages;
            } else {
                formattedMessages = messages;
            }

            const apiKey = params?.credentials?.apiKey;

            const generationConfig: GenerationConfig = {};

            if (params?.maxTokens) generationConfig.maxOutputTokens = params.maxTokens;

            const modelParams: ModelParams = {
                model: params.model,
            };

            if (Object.keys(generationConfig).length > 0) {
                modelParams.generationConfig = generationConfig;
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const $model = genAI.getGenerativeModel(modelParams);

            const toolsPrompt: GenerateContentRequest = {
                contents: formattedMessages,
            };

            if (systemInstruction) {
                toolsPrompt.systemInstruction = systemInstruction;
            }

            if (params?.toolsConfig?.tools) toolsPrompt.tools = params?.toolsConfig?.tools;
            if (params?.toolsConfig?.tool_choice)
                toolsPrompt.toolConfig = {
                    functionCallingConfig: { mode: params?.toolsConfig?.tool_choice || 'auto' },
                };

            const result = await $model.generateContent(toolsPrompt);

            const response = await result.response;
            const content = response.text();
            const usage = response?.usageMetadata as UsageMetadataWithThoughtsToken;
            this.reportUsage(usage, {
                modelEntryName: params.modelEntryName,
                keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId,
                teamId: params.teamId,
            });

            const toolCalls = response.candidates[0]?.content?.parts?.filter((part) => part.functionCall);

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
                data: { useTool, message: { content }, content, toolsData },
            };
        } catch (error: any) {
            throw error;
        }
    }

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent: string | Agent): Promise<any> {
        throw new Error('Image generation request is not supported for GoogleAI.');
    }

    // ! DEPRECATED: will be removed
    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async streamRequest(acRequest: AccessRequest, params, agent: string | Agent): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        const apiKey = params?.credentials?.apiKey;

        let systemInstruction = '';
        let formattedMessages;
        const messages = params?.messages || [];

        const agentId = agent instanceof Agent ? agent.id : agent;

        const hasSystemMessage = LLMHelper.hasSystemMessage(messages);
        if (hasSystemMessage) {
            const separateMessages = LLMHelper.separateSystemMessages(messages);
            const systemMessageContent = (separateMessages.systemMessage as TLLMMessageBlock)?.content;
            systemInstruction = typeof systemMessageContent === 'string' ? systemMessageContent : '';
            formattedMessages = separateMessages.otherMessages;
        } else {
            formattedMessages = messages;
        }

        const generationConfig: GenerationConfig = {};

        if (params?.maxTokens) generationConfig.maxOutputTokens = params.maxTokens;

        const modelParams: ModelParams = {
            model: params.model,
        };

        if (Object.keys(generationConfig).length > 0) {
            modelParams.generationConfig = generationConfig;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const $model = genAI.getGenerativeModel(modelParams);

        const toolsPrompt: GenerateContentRequest = {
            contents: formattedMessages,
        };

        if (systemInstruction) {
            toolsPrompt.systemInstruction = systemInstruction;
        }

        if (params?.toolsConfig?.tools) toolsPrompt.tools = params?.toolsConfig?.tools;
        if (params?.toolsConfig?.tool_choice)
            toolsPrompt.toolConfig = {
                functionCallingConfig: { mode: params?.toolsConfig?.tool_choice || 'auto' },
            };

        try {
            const result = await $model.generateContentStream(toolsPrompt);

            let toolsData: ToolData[] = [];
            let usage: UsageMetadataWithThoughtsToken;

            // Process stream asynchronously while as we need to return emitter immediately
            (async () => {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    emitter.emit('content', chunkText);

                    if (chunk.candidates[0]?.content?.parts) {
                        const toolCalls = chunk.candidates[0].content.parts.filter((part) => part.functionCall);
                        if (toolCalls.length > 0) {
                            toolsData = toolCalls.map((toolCall, index) => ({
                                index,
                                id: `tool-${index}`,
                                type: 'function',
                                name: toolCall.functionCall.name,
                                arguments: JSON.stringify(toolCall.functionCall.args),
                                role: TLLMMessageRole.Assistant,
                            }));
                            emitter.emit('toolsData', toolsData);
                        }
                    }

                    // the same usage is sent on each emit. IMPORTANT: google does not send usage for each chunk but
                    // rather just sends the same usage for the entire request.
                    // notice that the output tokens are only sent in the last chunk usage metadata.
                    // so we will just update a var to hold the latest usage and report it when the stream ends.
                    // e.g emit1: { input_tokens: 500, output_tokens: undefined } -> same input_tokens
                    // e.g emit2: { input_tokens: 500, output_tokens: undefined } -> same input_tokens
                    // e.g emit3: { input_tokens: 500, output_tokens: 10 } -> same input_tokens, new output_tokens in the last chunk
                    if (chunk?.usageMetadata) {
                        usage = chunk.usageMetadata as UsageMetadataWithThoughtsToken;
                    }
                }

                if (usage) {
                    this.reportUsage(usage, {
                        modelEntryName: params.modelEntryName,
                        keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId,
                        teamId: params.teamId,
                    });
                }

                setTimeout(() => {
                    emitter.emit('end', toolsData);
                }, 100);
            })();

            return emitter;
        } catch (error: any) {
            throw error;
        }
    }

    protected async multimodalStreamRequest(acRequest: AccessRequest, prompt, params, agent: string | Agent) {
        const emitter = new EventEmitter();
        const model = params?.model || DEFAULT_MODEL;
        const apiKey = params?.credentials?.apiKey;
        const fileSources = params?.fileSources || []; // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const agentId = agent instanceof Agent ? agent.id : agent;
        let _prompt = prompt;

        // If user provide mix of valid and invalid files, we will only process the valid files
        const validFiles = this.getValidFileSources(fileSources, 'all');

        const hasVideo = validFiles.some((file) => file?.mimetype?.includes('video'));

        // GoogleAI only supports one video file at a time
        if (hasVideo && validFiles.length > 1) {
            throw new Error('Only one video file is supported at a time.');
        }

        const fileUploadingTasks = validFiles.map((fileSource) => async () => {
            try {
                const uploadedFile = await this.uploadFile({ fileSource, apiKey, agentId });

                return { url: uploadedFile.url, mimetype: fileSource.mimetype };
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

        //#region Separate system message and add JSON response instruction if needed
        let systemInstruction = '';

        const responseFormat = params?.responseFormat || '';
        let responseMimeType = '';

        if (responseFormat === 'json') {
            systemInstruction += JSON_RESPONSE_INSTRUCTION;

            if (MODELS_SUPPORT_JSON_RESPONSE.includes(model)) {
                responseMimeType = 'application/json';
            }
        }

        // if the the model does not support system instruction, we will add it to the prompt
        if (!MODELS_SUPPORT_SYSTEM_INSTRUCTION.includes(model)) {
            _prompt = `${_prompt}\n${systemInstruction}`;
        }
        //#endregion Separate system message and add JSON response instruction if needed

        // Adjust input structure handling for multiple image files to accommodate variations.
        const promptWithFiles = fileData.length === 1 ? [...fileData, { text: _prompt }] : [_prompt, ...fileData];

        const modelParams: ModelParams = {
            model,
        };

        const generationConfig: GenerationConfig = {};

        if (params.maxTokens !== undefined) generationConfig.maxOutputTokens = params.maxTokens;
        if (params.temperature !== undefined) generationConfig.temperature = params.temperature;
        if (params.topP !== undefined) generationConfig.topP = params.topP;
        if (params.topK !== undefined) generationConfig.topK = params.topK;
        if (params.stopSequences?.length) generationConfig.stopSequences = params.stopSequences;
        if (responseMimeType) generationConfig.responseMimeType = responseMimeType;

        if (Object.keys(generationConfig).length > 0) {
            modelParams.generationConfig = generationConfig;
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const $model = genAI.getGenerativeModel(modelParams);

            // Check token limit
            const { totalTokens: promptTokens } = await $model.countTokens(promptWithFiles);

            // * the function will throw an error if the token limit is exceeded
            await LLMRegistry.validateTokensLimit({
                model,
                promptTokens,
                completionTokens: params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const result = await $model.generateContentStream(promptWithFiles);

            let toolsData: ToolData[] = [];
            let usage: UsageMetadataWithThoughtsToken;
            // Process stream asynchronously while as we need to return emitter immediately
            (async () => {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    emitter.emit('content', chunkText);

                    if (chunk.candidates[0]?.content?.parts) {
                        const toolCalls = chunk.candidates[0].content.parts.filter((part) => part.functionCall);
                        if (toolCalls.length > 0) {
                            toolsData = toolCalls.map((toolCall, index) => ({
                                index,
                                id: `tool-${index}`,
                                type: 'function',
                                name: toolCall.functionCall.name,
                                arguments: JSON.stringify(toolCall.functionCall.args),
                                role: TLLMMessageRole.Assistant,
                            }));
                            emitter.emit('toolsData', toolsData);
                        }
                    }

                    // the same usage is sent on each emit. IMPORTANT: google does not send usage for each chunk but
                    // rather just sends the same usage for the entire request.
                    // notice that the output tokens are only sent in the last chunk usage metadata.
                    // so we will just update a var to hold the latest usage and report it when the stream ends.
                    // e.g emit1: { input_tokens: 500, output_tokens: undefined } -> same input_tokens
                    // e.g emit2: { input_tokens: 500, output_tokens: undefined } -> same input_tokens
                    // e.g emit3: { input_tokens: 500, output_tokens: 10 } -> same input_tokens, new output_tokens in the last chunk
                    if (chunk?.usageMetadata) {
                        usage = chunk.usageMetadata as UsageMetadataWithThoughtsToken;
                    }
                }

                if (usage) {
                    this.reportUsage(usage, {
                        modelEntryName: params.modelEntryName,
                        keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId,
                        teamId: params.teamId,
                    });
                }

                setTimeout(() => {
                    emitter.emit('end', toolsData);
                }, 100);
            })();

            return emitter;
        } catch (error) {
            throw error;
        }
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
                role: TLLMMessageRole.Function,
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

    private async uploadFile({
        fileSource,
        apiKey,
        agentId,
    }: {
        fileSource: BinaryInput;
        apiKey: string;
        agentId: string;
    }): Promise<{ url: string }> {
        try {
            if (!apiKey || !fileSource?.mimetype) {
                throw new Error('Missing required parameters to save file for Google AI!');
            }

            // Create a temporary directory
            const tempDir = os.tmpdir();
            const fileName = uid();
            const tempFilePath = path.join(tempDir, fileName);

            const bufferData = await fileSource.readData(AccessCandidate.agent(agentId));

            // Write buffer data to temp file
            await fs.promises.writeFile(tempFilePath, new Uint8Array(bufferData));

            // Upload the file to the Google File Manager
            const fileManager = new GoogleAIFileManager(apiKey);

            const uploadResponse = await fileManager.uploadFile(tempFilePath, {
                mimeType: fileSource.mimetype,
                displayName: fileName,
            });

            const name = uploadResponse.file.name;

            // Poll getFile() on a set interval (10 seconds here) to check file state.
            let uploadedFile = await fileManager.getFile(name);
            while (uploadedFile.state === FileState.PROCESSING) {
                process.stdout.write('.');
                // Sleep for 10 seconds
                await new Promise((resolve) => setTimeout(resolve, 10_000));
                // Fetch the file from the API again
                uploadedFile = await fileManager.getFile(name);
            }

            if (uploadedFile.state === FileState.FAILED) {
                throw new Error('File processing failed.');
            }

            // Clean up temp file
            await fs.promises.unlink(tempFilePath);

            return {
                url: uploadResponse.file.uri || '',
            };
        } catch (error) {
            throw new Error(`Error uploading file for Google AI: ${error.message}`);
        }
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

    private getValidFileSources(fileSources: BinaryInput[], type: 'image' | 'all') {
        const validSources = [];

        for (let fileSource of fileSources) {
            if (this.validMimeTypes[type].includes(fileSource?.mimetype)) {
                validSources.push(fileSource);
            }
        }

        if (validSources?.length === 0) {
            throw new Error(`Unsupported file(s). Please make sure your file is one of the following types: ${this.validMimeTypes[type].join(', ')}`);
        }

        return validSources;
    }

    private getFileData(
        fileSources: {
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

            for (let fileSource of fileSources) {
                imageData.push({
                    fileData: {
                        mimeType: fileSource.mimetype,
                        fileUri: fileSource.url,
                    },
                });
            }

            return imageData;
        } catch (error) {
            throw error;
        }
    }

    protected reportUsage(
        usage: UsageMetadataWithThoughtsToken,
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        const modelEntryName = metadata.modelEntryName;
        let tier = '';

        const tierThresholds = {
            'gemini-1.5-pro': 128_000,
            'gemini-2.5-pro': 200_000,
        };

        const textInputTokens =
            usage?.['promptTokensDetails']?.find((detail) => detail.modality === 'TEXT')?.tokenCount || usage?.promptTokenCount || 0;
        const audioInputTokens = usage?.['promptTokensDetails']?.find((detail) => detail.modality === 'AUDIO')?.tokenCount || 0;

        // Find matching model and set tier based on threshold
        const modelWithTier = Object.keys(tierThresholds).find((model) => modelEntryName.includes(model));
        if (modelWithTier) {
            tier = textInputTokens < tierThresholds[modelWithTier] ? 'tier1' : 'tier2';
        }

        // #endregion

        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace('smythos/', '');

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: textInputTokens,
            output_tokens: usage.candidatesTokenCount,
            input_tokens_audio: audioInputTokens,
            input_tokens_cache_read: usage.cachedContentTokenCount || 0,
            input_tokens_cache_write: 0,
            reasoning_tokens: usage.thoughtsTokenCount,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
            tier,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }
}
