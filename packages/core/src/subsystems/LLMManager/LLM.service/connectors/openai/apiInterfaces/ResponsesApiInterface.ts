import EventEmitter from 'events';
import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import os from 'os';
import path from 'path';
import fs from 'fs';

import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TLLMParams, TLLMPreparedParams, ILLMRequestContext, ToolData, APIKeySource, TLLMEvent, LLMModelInfo } from '@sre/types/LLM.types';
import { OpenAIApiInterface, ToolConfig } from './OpenAIApiInterface';
import { HandlerDependencies, TToolType } from '../types';
import { SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';
import { SEARCH_TOOL_COSTS } from './constants';
import { isValidOpenAIReasoningEffort } from './utils';
import { uid } from '@sre/utils';

// File size limits in bytes
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB

// Event type constants for type safety and maintainability
const EVENT_TYPES = {
    // Officially supported web search events (OpenAI SDK >= 5.12.x)
    WEB_SEARCH_IN_PROGRESS: 'response.web_search_call.in_progress',
    WEB_SEARCH_SEARCHING: 'response.web_search_call.searching',
    WEB_SEARCH_COMPLETED: 'response.web_search_call.completed',
    // Legacy alias observed historically (kept for backward compat if emitted)
    WEB_SEARCH_STARTED: 'response.web_search_call.started',

    RESPONSE_COMPLETED: 'response.completed',
    OUTPUT_TEXT_DELTA: 'response.output_text.delta',
    OUTPUT_ITEM_ADDED: 'response.output_item.added',
    FUNCTION_CALL_ARGUMENTS_DELTA: 'response.function_call_arguments.delta',
    FUNCTION_CALL_ARGUMENTS_DONE: 'response.function_call_arguments.done',
    OUTPUT_ITEM_DONE: 'response.output_item.done',
    INCOMPLETE: 'response.incomplete',
} as const;

// Type definitions for web search events (augmenting SDK types locally)
interface WebSearchInProgressEvent {
    type: typeof EVENT_TYPES.WEB_SEARCH_IN_PROGRESS;
    item_id: string;
}

interface WebSearchSearchingEvent {
    type: typeof EVENT_TYPES.WEB_SEARCH_SEARCHING;
    item_id: string;
}

interface WebSearchCompletedEvent {
    type: typeof EVENT_TYPES.WEB_SEARCH_COMPLETED;
    item_id: string;
}

type TSearchLocation = {
    type: 'approximate';
    city?: string;
    country?: string;
    region?: string;
    timezone?: string;
};

/**
 * OpenAI Responses API interface implementation
 * Handles all Responses API-specific logic including:
 * - Stream creation and handling
 * - Request body preparation
 * - Tool and message transformations
 * - File attachment handling
 */
export class ResponsesApiInterface extends OpenAIApiInterface {
    private deps: HandlerDependencies;
    private validImageMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.image;
    private validDocumentMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.document;

    constructor(context: ILLMRequestContext, deps: HandlerDependencies) {
        super(context);
        this.deps = deps;
    }

    async createRequest(body: OpenAI.Responses.ResponseCreateParams, context: ILLMRequestContext): Promise<OpenAI.Responses.Response> {
        const openai = await this.deps.getClient(context);
        return await openai.responses.create({
            ...body,
            stream: false,
        });
    }

    async createStream(
        body: OpenAI.Responses.ResponseCreateParams,
        context: ILLMRequestContext
    ): Promise<Stream<OpenAI.Responses.ResponseStreamEvent>> {
        const openai = await this.deps.getClient(context);
        return (await openai.responses.create({
            ...body,
            stream: true,
        })) as Stream<OpenAI.Responses.ResponseStreamEvent>;
    }

    public handleStream(stream: Stream<OpenAI.Responses.ResponseStreamEvent>, context: ILLMRequestContext): EventEmitter {
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

    /**
     * Process the responses API stream format
     */
    private async processStream(
        stream: Stream<OpenAI.Responses.ResponseStreamEvent>,
        emitter: EventEmitter
    ): Promise<{ toolsData: ToolData[]; finishReason: string; usageData: any[] }> {
        let toolsData: ToolData[] = [];
        let finishReason = 'stop';
        const usageData = [];

        for await (const part of stream) {
            try {
                // Handle different event types from the Responses API stream
                if ('type' in part) {
                    // Handle officially typed events using constants
                    switch (part.type) {
                        case EVENT_TYPES.WEB_SEARCH_IN_PROGRESS:
                            toolsData = this.handleWebSearchInProgress(part as any, toolsData);
                            break;
                        case EVENT_TYPES.WEB_SEARCH_SEARCHING:
                            toolsData = this.handleWebSearchSearching(part as any, toolsData);
                            break;
                        case EVENT_TYPES.WEB_SEARCH_COMPLETED:
                            toolsData = this.handleWebSearchCompleted(part as any, toolsData);
                            break;
                        case EVENT_TYPES.OUTPUT_TEXT_DELTA:
                            this.handleOutputTextDelta(part, emitter);
                            break;

                        case EVENT_TYPES.OUTPUT_ITEM_ADDED:
                            toolsData = this.handleOutputItemAdded(part, toolsData, emitter);
                            break;

                        case EVENT_TYPES.FUNCTION_CALL_ARGUMENTS_DELTA:
                            toolsData = this.handleFunctionCallArgumentsDelta(part, toolsData, emitter);
                            break;

                        case EVENT_TYPES.FUNCTION_CALL_ARGUMENTS_DONE:
                            toolsData = this.handleFunctionCallArgumentsDone(part, toolsData, emitter);
                            break;

                        case EVENT_TYPES.OUTPUT_ITEM_DONE:
                            toolsData = this.handleOutputItemDone(part, toolsData);
                            break;

                        case EVENT_TYPES.RESPONSE_COMPLETED: {
                            finishReason = 'stop';
                            const responseData = (part as any)?.response;
                            if (responseData?.usage) {
                                usageData.push(responseData.usage);
                            }
                            break;
                        }

                        case EVENT_TYPES.INCOMPLETE:
                            finishReason = 'incomplete';
                            const responseData = (part as any)?.response;
                            if (responseData?.usage) {
                                usageData.push(responseData.usage);
                            }
                            break;

                        default: {
                            const eventType = String(part.type);
                            // Handle legacy started event if ever emitted
                            if (eventType === EVENT_TYPES.WEB_SEARCH_STARTED) {
                                const legacyId = (part as any)?.id;
                                if (typeof legacyId === 'string') {
                                    const result = this.upsertWebSearchToolImmutable(toolsData, legacyId);
                                    toolsData = result.toolsData;
                                }
                                break;
                            }
                            // Handle any other unknown 'done' style events as completion
                            finishReason = this.handleCompletionEvent(eventType);
                            break;
                        }
                    }
                }
            } catch (error) {
                // Log error but continue processing to prevent stream interruption
                console.warn('Error processing stream event:', error, 'Event:', part);
            }
        }

        return { toolsData: this.extractToolCalls(toolsData), finishReason, usageData };
    }

    /**
     * Extract and format tool calls from the accumulated data
     */
    private extractToolCalls(output: ToolData[]): ToolData[] {
        return output.map((tool) => ({
            index: tool.index,
            name: tool.name,
            arguments: tool.arguments,
            id: tool.callId || tool.id, // Use callId for final output if available
            type: tool.type,
            role: tool.role,
            callId: tool.callId, // Preserve callId for reference
        }));
    }

    /**
     * Report usage statistics
     */
    private reportUsageStatistics(usage_data: any[], context: ILLMRequestContext): any[] {
        const reportedUsage: any[] = [];

        // Report normal usage
        usage_data.forEach((usage) => {
            // Convert ResponseUsage to CompletionUsage format for compatibility
            const convertedUsage = {
                completion_tokens: usage.completion_tokens || 0,
                prompt_tokens: usage.prompt_tokens || 0,
                total_tokens: usage.total_tokens || 0,
                ...usage,
            };
            const reported = this.deps.reportUsage(convertedUsage, this.buildUsageContext(context));
            reportedUsage.push(reported);
        });

        // Report search tool usage if enabled
        if (context.toolsInfo?.openai?.webSearch?.enabled) {
            const searchUsage = this.calculateSearchToolUsage(context);
            const reported = this.deps.reportUsage(searchUsage, this.buildUsageContext(context));
            reportedUsage.push(reported);
        }

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
     * Calculate search tool usage with cost
     */
    private calculateSearchToolUsage(context: ILLMRequestContext) {
        const modelName = context.modelEntryName?.replace('smythos/', '');
        const cost = this.getSearchToolCost(modelName);

        return {
            cost,
            completion_tokens: 0,
            prompt_tokens: 0,
            total_tokens: 0,
        };
    }

    // =====================
    // Event handlers (private)
    // =====================

    /**
     * Handle web search completed event with proper type safety
     */
    private handleWebSearchCompleted(event: WebSearchCompletedEvent, toolsData: ToolData[]): ToolData[] {
        try {
            const { item_id: itemId } = event;
            const result = this.upsertWebSearchToolImmutable(toolsData, itemId);
            return result.toolsData;
        } catch (error) {
            console.warn('Error handling web search completed event:', error);
            return toolsData;
        }
    }

    /**
     * Handle web search in-progress event (official typed)
     */
    private handleWebSearchInProgress(event: WebSearchInProgressEvent, toolsData: ToolData[]): ToolData[] {
        try {
            const { item_id: itemId } = event;
            const result = this.upsertWebSearchToolImmutable(toolsData, itemId);
            return result.toolsData;
        } catch (error) {
            console.warn('Error handling web search in_progress event:', error);
            return toolsData;
        }
    }

    /**
     * Handle web search searching event (official typed)
     */
    private handleWebSearchSearching(event: WebSearchSearchingEvent, toolsData: ToolData[]): ToolData[] {
        try {
            const { item_id: itemId } = event;
            const result = this.upsertWebSearchToolImmutable(toolsData, itemId);
            return result.toolsData;
        } catch (error) {
            console.warn('Error handling web search searching event:', error);
            return toolsData;
        }
    }

    /**
     * Handle output text delta events
     */
    private handleOutputTextDelta(part: any, emitter: EventEmitter): void {
        try {
            if ('delta' in part && part.delta) {
                const deltaMsg = {
                    role: 'assistant',
                    content: part.delta,
                };

                // TODO: we have inconsistency for data event with chat completions API, we need to check and fix it
                emitter.emit(TLLMEvent.Data, deltaMsg);
                emitter.emit(TLLMEvent.Content, part.delta, 'assistant');
            }
        } catch (error) {
            console.warn('Error handling output text delta:', error);
        }
    }

    /**
     * Handle output item added events (function calls)
     */
    private handleOutputItemAdded(part: any, toolsData: ToolData[], emitter: EventEmitter): ToolData[] {
        try {
            const partAny = part as any;
            if (partAny.item && partAny.item.type === 'function_call') {
                const item = partAny.item;
                const callId = item.call_id;
                const functionName = item.name;
                const itemId = item.id;

                if (callId && itemId) {
                    const existingIndex = toolsData.findIndex((t) => t.id === itemId || t.id === callId);
                    const addingNew = existingIndex === -1;
                    const nextIndex = addingNew ? toolsData.length : existingIndex;

                    let updated: ToolData[];
                    if (addingNew) {
                        const newItem: ToolData = {
                            index: nextIndex,
                            id: itemId,
                            callId: callId,
                            type: 'function',
                            name: functionName || '',
                            arguments: item.arguments || '',
                            role: 'tool',
                        } as ToolData;
                        updated = [...toolsData, newItem];
                    } else {
                        updated = toolsData.map((t, idx) => {
                            if (idx !== existingIndex) return t;
                            return {
                                ...t,
                                name: functionName || t.name,
                                arguments: item.arguments !== undefined ? item.arguments : t.arguments,
                                callId: t.callId || callId,
                            };
                        });
                    }

                    if (addingNew) {
                        // TODO: Check whether this event is being used.
                        emitter.emit('tool_call_started', {
                            id: callId,
                            name: functionName || '',
                            type: 'function',
                        });
                    }

                    return updated;
                }
            }
            return toolsData;
        } catch (error) {
            console.warn('Error handling output item added:', error);
            return toolsData;
        }
    }

    /**
     * Handle function call arguments delta events
     */
    private handleFunctionCallArgumentsDelta(part: any, toolsData: ToolData[], emitter: EventEmitter): ToolData[] {
        try {
            if ('delta' in part && 'item_id' in part && typeof part.delta === 'string' && typeof part.item_id === 'string') {
                const delta = part.delta;
                const itemId = part.item_id;

                const existingIndex = toolsData.findIndex((t) => t.id === itemId);
                let updated: ToolData[];
                let finalIndex: number;
                if (existingIndex === -1) {
                    finalIndex = toolsData.length;
                    const newItem: ToolData = {
                        index: finalIndex,
                        id: itemId,
                        type: 'function',
                        name: '',
                        arguments: delta,
                        role: 'tool',
                    } as ToolData;
                    updated = [...toolsData, newItem];
                } else {
                    finalIndex = existingIndex;
                    updated = toolsData.map((t, idx) => (idx === existingIndex ? { ...t, arguments: String(t.arguments || '') + delta } : t));
                }

                const entry = existingIndex === -1 ? updated[finalIndex] : updated[finalIndex];
                // TODO: Check whether this event is being used.
                emitter.emit('tool_call_progress', {
                    id: entry.callId || itemId,
                    name: entry.name,
                    arguments: entry.arguments,
                    delta: delta,
                });

                return updated;
            }
            return toolsData;
        } catch (error) {
            console.warn('Error handling function call arguments delta:', error);
            return toolsData;
        }
    }

    /**
     * Handle function call arguments done events
     */
    private handleFunctionCallArgumentsDone(part: any, toolsData: ToolData[], emitter: EventEmitter): ToolData[] {
        try {
            const partAny = part;
            if (partAny.item_id && partAny.arguments) {
                const itemId = partAny.item_id;
                const finalArguments = partAny.arguments;

                const toolIndex = toolsData.findIndex((t) => t.id === itemId);
                if (toolIndex !== -1) {
                    const updated = toolsData.map((t, idx) => (idx === toolIndex ? { ...t, arguments: finalArguments } : t));

                    const updatedEntry = updated[toolIndex];
                    // TODO: Check whether this event is being used.
                    emitter.emit('tool_call_completed', {
                        id: updatedEntry.callId || itemId,
                        name: updatedEntry.name,
                        arguments: finalArguments,
                    });

                    return updated;
                }
            }
            return toolsData;
        } catch (error) {
            console.warn('Error handling function call arguments done:', error);
            return toolsData;
        }
    }

    /**
     * Handle output item done events
     */
    private handleOutputItemDone(part: any, toolsData: ToolData[]): ToolData[] {
        try {
            const partAny = part as any;
            if (partAny.item && partAny.item.type === 'function_call' && partAny.item.status === 'completed') {
                const item = partAny.item;
                const callId = item.call_id;
                const itemId = item.id;

                const toolIndex = toolsData.findIndex((t) => t.id === itemId || t.id === callId);
                if (toolIndex !== -1 && item.arguments) {
                    const updated = toolsData.map((t, idx) =>
                        idx === toolIndex
                            ? {
                                  ...t,
                                  arguments: item.arguments,
                                  callId: t.callId || callId,
                              }
                            : t
                    );
                    return updated;
                }
            }
            return toolsData;
        } catch (error) {
            console.warn('Error handling output item done:', error);
            return toolsData;
        }
    }

    /**
     * Handle completion events and unknown event types
     */
    private handleCompletionEvent(eventType: string): string {
        if (eventType === EVENT_TYPES.RESPONSE_COMPLETED || eventType.includes('done')) {
            return 'stop';
        }
        return 'stop'; // Default finish reason
    }

    public async prepareRequestBody(params: TLLMPreparedParams): Promise<OpenAI.Responses.ResponseCreateParams> {
        let input = await this.prepareInputMessages(params);

        // Apply tool message transformation to input messages
        // There's a difference in the tools message data structures between `Chat Completions` and the `Response` interface.
        // Since we don't have enough context for the interface in `transformToolMessageBlocks`, we need to perform the transformation here so it's compatible with the `Responses` interface.
        input = this.applyToolMessageTransformation(input);

        const body: OpenAI.Responses.ResponseCreateParams = {
            model: params.model as string,
            input,
        };

        // Handle max tokens
        if (params?.maxTokens !== undefined) {
            body.max_output_tokens = params.maxTokens;
        }
        // #region GPT 5 specific fields

        const isGPT5ReasoningModels = params.modelEntryName?.includes('gpt-5') && params?.capabilities?.reasoning;
        if (isGPT5ReasoningModels && params?.verbosity) {
            body.text = { verbosity: params.verbosity };
        }

        // We need to validate the `reasoningEffort` parameter for OpenAI models, since models like `qwen/qwen3-32b` and `deepseek-r1-distill-llama-70b` (available via Groq) also support this parameter but use different values, such as `none` and `default`. These values are valid in our system but not specifically for OpenAI.
        if (isGPT5ReasoningModels && isValidOpenAIReasoningEffort(params.reasoningEffort)) {
            body.reasoning = { effort: params.reasoningEffort };
        }
        // #endregion GPT 5 specific fields

        let tools: OpenAI.Responses.Tool[] = [];

        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            tools = await this.prepareFunctionTools(params);
        }

        // Add null safety check before accessing toolsInfo
        if (params.toolsInfo?.openai?.webSearch?.enabled) {
            const searchTool = this.prepareWebSearchTool(params);
            tools.push(searchTool);
        }

        if (tools.length > 0) {
            body.tools = tools;

            if (params?.toolsConfig?.tool_choice) {
                const toolChoice = params.toolsConfig.tool_choice;

                // Validate tool choice before applying
                if (this.validateToolChoice(toolChoice, tools)) {
                    if (typeof toolChoice === 'string') {
                        // Handle string-based tool choices
                        body.tool_choice = toolChoice;
                    } else if (typeof toolChoice === 'object' && toolChoice !== null) {
                        // Handle object-based tool choices (specific function selection)
                        if ('type' in toolChoice && toolChoice.type === 'function' && 'function' in toolChoice && 'name' in toolChoice.function) {
                            // Transform Chat Completions specific function choice to Responses API format
                            body.tool_choice = {
                                type: 'function',
                                name: toolChoice.function.name,
                            };
                        } else {
                            // For other object formats, pass through with type assertion
                            body.tool_choice = toolChoice as any;
                        }
                    }
                } else {
                    body.tool_choice = 'auto';
                }
            } else {
                // Default to auto if tools are present but no choice is specified
                body.tool_choice = 'auto';
            }
        }

        return body;
    }

    /**
     * Transform OpenAI tool definitions to Responses.Tool format
     * Handles multiple tool definition formats and ensures compatibility
     */
    public transformToolsConfig(config: ToolConfig): OpenAI.Responses.Tool[] {
        if (!config?.toolDefinitions || !Array.isArray(config.toolDefinitions)) {
            return [];
        }

        return config.toolDefinitions
            .map((tool, index) => {
                // Validate basic tool structure
                if (!tool || typeof tool !== 'object') {
                    // Return a minimal tool structure for compatibility
                    return {
                        type: 'function' as const,
                        name: undefined,
                        description: undefined,
                        parameters: {
                            type: 'object',
                            properties: undefined,
                            required: undefined,
                        },
                        strict: false,
                    } as OpenAI.Responses.Tool;
                }

                // Handle tools that are already in ChatCompletionTool format (with nested function object)
                if ('function' in tool && tool.function && typeof tool.function === 'object' && tool.function !== null) {
                    const funcTool = tool.function as { name: string; description?: string; parameters?: any };

                    if (!funcTool.name || typeof funcTool.name !== 'string') {
                        return {
                            type: 'function' as const,
                            name: undefined,
                            description: tool.description || '',
                            parameters: { type: 'object', properties: undefined, required: undefined },
                            strict: false,
                        } as OpenAI.Responses.Tool;
                    }

                    return {
                        type: 'function' as const,
                        name: funcTool.name,
                        description: funcTool.description || tool.description || '',
                        parameters: funcTool.parameters || { type: 'object', properties: {}, required: [] },
                        strict: false,
                    } as OpenAI.Responses.Tool;
                }

                // Handle OpenAI tool definition format (direct parameters)
                if ('parameters' in tool) {
                    return {
                        type: 'function' as const,
                        name: tool.name,
                        description: tool.description || '',
                        parameters: tool.parameters || { type: 'object', properties: {}, required: [] },
                        strict: false,
                    } as OpenAI.Responses.Tool;
                }

                // Handle legacy format for backward compatibility
                const legacyTool = tool as any;
                return {
                    type: 'function' as const,
                    name: tool.name,
                    description: tool.description || legacyTool.desc,
                    parameters: {
                        type: 'object',
                        properties: legacyTool.properties,
                        required: legacyTool.requiredFields || legacyTool.required,
                    },
                    strict: false,
                } as OpenAI.Responses.Tool;
            })
            .filter(Boolean) as OpenAI.Responses.Tool[];
    }

    /**
     * Normalize tool arguments to string format for Responses API
     */
    private normalizeToolArguments(args: any): string {
        if (typeof args === 'string') {
            // If it's already a string, validate it's proper JSON
            try {
                JSON.parse(args);
                return args;
            } catch {
                // If not valid JSON, wrap it in quotes to make it valid
                return JSON.stringify(args);
            }
        }

        if (typeof args === 'object' && args !== null) {
            try {
                return JSON.stringify(args);
            } catch (error) {
                return '{}'; // Fallback to empty object
            }
        }

        if (args === undefined || args === null) {
            return '{}';
        }

        // For primitive types, convert to JSON
        return JSON.stringify(args);
    }

    /**
     * Validate if tool data is complete and valid for transformation
     */
    private isValidToolData(toolData: ToolData): boolean {
        return !!(toolData && toolData.id && toolData.name && (toolData.result !== undefined || toolData.error !== undefined));
    }

    async handleFileAttachments(files: BinaryInput[], agentId: string, messages: any[]): Promise<any[]> {
        if (files.length === 0) return messages;

        const uploadedFiles = await this.uploadFiles(files, agentId);
        const validImageFiles = this.getValidImageFiles(uploadedFiles);
        const validDocumentFiles = this.getValidDocumentFiles(uploadedFiles);

        // Process images and documents with Responses API specific formatting
        const imageData = await this.processImageData(validImageFiles, agentId);
        const documentData = await this.processDocumentData(validDocumentFiles, agentId);

        // Find the last user message and add files to it
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                // Ensure content is an array before pushing files
                if (typeof messages[i].content === 'string') {
                    messages[i].content = [{ type: 'input_text', text: messages[i].content }];
                } else if (!Array.isArray(messages[i].content)) {
                    messages[i].content = [];
                }
                messages[i].content.push(...imageData, ...documentData);
                break;
            }
        }

        // If no user message found, create one with files
        if (!messages.some((item) => item.role === 'user')) {
            messages.push({
                role: 'user',
                content: [...imageData, ...documentData],
            });
        }

        return messages;
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
        const promises = files.map((file) => {
            const binaryInput = BinaryInput.from(file);
            return binaryInput.upload(AccessCandidate.agent(agentId)).then(() => binaryInput);
        });

        return Promise.all(promises);
    }

    /**
     * Upload file to OpenAI Files API
     * Similar to GoogleAI's uploadFile implementation
     */
    private async uploadFile({
        file,
        agentId,
        purpose = 'user_data',
    }: {
        file: BinaryInput;
        agentId: string;
        purpose?: 'user_data' | 'assistants' | 'batch' | 'fine-tune' | 'vision';
    }): Promise<{ fileId: string; filename: string }> {
        try {
            if (!file?.mimetype) {
                throw new Error('Missing required parameters to upload file to OpenAI!');
            }

            const tempDir = os.tmpdir();
            const fileName = await file.getName();
            const tempFilePath = path.join(tempDir, `${uid()}_${fileName}`);

            // Write file to temporary location
            const bufferData = await file.readData(AccessCandidate.agent(agentId));
            await fs.promises.writeFile(tempFilePath, new Uint8Array(bufferData));

            const openai = await this.deps.getClient(this.context);

            // Upload file to OpenAI Files API
            const uploadResponse = await openai.files.create({
                file: fs.createReadStream(tempFilePath),
                purpose: purpose,
            });

            const fileId = uploadResponse.id;
            if (!fileId) {
                throw new Error('File upload did not return a file ID.');
            }

            // Clean up temporary file
            await fs.promises.unlink(tempFilePath).catch(() => {
                // Ignore cleanup errors
            });

            return {
                fileId,
                filename: fileName,
            };
        } catch (error: any) {
            throw new Error(`Error uploading file to OpenAI: ${error.message}`);
        }
    }

    /**
     * Process image files with Responses API specific formatting
     * Uses OpenAI Files API for uploading images
     */
    private async processImageData(files: BinaryInput[], agentId: string): Promise<any[]> {
        if (files.length === 0) return [];

        const imageData = [];
        for (const file of files) {
            await this.validateFileSize(file, MAX_IMAGE_SIZE, 'Image');

            try {
                // Upload file to OpenAI Files API with 'vision' purpose
                const { fileId } = await this.uploadFile({
                    file,
                    agentId,
                    purpose: 'vision',
                });

                imageData.push({
                    type: 'input_image',
                    file_id: fileId,
                });
            } catch (error) {
                // If Files API upload fails, fall back to base64 inline data
                console.warn('Failed to upload image via Files API, falling back to base64:', error);
                const bufferData = await file.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');
                const url = `data:${file.mimetype};base64,${base64Data}`;

                imageData.push({
                    type: 'input_image',
                    image_url: url,
                });
            }
        }

        return imageData;
    }

    /**
     * Process document files with Responses API specific formatting
     * Uses OpenAI Files API for uploading documents
     */
    private async processDocumentData(files: BinaryInput[], agentId: string): Promise<any[]> {
        if (files.length === 0) return [];

        const documentData = [];
        for (const file of files) {
            await this.validateFileSize(file, MAX_DOCUMENT_SIZE, 'Document');

            try {
                // Upload file to OpenAI Files API with 'user_data' purpose
                const { fileId, filename } = await this.uploadFile({
                    file,
                    agentId,
                    purpose: 'user_data',
                });

                documentData.push({
                    type: 'input_file',
                    file_id: fileId,
                });
            } catch (error) {
                // If Files API upload fails, fall back to base64 inline data
                console.warn('Failed to upload document via Files API, falling back to base64:', error);
                const bufferData = await file.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');
                const filename = await file.getName();

                documentData.push({
                    type: 'input_file',
                    filename,
                    file_data: `data:${file.mimetype};base64,${base64Data}`,
                });
            }
        }

        return documentData;
    }

    /**
     * Validate file size before processing
     */
    private async validateFileSize(file: BinaryInput, maxSize: number, fileType: string): Promise<void> {
        await file.ready();
        const fileInfo = await file.getJsonData(AccessCandidate.agent('temp'));
        if (fileInfo.size > maxSize) {
            throw new Error(`${fileType} file size (${fileInfo.size} bytes) exceeds maximum allowed size of ${maxSize} bytes`);
        }
    }

    getInterfaceName(): string {
        return 'responses';
    }

    validateParameters(params: TLLMParams): boolean {
        // Basic validation for Responses API parameters
        return !!params.model;
    }

    /**
     * Prepare input messages for Responses API
     */
    private async prepareInputMessages(params: TLLMParams): Promise<any[]> {
        const messages = params?.messages || [];
        const files: BinaryInput[] = params?.files || [];

        // Start with raw messages - transformation now happens in applyToolMessageTransformation
        let input = [...messages];

        // Handle files if present
        if (files.length > 0) {
            input = await this.handleFileAttachments(files, params.agentId, input);
        }

        return input;
    }

    /**
     * Prepare function tools for Responses API request
     * Transforms tools from various formats to Responses API format
     */
    private async prepareFunctionTools(params: TLLMParams): Promise<OpenAI.Responses.Tool[]> {
        const tools: OpenAI.Responses.Tool[] = [];

        // Validate and process function tools
        if (params?.toolsConfig?.tools && Array.isArray(params.toolsConfig.tools) && params.toolsConfig.tools.length > 0) {
            try {
                // Transform tools using the enhanced transformToolsConfig method
                const toolsConfig = this.transformToolsConfig({
                    type: 'function',
                    toolDefinitions: params.toolsConfig.tools as any[],
                    toolChoice: params.toolsConfig.tool_choice || 'auto',
                    modelInfo: (params.modelInfo as LLMModelInfo) || null,
                });

                // Validate transformed tools before adding them
                const validTools = toolsConfig.filter((tool, index) => {
                    if (tool.type !== 'function' || !(tool as any).name) {
                        return false;
                    }
                    return true;
                });

                tools.push(...validTools);
            } catch (error) {
                // Don't throw here to allow the request to continue without tools
                // This provides better resilience in production
            }
        }

        return tools;
    }

    /**
     * Get web search tool configuration for OpenAI Responses API
     * According to OpenAI documentation: https://platform.openai.com/docs/api-reference/responses/create
     */
    private prepareWebSearchTool(params: TLLMPreparedParams): OpenAI.Responses.WebSearchTool {
        const webSearch = params?.toolsInfo?.openai?.webSearch;
        const contextSize = webSearch?.contextSize;
        const searchCity = webSearch?.city;
        const searchCountry = webSearch?.country;
        const searchRegion = webSearch?.region;
        const searchTimezone = webSearch?.timezone;

        // Prepare location object - build incrementally if any location parameters exist
        const userLocation: TSearchLocation = {
            type: 'approximate', // Required, always be 'approximate' when we implement location
        };

        // Add location fields if they exist
        if (searchCity) userLocation.city = searchCity;
        if (searchCountry) userLocation.country = searchCountry;
        if (searchRegion) userLocation.region = searchRegion;
        if (searchTimezone) userLocation.timezone = searchTimezone;

        // Only include location in config if we have actual location data
        const hasLocationData = searchCity || searchCountry || searchRegion || searchTimezone;

        // Configure web search tool according to OpenAI Responses API specification
        const searchTool = {
            type: 'web_search_preview' as const, // Use literal type to ensure consistency
        };

        // Add optional configuration properties
        const webSearchConfig: any = {};

        if (contextSize) {
            webSearchConfig.search_context_size = contextSize;
        }

        if (hasLocationData) {
            webSearchConfig.user_location = userLocation;
        }

        return { ...searchTool, ...webSearchConfig };
    }

    /**
     * Transform messages for Responses API compatibility
     * Handles the differences between Chat Completions and Responses API message formats
     */
    private applyToolMessageTransformation(input: any[]): any[] {
        const transformedMessages: any[] = [];

        for (let i = 0; i < input.length; i++) {
            const message = input[i];

            try {
                if (message.role === 'assistant' && message.tool_calls && Array.isArray(message.tool_calls)) {
                    // Split assistant message with tool_calls into separate items (Responses API format)

                    // Add assistant content first if present
                    if (message.content !== undefined && message.content !== null) {
                        const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
                        if (contentStr.trim().length > 0) {
                            transformedMessages.push({
                                role: 'assistant',
                                content: contentStr,
                            });
                        }
                    }

                    // Transform each tool call to function_call format
                    message.tool_calls.forEach((toolCall: any, index: number) => {
                        if (!toolCall || !toolCall.function) {
                            return;
                        }

                        const functionArgs = toolCall.function.arguments;
                        const normalizedArgs =
                            functionArgs === undefined || functionArgs === null
                                ? undefined
                                : typeof functionArgs === 'object'
                                ? JSON.stringify(functionArgs)
                                : String(functionArgs);

                        transformedMessages.push({
                            type: 'function_call',
                            name: toolCall.function.name || '',
                            arguments: normalizedArgs,
                            call_id: toolCall.id || toolCall.call_id || `call_${Date.now()}_${index}`, // Ensure unique ID
                        });
                    });
                } else if (message.role === 'tool') {
                    // Transform tool message to function_call_output (Responses API format)
                    if (!message.tool_call_id) {
                        return;
                    }

                    const outputContent = message.content;
                    const normalizedOutput = typeof outputContent === 'string' ? outputContent : JSON.stringify(outputContent || 'null');

                    transformedMessages.push({
                        type: 'function_call_output',
                        call_id: message.tool_call_id,
                        output: normalizedOutput,
                    });
                } else {
                    // Pass through other message types without content modification
                    // The Responses API can handle various content formats
                    transformedMessages.push(message);
                }
            } catch (error) {
                // Add the original message to prevent data loss
                transformedMessages.push(message);
            }
        }

        // Validate the final message structure
        const validMessages = transformedMessages.filter((msg, index) => {
            if (!msg || typeof msg !== 'object') {
                return false;
            }
            return true;
        });

        return validMessages;
    }

    /**
     * Get search tool cost for a specific model and context size
     */
    private getSearchToolCost(modelName: string): number {
        if (!modelName) return 0;
        // Normalize: remove built-in prefix and compare case-insensitively
        const normalized = String(modelName)
            .toLowerCase()
            .replace(/^smythos\//, '');

        // Match by prefix with any configured family in SEARCH_TOOL_COSTS
        const match = Object.entries(SEARCH_TOOL_COSTS).find(([family]) => normalized.startsWith(family));
        return match ? (match[1] as number) : 0;
    }

    /**
     * Process function call responses and integrate them back into the conversation
     * This method helps maintain compatibility with the chat completion flow
     */
    public async processFunctionCallResults(toolsData: ToolData[]): Promise<ToolData[]> {
        const processedTools: ToolData[] = [];

        for (const tool of toolsData) {
            if (!this.isValidToolData(tool)) {
                continue;
            }

            try {
                const processedTool: ToolData = {
                    ...tool,
                    // Ensure arguments are properly formatted as JSON string
                    arguments: this.normalizeToolArguments(tool.arguments),
                    // Ensure function property is properly structured for compatibility
                    function: tool.function || {
                        name: tool.name,
                        arguments: this.normalizeToolArguments(tool.arguments),
                    },
                };

                processedTools.push(processedTool);
            } catch (error) {
                // Add error information to the tool result
                processedTools.push({
                    ...tool,
                    error: error instanceof Error ? error.message : 'Unknown processing error',
                    result: undefined,
                });
            }
        }

        return processedTools;
    }

    /**
     * Validate tool choice parameter for Responses API
     */
    private validateToolChoice(toolChoice: any, availableTools: OpenAI.Responses.Tool[]): boolean {
        if (!toolChoice) return true;

        if (typeof toolChoice === 'string') {
            const validStringChoices = ['auto', 'required', 'none'];
            return validStringChoices.includes(toolChoice);
        }

        if (typeof toolChoice === 'object' && toolChoice !== null) {
            // For specific function selection
            if (toolChoice.type === 'function' && toolChoice.function?.name) {
                // Check if the specified function exists in available tools
                return availableTools.some((tool) => tool.type === 'function' && tool.name === toolChoice.function.name);
            }
        }

        return false;
    }

    /**
     * Upsert a web search tool entry in toolsData and return its index
     */
    private upsertWebSearchToolImmutable(toolsData: ToolData[], id: string, args: string = ''): { toolsData: ToolData[]; index: number } {
        const existingIndex = toolsData.findIndex((t) => t.id === id);
        if (existingIndex === -1) {
            const index = toolsData.length;
            const newItem: ToolData = {
                index,
                id,
                type: TToolType.WebSearch,
                name: 'web_search',
                arguments: args,
                role: 'tool',
            } as ToolData;
            const updated: ToolData[] = [...toolsData, newItem];
            return { toolsData: updated, index };
        }

        if (args) {
            const updated: ToolData[] = toolsData.map((t, idx) => (idx === existingIndex ? { ...t, arguments: args } : t));
            return { toolsData: updated, index: existingIndex };
        }

        return { toolsData, index: existingIndex };
    }
}
