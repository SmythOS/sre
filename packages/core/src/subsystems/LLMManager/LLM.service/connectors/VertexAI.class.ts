import { VertexAI, type GenerationConfig, type UsageMetadata } from '@google-cloud/vertexai';
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
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';
import { hookAsync } from '@sre/Core/HookService';

const logger = Logger('VertexAIConnector');

//TODO: [AHMED/FORHAD]: test the usage reporting for VertexAI because by the time we were implementing the feature of usage reporting
// we had no access to VertexAI so we assumed it is working (potential bug)

export class VertexAIConnector extends LLMConnector {
    public name = 'LLM:VertexAI';

    private async getClient(params: ILLMRequestContext): Promise<VertexAI> {
        const credentials = params.credentials as any;
        const modelInfo = params.modelInfo as TCustomLLMModel;
        const projectId = (modelInfo?.settings as TVertexAISettings)?.projectId;
        const region = modelInfo?.settings?.region;

        return new VertexAI({
            project: projectId,
            location: region,
            apiEndpoint: (modelInfo?.settings as TVertexAISettings)?.apiEndpoint,
            googleAuthOptions: {
                credentials: credentials as any,
            },
        });
    }

    @hookAsync('LLMConnector.request')
    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
            const vertexAI = await this.getClient(context);

            // Separate contents from model configuration
            const contents = body.contents;
            delete body.contents;

            // VertexAI expects contents in a specific format: {contents: [...]}
            const requestParam = { contents };

            const model = vertexAI.getGenerativeModel(body);

            const result = await model.generateContent(requestParam);
            const response = await result.response;

            const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const finishReason = response.candidates?.[0]?.finishReason || 'stop';
            const usage = response.usageMetadata;

            let toolsData: ToolData[] = [];
            let useTool = false;

            // Check for function calls in the response
            const functionCalls = response.candidates?.[0]?.content?.parts?.filter((part) => part.functionCall);
            if (functionCalls && functionCalls.length > 0) {
                functionCalls.forEach((call, index) => {
                    toolsData.push({
                        index,
                        id: call.functionCall?.name + '_' + index, // VertexAI doesn't provide IDs like Anthropic
                        type: 'function',
                        name: call.functionCall?.name,
                        arguments: call.functionCall?.args,
                        role: TLLMMessageRole.Assistant,
                    });
                });
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
        const emitter = new EventEmitter();

        // Handle abort signal to stop receiving events
        let isAborted = false;
        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                isAborted = true;
                emitter.removeAllListeners();
            });
        }

        setTimeout(async () => {
            try {
                logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
                const vertexAI = await this.getClient(context);

                // Separate contents from model configuration
                const contents = body.contents;
                delete body.contents;

                const vertexModel = vertexAI.getGenerativeModel(body);

                // VertexAI expects contents in a specific format: {contents: [...]}
                const requestParam = { contents };

                const streamResult = await vertexModel.generateContentStream(requestParam);

                let toolsData: ToolData[] = [];
                let usageData: any[] = [];

                for await (const chunk of streamResult.stream) {
                    // Break out of the loop if aborted
                    if (isAborted) break;

                    const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (chunkText) {
                        emitter.emit(TLLMEvent.Content, chunkText);
                    }
                }

                const aggregatedResponse = await streamResult.response;

                emitter.emit(TLLMEvent.Data, aggregatedResponse);

                // Check for function calls in the final response (like Anthropic does)
                const functionCalls = aggregatedResponse.candidates?.[0]?.content?.parts?.filter((part) => part.functionCall);
                if (functionCalls && functionCalls.length > 0) {
                    functionCalls.forEach((call, index) => {
                        toolsData.push({
                            index,
                            id: call.functionCall?.name + '_' + index,
                            type: 'function',
                            name: call.functionCall?.name,
                            arguments: call.functionCall?.args,
                            role: TLLMMessageRole.Assistant,
                        });
                    });

                    emitter.emit(TLLMEvent.ToolInfo, toolsData);
                }

                const usage = aggregatedResponse.usageMetadata;

                if (usage) {
                    const reportedUsage = this.reportUsage(usage, {
                        modelEntryName: context.modelEntryName,
                        keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId: context.agentId,
                        teamId: context.teamId,
                    });
                    usageData.push(reportedUsage);
                }

                const finishReason = (aggregatedResponse.candidates?.[0]?.finishReason || 'stop').toLowerCase();

                if (finishReason !== 'stop') {
                    emitter.emit(TLLMEvent.Interrupted, finishReason);
                }

                setTimeout(() => {
                    emitter.emit(TLLMEvent.End, toolsData, usageData, finishReason);
                }, 100);
            } catch (error) {
                logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
                emitter.emit(TLLMEvent.Error, error);
            }
        }, 100);

        return emitter;
    }

    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<TGoogleAIRequestBody> {
        const model = params?.model;
        const { messages, systemMessage } = await this.prepareMessages(params);

        let body: any = {
            model: model as string,
            contents: messages, // This will be separated in the request methods
        };

        const responseFormat = params?.responseFormat || '';
        let systemInstruction = systemMessage || '';

        if (responseFormat === 'json') {
            systemInstruction += (systemInstruction ? '\n\n' : '') + JSON_RESPONSE_INSTRUCTION;
        }

        const config: GenerationConfig = {};

        if (params.maxTokens !== undefined) config.maxOutputTokens = params.maxTokens;
        if (params.temperature !== undefined) config.temperature = params.temperature;
        if (params.topP !== undefined) config.topP = params.topP;
        if (params.topK !== undefined) config.topK = params.topK;
        if (params.stopSequences?.length) config.stopSequences = params.stopSequences;

        if (systemInstruction) {
            body.systemInstruction = {
                role: 'system',
                parts: [{ text: systemInstruction }],
            };
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

    protected reportUsage(usage: UsageMetadata, metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }) {
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

        // Handle system messages - VertexAI uses systemInstruction separately
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

        // Convert messages to VertexAI format
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
