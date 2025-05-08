import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { FunctionCallingMode } from '@google/generative-ai';

import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { type models } from '@sre/LLMManager/models';

export type LLMProvider = Extract<(typeof models)[keyof typeof models], { llm: string }>['llm'] | 'VertexAI' | 'Bedrock';
export type LLMModel = keyof typeof models;
export type LLMModelInfo = (typeof models)[LLMModel];

export type TLLMParams = {
    model: string;
    modelEntryName: string; // for usage reporting
    credentials:
        | Record<string, string> // for VertexAI
        | {
              apiKey?: string; // for standard models
              keyId?: string; // for Bedrock
              secretKey?: string; // for Bedrock
              sessionKey?: string; // for Bedrock
              isUserKey?: boolean; // for Bedrock
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
    modelInfo?: TVertexAIModel | TBedrockModel;
    fileSources?: BinaryInput[];
    toolsConfig?: {
        tools?: OpenAI.ChatCompletionTool[];
        tool_choice?: OpenAI.ChatCompletionToolChoiceOption;
    };
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

    // #region Search
    useWebSearch?: boolean;
    webSearchContextSize?: 'high' | 'medium' | 'low';
    webSearchCity?: string;
    webSearchCountry?: string;
    webSearchRegion?: string;
    webSearchTimezone?: string;
    // #endregion
};

export type TLLMParamsV2 = {
    model: string;
    modelEntryName: string;
    messages: any[];
    toolsConfig?: {
        tools?: OpenAI.Responses.Tool[];
        tool_choice?: OpenAI.Responses.ToolChoiceOptions | OpenAI.Responses.ToolChoiceTypes | OpenAI.Responses.ToolChoiceFunction;
    };
    baseURL?: string;
    stream?: boolean;
    responseFormat?: any;
    credentials?: {
        apiKey?: string;
        isUserKey?: boolean;
    };
    max_output_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    teamId?: string;

    // #region Search
    useWebSearch?: boolean;
    webSearchContextSize?: 'high' | 'medium' | 'low';
    webSearchCity?: string;
    webSearchCountry?: string;
    webSearchRegion?: string;
    webSearchTimezone?: string;
    // #endregion
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

export type TLLMModel = {
    llm: string;
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

type TCustomModel = {
    name: string;
    label: string;
    provider: 'Bedrock';
    components: string[];
    tags: string[];
    features: string[];
    tokens: number;
    completionTokens: number;
    settings: {
        foundationModel: string;
        customModel: string;
        region: string;
    };
};

export type TBedrockModel = TCustomModel & {
    settings: {
        keyIDName: string;
        secretKeyName: string;
        sessionKeyName: string;
    };
};

export type TVertexAIModel = TCustomModel & {
    settings: {
        projectId: string;
        credentialsName: string;
        jsonCredentialsName: string;
    };
};

// ! Deprecated
export type TLLMInputMessage = {
    role: string;
    content?: string | { text: string }[];
    parts?: { text: string }[]; // * 'part' is for Google Vertex AI
};

export enum TLLMProvider {
    OpenAI = 'OpenAI',
    Anthropic = 'Anthropic',
    GoogleAI = 'GoogleAI',
    Groq = 'Groq',
    TogetherAI = 'TogetherAI',
    Bedrock = 'Bedrock',
    VertexAI = 'VertexAI',
}

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
    [key: string]: TLLMModel;
};

export type SmythModelsProviderConfig = {
    models: (models: TLLMModelsList) => Promise<TLLMModelsList> | TLLMModelsList;
};
