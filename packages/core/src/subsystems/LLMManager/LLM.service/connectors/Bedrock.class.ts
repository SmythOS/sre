import {
    BedrockRuntimeClient,
    ConverseCommand,
    ConverseCommandInput,
    ConverseStreamCommandInput,
    ConverseStreamCommand,
    ConverseStreamCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, ToolData, TLLMMessageBlock, TLLMToolResultMessageBlock, TLLMMessageRole, GenerateImageConfig } from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { customModels } from '@sre/LLMManager/custom-models';
import { isJSONString } from '@sre/utils/general.utils';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('BedrockConnector');

type InferenceConfig = {
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
    topP?: number;
};

// TODO: Need to adjust some type definitions

export class BedrockConnector extends LLMConnector {
    public name = 'LLM:Bedrock';

    protected async chatRequest(acRequest: AccessRequest, params: TLLMParams): Promise<LLMChatResponse> {
        const _params = JSON.parse(JSON.stringify(params)); // Avoid mutation of the original params
        let messages = _params?.messages || [];

        //#region Separate system message and add JSON response instruction if needed
        let systemPrompt;
        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

        if ('content' in systemMessage) {
            systemPrompt = systemMessage.content;
        }

        messages = otherMessages;

        const responseFormat = _params?.responseFormat || '';
        if (responseFormat === 'json') {
            systemPrompt = [{ text: JSON_RESPONSE_INSTRUCTION }];
        }

        const modelInfo = _params.modelInfo;
        const supportsSystemPrompt = customModels[modelInfo?.settings?.foundationModel]?.supportsSystemPrompt;

        if (!supportsSystemPrompt) {
            messages[0].content?.push(systemPrompt[0]);
            systemPrompt = undefined; // Reset system prompt if it's not supported
        }

        //#endregion Separate system message and add JSON response instruction if needed

        const modelId = modelInfo.settings?.customModel || modelInfo.settings?.foundationModel;

        const inferenceConfig: InferenceConfig = {};
        if (_params?.maxTokens !== undefined) inferenceConfig.maxTokens = _params.maxTokens;
        if (_params?.temperature !== undefined) inferenceConfig.temperature = _params.temperature;
        if (_params?.topP !== undefined) inferenceConfig.topP = _params.topP;
        if (_params?.stopSequences?.length) inferenceConfig.stopSequences = _params.stopSequences;

        const converseCommandInput: any = {
            modelId,
            messages,
        };

        if (Object.keys(inferenceConfig).length > 0) {
            converseCommandInput.inferenceConfig = inferenceConfig;
        }

        if (systemPrompt) {
            converseCommandInput.system = systemPrompt;
        }

        const command = new ConverseCommand(converseCommandInput);

        try {
            const client = new BedrockRuntimeClient({
                region: modelInfo.settings.region,
                credentials: _params?.credentials,
            });

            const response = await client.send(command);
            const content = response.output?.message?.content?.[0]?.text;

            return { content, finishReason: 'stop' };
        } catch (error) {
            throw error;
        }
    }

