import EventEmitter from 'events';
import OpenAI from 'openai';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TLLMParams, TLLMPreparedParams, ILLMRequestContext, ToolData, TLLMMessageRole, APIKeySource, TLLMEvent } from '@sre/types/LLM.types';
import { OpenAIApiInterface, ToolConfig } from './OpenAIApiInterface';
import { HandlerDependencies } from '../types';
import { JSON_RESPONSE_INSTRUCTION, SUPPORTED_MIME_TYPES_MAP, BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import { MODELS_WITHOUT_SYSTEM_MESSAGE_SUPPORT, MODELS_WITHOUT_JSON_RESPONSE_SUPPORT, O3_AND_O4_MODELS } from './constants';

import { isValidOpenAIReasoningEffort } from './utils';

// File size limits in bytes
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * OpenAI Chat Completions API interface implementation
 * Handles all Chat Completions API-specific logic including:
 * - Stream creation and handling
 * - Request body preparation
 * - Tool and message transformations
 * - File attachment handling
 */
export class ChatCompletionsApiInterface extends OpenAIApiInterface {
    private deps: HandlerDependencies;
    private validImageMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.image;
    private validDocumentMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.document;

    constructor(context: ILLMRequestContext, deps: HandlerDependencies) {
        super(context);
        this.deps = deps;
    }

    public async createRequest(
        body: OpenAI.ChatCompletionCreateParams,
        context: ILLMRequestContext,
        abortSignal?: AbortSignal
    ): Promise<OpenAI.ChatCompletion> {
        const openai = await this.deps.getClient(context);
        return await openai.chat.completions.create(
            {
                ...body,
                stream: false,
            },
            { signal: abortSignal }
        );
    }

    public async createStream(
        body: OpenAI.ChatCompletionCreateParams,
        context: ILLMRequestContext,
        abortSignal?: AbortSignal
    ): Promise<AsyncIterable<OpenAI.ChatCompletionChunk>> {
        const openai = await this.deps.getClient(context);
        return await openai.chat.completions.create(
            {
                ...body,
                stream: true,
                stream_options: { include_usage: true },
            },
            { signal: abortSignal }
        );
    }

    public handleStream(stream: AsyncIterable<OpenAI.ChatCompletionChunk>, context: ILLMRequestContext): EventEmitter {
        const emitter = new EventEmitter();

        // Process stream asynchronously while returning emitter immediately
        (async () => {
            let finalToolsData: ToolData[] = [];

            try {
                // Step 1: Process the stream
                const streamResult = await this.processStream(stream, emitter);
                finalToolsData = streamResult.toolsData;

                const finishReason = streamResult.finishReason || 'stop';
                const usageData = streamResult.usageData;

                // Step 2: Report usage statistics
                const reportedUsage = this.reportUsageStatistics(usageData, context);

                // Step 3: Emit final events
                this.emitFinalEvents(emitter, finalToolsData, reportedUsage, finishReason);
            } catch (error) {
                emitter.emit(TLLMEvent.Error, error);
            }
        })();

        return emitter;
    }

    public async prepareRequestBody(params: TLLMPreparedParams): Promise<OpenAI.ChatCompletionCreateParams> {
        let messages = await this.prepareMessages(params);

        // Convert system messages for models that don't support them
        if (MODELS_WITHOUT_SYSTEM_MESSAGE_SUPPORT.includes(params.modelEntryName)) {
            messages = this.convertSystemMessagesToUserMessages(messages);
        }

        // Handle JSON response format
        if (params.responseFormat === 'json') {
            const supportsSystemMessages = !MODELS_WITHOUT_SYSTEM_MESSAGE_SUPPORT.includes(params.modelEntryName);

            if (supportsSystemMessages) {
                // For models that support system messages
                if (messages?.[0]?.role === TLLMMessageRole.System) {
                    messages[0] = { ...messages[0], content: messages[0].content + JSON_RESPONSE_INSTRUCTION };
                } else {
                    messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
                }
            } else {
                // For models that don't support system messages, prepend to first user message
                const firstUserMessageIndex = messages.findIndex((msg) => msg.role === TLLMMessageRole.User);
                if (firstUserMessageIndex !== -1) {
                    const userMessage = messages[firstUserMessageIndex];
                    const content = typeof userMessage.content === 'string' ? userMessage.content : '';
                    messages[firstUserMessageIndex] = {
                        ...userMessage,
                        content: JSON_RESPONSE_INSTRUCTION + '\n\n' + content,
                    };
                } else {
                    // If no user message exists, create one with the instruction
                    messages.push({ role: TLLMMessageRole.User, content: JSON_RESPONSE_INSTRUCTION });
                }
            }

            params.responseFormat = { type: 'json_object' };
        }

        const body: OpenAI.ChatCompletionCreateParams = {
            model: params.model as string,
            messages,
        };

        // Handle max tokens
        if (params?.maxTokens !== undefined) {
            body.max_completion_tokens = params.maxTokens;
        }

        // Handle temperature
        const modelName = params.modelEntryName?.replace(BUILT_IN_MODEL_PREFIX, '');
        if (params?.temperature !== undefined && !O3_AND_O4_MODELS.includes(modelName)) {
            body.temperature = params.temperature;
        }

        // Handle topP
        if (params?.topP !== undefined && !O3_AND_O4_MODELS.includes(modelName)) {
            body.top_p = params.topP;
        }

        // Handle frequency penalty
        if (params?.frequencyPenalty !== undefined && !O3_AND_O4_MODELS.includes(modelName)) {
            body.frequency_penalty = params.frequencyPenalty;
        }

        // Handle presence penalty
        if (params?.presencePenalty !== undefined && !O3_AND_O4_MODELS.includes(modelName)) {
            body.presence_penalty = params.presencePenalty;
        }

        // Handle response format
        if (params?.responseFormat?.type && !MODELS_WITHOUT_JSON_RESPONSE_SUPPORT.includes(modelName)) {
            body.response_format = params.responseFormat;
        }

        // Handle stop sequences
        if (params?.stopSequences?.length && !O3_AND_O4_MODELS.includes(modelName)) {
            body.stop = params.stopSequences;
        }

        // #region GPT 5 specific fields
        const isGPT5ReasoningModels = params.modelEntryName?.includes('gpt-5') && params?.capabilities?.reasoning;
        if (isGPT5ReasoningModels && params?.verbosity) {
            body.verbosity = params.verbosity;
        }

        // We need to validate the `reasoningEffort` parameter for OpenAI models, since models like `qwen/qwen3-32b` and `deepseek-r1-distill-llama-70b` (available via Groq) also support this parameter but use different values, such as `none` and `default`. These values are valid in our system but not specifically for OpenAI.
        if (isGPT5ReasoningModels && isValidOpenAIReasoningEffort(params.reasoningEffort)) {
            body.reasoning_effort = params.reasoningEffort;
        }
        // #endregion GPT 5 specific fields

        // Handle tools configuration
        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            body.tools = params?.toolsConfig?.tools as OpenAI.ChatCompletionTool[];
            body.tool_choice = params?.toolsConfig?.tool_choice;
        }

        return body;
    }

    /**
     * Transform OpenAI tool definitions to ChatCompletionTool format
     */
    public transformToolsConfig(config: ToolConfig): OpenAI.ChatCompletionTool[] {
        return config.toolDefinitions.map((tool) => {
            // Handle OpenAI tool definition format
            if ('parameters' in tool) {
                return {
                    type: 'function' as const,
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.parameters,
                    },
                };
            }

            // Handle legacy format for backward compatibility
            return {
                type: 'function' as const,
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: {
                        type: 'object',
                        properties: tool.properties || {},
                        required: tool.requiredFields || [],
                    },
                },
            };
        });
    }

    public async handleFileAttachments(
        files: BinaryInput[],
        agentId: string,
        messages: OpenAI.ChatCompletionMessageParam[]
    ): Promise<OpenAI.ChatCompletionMessageParam[]> {
        if (files.length === 0) return messages;

        const uploadedFiles = await this.uploadFiles(files, agentId);
        const validImageFiles = this.getValidImageFiles(uploadedFiles);
        const validDocumentFiles = this.getValidDocumentFiles(uploadedFiles);

        // Process images and documents with Chat Completions specific formatting
        const imageData = await this.processImageData(validImageFiles, agentId);
        const documentData = await this.processDocumentData(validDocumentFiles, agentId);

        // For Chat Completions, we modify the last user message
        const messagesCopy = [...messages];
        const userMessage =
            Array.isArray(messagesCopy) && messagesCopy.length > 0 ? messagesCopy[messagesCopy.length - 1] : { role: 'user', content: '' };
        const prompt = userMessage?.content && typeof userMessage.content === 'string' ? userMessage.content : '';

        const promptData = [{ type: 'text', text: prompt || '' }, ...imageData, ...documentData];

        // Replace the last message or add a new one if array was empty
        if (messagesCopy.length > 0) {
            messagesCopy[messagesCopy.length - 1] = { role: 'user', content: promptData };
        } else {
            messagesCopy.push({ role: 'user', content: promptData });
        }

        return messagesCopy;
    }

    /**
     * Process the chat completions API stream format
     */
    private async processStream(
        stream: AsyncIterable<OpenAI.ChatCompletionChunk>,
        emitter: EventEmitter
    ): Promise<{ toolsData: ToolData[]; finishReason: string; usageData: any[] }> {
        let toolsData: ToolData[] = [];
        let finishReason = 'stop';
        const usageData = [];

        for await (const part of stream) {
            const delta = part.choices[0]?.delta;
            const usage = part.usage;

            // Collect usage statistics
            if (usage) {
                usageData.push(usage);
            }

            // Emit data event for delta
            emitter.emit(TLLMEvent.Data, delta);

            // Handle content deltas
            if (!delta?.tool_calls && delta?.content) {
                emitter.emit(TLLMEvent.Content, delta?.content, delta?.role);
            }

            // Handle tool calls
            if (delta?.tool_calls) {
                const toolCall = delta?.tool_calls?.[0];
                const index = toolCall?.index;

                if (!toolsData[index]) {
                    toolsData[index] = {
                        index: index || 0,
                        id: '',
                        type: 'function',
                        name: '',
                        arguments: '',
                        role: 'tool',
                    };
                }

                if (toolCall?.function?.name) {
                    toolsData[index].name = toolCall.function.name;
                }
                if (toolCall?.function?.arguments) {
                    toolsData[index].arguments += toolCall.function.arguments;
                }
                if (toolCall?.id) {
                    toolsData[index].id = toolCall.id;
                }
            }

            // Handle finish reason
            if (part.choices[0]?.finish_reason) {
                finishReason = part.choices[0].finish_reason;
            }
        }

        return { toolsData: this.extractToolCalls(toolsData), finishReason, usageData };
    }

    /**
     * Extract and format tool calls from the accumulated data
     */
    private extractToolCalls(toolsData: ToolData[]): ToolData[] {
        return toolsData.map((tool) => ({
            index: tool.index,
            name: tool.name,
            arguments: tool.arguments,
            id: tool.id,
            type: tool.type,
            role: tool.role,
        }));
    }

    /**
     * Report usage statistics
     */
    private reportUsageStatistics(usage_data: OpenAI.Completions.CompletionUsage[], context: ILLMRequestContext): any[] {
        const reportedUsage: any[] = [];

        // Report normal usage
        usage_data.forEach((usage) => {
            const reported = this.deps.reportUsage(usage, this.buildUsageContext(context));
            reportedUsage.push(reported);
        });

        return reportedUsage;
    }

    /**
     * Emit final events
     */
    private emitFinalEvents(emitter: EventEmitter, toolsData: ToolData[], reportedUsage: any[], finishReason: string): void {
        // Emit tool info event if tools were called
        if (toolsData.length > 0) {
            emitter.emit(TLLMEvent.ToolInfo, toolsData);
        }

        // Emit interrupted event if finishReason is not 'stop'
        if (finishReason !== 'stop') {
            emitter.emit(TLLMEvent.Interrupted, finishReason);
        }

        // Emit end event with setImmediate to ensure proper event ordering
        setImmediate(() => {
            emitter.emit(TLLMEvent.End, toolsData, reportedUsage, finishReason);
        });
    }

    /**
     * Build usage context parameters from request context
     */
    private buildUsageContext(context: ILLMRequestContext) {
        return {
            modelEntryName: context.modelEntryName,
            keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
            agentId: context.agentId,
            teamId: context.teamId,
        };
    }

    /**
     * Get valid image files based on supported MIME types
     */
    private getValidImageFiles(files: BinaryInput[]): BinaryInput[] {
        return files.filter((file) => this.validImageMimeTypes.includes(file?.mimetype));
    }

    /**
     * Get valid document files based on supported MIME types
     */
    private getValidDocumentFiles(files: BinaryInput[]): BinaryInput[] {
        return files.filter((file) => this.validDocumentMimeTypes.includes(file?.mimetype));
    }

    /**
     * Upload files to storage
     */
    private async uploadFiles(files: BinaryInput[], agentId: string): Promise<BinaryInput[]> {
        const candidate = AccessCandidate.agent(agentId);
        const promises = files.map((file) => {
            const binaryInput = BinaryInput.from(file, null, null, candidate);
            return binaryInput.upload(candidate).then(() => binaryInput);
        });

        return Promise.all(promises);
    }

    /**
     * Process image files with Chat Completions specific formatting
     */
    private async processImageData(files: BinaryInput[], agentId: string): Promise<any[]> {
        if (files.length === 0) return [];

        const imageData = [];
        for (const file of files) {
            await this.validateFileSize(file, MAX_IMAGE_SIZE, 'Image', agentId);

            const bufferData = await file.readData(AccessCandidate.agent(agentId));
            const base64Data = bufferData.toString('base64');
            const url = `data:${file.mimetype};base64,${base64Data}`;

            imageData.push({
                type: 'image_url',
                image_url: { url },
            });
        }

        return imageData;
    }

    /**
     * Process document files with Chat Completions specific formatting
     */
    private async processDocumentData(files: BinaryInput[], agentId: string): Promise<any[]> {
        if (files.length === 0) return [];

        const documentData = [];
        for (const file of files) {
            await this.validateFileSize(file, MAX_DOCUMENT_SIZE, 'Document', agentId);

            const bufferData = await file.readData(AccessCandidate.agent(agentId));
            const base64Data = bufferData.toString('base64');
            const fileData = `data:${file.mimetype};base64,${base64Data}`;
            const filename = await file.getName();

            documentData.push({
                type: 'file',
                file: {
                    file_data: fileData,
                    filename,
                },
            });
        }

        return documentData;
    }

    /**
     * Validate file size before processing
     */
    private async validateFileSize(file: BinaryInput, maxSize: number, fileType: string, agentId: string): Promise<void> {
        await file.ready();
        const fileInfo = await file.getJsonData(AccessCandidate.agent(agentId));
        if (fileInfo.size > maxSize) {
            throw new Error(`${fileType} file size (${fileInfo.size} bytes) exceeds maximum allowed size of ${maxSize} bytes`);
        }
    }

    getInterfaceName(): string {
        return 'chat.completions';
    }

    validateParameters(params: TLLMParams): boolean {
        // Basic validation for Chat Completions parameters
        return !!params.model && Array.isArray(params.messages);
    }

    /**
     * Convert system messages to user messages for models that don't support system messages
     */
    private convertSystemMessagesToUserMessages(messages: OpenAI.ChatCompletionMessageParam[]): OpenAI.ChatCompletionMessageParam[] {
        const convertedMessages: OpenAI.ChatCompletionMessageParam[] = [];
        const systemMessages: string[] = [];

        // Extract system messages and collect other messages
        for (const message of messages) {
            if (message.role === TLLMMessageRole.System) {
                const content = typeof message.content === 'string' ? message.content : '';
                if (content.trim()) {
                    systemMessages.push(content);
                }
            } else {
                convertedMessages.push(message);
            }
        }

        // If we have system messages, prepend them to the first user message
        if (systemMessages.length > 0) {
            const systemContent = systemMessages.join('\n\n');
            const firstUserMessageIndex = convertedMessages.findIndex((msg) => msg.role === TLLMMessageRole.User);

            if (firstUserMessageIndex !== -1) {
                const userMessage = convertedMessages[firstUserMessageIndex];
                const existingContent = typeof userMessage.content === 'string' ? userMessage.content : '';
                convertedMessages[firstUserMessageIndex] = {
                    ...userMessage,
                    content: systemContent + '\n\n' + existingContent,
                };
            } else {
                // If no user message exists, create one with the system content
                convertedMessages.unshift({ role: TLLMMessageRole.User, content: systemContent });
            }
        }

        return convertedMessages;
    }

    /**
     * Prepare messages for Chat Completions API
     */
    private async prepareMessages(params: TLLMParams): Promise<OpenAI.ChatCompletionMessageParam[]> {
        const messages = params?.messages || [];
        const files: BinaryInput[] = params?.files || [];

        // Handle files if present
        if (files.length > 0) {
            return await this.handleFileAttachments(files, params.agentId, [...messages]);
        }

        return messages;
    }
}
