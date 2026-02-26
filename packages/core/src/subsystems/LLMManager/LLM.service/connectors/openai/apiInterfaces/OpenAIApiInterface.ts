import EventEmitter from 'events';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { TLLMParams, ILLMRequestContext, TLLMToolChoice, OpenAIToolDefinition, LegacyToolDefinition, LLMModelInfo } from '@sre/types/LLM.types';
import { HandlerDependencies } from '../types';

/**
 * OpenAI-specific tool configuration interface
 * Only deals with OpenAI tool definitions for clean separation
 */
export interface ToolConfig {
    type?: string;
    toolDefinitions: (OpenAIToolDefinition | LegacyToolDefinition)[];
    toolChoice?: TLLMToolChoice;
    modelInfo?: LLMModelInfo | null;
}

/**
 * Abstract base class for OpenAI API interfaces
 * Defines the contract that all OpenAI API implementations must follow
 *
 * This follows the Strategy pattern - each API interface (responses, chat.completions)
 * implements this interface with its own specific behavior
 */
export abstract class OpenAIApiInterface {
    protected context: ILLMRequestContext;

    constructor(context: ILLMRequestContext) {
        this.context = context;
    }

    /**
     * Create a regular (non-streaming) request for this API interface
     * @param body - The request body prepared for this API
     * @param context - The request context
     */
    abstract createRequest(body: any, context: ILLMRequestContext, abortSignal?: AbortSignal): Promise<any>;

    /**
     * Create a stream for this API interface
     * @param body - The request body prepared for this API
     * @param context - The request context
     */
    abstract createStream(body: any, context: ILLMRequestContext, abortSignal?: AbortSignal): Promise<any>;

    /**
     * Handle the stream response from this API interface
     * @param stream - The stream returned from createStream
     * @param context - The request context
     */
    abstract handleStream(stream: any, context: ILLMRequestContext): EventEmitter;

    /**
     * Prepare the request body for this API interface
     * @param params - The LLM parameters
     */
    abstract prepareRequestBody(params: TLLMParams): Promise<any>;

    /**
     * Transform tools configuration for this API interface
     * @param config - The tool configuration
     */
    abstract transformToolsConfig(config: ToolConfig): any[];

    /**
     * Handle file attachments for this API interface
     * @param files - The files to attach
     * @param agentId - The agent ID
     * @param messages - The messages to attach files to
     */
    abstract handleFileAttachments(files: BinaryInput[], agentId: string, messages: any[]): Promise<any[]>;

    /**
     * Get the API interface name
     */
    abstract getInterfaceName(): string;

    /**
     * Validate if this interface supports the given parameters
     * @param params - The parameters to validate
     */
    abstract validateParameters(params: TLLMParams): boolean;
}

/**
 * Factory interface for creating OpenAI API interfaces
 */
export interface OpenAIApiInterfaceFactory {
    /**
     * Create an API interface instance for the specified type
     * @param interfaceType - The type of interface to create
     * @param context - The context for the interface
     * @param deps - The handler dependencies for the interface
     */
    createInterface(interfaceType: string, context: ILLMRequestContext, deps: HandlerDependencies): OpenAIApiInterface;

    /**
     * Get supported interface types
     */
    getSupportedInterfaces(): string[];
}
