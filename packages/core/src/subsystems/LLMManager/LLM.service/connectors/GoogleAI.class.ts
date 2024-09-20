import os from 'os';
import path from 'path';
import EventEmitter from 'events';
import fs from 'fs';

import axios from 'axios';
import { GoogleGenerativeAI, ModelParams, GenerationConfig, GenerateContentRequest } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { uid } from '@sre/utils';

import { processWithConcurrencyLimit, isDataUrl, isUrl, getMimeTypeFromUrl, isRawBase64, parseBase64, isValidString } from '@sre/utils';

import { TLLMParams, TLLMMessageBlock, ToolData, TLLMMessageRole, TLLMToolResultMessageBlock } from '@sre/types/LLM.types';
import { IAccessCandidate } from '@sre/types/ACL.types';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('GoogleAIConnector');

type FileObject = {
    url: string;
    mimetype: string;
};

const DEFAULT_MODEL = 'gemini-1.5-pro';

const MODELS_WITH_SYSTEM_MESSAGE = [
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
    'gemini-1.5-pro-001',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-flash-001',
];
const MODELS_WITH_JSON_RESPONSE = MODELS_WITH_SYSTEM_MESSAGE;

// Supported file MIME types for Google AI's Gemini models
const VALID_MIME_TYPES = [
    'video/mp4',
    'video/mpeg',
    'video/mov',
    'video/avi',
    'video/x-flv',
    'video/mpg',
    'video/webm',
    'video/wmv',
    'video/3gpp',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/heic',
    'image/heif',
    'audio/wav',
    'audio/mp3',
    'audio/aiff',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    'application/pdf',
    'application/x-javascript',
    'application/x-typescript',
    'application/x-python-code',
    'application/json',
    'application/rtf',
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'text/x-typescript',
    'text/csv',
    'text/markdown',
    'text/x-python',
    'text/xml',
    'text/rtf',
];

// Supported image MIME types for Google AI's Gemini models
const VALID_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];

export class GoogleAIConnector extends LLMConnector {
    public name = 'LLM:GoogleAI';

    private validMimeTypes = {
        all: VALID_MIME_TYPES,
        image: VALID_IMAGE_MIME_TYPES,
    };

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        const _params = { ...params }; // Avoid mutation of the original params object

        const model = _params?.model || DEFAULT_MODEL;

        const apiKey = _params?.apiKey;

        let messages = _params?.messages || [];

        let systemInstruction;
        let systemMessage: TLLMMessageBlock | {} = {};

        if (this.hasSystemMessage(_params?.messages)) {
            const separateMessages = this.separateSystemMessages(messages);
            const systemMessageContent = (separateMessages.systemMessage as TLLMMessageBlock)?.content;
            systemInstruction = typeof systemMessageContent === 'string' ? systemMessageContent : '';
            messages = separateMessages.otherMessages;
        }

        if (MODELS_WITH_SYSTEM_MESSAGE.includes(model)) {
            systemInstruction = 'content' in systemMessage ? systemMessage.content : '';
        } else {
            prompt = `${prompt}\n${'content' in systemMessage ? systemMessage.content : ''}`;
        }

        if (_params?.messages) {
            const messages = this.getConsistentMessages(_params.messages);
            // Concatenate messages with prompt and remove messages from params as it's not supported
            prompt = messages.map((message) => message?.parts?.[0]?.text || '').join('\n');
        }

        // Need to return JSON for LLM Prompt component
        const responseFormat = _params?.responseFormat || 'json';
        if (responseFormat === 'json') {
            if (MODELS_WITH_JSON_RESPONSE.includes(model)) _params.responseMimeType = 'application/json';
            else prompt += JSON_RESPONSE_INSTRUCTION;
        }

        if (!prompt) throw new Error('Prompt is required!');

        // TODO: implement claude specific token counting to validate token limit
        // this.validateTokenLimit(_params);

        const modelParams: ModelParams = {
            model,
        };

        if (systemInstruction) modelParams.systemInstruction = systemInstruction;

        const generationConfig: GenerationConfig = {};

        if (_params.maxOutputTokens) generationConfig.maxOutputTokens = _params.maxOutputTokens;
        if (_params.temperature) generationConfig.temperature = _params.temperature;
        if (_params.stopSequences) generationConfig.stopSequences = _params.stopSequences;
        if (_params.topP) generationConfig.topP = _params.topP;
        if (_params.topK) generationConfig.topK = _params.topK;

