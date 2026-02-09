import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { FunctionCallingConfigMode } from '@google/genai';

import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { type models } from '@sre/LLMManager/models';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ConverseCommandInput } from '@aws-sdk/client-bedrock-runtime';

export type LLMProvider = Extract<(typeof models)[keyof typeof models], { llm: string }>['llm'] | 'VertexAI' | 'Bedrock';
export type LLMModel = keyof typeof models;
export type LLMModelInfo = (typeof models)[LLMModel];

// Google Service Account Credentials Interface
export interface VertexAICredentials {
    type: 'service_account';
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
    universe_domain?: string; // Optional, defaults to "googleapis.com"
}

// Basic LLM Credentials Interface
export interface BasicCredentials {
    apiKey: string;
    isUserKey: boolean;
}

// AWS Bedrock Credentials Interface
export interface BedrockCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}

// Union type for all credential types
export type ILLMConnectorCredentials = BasicCredentials | BedrockCredentials | VertexAICredentials;

export type TOpenAIResponseToolChoice = OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceTypes | OpenAI.Responses.ToolChoiceFunction;
export type TLLMToolChoice = OpenAI.ChatCompletionToolChoiceOption;

// Local alias to the upstream OpenAI reasoning effort union type
export type OpenAIReasoningEffort = NonNullable<OpenAI.Responses.ResponseCreateParams['reasoning']>['effort'];

export type TOpenAIToolsInfo = {
    webSearch: {
        enabled: boolean;
        contextSize: TSearchContextSize;
        city?: string;
        country?: string;
        region?: string;
        timezone?: string;
    };
};

export type TxAIToolsInfo = {
    search: {
        enabled: boolean;
        mode?: 'auto' | 'on' | 'off';
        returnCitations?: boolean;
        maxResults?: number;
        dataSources?: string[];
        country?: string;
        excludedWebsites?: string[];
        allowedWebsites?: string[];
        includedXHandles?: string[];
        excludedXHandles?: string[];
        postFavoriteCount?: number;
        postViewCount?: number;
        rssLinks?: string;
        safeSearch?: boolean;
        fromDate?: string;
        toDate?: string;
    };
};

// #region TLLMParams
export type TToolsInfo = {
    openai: TOpenAIToolsInfo;
    xai: TxAIToolsInfo;
};

export type TSearchContextSize = 'low' | 'medium' | 'high';

type TLLMToolConfig = {
    toolsConfig?: {
        tools?: OpenAI.ChatCompletionTool[] | OpenAI.Responses.Tool[] | OpenAI.Responses.WebSearchTool[];
        tool_choice?: TLLMToolChoice;
    };
};

type TLLMThinkingConfig = {
    thinking?: {
        // for Anthropic
        type: 'enabled' | 'disabled';
        budget_tokens: number;
    };
    maxThinkingTokens?: number;
};

type TLLMReasoningConfig = {
    useReasoning?: boolean;

    /**
     * Controls the level of effort the model will put into reasoning
     * For GPT-OSS models (20B, 120B): "low" | "medium" | "high"
     * For Qwen 3 32B: "none" | "default"
     */
    reasoningEffort?: 'none' | 'default' | OpenAIReasoningEffort;

    max_output_tokens?: number;
    verbosity?: OpenAI.Responses.ResponseCreateParams['text']['verbosity'];
    abortSignal?: AbortSignal;
};

type TLLMTextGenConfig = {
    model: TLLMModel | string;
    prompt?: string;
    messages?: any[]; // TODO [Forhad]: apply proper typing
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    responseFormat?: any; // TODO [Forhad]: apply proper typing
} & TLLMToolConfig &
    TLLMThinkingConfig &
    TLLMReasoningConfig;

// OpenAI specific web search parameters
type TLLMWebSearchConfig = {
    useWebSearch?: boolean;
    webSearchContextSize?: TSearchContextSize;
    webSearchCity?: string;
    webSearchCountry?: string;
    webSearchRegion?: string;
    webSearchTimezone?: string;
};

// xAI specific search parameters
type TLLMSearchConfig = {
    useSearch?: boolean;
    searchMode?: 'auto' | 'on' | 'off';
    returnCitations?: boolean;
    maxSearchResults?: number;
    searchDataSources?: string[];
    searchCountry?: string;
    excludedWebsites?: string[];
    allowedWebsites?: string[];
    includedXHandles?: string[];
    excludedXHandles?: string[];
    postFavoriteCount?: number;
    postViewCount?: number;
    rssLinks?: string;
    safeSearch?: boolean;
    fromDate?: string;
    toDate?: string;
} & TLLMWebSearchConfig;