    protected async streamToolRequest(acRequest: AccessRequest, { model, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by Bedrock');
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not supported for Bedrock.');
    }

    protected async toolRequest(acRequest: AccessRequest, params): Promise<any> {
        try {
            const _params = JSON.parse(JSON.stringify(params)); // Avoid mutation of the original params

            const customModelInfo = _params.modelInfo;

            const client = new BedrockRuntimeClient({
                region: customModelInfo.settings.region,
                credentials: _params?.credentials,
            });

            let systemPrompt;
            let messages = _params?.messages || [];

            const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

            if ('content' in systemMessage) {
                systemPrompt = typeof systemMessage?.content === 'string' ? [{ text: systemMessage?.content }] : systemMessage?.content;
            }

            messages = otherMessages;

            const converseCommandInput: ConverseCommandInput = {
                modelId: customModelInfo.settings?.customModel || customModelInfo.settings?.foundationModel,
                messages,
            };

            if (systemPrompt) {
                converseCommandInput.system = systemPrompt;
            }

            if (_params?.toolsConfig?.tools?.length > 0) {
                converseCommandInput.toolConfig = {
                    tools: _params?.toolsConfig?.tools,
                    ...(_params?.toolsConfig?.tool_choice && { toolChoice: _params?.toolsConfig?.tool_choice }),
                };
            }

            const command = new ConverseCommand(converseCommandInput);
            const response = await client.send(command);

            const message = response.output?.message;
            const finishReason = response.stopReason;

            let toolsData: ToolData[] = [];
            let useTool = false;

            if (finishReason === 'tool_use') {
                const toolUseBlocks = message?.content?.filter((block) => block?.toolUse) || [];

                toolsData = toolUseBlocks.map((block, index) => ({
                    index,
                    id: block.toolUse?.toolUseId as string,
                    type: 'function', // We call API only when the tool type is 'function' in src/services/LLMHelper/ToolExecutor.class.ts`. Even though Claude returns the type as 'tool_use', it should be interpreted as 'function'.,
                    name: _deserializeToolName(block.toolUse?.name as string),
                    arguments: block.toolUse?.input as Record<string, any>,
                    role: 'tool',
                }));
                useTool = true;
            }

            return {
                data: {
                    useTool,
                    message,
                    content: message?.content?.[0]?.text || message?.content || '',
                    toolsData,
                },
            };
        } catch (error: any) {
            throw error?.error || error;
        }
    }

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<ImagesResponse> {
        throw new Error('Image generation request is not supported for Bedrock.');
    }

    protected async streamRequest(acRequest: AccessRequest, params): Promise<EventEmitter> {
        const emitter = new EventEmitter();

        try {
            const _params = JSON.parse(JSON.stringify(params)); // Avoid mutation of the original params

            const customModelInfo = _params.modelInfo;

            const client = new BedrockRuntimeClient({
                region: customModelInfo.settings.region,
                credentials: _params?.credentials,
            });

            let systemPrompt;
            let messages = _params?.messages || [];

            // Handle system message separation
            const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

            if ('content' in systemMessage) {
                systemPrompt = typeof systemMessage?.content === 'string' ? [{ text: systemMessage?.content }] : systemMessage?.content;
            }

            messages = otherMessages;

            const converseCommandInput: ConverseStreamCommandInput = {
                modelId: customModelInfo.settings?.customModel || customModelInfo.settings?.foundationModel,
                messages,
            };

            if (systemPrompt) {
                converseCommandInput.system = systemPrompt;
            }

            if (_params?.toolsConfig?.tools?.length > 0) {
                converseCommandInput.toolConfig = {
                    tools: _params?.toolsConfig?.tools,
                    ...(_params?.toolsConfig?.tool_choice && { toolChoice: _params?.toolsConfig?.tool_choice }),
                };
            }

            const command = new ConverseStreamCommand(converseCommandInput);
            const response: ConverseStreamCommandOutput = await client.send(command);
            const stream = response.stream;

            if (stream) {
                (async () => {
                    let currentMessage = {
                        role: '',
                        content: '',
                        toolCalls: [] as any[],
                        currentToolCall: null as any,
                        currentToolInput: '' as string,
                    };

                    for await (const chunk of stream) {
                        // Handle message start
                        if (chunk.messageStart) {
                            currentMessage.role = chunk.messageStart.role || '';
                            emitter.emit('data', { role: currentMessage.role });
                        }

                        // Handle content deltas
                        if (chunk.contentBlockDelta?.delta?.text) {
                            currentMessage.content += chunk.contentBlockDelta.delta.text;
                            emitter.emit('data', chunk.contentBlockDelta.delta.text);
                            emitter.emit('content', chunk.contentBlockDelta.delta.text, currentMessage.role);
                        }

                        // Handle tool use start
                        if (chunk.contentBlockStart?.start?.toolUse) {
                            const toolUse = chunk.contentBlockStart.start.toolUse;
                            if (toolUse.toolUseId && toolUse.name) {
                                currentMessage.currentToolCall = {
                                    index: currentMessage.toolCalls.length,
                                    id: toolUse.toolUseId,
                                    type: 'function',
                                    name: _deserializeToolName(toolUse.name),
                                    arguments: '',
                                    role: 'tool',
                                };
                                currentMessage.currentToolInput = '';
                            }
                        }

                        // Handle tool use input deltas
                        if (chunk.contentBlockDelta?.delta?.toolUse?.input && currentMessage.currentToolCall) {
                            currentMessage.currentToolInput += chunk.contentBlockDelta.delta.toolUse.input;
                            currentMessage.currentToolCall.arguments = currentMessage.currentToolInput;
                        }

                        // Handle tool use block completion
                        if (chunk.contentBlockStop && currentMessage.currentToolCall) {
                            // Parse JSON arguments if possible
                            if (
                                typeof currentMessage.currentToolCall.arguments === 'string' &&
                                isJSONString(currentMessage.currentToolCall.arguments)
                            ) {
                                currentMessage.currentToolCall.arguments = JSON.parse(currentMessage.currentToolCall.arguments);
                            }

                            currentMessage.toolCalls.push(currentMessage.currentToolCall);
                            currentMessage.currentToolCall = null;
                            currentMessage.currentToolInput = '';
                        }

                        // Handle message completion
                        if (chunk.messageStop) {
                            if (currentMessage.toolCalls.length > 0) {
                                emitter.emit('toolsData', currentMessage.toolCalls);
                            }
                            emitter.emit('end', currentMessage.toolCalls);
                        }
                    }
                })();
            }

            return emitter;
        } catch (error: unknown) {
            const typedError = error as Error;
            emitter.emit('error', typedError?.['error'] || typedError);
            return emitter;
        }
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        let tools: any[] = [];

        if (type === 'function') {
            tools = toolDefinitions.map((tool) => {
                const { name, description, properties, requiredFields } = tool;

                return {
                    toolSpec: {
                        name: _serializeToolName(name),
                        description,
                        inputSchema: {
                            json: {
                                type: 'object',
                                properties,
                                required: requiredFields,
                            },
                        },
                    },
                };
            });
        }

        return tools?.length > 0 ? { tools, toolChoice: toolChoice || 'auto' } : {};
    }

    public transformToolMessageBlocks({
        messageBlock,
        toolsData,
    }: {
        messageBlock: TLLMMessageBlock;
        toolsData: ToolData[];
    }): TLLMToolResultMessageBlock[] {
        const messageBlocks: any[] = [];

        if (messageBlock) {
            const content: any[] = []; // TODO: set proper type for content

            if (typeof messageBlock.content === 'string') {
                content.push({ text: messageBlock.content });
            } else if (Array.isArray(messageBlock.content)) {
                content.push(...messageBlock.content);
            }

            if (messageBlock.tool_calls?.length) {
                messageBlock.tool_calls.forEach((toolCall: Record<string, any>) => {
                    content.push({
                        toolUse: {
                            toolUseId: toolCall.id,
                            name: _serializeToolName(toolCall?.function?.name),
                            input: toolCall?.function?.arguments || {},
                        },
                    });
                });
            }

            messageBlocks.push({
                role: messageBlock?.role,
                content,
            });
        }

        // Add tool results as user message
        if (toolsData?.length) {
            const toolResultsContent = toolsData
                .filter((tool) => tool.id && (tool.result || tool.error))
                .map((tool) => {
                    let content;

                    // * Note: We also have two other types of results: image and document. - https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/command/ConverseStreamCommand/
                    if (typeof tool?.result === 'string') {
                        content = [{ text: tool.result as string }];
                    } else if (typeof tool?.result === 'object') {
                        content = [{ json: tool.result }];
                    }

                    return {
                        toolResult: {
                            toolUseId: tool.id,
                            content: content,
                            ...(tool.error && { status: 'error' }),
                        },
                    };
                });

            if (toolResultsContent.length > 0) {
                messageBlocks.push({
                    role: TLLMMessageRole.User,
                    content: toolResultsContent,
                });
            }
        }

        return messageBlocks;
    }

    public getConsistentMessages(messages: TLLMMessageBlock[]): TLLMMessageBlock[] {
        const _messages = LLMHelper.removeDuplicateUserMessages(messages);

        return _messages.map((message) => {
            let textBlock = [];

            if (message?.parts) {
                textBlock = message.parts;
            } else if (message?.content) {
                textBlock = Array.isArray(message.content) ? message.content : [{ text: message.content as string }];
            }

            return {
                role: message.role,
                content: textBlock,
            };
        });
    }
}

/**
 * Serializes a name by converting dashes to double underscores for Bedrock compatibility
 * @param name - The original name containing dashes
 * @returns The serialized name with dashes replaced by double underscores
 */
function _serializeToolName(name: string): string {
    return name?.replace(/-/g, '__');
}

/**
 * Deserializes a Bedrock Tool name by converting double underscores back to dashes
 * @param name - The serialized name containing double underscores
 * @returns The deserialized name with double underscores replaced by dashes
 */
function _deserializeToolName(name: string): string {
    return name?.replace(/__/g, '-');
}
