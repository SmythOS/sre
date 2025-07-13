import { Agent } from '../../Agent/Agent.class';
export interface TGenAILLMSettings {
    name?: string;
    model: string;
    /** Prompt */
    prompt: string;
    /** Temperature */
    temperature?: number;
    /** Maximum Tokens */
    maxTokens?: number;
    /** Maximum Thinking Tokens */
    maxThinkingTokens?: number;
    /** Stop Sequences */
    stopSequences?: string;
    /** Top P */
    topP?: number;
    /** Top K */
    topK?: number;
    /** Frequency Penalty */
    frequencyPenalty?: number;
    /** Presence Penalty */
    presencePenalty?: number;
    /** Response Format */
    responseFormat?: 'json' | 'text';
    /** If true, the LLM response will be returned as is by the agent */
    passthrough?: boolean;
    /** If true, the component will use parent agent system prompt */
    useSystemPrompt?: boolean;
    /** If true, the component will use parent agent context window */
    useContextWindow?: boolean;
    /** The maximum number of messages to use from this component context window (if useContextWindow is true) */
    maxContextWindowLength?: number;
    /** Use Search */
    useWebSearch?: boolean;
    /** Search Content Size */
    webSearchContextSize?: 'high' | 'medium' | 'low';
    /** Search City */
    webSearchCity?: string;
    /** Search Country */
    webSearchCountry?: string;
    /** Search Region */
    webSearchRegion?: string;
    /** Search Timezone */
    webSearchTimezone?: string;
    /** Use Reasoning */
    useReasoning?: boolean;
}
export type TGenAILLMInputs = {
    /** An input that you can pass to the LLM */
    Input?: any;
    /** An attachment that you can pass to the LLM */
    Attachment?: ArrayBuffer | Uint8Array | string;
    [key: string]: any;
};
export type TGenAILLMOutputs = {
    Reply: any;
    [key: string]: any;
};
/**
 * Use this component to generate a responses from an LLM
 */
export declare function GenAILLM(settings?: TGenAILLMSettings, agent?: Agent): {
    /** Component outputs - access via .out.OutputName */
    out: TGenAILLMOutputs;
    /**
     * Create or Connect the component inputs
     * if the input does not exist, it will be created
     * @examples
     *    - component.in({ Input: source.out.data })
     *    - component.in({ Input: { type: 'string', source:source.out.data } })
     */
    in: (inputs: TGenAILLMInputs) => void;
};