type TLLMMiscConfig = {
    maxContextWindowLength?: number;
    useContextWindow?: boolean;
    passthrough?: boolean;
};

type TLLMRuntimeContext = {
    modelInfo?: TCustomLLMModel;
    files?: BinaryInput[];
    baseURL?: string;

    cache?: boolean;
    agentId?: string;
    teamId?: string;
};

type TLLMImageGenConfig = {
    size?: OpenAI.Images.ImageGenerateParams['size'] | OpenAI.Images.ImageEditParams['size']; // for image generation and image editing
    quality?: 'standard' | 'hd'; // for image generation
    n?: number; // for image generation
    style?: 'vivid' | 'natural'; // for image generation
};

export type TLLMParams = TLLMTextGenConfig & TLLMSearchConfig & TLLMImageGenConfig & TLLMMiscConfig & TLLMRuntimeContext;

// #endregion TLLMParams

export type TLLMPreparedParams = TLLMParams & {
    body: any;
    modelEntryName?: string; // for usage reporting
    credentials?: ILLMConnectorCredentials;
    isUserKey?: boolean;
    capabilities?: {
        search?: boolean;
        reasoning?: boolean;
        imageGeneration?: boolean;
        imageEditing?: boolean;
    };
    toolsInfo?: TToolsInfo;
    outputs?: any[];
};

export type TLLMConnectorParams = Omit<TLLMParams, 'model'> & {
    //the LLMConnector accepts a model object that we extract the model info from instead of relying on the internal models list
    model: string | TLLMModel | TCustomLLMModel;
};

export type TLLMModelEntry = {
    llm: string;
    tokens?: number;
    completionTokens?: number;
    enabled?: boolean;
    components?: string[];
    alias?: string;
    tags?: string[];
    keyOptions?: {
        tokens: number;
        completionTokens: number;
    };
};

export enum TLLMCredentials {
    Vault = 'vault',
    Internal = 'internal',
    BedrockVault = 'bedrock_vault',
    VertexAIVault = 'vertexai_vault',
    None = 'none',
}
export type TLLMModel = {
    llm?: string;
    isCustomLLM?: boolean;
    isUserCustomLLM?: boolean;
    modelId?: string;
    modelEntryName?: string;
    tokens?: number;
    completionTokens?: number;
    components?: string[];
    tags?: string[];
    label?: string;
    provider?: LLMProvider;
    features?: string[];
    enabled?: boolean;
    alias?: string;
    baseURL?: string;
    fallbackLLM?: string;
    keyOptions?: {
        tokens: number;
        completionTokens: number;
    };
    credentials?: TLLMCredentials | TLLMCredentials[];

    //models can come with predefined params
    //this can also be used to pass a preconfigured model object
    params?: TLLMParams;
    /**
     * Specifies the API interface type to use for this model
     * This determines which API endpoint and interface implementation to use
     */
    interface?: LLMInterface;

    /**
     * Indicates whether this model supports image editing functionality
     * Only applicable for image generation models
     */
    supportsEditing?: boolean;
};

// #region [ LLM Interface Types ] ================================================
/**
 * Enum for different LLM API interfaces
 * Each interface represents a different API endpoint or interaction pattern
 */
export enum LLMInterface {
    /** OpenAI-style chat completions API */
    ChatCompletions = 'chat.completions',
    /** OpenAI-style responses API */
    Responses = 'responses',
    /** Google AI generateContent API (for text and multimodal) */
    GenerateContent = 'generateContent',
    /** Google AI generateImages API (for traditional Imagen models) */
    GenerateImages = 'generateImages',
}

// #region [ Handle extendable LLM Providers ] ================================================
export const BuiltinLLMProviders = {
    Echo: 'Echo',
    OpenAI: 'OpenAI',
    DeepSeek: 'DeepSeek',
    GoogleAI: 'GoogleAI',
    Anthropic: 'Anthropic',
    Groq: 'Groq',
    TogetherAI: 'TogetherAI',
    Bedrock: 'Bedrock',
    VertexAI: 'VertexAI',
    xAI: 'xAI',
    Perplexity: 'Perplexity',
    Ollama: 'Ollama',
} as const;
// Base provider type
export type TBuiltinLLMProvider = (typeof BuiltinLLMProviders)[keyof typeof BuiltinLLMProviders];

// Extensible interface for custom providers
export interface ILLMProviders {}
// Combined provider type that can be extended
export type TLLMProvider = TBuiltinLLMProvider | keyof ILLMProviders;

