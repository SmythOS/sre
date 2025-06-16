# LLMInstanceParams

Parameters accepted when creating an `LLMInstance`.

```ts
export type TLLMInstanceParams = {
    model?: string;
    apiKey?: string;
    provider?: TLLMProvider;
    maxTokens?: number;
    maxThinkingTokens?: number;
    temperature?: number;
    stopSequences?: string[];
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
};
```
