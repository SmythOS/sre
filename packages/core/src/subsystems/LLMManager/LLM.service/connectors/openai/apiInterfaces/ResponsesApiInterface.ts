import EventEmitter from 'events';
import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';

import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import {
    TLLMParams,
    TLLMPreparedParams,
    ILLMRequestContext,
    TLLMMessageBlock,
    ToolData,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    APIKeySource,
    TLLMEvent,
    OpenAIToolDefinition,
    LegacyToolDefinition,
    LLMModelInfo,
} from '@sre/types/LLM.types';
import { OpenAIApiInterface, ToolConfig } from './OpenAIApiInterface';
import { HandlerDependencies, TToolType } from '../types';
import { SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';
import { MODELS_WITHOUT_TEMPERATURE_SUPPORT, SEARCH_TOOL_COSTS } from './constants';

// File size limits in bytes
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB

type TSearchContextSize = 'low' | 'medium' | 'high';
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
                emitter.emit('error', error);
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
            // Handle different event types from the Responses API stream
            if ('type' in part) {
                const event = part.type;

                switch (event) {
                    case 'response.output_text.delta': {
                        if ('delta' in part && part.delta) {
                            // Emit content in delta format for compatibility
                            const deltaMsg = {
                                role: 'assistant',
                                content: part.delta,
                            };
                            emitter.emit('data', deltaMsg);
                            emitter.emit('content', part.delta, 'assistant');
                        }
                        break;
                    }
                    case 'response.function_call_arguments.delta': {
                        // Handle function call arguments streaming - use any to work around type issues
                        const partAny = part as any;
                        if (partAny?.delta && partAny?.call_id) {
                            // Find or create tool data entry
                            let toolIndex = toolsData.findIndex((t) => t.id === partAny.call_id);
                            if (toolIndex === -1) {
                                toolIndex = toolsData.length;
                                toolsData.push({
                                    index: toolIndex,
                                    id: partAny.call_id,
                                    type: 'function',
                                    name: partAny?.name || '',
                                    arguments: '',
                                    role: 'tool',
                                });
                            }
                            toolsData[toolIndex].arguments += partAny.delta;
                        }
                        break;
                    }
                    case 'response.web_search_call.started' as any:
                    case 'response.web_search_call.completed' as any: {
                        // Handle web search events - these are newer event types not yet in the official types
                        const partAny = part as any;
                        if (partAny?.id) {
                            // Find or create web search tool data entry
                            let toolIndex = toolsData.findIndex((t) => t.id === partAny.id);
                            if (toolIndex === -1) {
                                toolIndex = toolsData.length;
                                toolsData.push({
                                    index: toolIndex,
                                    id: partAny.id,
                                    type: TToolType.WebSearch,
                                    name: 'web_search',
                                    arguments: partAny?.query || '',
                                    role: 'tool',
                                });
                            } else {
                                // Update existing entry
                                if (partAny?.query) {
                                    toolsData[toolIndex].arguments = partAny.query;
                                }
                            }
                        }
                        break;
                    }
                    default: {
                        // Handle other event types including response completion
                        if (event.includes('done')) {
                            finishReason = 'stop';
                        }
                        break;
                    }
                }
            }

            // Handle usage statistics from response object
            if ('response' in part && (part as any).response?.usage) {
                usageData.push((part as any).response.usage);
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
            id: tool.id,
            type: tool.type,
            role: tool.role,
        }));
    }

    /**
     * Report usage statistics
     */
    private reportUsageStatistics(usage_data: any[], context: ILLMRequestContext): any[] {
        let reportedUsage: any[] = [];

        // Report normal usage
        usage_data.forEach((usage) => {
            const reported = this.deps.reportUsage(usage, this.buildUsageContext(context));
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
            emitter.emit('interrupted', finishReason);
        }

        // Emit end event with setImmediate to ensure proper event ordering
        setImmediate(() => {
            emitter.emit('end', toolsData, reportedUsage, finishReason);
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
     *
     * Note: This only calculates the per-call cost for web search.
     * Search content tokens are included in the main usage report as input_tokens.
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

        // o3-pro does not support temperature
        if (params?.temperature !== undefined && !MODELS_WITHOUT_TEMPERATURE_SUPPORT.includes(params.modelEntryName)) {
            body.temperature = params.temperature;
        }

        if (params?.topP !== undefined) {
            body.top_p = params.topP;
        }

        // Handle verbosity
        if (params?.verbosity !== undefined && params?.verbosity !== null) {
            (body as any).verbosity = params.verbosity;
        }

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
                body.tool_choice = params?.toolsConfig?.tool_choice as any;
            }
        }

        return body;
    }

    /**
     * Type guard to check if a tool is an OpenAI tool definition
     */
    private isOpenAIToolDefinition(tool: OpenAIToolDefinition | LegacyToolDefinition): tool is OpenAIToolDefinition {
        return 'parameters' in tool;
    }

    /**
     * Transform OpenAI tool definitions to Responses.Tool format
     */
    public transformToolsConfig(config: ToolConfig): OpenAI.Responses.Tool[] {
        return config.toolDefinitions.map((tool) => {
            // Handle OpenAI tool definition format
            if (this.isOpenAIToolDefinition(tool)) {
                return {
                    type: 'function' as const,
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                    strict: false, // Add required property for OpenAI Responses API
                } as OpenAI.Responses.Tool;
            }

            // Handle legacy format for backward compatibility
            return {
                type: 'function' as const,
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: 'object',
                    properties: tool.properties || {},
                    required: tool.requiredFields || [],
                },
                strict: false, // Add required property for OpenAI Responses API
            } as OpenAI.Responses.Tool;
        });
    }

    /**
     * Transform assistant message block with tool calls for Responses API
     */
    private transformAssistantMessageBlock(messageBlock: TLLMMessageBlock): TLLMToolResultMessageBlock {
        const transformedMessageBlock: TLLMToolResultMessageBlock = {
            ...messageBlock,
            content: this.normalizeContent(messageBlock.content),
        };

        // Transform tool calls if present
        if (transformedMessageBlock.tool_calls) {
            transformedMessageBlock.tool_calls = this.transformToolCalls(transformedMessageBlock.tool_calls);
        }

        return transformedMessageBlock;
    }

    /**
     * Transform individual tool calls to ensure proper formatting
     */
    private transformToolCalls(toolCalls: ToolData[]): ToolData[] {
        return toolCalls.map((toolCall) => ({
            ...toolCall,
            // Ensure function arguments are properly stringified for Responses API
            function: {
                ...toolCall.function,
                arguments: this.normalizeToolArguments(toolCall.function?.arguments || toolCall.arguments),
            },
            // Ensure arguments at root level are also normalized (for backward compatibility)
            arguments: this.normalizeToolArguments(toolCall.arguments),
        }));
    }

    /**
     * Transform tool results with comprehensive error handling and type support
     */
    private transformToolResults(toolsData: ToolData[]): TLLMToolResultMessageBlock[] {
        return toolsData.filter((toolData) => this.isValidToolData(toolData)).map((toolData) => this.createToolResultMessage(toolData));
    }

    /**
     * Create a tool result message for the Responses API format
     */
    private createToolResultMessage(toolData: ToolData): TLLMToolResultMessageBlock {
        const baseMessage: TLLMToolResultMessageBlock = {
            tool_call_id: toolData.id,
            role: TLLMMessageRole.Tool,
            name: toolData.name,
            content: this.formatToolResult(toolData),
        };

        // Handle tool errors specifically
        if (toolData.error) {
            baseMessage.content = this.formatToolError(toolData);
        }

        return baseMessage;
    }

    /**
     * Format tool result content based on type and handle special cases
     */
    private formatToolResult(toolData: ToolData): string {
        const result = toolData.result;

        // Handle different result types
        if (typeof result === 'string') {
            return result;
        }

        if (typeof result === 'object' && result !== null) {
            try {
                return JSON.stringify(result, null, 2);
            } catch (error) {
                return `[Error serializing result: ${error instanceof Error ? error.message : 'Unknown error'}]`;
            }
        }

        // Handle special tool types
        if (this.isWebSearchTool(toolData)) {
            return this.formatWebSearchResult(result);
        }

        // Handle undefined/null results
        if (result === undefined || result === null) {
            return `[Tool ${toolData.name} completed with no result]`;
        }

        // Fallback to string conversion
        return String(result);
    }

    /**
     * Format tool error messages with context
     */
    private formatToolError(toolData: ToolData): string {
        const errorMessage = toolData.error || 'Unknown error occurred';
        return `[Tool Error in ${toolData.name}]: ${errorMessage}`;
    }

    /**
     * Normalize content to string format for Responses API
     */
    private normalizeContent(content: any): string {
        if (typeof content === 'string') {
            return content;
        }

        if (Array.isArray(content)) {
            // Handle array content by extracting text parts
            return content
                .map((item) => {
                    if (typeof item === 'string') return item;
                    if (item?.text) return item.text;
                    if (item?.type === 'text' && item?.text) return item.text;
                    return JSON.stringify(item);
                })
                .join(' ');
        }

        if (typeof content === 'object' && content !== null) {
            try {
                return JSON.stringify(content);
            } catch (error) {
                return '[Error serializing content]';
            }
        }

        return String(content || '');
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

    /**
     * Check if the tool is a web search tool based on type or name
     */
    private isWebSearchTool(toolData: ToolData): boolean {
        return (
            toolData.type === TToolType.WebSearch || toolData.name?.toLowerCase().includes('search') || toolData.name?.toLowerCase().includes('web')
        );
    }

    /**
     * Format web search results with better structure
     */
    private formatWebSearchResult(result: any): string {
        if (!result) return '[Web search completed with no results]';

        // If result is already a well-formatted string, use it
        if (typeof result === 'string') {
            return result;
        }

        // If result is an object with search-specific structure, format it nicely
        if (typeof result === 'object') {
            try {
                // Check for common web search result structures
                if (result.results || result.items || result.data) {
                    return JSON.stringify(result, null, 2);
                }
                return JSON.stringify(result, null, 2);
            } catch (error) {
                return '[Error formatting web search results]';
            }
        }

        return String(result);
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
     * Process image files with Responses API specific formatting
     */
    private async processImageData(files: BinaryInput[], agentId: string): Promise<any[]> {
        if (files.length === 0) return [];

        const imageData = [];
        for (const file of files) {
            await this.validateFileSize(file, MAX_IMAGE_SIZE, 'Image');

            const bufferData = await file.readData(AccessCandidate.agent(agentId));
            const base64Data = bufferData.toString('base64');
            const url = `data:${file.mimetype};base64,${base64Data}`;

            imageData.push({
                type: 'input_image',
                image_url: url,
            });
        }

        return imageData;
    }

    /**
     * Process document files with Responses API specific formatting
     */
    private async processDocumentData(files: BinaryInput[], agentId: string): Promise<any[]> {
        if (files.length === 0) return [];

        const documentData = [];
        for (const file of files) {
            await this.validateFileSize(file, MAX_DOCUMENT_SIZE, 'Document');

            const bufferData = await file.readData(AccessCandidate.agent(agentId));
            const base64Data = bufferData.toString('base64');
            const fileData = `data:${file.mimetype};base64,${base64Data}`;
            const filename = await file.getName();

            documentData.push({
                type: 'input_file',
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
     * Prepare tools for request
     */
    private async prepareFunctionTools(params: TLLMParams): Promise<OpenAI.Responses.Tool[]> {
        const tools: OpenAI.Responses.Tool[] = [];

        // Add regular function tools
        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            // Now we can pass the tools directly to transformToolsConfig
            // which handles type detection and conversion properly
            const toolsConfig = this.transformToolsConfig({
                type: 'function',
                toolDefinitions: params.toolsConfig.tools as (OpenAIToolDefinition | LegacyToolDefinition)[],
                toolChoice: 'auto',
                modelInfo: (params.modelInfo as LLMModelInfo) || null,
            });
            tools.push(...toolsConfig);
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
        const searchTool: OpenAI.Responses.WebSearchTool = {
            type: 'web_search_preview' as any, // Use correct type as per OpenAI docs
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

    private applyToolMessageTransformation(input: any[]): any[] {
        const transformedMessages: any[] = [];

        input.forEach((message) => {
            if (message.role === 'assistant' && message.tool_calls) {
                // Split assistant message with tool_calls into separate items (Responses API format)
                if (message.content) {
                    transformedMessages.push({
                        role: 'assistant',
                        content: typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
                    });
                }

                message.tool_calls.forEach((toolCall) => {
                    transformedMessages.push({
                        type: 'function_call',
                        name: toolCall.function.name,
                        arguments:
                            typeof toolCall.function.arguments === 'object'
                                ? JSON.stringify(toolCall.function.arguments)
                                : toolCall.function.arguments,
                        call_id: toolCall.id,
                    });
                });
            } else if (message.role === 'tool') {
                // Transform tool message to function_call_output (Responses API format)
                transformedMessages.push({
                    type: 'function_call_output',
                    call_id: message.tool_call_id,
                    output: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
                });
            } else {
                transformedMessages.push(message);
            }
        });

        return transformedMessages;
    }

    /**
     * Get search tool cost for a specific model
     * @returns Cost per call (not per 1000 calls)
     */
    private getSearchToolCost(modelName: string): number {
        const normalizedModelName = modelName?.replace('smythos/', '');

        // Check gpt-4 models (gpt-4o, gpt-4.1 and their mini variants)
        if (SEARCH_TOOL_COSTS.gpt4Models[normalizedModelName]) {
            return SEARCH_TOOL_COSTS.gpt4Models[normalizedModelName];
        }

        // Check gpt-5 models
        if (SEARCH_TOOL_COSTS.gpt5Models[normalizedModelName]) {
            return SEARCH_TOOL_COSTS.gpt5Models[normalizedModelName];
        }

        return 0;
    }
}
