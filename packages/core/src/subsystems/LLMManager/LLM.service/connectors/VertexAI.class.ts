import { GoogleGenAI, type GenerateContentResponseUsageMetadata } from '@google/genai/node';
import EventEmitter from 'events';

import { JSON_RESPONSE_INSTRUCTION, BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import {
    TCustomLLMModel,
    APIKeySource,
    TVertexAISettings,
    ILLMRequestFuncParams,
    TGoogleAIRequestBody,
    ILLMRequestContext,
    TLLMPreparedParams,
    TLLMMessageBlock,
    ToolData,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    TLLMChatResponse,
    TLLMEvent,
    VertexAICredentials,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { uid } from '@sre/utils';

import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';
import { hookAsync } from '@sre/Core/HookService';

const logger = Logger('VertexAIConnector');

// Type alias for usage metadata compatibility
type UsageMetadataWithThoughtsToken = GenerateContentResponseUsageMetadata & { thoughtsTokenCount?: number; cost?: number };

export class VertexAIConnector extends LLMConnector {
    public name = 'LLM:VertexAI';

    private async getClient(params: ILLMRequestContext): Promise<GoogleGenAI> {
        const credentials = params.credentials as VertexAICredentials;
        const modelInfo = params.modelInfo as TCustomLLMModel;
        const settings = modelInfo?.settings as TVertexAISettings;
        const projectId = settings?.projectId;
        const region = (modelInfo?.settings as any)?.region;

        if (!projectId) {
            throw new Error('Please provide a project ID for Vertex AI');
        }

        if (!region) {
            throw new Error('Please provide a region for Vertex AI');
        }

        // @google/genai automatically uses Google Cloud authentication when vertexai: true is set
        // It will use service account credentials from the environment or the provided credentials
        const clientOptions: any = {
            vertexai: true,
            project: projectId,
            location: region,
        };

        // If credentials are provided explicitly, pass them via googleAuthOptions
        // This maintains backward compatibility with the old @google-cloud/vertexai implementation
        if (credentials) {
            clientOptions.googleAuthOptions = {
                credentials: credentials as any,
            };
        }

        // If custom API endpoint is provided, we need to handle it via httpOptions
        // Note: @google/genai may not directly support custom apiEndpoint in constructor
        // For now, we'll log a warning if apiEndpoint is set
        if (settings?.apiEndpoint) {
            logger.warn('Custom apiEndpoint is set but may not be fully supported by @google/genai. Using default Vertex AI endpoint.');
        }

        return new GoogleGenAI(clientOptions);
    }

    @hookAsync('LLMConnector.request')
    protected async request({ acRequest, body, context, abortSignal }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
            const genAI = await this.getClient(context);

            // Normalize the prompt format (similar to GoogleAI connector)
            const promptSource = body.messages ?? body.contents ?? '';
            const { contents, config: promptConfig } = this.normalizePrompt(promptSource as any);
            const requestConfig = this.buildRequestConfig({
                generationConfig: body.generationConfig,
                systemInstruction: body.systemInstruction,
                promptConfig,
                abortSignal,
            });

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

            let toolsData: ToolData[] = [];
            let useTool = false;

            // Check for function calls in the response
            const toolCalls = response.candidates?.[0]?.content?.parts?.filter((part) => part.functionCall);
            if (toolCalls && toolCalls.length > 0) {
                // Extract the thoughtSignature from the first tool call (if available)
                const sharedThoughtSignature = (toolCalls[0] as any).thoughtSignature;

                /**
                 * Unique ID per request call to prevent tool ID collisions.
                 */
                const requestId = uid();

                toolsData = toolCalls.map((toolCall, index) => ({
                    index,
                    id: `tool-${requestId}-${index}`,
                    type: 'function',
                    name: toolCall.functionCall?.name,
                    arguments:
                        typeof toolCall.functionCall?.args === 'string'
                            ? toolCall.functionCall?.args
                            : JSON.stringify(toolCall.functionCall?.args ?? {}),
                    role: TLLMMessageRole.Assistant,
                    // All parallel tool calls share the same thoughtSignature from the first one
                    thoughtSignature: (toolCall as any).thoughtSignature || sharedThoughtSignature,
                }));
                useTool = true;
            }

            if (usage) {
                this.reportUsage(usage, {
                    modelEntryName: context.modelEntryName,
                    keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                    agentId: context.agentId,
                    teamId: context.teamId,
                });
            }

            return {
                content,
                finishReason,
                toolsData,
                useTool,
            };
        } catch (error) {
            logger.error(`request ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    @hookAsync('LLMConnector.streamRequest')
    protected async streamRequest({ acRequest, body, context, abortSignal }: ILLMRequestFuncParams): Promise<EventEmitter> {
        logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
        const emitter = new EventEmitter();

        const promptSource = body.messages ?? body.contents ?? '';
        const { contents, config: promptConfig } = this.normalizePrompt(promptSource as any);
        const requestConfig = this.buildRequestConfig({
            generationConfig: body.generationConfig,
            systemInstruction: body.systemInstruction,
            promptConfig,
            abortSignal,
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
            let streamThoughtSignature: string | undefined; // Track signature across streaming chunks

            /**
             * Unique ID per streamRequest call to prevent tool ID collisions.
             */
            const requestId = uid();

            try {
                for await (const chunk of stream) {
                    emitter.emit(TLLMEvent.Data, chunk);

                    const parts = chunk.candidates?.[0]?.content?.parts || [];
                    // Extract text from parts, filtering out non-text parts and ensuring type safety
                    const textParts = parts
                        .map((part) => part?.text)
                        .filter((text): text is string => typeof text === 'string')
                        .join('');
                    if (textParts) {
                        emitter.emit(TLLMEvent.Content, textParts);
                    }

                    const toolCalls = chunk.candidates?.[0]?.content?.parts?.filter((part) => part.functionCall);
                    if (toolCalls && toolCalls.length > 0) {
                        // Capture thoughtSignature from the first tool call chunk if we haven't already
                        if (!streamThoughtSignature) {
                            streamThoughtSignature = (toolCalls[0] as any).thoughtSignature;
                        }

                        // For streaming, replace toolsData with the latest chunk (chunks contain cumulative tool calls)
                        toolsData = toolCalls.map((toolCall, index) => ({
                            index,
                            id: `tool-${requestId}-${index}`,
                            type: 'function' as const,
                            name: toolCall.functionCall?.name,
                            arguments:
                                typeof toolCall.functionCall?.args === 'string'
                                    ? toolCall.functionCall?.args
                                    : JSON.stringify(toolCall.functionCall?.args ?? {}),
                            role: TLLMMessageRole.Assistant as any,
                            // All tool calls share the thoughtSignature from the first chunk
                            thoughtSignature: (toolCall as any).thoughtSignature || streamThoughtSignature,
                        }));
                    }

                    if (chunk.usageMetadata) {
                        usage = chunk.usageMetadata as UsageMetadataWithThoughtsToken;
                    }
                }

                // Emit ToolInfo once after all chunks are processed
                if (toolsData.length > 0) {
                    emitter.emit(TLLMEvent.ToolInfo, toolsData);
                }

                const finishReason = 'stop'; // Vertex AI doesn't provide explicit finishReason in streaming
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

                setTimeout(() => {
                    emitter.emit(TLLMEvent.End, toolsData, reportedUsage, finishReason);
                }, 100);
            } catch (error) {
                logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
                emitter.emit(TLLMEvent.Error, error);
            }

            return emitter;
        } catch (error) {
            logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
            emitter.emit(TLLMEvent.Error, error);
            return emitter;
        }
    }

    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<TGoogleAIRequestBody> {
        const model = params?.model;
        const { messages, systemMessage } = await this.prepareMessages(params);

        let body: any = {
            model: model as string,
            contents: messages, // This will be normalized in the request methods
        };

        const responseFormat = params?.responseFormat || '';
        let systemInstruction = systemMessage || '';

        if (responseFormat === 'json') {
            systemInstruction += (systemInstruction ? '\n\n' : '') + JSON_RESPONSE_INSTRUCTION;
        }

        const config: Record<string, any> = {};

        if (params.maxTokens !== undefined) config.maxOutputTokens = params.maxTokens;
        if (params.temperature !== undefined) config.temperature = params.temperature;
        if (params.topP !== undefined) config.topP = params.topP;
        if (params.topK !== undefined) config.topK = params.topK;
        if (params.stopSequences?.length) config.stopSequences = params.stopSequences;

        if (systemInstruction) {
            body.systemInstruction = systemInstruction;
        }

        if (Object.keys(config).length > 0) {
            body.generationConfig = config;
        }

        // Handle tools configuration
        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools.length > 0) {
            body.tools = this.formatToolsForVertexAI(params.toolsConfig.tools);
        }

        return body;
    }

    protected reportUsage(
        usage: UsageMetadataWithThoughtsToken,
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: usage.promptTokenCount || 0,
            output_tokens: usage.candidatesTokenCount || 0,
            input_tokens_cache_read: usage.cachedContentTokenCount || 0,
            input_tokens_cache_write: 0,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }

    private async prepareMessages(params: TLLMPreparedParams) {
        const messages = params?.messages || [];
        const files: BinaryInput[] = params?.files || [];

        let processedMessages = [...messages];

        // Handle system messages - Vertex AI uses systemInstruction separately
        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(processedMessages);
        processedMessages = otherMessages;

        // Handle files if present
        if (files?.length > 0) {
            const fileData = await this.processFiles(files, params.agentId);

            // Add file data to the last user message
            const userMessage = processedMessages.pop();
            if (userMessage) {
                const content = [{ text: userMessage.content as string }, ...fileData];
                processedMessages.push({
                    role: userMessage.role,
                    parts: content,
                });
            }
        }

        // Convert messages to Vertex AI format (same as Google AI format)
        let vertexAIMessages = this.convertMessagesToVertexAIFormat(processedMessages);

        // Ensure we have at least one message with content
        if (!vertexAIMessages || vertexAIMessages.length === 0) {
            vertexAIMessages = [
                {
                    role: 'user',
                    parts: [{ text: 'Hello' }],
                },
            ];
        }

        return {
            messages: vertexAIMessages,
            systemMessage: (systemMessage as any)?.content || '',
        };
    }

    private async processFiles(files: BinaryInput[], agentId: string) {
        const fileData = [];

        for (const file of files) {
            const bufferData = await file.readData(AccessCandidate.agent(agentId));
            const base64Data = bufferData.toString('base64');

            fileData.push({
                inlineData: {
                    data: base64Data,
                    mimeType: file.mimetype,
                },
            });
        }

        return fileData;
    }

    private convertMessagesToVertexAIFormat(messages: TLLMMessageBlock[]) {
        return messages
            .filter((message) => message && (message.content || message.parts))
            .map((message) => {
                let parts;

                if (typeof message.content === 'string') {
                    parts = message.content.trim() ? [{ text: message.content.trim() }] : [{ text: 'Continue' }];
                } else if (message.parts && Array.isArray(message.parts)) {
                    parts = message.parts;
                } else if (message.content) {
                    parts = [{ text: String(message.content) || 'Continue' }];
                } else {
                    parts = [{ text: 'Continue' }];
                }

                return {
                    role: message.role === TLLMMessageRole.Assistant ? 'model' : 'user',
                    parts,
                };
            });
    }

    private formatToolsForVertexAI(tools: any[]) {
        return [
            {
                functionDeclarations: tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description || '',
                    parameters: {
                        type: 'object',
                        properties: tool.properties || {},
                        required: tool.requiredFields || [],
                    },
                })),
            },
        ];
    }

    /**
     * Normalize prompt format for @google/genai API
     * Similar to GoogleAI connector's normalizePrompt method
     */
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

        // Handle tool prompt format if needed
        if (typeof prompt === 'object' && 'contents' in (prompt as any)) {
            const { contents, systemInstruction, tools, toolConfig } = prompt as any;
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

    /**
     * Build request configuration from various sources
     * Similar to GoogleAI connector's buildRequestConfig method
     */
    private buildRequestConfig({
        generationConfig,
        systemInstruction,
        promptConfig,
        abortSignal,
    }: {
        generationConfig?: TGoogleAIRequestBody['generationConfig'];
        systemInstruction?: TGoogleAIRequestBody['systemInstruction'];
        promptConfig?: Record<string, any>;
        abortSignal?: AbortSignal;
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

        if (abortSignal) {
            config.abortSignal = abortSignal;
        }

        return Object.keys(config).length > 0 ? config : undefined;
    }

    public formatToolsConfig({ toolDefinitions, toolChoice = 'auto' }) {
        const tools = toolDefinitions.map((tool) => {
            const { name, description, properties, requiredFields } = tool;

            return {
                name,
                description,
                properties,
                requiredFields,
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
            const parts: any[] = [];

            if (Array.isArray(messageBlock.parts) && messageBlock.parts.length > 0) {
                for (const part of messageBlock.parts) {
                    if (!part) continue;

                    if (typeof part.text === 'string' && part.text.trim()) {
                        parts.push({ text: part.text.trim() });
                        continue;
                    }

                    if (part.functionCall) {
                        parts.push({
                            functionCall: {
                                name: part.functionCall.name,
                                args: parseFunctionArgs(part.functionCall.args),
                            },
                        });
                        continue;
                    }

                    if (part.functionResponse) {
                        parts.push({
                            functionResponse: {
                                name: part.functionResponse.name,
                                response: parseFunctionResponse(part.functionResponse.response),
                            },
                        });
                        continue;
                    }

                    if ((part as any).inlineData) {
                        parts.push({ inlineData: (part as any).inlineData });
                    }
                }
            } else {
                if (typeof messageBlock.content === 'string' && messageBlock.content.trim()) {
                    parts.push({ text: messageBlock.content.trim() });
                } else if (Array.isArray(messageBlock.content) && messageBlock.content.length > 0) {
                    parts.push(...messageBlock.content);
                }
            }

            if (Array.isArray(messageBlock.tool_calls) && messageBlock.tool_calls.length > 0) {
                const functionCalls = messageBlock.tool_calls
                    .map((toolCall: any) => {
                        if (!toolCall?.function?.name) return undefined;
                        return {
                            functionCall: {
                                name: toolCall.function.name,
                                args: parseFunctionArgs(toolCall.function.arguments),
                            },
                        };
                    })
                    .filter(Boolean);

                parts.push(...functionCalls);
            }

            const hasFunctionCall = parts.some((part) => part.functionCall);
            if (!hasFunctionCall && toolsData.length > 0) {
                toolsData.forEach((toolCall) => {
                    parts.push({
                        functionCall: {
                            name: toolCall.name,
                            args: parseFunctionArgs(toolCall.arguments),
                        },
                    });
                });
            }

            if (parts.length > 0) {
                let role = messageBlock.role;
                if (role === TLLMMessageRole.Assistant) {
                    role = TLLMMessageRole.Model;
                } else if (role === TLLMMessageRole.Tool) {
                    role = TLLMMessageRole.Function;
                }

                messageBlocks.push({
                    role,
                    parts,
                });
            }
        }

        // Transform tool results
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
}
