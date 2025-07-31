import { OpenAIApiInterface, OpenAIApiInterfaceFactory as IOpenAIApiInterfaceFactory } from './OpenAIApiInterface';
import { ResponsesApiInterface } from './ResponsesApiInterface';
import { ChatCompletionsApiInterface } from './ChatCompletionsApiInterface';
import { HandlerDependencies } from '../types';
import { ILLMRequestContext } from '@sre/types/LLM.types';

/**
 * Factory for creating OpenAI API interfaces
 * Implements the Factory pattern to provide clean abstraction for different OpenAI API types
 * Each API interface now handles its own streaming functionality
 *
 * Usage:
 * ```typescript
 * const factory = new OpenAIApiInterfaceFactory();
 * const apiInterface = factory.createInterface('responses', context, deps);
 * ```
 */
export class OpenAIApiInterfaceFactory implements IOpenAIApiInterfaceFactory {
    constructor() {
        // No dependencies needed at factory level anymore
    }

    /**
     * Create an API interface instance for the specified type
     * @param interfaceType - The type of interface to create ('responses', 'chat.completions')
     * @param context - The context for the interface
     * @param deps - The handler dependencies for the interface
     * @returns The appropriate OpenAI API interface instance
     */
    createInterface(interfaceType: string, context: ILLMRequestContext, deps: HandlerDependencies): OpenAIApiInterface {
        if (!context || !deps) {
            throw new Error('Context and dependencies (getClient(), reportUsage()) are required to create an interface');
        }

        switch (interfaceType) {
            case 'responses':
                return new ResponsesApiInterface(context, deps);
            case 'chat.completions':
                return new ChatCompletionsApiInterface(context, deps);
            default:
                throw new Error(
                    `Unsupported OpenAI API interface type: ${interfaceType}. Supported types: ${this.getSupportedInterfaces().join(', ')}`
                );
        }
    }

    /**
     * Get list of supported interface types
     * @returns Array of supported interface type strings
     */
    getSupportedInterfaces(): string[] {
        return ['responses', 'chat.completions'];
    }

    /**
     * Check if an interface type is supported
     * @param interfaceType - The interface type to check
     * @returns True if supported, false otherwise
     */
    isInterfaceSupported(interfaceType: string): boolean {
        return this.getSupportedInterfaces().includes(interfaceType);
    }

    /**
     * Get the default interface type
     * @returns The default interface type string
     */
    getDefaultInterfaceType(): string {
        return 'chat.completions';
    }

    /**
     * Get interface type based on model information
     * @param modelInfo - Model information object
     * @returns The appropriate interface type for the model
     */
    getInterfaceTypeFromModelInfo(modelInfo?: { interface?: string } | unknown): string {
        const info = modelInfo as { interface?: string } | undefined;
        return info?.interface || this.getDefaultInterfaceType();
    }
}
