import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { FunctionCallingMode } from '@google/generative-ai';

import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { type models } from '@sre/LLMManager/models';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';

export type LLMProvider = Extract<(typeof models)[keyof typeof models], { llm: string }>['llm'] | 'VertexAI' | 'Bedrock';
export type LLMModel = keyof typeof models;
export type LLMModelInfo = (typeof models)[LLMModel];

export type TLLMParams = {
    model: string;
    modelEntryName?: string; // for usage reporting
    credentials?:
        | Record<string, string> // for VertexAI
        | {
              apiKey?: string; // for standard models
              keyId?: string; // for Bedrock
              secretKey?: string; // for Bedrock
              sessionKey?: string; // for Bedrock
              isUserKey?: boolean;
          };

    messages?: any[]; // TODO [Forhad]: apply proper typing
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    responseFormat?: any; // TODO [Forhad]: apply proper typing
    modelInfo?: TCustomLLMModel;
    fileSources?: BinaryInput[];
    toolsConfig?: ToolsConfig;
    baseURL?: string;

    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'; // for image generation
    quality?: 'standard' | 'hd'; // for image generation
    n?: number; // for image generation
    style?: 'vivid' | 'natural'; // for image generation

    cache?: boolean;
    teamId?: string;
    thinking?: {
        // for Anthropic
        type: 'enabled' | 'disabled';
        budget_tokens: number;
    };
    maxThinkingTokens?: number;
};

export type TLLMConnectorParams = Omit<TLLMParams, 'model'> & {
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
    llm: string;
    isCustomLLM: boolean;
    modelId?: string;
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
    keyOptions?: {
        tokens: number;
        completionTokens: number;
    };
    credentials?: TLLMCredentials;
};

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
};

export interface AnthropicToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
    };
}
export type ToolDefinition = OpenAI.ChatCompletionTool | AnthropicToolDefinition;
export type ToolChoice = OpenAI.ChatCompletionToolChoiceOption | FunctionCallingMode;

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
        functionCall?: { name: string; args: string };
        functionResponse?: { name: string; response: { name: string; content: string } };
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
};

// ! Deprecated
export type TLLMInputMessage = {
    role: string;
    content?: string | { text: string }[];
    parts?: { text: string }[]; // * 'part' is for Google Vertex AI
};

export interface ILLMContextStore {
    save(messages: any[]): Promise<void>;
    load(count?: number): Promise<any[]>;
    getMessage(message_id: string): Promise<any[]>;
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
    Content = 'content',
    /** Thinking blocks/chunks */
    Thinking = 'thinking',
    /** End of the response */
    End = 'end',
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
}