// For backward compatibility, export the built-in providers as enum-like object
export const TLLMProvider = BuiltinLLMProviders;

// #endregion

export type TBedrockSettings = {
    keyIDName: string;
    secretKeyName: string;
    sessionKeyName: string;
};
export type TVertexAISettings = {
    projectId: string;
    credentialsName: string;
    jsonCredentialsName: string;
    apiEndpoint?: string;
};

export type TCustomLLMModel = TLLMModel & {
    name: string;
    settings: {
        foundationModel: string;
        customModel: string;
        region: string;
    } & (TBedrockSettings | TVertexAISettings);
};

//#region === LLM Tools ===========================
export type ToolData = {
    index: number;
    id: string;
    type: string;
    name: string;
    arguments: string | Record<string, any>;
    role: 'user' | 'tool' | 'assistant';
    result?: string; // result string from the used tool
    function?: any;
    error?: string; // for Bedrock
    callId?: string; // for OpenAI Responses API call ID mapping
    thoughtSignature?: string; // for Google AI - required to maintain reasoning context
};

/**
 * Base tool definition interface - only truly common properties
 * All provider-specific tool definitions extend from this
 */
export interface ToolDefinition {
    name: string;
    description: string;
}

/**
 * OpenAI-specific tool definition
 * Extends base with OpenAI's parameter format
 */
export interface OpenAIToolDefinition extends ToolDefinition {
    parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

/**
 * Anthropic-specific tool definition
 * Extends base with Anthropic's input_schema format
 */
export interface AnthropicToolDefinition extends ToolDefinition {
    input_schema: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
    };
}

/**
 * Legacy tool definition for backward compatibility
 * @deprecated Use provider-specific definitions instead
 */
export interface LegacyToolDefinition extends ToolDefinition {
    properties?: Record<string, unknown>;
    requiredFields?: string[];
}
export type ToolChoice = OpenAI.ChatCompletionToolChoiceOption | FunctionCallingConfigMode;

export interface ToolsConfig {
    tools?: ToolDefinition[];
    tool_choice?: ToolChoice;
}

//#endregion

export enum TLLMMessageRole {
    User = 'user',
    Assistant = 'assistant',
    System = 'system',
    Model = 'model',
    Tool = 'tool',
    Function = 'function',
}

export type TLLMMessageBlock = {
    role: TLLMMessageRole;
    content?:
        | string
        | { text: string }[]
        | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam>;
    parts?: {
        text?: string;
        functionCall?: { name: string; args: string | Record<string, any> };
        functionResponse?: { name: string; response: any };
    }[]; // for Google Vertex AI
    tool_calls?: ToolData[];
};

export type TLLMToolResultMessageBlock = TLLMMessageBlock & {
    tool_call_id?: string; // for tool result message block of OpenAI
    name?: string; // for tool result message block of OpenAI
};

export type GenerateImageConfig = {
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    model: string;
    style?: 'vivid' | 'natural';
    n?: number;
    response_format?: 'url' | 'b64_json';
    prompt?: string;
};

// ! Deprecated
export type TLLMInputMessage = {
    role: string;
    content?: string | { text: string }[];
    parts?: { text: string }[]; // * 'part' is for Google Vertex AI
};

export interface ILLMContextStore {
    id: string;
    save(messages: any[]): Promise<void>;
    load(count?: number): Promise<any[]>;
    getMessage(message_id: string): Promise<any[]>;
}

/**
 * Configuration options for Conversation helper
 */
export interface IConversationSettings {
    maxContextSize?: number;
    maxOutputTokens?: number;
    systemPrompt?: string;
    toolChoice?: string;
    store?: ILLMContextStore;
    experimentalCache?: boolean;
    toolsStrategy?: (toolsConfig: any) => any;
    agentId?: string;
    agentVersion?: string;
    baseUrl?: string;
    /**
     * Maximum number of tool calls allowed in a single conversation session.
     * Prevents infinite loops in tool calling scenarios.
     * @default 100
     */
    maxToolCalls?: number;
}

export enum APIKeySource {
    Smyth = 'smyth-managed',
    User = 'user-managed',
    Custom = 'custom',
}

export interface SmythLLMUsage {
    sourceId: string;
    input_tokens: number;
    input_tokens_cache_write: number;
    input_tokens_cache_read: number;
    output_tokens: number;
    keySource?: APIKeySource;
    agentId: string;
    teamId: string;
    tier?: string; // for Google AI
}

export interface SmythTaskUsage {
    sourceId: string;
    number: number;
    agentId: string;
    teamId: string;
}

export type TLLMModelsList = {
    [key: string]: TLLMModel | TCustomLLMModel;
};

