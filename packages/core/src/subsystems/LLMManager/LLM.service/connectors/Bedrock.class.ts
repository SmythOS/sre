import {
    BedrockRuntimeClient,
    ConverseCommand,
    ConverseCommandInput,
    ConverseStreamCommand,
    ConverseStreamCommandOutput,
    TokenUsage,
    ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import EventEmitter from 'events';

import { BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import {
    ToolData,
    TLLMMessageBlock,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    APIKeySource,
    TLLMEvent,
    TLLMFinishReason,
    BedrockCredentials,
    ILLMRequestFuncParams,
    TLLMChatResponse,
    ILLMRequestContext,
    TCustomLLMModel,
    TLLMPreparedParams,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { isJSONString } from '@sre/utils/general.utils';

import { LLMConnector } from '../LLMConnector';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';
import { hookAsync } from '@sre/Core/HookService';

const logger = Logger('BedrockConnector');

// TODO [Forhad]: Need to adjust some type definitions

export class BedrockConnector extends LLMConnector {
    public name = 'LLM:Bedrock';

    private async getClient(params: ILLMRequestContext): Promise<BedrockRuntimeClient> {
        const credentials = params.credentials as BedrockCredentials;
        const region = (params.modelInfo as TCustomLLMModel).settings.region;

        if (!(Object.keys(credentials).length >= 2)) throw new Error('Access key ID and secret access key are required for Bedrock');

        return new BedrockRuntimeClient({
            region: region,
            credentials,
        });
    }

    @hookAsync('LLMConnector.request')
    protected async request({ acRequest, body, context, abortSignal }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
            const bedrock = await this.getClient(context);
            const command = new ConverseCommand(body);
            const response: ConverseCommandOutput = await bedrock.send(command, { abortSignal });

            const usage = response.usage;
            this.reportUsage(usage as any, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            const message = response.output?.message;
            const finishReason = LLMHelper.normalizeFinishReason(response.stopReason);

            let toolsData: ToolData[] = [];
            let useTool = false;

            if (finishReason === TLLMFinishReason.ToolCalls) {
                const toolUseBlocks = message?.content?.filter((block) => block?.toolUse) || [];

                toolsData = toolUseBlocks.map((block, index) => ({
                    index,
                    id: block.toolUse?.toolUseId as string,
                    type: 'function', // We call API only when the tool type is 'function' in src/helpers/Conversation.helper.ts`. Even though Claude returns the type as 'tool_use', it should be interpreted as 'function'.,
                    name: _deserializeToolName(block.toolUse?.name as string),
                    arguments: block.toolUse?.input as Record<string, any>,
                    role: 'tool',
                }));
                useTool = true;
            }

            return {
                content: Array.isArray(message?.content) ? message?.content?.[0]?.text || '' : message?.content || '',
                finishReason,
                useTool,
                toolsData,
                message: message as any,
                usage,
            };
        } catch (error: any) {
            logger.error(`request ${this.name}`, error, acRequest.candidate);
            throw error?.error || error;
        }
    }
    @hookAsync('LLMConnector.streamRequest')
    protected async streamRequest({ acRequest, body, context, abortSignal }: ILLMRequestFuncParams): Promise<EventEmitter> {
        const emitter = new EventEmitter();

        try {
            logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
            const bedrock = await this.getClient(context);
            const command = new ConverseStreamCommand(body);
            const response: ConverseStreamCommandOutput = await bedrock.send(command, { abortSignal });
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
                            emitter.emit(TLLMEvent.Data, { role: currentMessage.role });
                        }

                        // Handle content deltas
                        if (chunk.contentBlockDelta?.delta?.text) {
                            currentMessage.content += chunk.contentBlockDelta.delta.text;
                            emitter.emit(TLLMEvent.Data, chunk.contentBlockDelta.delta.text);
                            emitter.emit(TLLMEvent.Content, chunk.contentBlockDelta.delta.text, currentMessage.role);
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
                            const finishReason = chunk.messageStop.stopReason || 'stop';

                            if (currentMessage.toolCalls.length > 0) {
                                emitter.emit(TLLMEvent.ToolInfo, currentMessage.toolCalls);
                            }

                            // Emit interrupted event if finishReason is not 'stop'
                            if (finishReason !== 'stop' && finishReason !== 'end_turn') {
                                emitter.emit(TLLMEvent.Interrupted, finishReason);
                            }

                            emitter.emit(TLLMEvent.End, currentMessage.toolCalls, [], finishReason);
                        }

                        if (chunk?.metadata?.usage) {
                            const usage = chunk.metadata.usage;
                            this.reportUsage(usage as any, {
                                modelEntryName: context.modelEntryName,
                                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                                agentId: context.agentId,
                                teamId: context.teamId,
                            });
                        }
                    }
                })();
            }

            return emitter;
        } catch (error: unknown) {
            const typedError = error as Error;
            logger.error(`streamRequest ${this.name}`, typedError, acRequest.candidate);
            emitter.emit(TLLMEvent.Error, typedError?.['error'] || typedError);
            return emitter;
        }
    }

    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<ConverseCommandInput> {
        const customModelInfo = params.modelInfo;

        let systemPrompt;
        let messages = params?.messages || [];

        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

        if ('content' in systemMessage) {
            systemPrompt = typeof systemMessage?.content === 'string' ? [{ text: systemMessage?.content }] : systemMessage?.content;
        }

        messages = otherMessages;

        const body: ConverseCommandInput = {
            modelId: customModelInfo.settings?.customModel || customModelInfo.settings?.foundationModel,
            messages,
        };

        if (systemPrompt) {
            body.system = systemPrompt;
        }

        if (params?.toolsConfig?.tools?.length > 0) {
            body.toolConfig = {
                tools: params?.toolsConfig?.tools as any,
                ...(params?.toolsConfig?.tool_choice && { toolChoice: params?.toolsConfig?.tool_choice as any }),
            };
        }

        return body;
    }

    protected reportUsage(
        usage: TokenUsage & { cacheReadInputTokenCount: number; cacheWriteInputTokenCount: number },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: usage.inputTokens,
            output_tokens: usage.outputTokens,
            input_tokens_cache_write: usage.cacheWriteInputTokenCount || 0,
            input_tokens_cache_read: usage.cacheReadInputTokenCount || 0,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
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
                    const args = toolCall?.function?.arguments;
                    content.push({
                        toolUse: {
                            toolUseId: toolCall.id,
                            name: _serializeToolName(toolCall?.function?.name),
                            input: typeof args === 'string' ? JSONContent(args || '{}').tryParse() : args || {},
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
                // empty text causes error in Bedrock, so we add a placeholder
                textBlock = message.parts.map((part) => {
                    if ('text' in part) {
                        return { ...part, text: part.text || '...' };
                    }

                    return { ...part };
                });
            } else if (message?.content) {
                textBlock = Array.isArray(message.content)
                    ? message.content.map((part) => {
                          if ('text' in part) {
                              return { ...part, text: part.text || '...' };
                          }

                          return { ...part };
                      })
                    : [{ text: (message?.content as string) || '...' }]; // empty text causes error in Bedrock, so we add a placeholder
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
