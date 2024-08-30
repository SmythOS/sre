import os from 'os';
import path from 'path';
import EventEmitter from 'events';
import fs from 'fs';

import axios from 'axios';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';

import { processWithConcurrencyLimit, isDataUrl, isUrl, getMimeTypeFromUrl, isRawBase64, parseBase64, isValidString } from '@sre/utils';

import { LLMParams, LLMMessageBlock, ToolData } from '@sre/types/LLM.types';
import { IAccessCandidate } from '@sre/types/ACL.types';

import { LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('GoogleAIConnector');

type FileObject = {
    url: string;
    mimetype: string;
};

const DEFAULT_MODEL = 'gemini-pro';

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
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/x-javascript',
    'text/x-typescript',
    'application/x-typescript',
    'text/csv',
    'text/markdown',
    'text/x-python',
    'application/x-python-code',
    'application/json',
    'text/xml',
    'application/rtf',
    'text/rtf',
];

// Supported image MIME types for Google AI's Gemini models
const VALID_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];

export type GetGenerativeModelArgs = {
    model: string;
    generationConfig: {
        stopSequences: string[];
        candidateCount: number;
        maxOutputTokens: number;
        temperature: number;
        topP: number;
        topK: number;
    };
    systemInstruction?: string;
};
export class GoogleAIConnector extends LLMConnector {
    public name = 'LLM:GoogleAI';

    private validMimeTypes = VALID_MIME_TYPES;
    private validImageMimeTypes = VALID_IMAGE_MIME_TYPES;

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        try {
            const model = params?.model || DEFAULT_MODEL;

            const apiKey = params?.apiKey;

            const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);

            let messages = params?.messages || [];

            let systemInstruction;
            let systemMessage: LLMMessageBlock | {} = {};

            if (this.hasSystemMessage(params?.messages)) {
                const separateMessages = this.separateSystemMessages(messages);
                systemMessage = separateMessages.systemMessage;
                messages = separateMessages.otherMessages;
            }

            if (MODELS_WITH_SYSTEM_MESSAGE.includes(model)) {
                systemInstruction = (systemMessage as LLMMessageBlock)?.content || '';
            } else {
                prompt = `${prompt}\n${(systemMessage as LLMMessageBlock)?.content || ''}`;
            }

            if (params?.messages) {
                // Concatenate messages with prompt and remove messages from params as it's not supported
                prompt = params.messages.map((message) => message?.content || '').join('\n');
            }

            // Need to return JSON for LLM Prompt component
            const responseFormat = params?.responseFormat || 'json';
            if (responseFormat === 'json') {
                if (MODELS_WITH_JSON_RESPONSE.includes(model)) params.responseMimeType = 'application/json';
                else prompt += JSON_RESPONSE_INSTRUCTION;
            }

            if (!prompt) throw new Error('Prompt is required!');

            const args: GetGenerativeModelArgs = {
                model,
                generationConfig: params,
            };

            if (systemInstruction) args.systemInstruction = systemInstruction;

            const generationConfig = {
                stopSequences: params.stopSequences,
                maxOutputTokens: params.maxOutputTokens,
                temperature: params.temperature,
                topP: params.topP,
                topK: params.topK,
            };

            const $model = genAI.getGenerativeModel({
                model,
                systemInstruction,
                generationConfig,
            });