export enum TLLMEvent {
    /** Generated response chunks */
    Data = 'data',
    /** Generated response chunks */
    Content = 'content',
    /** Thinking blocks/chunks */
    Thinking = 'thinking',
    /** End of the response */
    End = 'end',
    /** Request aborted */
    Abort = 'abort',
    /** Error */
    Error = 'error',
    /** Tool information : emitted by the LLM determines the next tool call */
    ToolInfo = 'toolInfo',
    /** Tool call : emitted before the tool call */
    ToolCall = 'toolCall',
    /** Tool result : emitted after the tool call */
    ToolResult = 'toolResult',
    /** Tokens usage information */
    Usage = 'usage',
    /** Interrupted : emitted when the response is interrupted before completion */
    Interrupted = 'interrupted',
    /** Fallback : emitted when the response is using a fallback model */
    Fallback = 'fallback',
    /** Requested : emitted when a request is sent to the LLM */
    Requested = 'requested',
}

export interface ILLMRequestContext {
    modelEntryName: string;
    agentId: string;
    teamId: string;
    isUserKey: boolean;
    hasFiles?: boolean;
    modelInfo: TCustomLLMModel | TLLMModel;
    credentials: ILLMConnectorCredentials;
    toolsInfo?: TToolsInfo;
}

// Generic interface that can be extended by specific providers
export interface ILLMRequestFuncParams<TBody = any> {
    acRequest: AccessRequest;
    body: TBody;
    context: ILLMRequestContext;
    abortSignal?: AbortSignal;
}

// For future providers, you can add similar types:
// export type TAnthropicRequestBody = Anthropic.MessageCreateParams | Anthropic.MessageStreamParams;
// export type IAnthropicRequestFuncParams = ILLMRequestFuncParams<TAnthropicRequestBody>;

/**
 * Standardized finish reasons for LLM responses across all providers.
 * 
 * This enum normalizes provider-specific finish reasons (e.g., 'end_turn' from Anthropic,
 * 'max_tokens' from Google AI) into a consistent set of values.
 */
export enum TLLMFinishReason {
    /** Response completed normally (reached natural stopping point or stop sequence) */
    Stop = 'stop',
    /** Response was truncated due to maximum token limit or context window */
    Length = 'length',
    /** Response was truncated due to context window limit */
    ContextWindowLength = 'context_window_length',
    /** Response was filtered by content moderation policies */
    ContentFilter = 'content_filter',
    /** Response ended because the model called a tool/function */
    ToolCalls = 'tool_calls',
    /** Request was aborted by user or system */
    Abort = 'abort',
    /** Request ended due to an error */
    Error = 'error',
    /** Unknown or unmapped finish reason from provider */
    Unknown = 'unknown',
}

export type TLLMChatResponse = {
    content: string;
    finishReason: TLLMFinishReason;
    thinkingContent?: string;
    usage?: any;
    useTool?: boolean;
    toolsData?: ToolData[];
    message?: OpenAI.ChatCompletionMessageParam | Anthropic.MessageParam;
};

export type TOpenAIRequestBody =
    | OpenAI.ChatCompletionCreateParamsNonStreaming
    | OpenAI.ChatCompletionCreateParamsStreaming
    | OpenAI.ChatCompletionCreateParams
    | OpenAI.Responses.ResponseCreateParams
    | OpenAI.Responses.ResponseCreateParamsNonStreaming
    | OpenAI.Responses.ResponseCreateParamsStreaming
    | OpenAI.Images.ImageGenerateParams
    | OpenAI.Images.ImageEditParams;

export type TAnthropicRequestBody = Anthropic.MessageCreateParamsNonStreaming;

export type TGoogleAIToolPrompt = {
    contents: any;
    systemInstruction?: any;
    tools?: any;
    toolConfig?: {
        functionCallingConfig?: {
            mode?: FunctionCallingConfigMode;
            allowedFunctionNames?: string[];
        };
    };
};

export interface TGoogleAIRequestBody {
    model: string;
    messages?: string | TLLMMessageBlock[] | TGoogleAIToolPrompt;
    contents?: any;
    systemInstruction?: any;
    generationConfig?: {
        maxOutputTokens?: number;
        temperature?: number;
        topP?: number;
        topK?: number;
        stopSequences?: string[];
        responseMimeType?: string;
        media_resolution?: 'low' | 'medium' | 'high';
    };
    tools?: any;
    toolConfig?: any;
}

export type TLLMRequestBody = TOpenAIRequestBody | TAnthropicRequestBody | TGoogleAIRequestBody | ConverseCommandInput;
