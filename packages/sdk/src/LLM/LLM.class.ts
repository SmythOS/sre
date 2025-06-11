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
    (modelParams: TLLMInstanceParams & { model: string | TLLMModel | TCustomLLMModel }): LLMInstance;
};

export type TLLMProviderInstances = {
    [key in TLLMProvider]: TLLMInstanceFactory;
};

const LLM: TLLMProviderInstances = {} as TLLMProviderInstances;
for (const provider of Object.keys(TLLMProvider)) {
    LLM[provider] = ((modelIdOrParams: string | TLLMInstanceParams, modelParams?: TLLMInstanceParams): LLMInstance => {
        if (typeof modelIdOrParams === 'string') {
            // First signature: (modelId: string, modelParams?: TLLMInstanceParams)
            return new LLMInstance(TLLMProvider[provider], { model: modelIdOrParams, ...modelParams });
        } else {
            // Second signature: (modelParams: TLLMInstanceParams)
            return new LLMInstance(TLLMProvider[provider], modelIdOrParams);
        }
    }) as TLLMInstanceFactory;
}

export { LLM };
