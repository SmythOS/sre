import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { FunctionCallingMode } from '@google/generative-ai';

import { BinaryInput } from '@sre/helpers/BinaryInput.helper';

export type LLMParams = {
    apiKey?: string; // for all
    temperature?: number; // for all
    max_tokens?: number; // for OpenAI, cohere, together.ai, AnthropicAI
    maxOutputTokens?: number; // for GoogleAI
    stop?: string[] | null; // for OpenAI, together.ai
    stop_sequences?: string[] | null; // for cohere, AnthropicAI
    top_p?: number; // for OpenAI, together.ai, AnthropicAI
    top_k?: number; // for together.ai, AnthropicAI
    topP?: number; // for GoogleAI
    topK?: number; // for GoogleAI
    p?: number; // Top P for cohere
    k?: number; // Top K for cohere
    frequency_penalty?: number; // for OpenAI, cohere
    repetition_penalty?: number; // Frequency Penalty for together.ai
    presence_penalty?: number; // for OpenAI, cohere
    sources?: BinaryInput[];
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
    llmName: string;
    modelId: string;
    tokens: number;
    completionTokens: number;
    components: string[];
    tags: string[];
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
export type LLMMessageBlock = {
    role: string;
    content: string | any;
    tool_calls?: ToolData[];
};

export type LLMToolResultMessageBlock = LLMMessageBlock & {
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