        if (Object.keys(generationConfig).length > 0) {
            modelParams.generationConfig = generationConfig;
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);
            const $model = genAI.getGenerativeModel(modelParams);

            const { totalTokens: promptTokens } = await $model.countTokens(prompt);

            // * the function will throw an error if the token limit is exceeded
            this.validateTokensLimit({
                model,
                promptTokens,
                completionTokens: params?.maxOutputTokens,
                hasTeamAPIKey: !!apiKey,
            });

            const result = await $model.generateContent(prompt);
            const response = await result?.response;
            const content = response?.text();
            const finishReason = response.candidates[0].finishReason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent) {
        const _params = { ...params }; // Avoid mutation of the original params object
        const model = _params?.model || 'gemini-pro-vision';
        const apiKey = _params?.apiKey;
        const fileSources = _params?.fileSources || [];
        const agentId = agent instanceof Agent ? agent.id : agent;

        const validFiles = this.getValidFileSources(fileSources, 'image');

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
        if (uploadedFiles?.length === 0) {
            throw new Error(`There is an issue during upload file in Google AI Server!`);
        }

        const imageData = this.getFileData(uploadedFiles);

        // Adjust input structure handling for multiple image files to accommodate variations.
        const promptWithFiles = imageData.length === 1 ? [...imageData, { text: prompt }] : [prompt, ...imageData];

        const modelParams: ModelParams = {
            model,
        };

        const generationConfig: GenerationConfig = {};

        if (_params.maxOutputTokens) generationConfig.maxOutputTokens = _params.maxOutputTokens;
        if (_params.temperature) generationConfig.temperature = _params.temperature;
        if (_params.stopSequences) generationConfig.stopSequences = _params.stopSequences;
        if (_params.topP) generationConfig.topP = _params.topP;
        if (_params.topK) generationConfig.topK = _params.topK;

        if (Object.keys(generationConfig).length > 0) {
            modelParams.generationConfig = generationConfig;
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);
            const $model = genAI.getGenerativeModel(modelParams);

            const responseFormat = _params?.responseFormat || 'json';
            if (responseFormat) {
                if (MODELS_WITH_JSON_RESPONSE.includes(model)) _params.responseMimeType = 'application/json';
                else prompt += JSON_RESPONSE_INSTRUCTION;
            }

            // Check token limit
            const { totalTokens: promptTokens } = await $model.countTokens(promptWithFiles);

            // * the function will throw an error if the token limit is exceeded
            this.validateTokensLimit({
                model,
                promptTokens,
                completionTokens: _params?.maxOutputTokens,
                hasTeamAPIKey: !!apiKey,
            });

            const result = await $model.generateContent(promptWithFiles);
            const response = await result?.response;
            const content = response?.text();
            const finishReason = response.candidates[0].finishReason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params, agent: string | Agent) {
        const _params = { ...params }; // Avoid mutation of the original params object
        const model = _params?.model || DEFAULT_MODEL;
        const apiKey = _params?.apiKey;
        const fileSources = _params?.fileSources || [];
        const agentId = agent instanceof Agent ? agent.id : agent;

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
        if (uploadedFiles?.length === 0) {
            throw new Error(`There is an issue during upload file in Google AI Server!`);
        }

        const fileData = this.getFileData(uploadedFiles);

        // Adjust input structure handling for multiple image files to accommodate variations.
        const promptWithFiles = fileData.length === 1 ? [...fileData, { text: prompt }] : [prompt, ...fileData];

        const modelParams: ModelParams = {
            model,
        };

        const generationConfig: GenerationConfig = {};

        if (_params.maxOutputTokens) generationConfig.maxOutputTokens = _params.maxOutputTokens;
        if (_params.temperature) generationConfig.temperature = _params.temperature;
        if (_params.stopSequences) generationConfig.stopSequences = _params.stopSequences;
        if (_params.topP) generationConfig.topP = _params.topP;
        if (_params.topK) generationConfig.topK = _params.topK;

        if (Object.keys(generationConfig).length > 0) {
            modelParams.generationConfig = generationConfig;
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);
            const $model = genAI.getGenerativeModel(modelParams);

            const responseFormat = _params?.responseFormat || 'json';
            if (responseFormat) {
                if (MODELS_WITH_JSON_RESPONSE.includes(model)) _params.responseMimeType = 'application/json';
                else prompt += JSON_RESPONSE_INSTRUCTION;
            }

            // Check token limit
            const { totalTokens: promptTokens } = await $model.countTokens(promptWithFiles);

            // * the function will throw an error if the token limit is exceeded
            this.validateTokensLimit({
                model,
                promptTokens,
                completionTokens: _params?.maxOutputTokens,
                hasTeamAPIKey: !!apiKey,
            });

            const result = await $model.generateContent(promptWithFiles);

            const response = await result?.response;
            const content = response?.text();
            const finishReason = response.candidates[0].finishReason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async toolRequest(acRequest: AccessRequest, params): Promise<any> {
        const _params = { ...params };

        try {
            let systemInstruction = '';
            let formattedMessages;

            const messages = this.getConsistentMessages(_params.messages);

            if (this.hasSystemMessage(messages)) {
                const separateMessages = this.separateSystemMessages(messages);
                const systemMessageContent = (separateMessages.systemMessage as TLLMMessageBlock)?.content;
                systemInstruction = typeof systemMessageContent === 'string' ? systemMessageContent : '';
                formattedMessages = separateMessages.otherMessages;
            } else {
                formattedMessages = messages;
            }

            const genAI = new GoogleGenerativeAI(_params.apiKey || process.env.GOOGLEAI_API_KEY);
            const $model = genAI.getGenerativeModel({ model: _params.model });

            const generationConfig: GenerateContentRequest = {
                contents: formattedMessages,
            };

            if (systemInstruction) {
                generationConfig.systemInstruction = systemInstruction;
            }

            if (_params?.toolsConfig?.tools) generationConfig.tools = _params?.toolsConfig?.tools;
            if (_params?.toolsConfig?.tool_choice)
                generationConfig.toolConfig = {
                    functionCallingConfig: { mode: _params?.toolsConfig?.tool_choice || 'auto' },
                };

            const result = await $model.generateContent(generationConfig);

            const response = await result.response;
            const content = response.text();
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

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<ImagesResponse> {
        throw new Error('Image generation request is not supported for GoogleAI.');
    }

    // ! DEPRECATED: will be removed
    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async streamRequest(acRequest: AccessRequest, params): Promise<EventEmitter> {
        const _params = { ...params };

        const emitter = new EventEmitter();
        const genAI = new GoogleGenerativeAI(_params.apiKey || process.env.GOOGLEAI_API_KEY);
        const $model = genAI.getGenerativeModel({ model: _params.model });

        let systemInstruction = '';
        let formattedMessages;
        const messages = this.getConsistentMessages(_params.messages);

        if (this.hasSystemMessage(messages)) {
            const separateMessages = this.separateSystemMessages(messages);
            const systemMessageContent = (separateMessages.systemMessage as TLLMMessageBlock)?.content;
            systemInstruction = typeof systemMessageContent === 'string' ? systemMessageContent : '';
            formattedMessages = this.getConsistentMessages(separateMessages.otherMessages);
        } else {
            formattedMessages = this.getConsistentMessages(messages);
        }

        const generationConfig: GenerateContentRequest = {
            contents: formattedMessages,
        };

        if (systemInstruction) {
            generationConfig.systemInstruction = systemInstruction;
        }

        if (_params?.toolsConfig?.tools) generationConfig.tools = _params?.toolsConfig?.tools;
        if (_params?.toolsConfig?.tool_choice)
            generationConfig.toolConfig = {
                functionCallingConfig: { mode: _params?.toolsConfig?.tool_choice || 'auto' },
            };

        try {
            const result = await $model.generateContentStream(generationConfig);

            let toolsData: ToolData[] = [];

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

    public async extractVisionLLMParams(config: any) {
        const params: TLLMParams = await super.extractVisionLLMParams(config);

        return params;
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
            await fs.promises.writeFile(tempFilePath, bufferData);

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

    private getConsistentMessages(messages: TLLMMessageBlock[]): TLLMMessageBlock[] {
        if (messages.length === 0) return messages;

        return messages.map((message) => {
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

            if (_message?.parts) {
                textContent = _message.parts.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (Array.isArray(_message?.content)) {
                textContent = _message.content.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (_message?.content) {
                textContent = _message.content as string;
            }

            _message.parts = [{ text: textContent }];

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
}
