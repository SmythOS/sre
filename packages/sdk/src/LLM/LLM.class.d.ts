import { TCustomLLMModel, TLLMModel, TLLMProvider } from '@smythos/sre';
import { LLMInstance, TLLMInstanceParams } from './LLMInstance.class';
/**
 * LLM instance factory functions for each LLM provider.
 *
 * **Supported calling patterns:**
 * - `LLM.provider(modelId, modelParams)` - specify model ID and optional parameters
 * - `LLM.provider(modelParams)` - specify model ID within modelParams object
 *
 * @example
 * ```typescript
 * // Pattern 1: Explicit model ID
 * const llm1 = LLM.openai('gpt-4', { temperature: 0.7 });
 * const response1 = await llm1.prompt("Hello!");
 *
 * // Pattern 2: Model ID in params
 * const llm2 = LLM.openai({ model: 'gpt-4', temperature: 0.7 });
 * const response2 = await llm2.prompt("Hello!");
 * ```
 */
export type TLLMInstanceFactory = {
    /**
     * Create an LLM instance with explicit model ID and optional parameters.
     *
     * @param modelId - The model identifier (e.g., `'gpt-4'`, `'claude-3-sonnet'`)
     * @param modelParams - Optional model parameters (temperature, maxTokens, etc.)
     * @returns LLM instance ready for use
     */
    (modelId: string, modelParams?: TLLMInstanceParams): LLMInstance;
    /**
     * Create an LLM instance with parameters object containing model ID.
     *
     * @param modelParams - Model parameters including the required `model` field
     * @returns LLM instance ready for use
     */
    (modelParams: TLLMInstanceParams & {
        model: string | TLLMModel | TCustomLLMModel;
    }): LLMInstance;
};
export type TLLMProviderInstances = {
    [key in TLLMProvider]: TLLMInstanceFactory;
};
/**
 * Create standalone LLM Provider instances, these can be used without agents.
 *
 * @namespace
 *
 * @example Different providers are available
 * ```typescript
 * const openai = LLM.OpenRouter('gpt-4o');
 * const anthropic = LLM.Anthropic('claude-3-5-sonnet-20240620');
 * const google = LLM.Google('gemini-2.0-flash-001');
 * ...
 * ```
 * see below for all available providers
 *
 * @example Prompting an LLM
 * ```typescript
 * const llm = LLM.OpenRouter('gpt-4o');
 * const response = await llm.prompt('Write a short story about a cat');
 * ```

 * @example Streaming response
 * ```typescript
 * const llm = LLM.OpenRouter('gpt-4o');
 * const streamEvents = await llm.prompt('Write a short story about a cat').stream();
 * streamEvents.on(TLLMEvent.Content, (event) => {
 *     console.log(event);
 * });
 * streamEvents.on(TLLMEvent.End, () => {
 *     console.log('Stream ended');
 * });
 * streamEvents.on(TLLMEvent.Error, (error) => {
 *     console.error(error);
 * });
 * ```
 *
 * @example Chat with an LLM
 * The difference between direct prompting and chatting is that chatting will persist the conversation.
 * ```typescript
 * const llm = LLM.OpenRouter('gpt-4o');
 * const chat = await llm.chat();
 *
 * //Prompt and get response
 * const response = await chat.prompt('Write a short story about a cat');
 *
 * //or use streaming
 * const streamEvents = await chat.prompt('Write a short story about a cat').stream();
 * streamEvents.on(TLLMEvent.Content, (event) => {
 *     console.log(event);
 * });
 * streamEvents.on(TLLMEvent.End, () => {
 *     console.log('Stream ended');
 * });
 * ```
 *
 * @example
 * By default, the SDK relies on a vault file to get the API keys, the vault is configured when you initialize your project using "sre" command line tool.
 * ```typescript
 * //Bellow are different ways to invoke an LLM without passing the API key
 *
 * //Using the model ID
 * const llm = LLM.OpenRouter('gpt-4o');
 * const response = await llm.prompt('Write a short story about a cat');
 *
 * //Using the model params
 * const llm = LLM.OpenRouter({ model: 'gpt-4o' });
 * const response = await llm.prompt('Write a short story about a cat');
 *
 * //Using the model params with custom settings
 * const llm = LLM.OpenRouter('gpt-4o', { temperature: 0.5, maxTokens: 50 });
 * const response = await llm.prompt('Write a short story about a cat');
 *
 * //Using the model params with custom settings
 * const llm = LLM.OpenRouter({ model: 'gpt-4o', temperature: 0.5, maxTokens: 50 });
 * const response = await llm.prompt('Write a short story about a cat');
 * ```
 *
 * @example
 * If you don't want to use the vault file, or want to use a specific API key, you can pass the API key explicitly.
 * ```typescript
 *
 * //Using the model params with an API key
 * const llm = LLM.OpenRouter({
 *         model: 'gpt-4o',
 *         apiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 *         temperature: 0.5,
 *         maxTokens: 50
 * });
 * const response = await llm.prompt('Write a short story about a cat');
 *
 *
 * //Using the model params with an API key
 * const llm = LLM.OpenRouter('gpt-4o', {
 *         apiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 *         temperature: 0.5,
 *         maxTokens: 50
 * });
 * const response = await llm.prompt('Write a short story about a cat');
 * ```
 */
declare const LLM: TLLMProviderInstances;
export { LLM };