            // Check token limit
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
            console.error('Error in googleAI componentLLMRequest', error);

            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent) {
        try {
            const model = params?.model || 'gemini-pro-vision';

            const apiKey = params?.apiKey;

            const fileSources = params?.fileSources || [];

            const agentId = agent instanceof Agent ? agent.id : agent;
            const agentCandidate = AccessCandidate.agent(agentId);

            const validFiles = await this.processValidFiles(fileSources, agentCandidate);

            const fileUploadingTasks = validFiles.map((file) => async () => {
                try {
                    const uploadedFile = await this.uploadFile({ file, apiKey });

                    return { url: uploadedFile.url, mimetype: file.mimetype };
                } catch {
                    return null;
                }
            });

            const uploadedFiles = await processWithConcurrencyLimit(fileUploadingTasks);

            // We throw error when there are no valid uploaded files,
            if (uploadedFiles?.length === 0) {
                throw new Error(
                    `Unsupported file(s). Please make sure your file is one of the following types: ${this.validImageMimeTypes.join(', ')}`
                );
            }

            const fileDataObjectsArray = uploadedFiles.map((file: FileObject) => ({
                fileData: {
                    mimeType: file.mimetype,
                    fileUri: file.url,
                },
            }));

            // Adjust input structure handling for multiple image files to accommodate variations.
            const promptWithFiles =
                fileDataObjectsArray.length === 1 ? [...fileDataObjectsArray, { text: prompt }] : [prompt, ...fileDataObjectsArray];

            const generationConfig = {
                stopSequences: params.stopSequences,
                maxOutputTokens: params.maxOutputTokens,
                temperature: params.temperature,
                topP: params.topP,
                topK: params.topK,
            };

            const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);
            const $model = genAI.getGenerativeModel({ model, generationConfig });

            const responseFormat = params?.responseFormat || 'json';
            if (responseFormat) {
                if (MODELS_WITH_JSON_RESPONSE.includes(model)) params.responseMimeType = 'application/json';
                else prompt += JSON_RESPONSE_INSTRUCTION;
            }

            // Check token limit
            const { totalTokens: promptTokens } = await $model.countTokens(promptWithFiles);

            // * the function will throw an error if the token limit is exceeded
            this.validateTokensLimit({
                model,
                promptTokens,
                completionTokens: params?.maxOutputTokens,
                hasTeamAPIKey: !!apiKey,
            });

            const result = await $model.generateContent(promptWithFiles);
            const response = await result?.response;
            const content = response?.text();
            const finishReason = response.candidates[0].finishReason;

            return { content, finishReason };
        } catch (error) {
            console.error('Error in googleAI visionLLMRequest', error);

            throw error;
        }
    }

    protected async toolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        try {
            const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);

            let systemInstruction = '';
            let formattedMessages;

            if (this.hasSystemMessage(messages)) {
                const separateMessages = this.separateSystemMessages(messages);
                systemInstruction = (separateMessages.systemMessage as LLMMessageBlock)?.content || '';
                formattedMessages = this.formatInputMessages(separateMessages.otherMessages);
            } else {
                formattedMessages = this.formatInputMessages(messages);
            }

            const $model = genAI.getGenerativeModel({ model });

            const result = await $model.generateContent({
                contents: formattedMessages,
                tools,
                systemInstruction,
                toolConfig: {
                    functionCallingConfig: { mode: tool_choice || 'auto' },
                },
            });

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
                    role: 'assistant',
                }));
                useTool = true;
            }

            return {
                data: { useTool, message: { content }, content, toolsData },
            };
        } catch (error: any) {
            console.log('Error on toolUseLLMRequest: ', error);
            return { error };
        }
    }

    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async streamRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);
        const $model = genAI.getGenerativeModel({ model });

        let systemInstruction = '';
        let formattedMessages;

        if (this.hasSystemMessage(messages)) {
            const separateMessages = this.separateSystemMessages(messages);
            systemInstruction = (separateMessages.systemMessage as LLMMessageBlock)?.content || '';
            formattedMessages = this.formatInputMessages(separateMessages.otherMessages);
        } else {
            formattedMessages = this.formatInputMessages(messages);
        }

        try {
            const result = await $model.generateContentStream({
                contents: formattedMessages,
                tools,
                systemInstruction,
                toolConfig: {
                    functionCallingConfig: { mode: tool_choice || 'auto' },
                },
            });

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
                                role: 'assistant',
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
            emitter.emit('error', error);
            return emitter;
        }
    }

    public async extractVisionLLMParams(config: any) {
        const params: LLMParams = await super.extractVisionLLMParams(config);

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

    private async processValidFiles(fileSources: string[] | Record<string, any>[], candidate: IAccessCandidate): Promise<FileObject[]> {
        const fileProcessingTasks = fileSources.map((fileSource) => async (): Promise<FileObject> => {
            if (!fileSource) return null;

            if (typeof fileSource === 'object' && fileSource.url && fileSource.mimetype) {
                return await this.processObjectFileSource(fileSource);
            }

            if (isValidString(fileSource as string)) {
                return await this.processStringFileSource(fileSource as string, candidate);
            }

            return null;
        });

        const validFiles = await processWithConcurrencyLimit(fileProcessingTasks);

        return validFiles as FileObject[];
    }

    private processObjectFileSource(fileSource: Record<string, string>) {
        const { mimetype, url } = fileSource as Record<string, any>;

        if (!this.validImageMimeTypes.includes(mimetype)) return null;

        return { url, mimetype };
    }

    private async processStringFileSource(fileSource: string, candidate: IAccessCandidate): Promise<FileObject | null> {
        if (isUrl(fileSource)) {
            const mimetype = await getMimeTypeFromUrl(fileSource);
            return this.validImageMimeTypes.includes(mimetype) ? { url: fileSource, mimetype } : null;
        }

        if (isDataUrl(fileSource) || isRawBase64(fileSource)) {
            const { mimetype } = await parseBase64(fileSource);

            if (!this.validImageMimeTypes.includes(mimetype)) return null;

            const binaryInput = new BinaryInput(fileSource);

            const fileData = await binaryInput.getJsonData(candidate);

            return { url: fileData.url, mimetype };
        }

        return null;
    }

    private async uploadFile({ file, apiKey }: { file: FileObject; apiKey: string }): Promise<{ url: string }> {
        try {
            if (!apiKey || !file?.url || !file?.mimetype) {
                throw new Error('Missing required parameters to save file for Google AI!');
            }

            // Download the file from source URL to a temp directory
            const tempDir = os.tmpdir();
            const fileName = path.basename(new URL(file.url).pathname);
            const tempFilePath = path.join(tempDir, fileName);

            const response = await axios.get(file.url, { responseType: 'stream' });

            const writer = fs.createWriteStream(tempFilePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Upload the file to the Google File Manager
            const fileManager = new GoogleAIFileManager(apiKey);

            const uploadResponse = await fileManager.uploadFile(tempFilePath, {
                mimeType: file.mimetype,
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
            fs.unlink(tempFilePath, (err) => {
                if (err) console.error('Error deleting temp file: ', err);
            });

            return {
                url: uploadResponse.file.uri || '',
            };
        } catch (error) {
            throw new Error(`Error uploading file for Google AI ${error.message}`);
        }
    }

    private formatInputMessages(messages: LLMMessageBlock[]): any[] {
        return messages.map((message) => {
            let role = message.role;

            // With 'assistant' we have error: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse: [400 Bad Request] Please use a valid role: user, model.
            if (message.role === 'assistant') {
                role = 'model';
            }

            return {
                role,
                parts: [{ text: message.content }],
            };
        });
    }
}
