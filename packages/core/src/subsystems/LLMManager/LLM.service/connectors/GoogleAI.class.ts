import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMParams, ToolInfo, LLMInputMessage } from '@sre/types/LLM.types';

import { LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('OpenAIConnector');

const DEFAULT_MODEL = 'gemini-pro';

const MODELS_WITH_SYSTEM_MESSAGE = [
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
    'gemini-1.5-pro-001',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-flash-001',
];
const MODELS_WITH_JSON_RESPONSE = MODELS_WITH_SYSTEM_MESSAGE;

export type GetGenerativeModelArgs = {
    model: string;
    generationConfig: {
        stopSequences: string[];
        candidateCount: number;
        maxOutputTokens: number;
        temperature: number;
        topP: number;
        topK: number;
    };
    systemInstruction?: string;
};

export class GoogleAIConnector extends LLMConnector {
    public name = 'LLM:OpenAI';

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        try {
            const model = params?.model || DEFAULT_MODEL;

            const apiKey = params?.apiKey;
            delete params.apiKey; // Remove apiKey from params

            const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);

            let messages = params?.messages || [];

            let systemInstruction;
            let systemMessage: LLMInputMessage | {} = {};

            if (this.hasSystemMessage(params?.messages)) {
                const separateMessages = this.separateSystemMessages(messages);
                systemMessage = separateMessages.systemMessage;
                messages = separateMessages.otherMessages;
            }

            if (MODELS_WITH_SYSTEM_MESSAGE.includes(model)) {
                systemInstruction = (systemMessage as LLMInputMessage)?.content || '';
            } else {
                prompt = `${prompt}\n${(systemMessage as LLMInputMessage)?.content || ''}`;
            }

            if (params?.messages) {
                // Concatenate messages with prompt and remove messages from params as it's not supported
                prompt = params.messages.map((message) => message?.content || '').join('\n');

                delete params?.messages;
            }

            // Need to return JSON for LLM Prompt component
            const responseFormat = params?.responseFormat || 'json';
            if (responseFormat === 'json') {
                if (MODELS_WITH_JSON_RESPONSE.includes(model)) params.responseMimeType = 'application/json';
                else prompt += JSON_RESPONSE_INSTRUCTION;
            }

            if (!prompt) throw new Error('Prompt is required!');

            const args: GetGenerativeModelArgs = {
                model,
                generationConfig: params,
            };

            if (systemInstruction) args.systemInstruction = systemInstruction;

            const $model = genAI.getGenerativeModel({ model, systemInstruction, generationConfig: params });

            // Check token limit
            const { totalTokens: promptTokens } = await $model.countTokens(prompt);

            // * the function will throw an error if the token limit is exceeded
            this.validateTokensLimit({
                model,
                promptTokens,
                completionTokens: params?.maxOutputTokens,
                hasTeamAPIKey: !!apiKey,
            });

            const result = await $model.generateContent(prompt);
            const response = await result?.response;
            const content = response?.text();
            const finishReason = response.candidates[0].finishReason;

            return { content, finishReason };
        } catch (error) {
            console.error('Error in googleAI componentLLMRequest', error);

            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent) {
        //if (!params.model) params.model = 'gpt-4-vision-preview';

        // Open to take system message with params, if no system message found then force to get JSON response in default
        if (!params.messages || params.messages?.length === 0) params.messages = [];
        if (params.messages?.role !== 'system') {
            params.messages.unshift({
                role: 'system',
                content:
                    'All responses should be in valid json format. The returned json should not be formatted with any newlines, indentations. For example: {"<guess key from response>":"<response>"}',
            });
        }

        const sources: BinaryInput[] = params?.sources || [];
        delete params?.sources; // Remove images from params

        //const imageData = await prepareImageData(sources, 'OpenAI', agent);

        const agentId = agent instanceof Agent ? agent.id : agent;
        const imageData = [];
        for (let source of sources) {
            const bufferData = await source.readData(AccessCandidate.agent(agentId));
            const base64Data = bufferData.toString('base64');
            const url = `data:${source.mimetype};base64,${base64Data}`;
            imageData.push({
                type: 'image_url',
                image_url: {
                    url,
                },
            });
        }

        // Add user message
        const promptData = [{ type: 'text', text: prompt }, ...imageData];
        params.messages.push({ role: 'user', content: promptData });

        try {
            // Check if the team has their own API key, then use it
            const apiKey = params?.apiKey;
            delete params.apiKey; // Remove apiKey from params

            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
            });

            // Check token limit
            const promptTokens = await this.countVisionPromptTokens(promptData);

            // * the function will throw an error if the token limit is exceeded
            this.validateTokensLimit({
                model: params.model,
                promptTokens,
                completionTokens: params?.max_tokens,
                hasTeamAPIKey: !!apiKey,
            });

            const response: any = await openai.chat.completions.create({ ...params });

            const content = response?.choices?.[0]?.message.content;

            return { content, finishReason: response?.choices?.[0]?.finish_reason };
        } catch (error) {
            console.log('Error in visionLLMRequest: ', error);

            throw error;
        }
    }

    protected async toolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        try {
            // We provide
            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
            });

            // sanity check
            if (!Array.isArray(messages) || !messages?.length) {
                return { error: new Error('Invalid messages argument for chat completion.') };
            }

            let args: OpenAI.ChatCompletionCreateParamsNonStreaming = {
                model,
                messages,
            };

            if (tools && tools.length > 0) args.tools = tools;
            if (tool_choice) args.tool_choice = tool_choice;

            const result = await openai.chat.completions.create(args);
            const message = result?.choices?.[0]?.message;
            const finishReason = result?.choices?.[0]?.finish_reason;

            let toolsInfo: ToolInfo[] = [];
            let useTool = false;

            if (finishReason === 'tool_calls') {
                toolsInfo =
                    message?.tool_calls?.map((tool, index) => ({
                        index,
                        id: tool?.id,
                        type: tool?.type,
                        name: tool?.function?.name,
                        arguments: tool?.function?.arguments,
                        role: 'tool',
                    })) || [];

                useTool = true;
            }

            return {
                data: { useTool, message: message, content: message?.content ?? '', toolsInfo },
            };
        } catch (error: any) {
            console.log('Error on toolUseLLMRequest: ', error);
            return { error };
        }
    }

    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        try {
            // We provide
            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
            });

            // sanity check
            if (!Array.isArray(messages) || !messages?.length) {
                return { error: new Error('Invalid messages argument for chat completion.') };
            }

            let args: OpenAI.ChatCompletionCreateParamsStreaming = {
                model,
                messages,
                stream: true,
            };

            if (tools && tools.length > 0) args.tools = tools;
            if (tool_choice) args.tool_choice = tool_choice;

            const stream: any = await openai.chat.completions.create(args);

            // consumed stream will not be available for further use, so we need to clone it
            const [toolCallsStream, contentStream] = stream.tee();

            let useTool = false;
            let delta: Record<string, any> = {};
            let toolsInfo: any = [];
            let _stream;

            let message = {
                role: '',
                content: '',
                tool_calls: [],
            };

            for await (const part of toolCallsStream) {
                delta = part.choices[0].delta;

                message.role += delta?.role || '';
                message.content += delta?.content || '';

                //if it's not a tools call, stop processing the stream immediately in order to allow streaming the text content
                //FIXME: OpenAI API returns empty content as first message for content reply, and null content for tool reply,
                //       this doesn't seem to be a very accurate way but it's the only solution to detect tool calls early enough (without reading the whole stream)
                if (!delta?.tool_calls && delta?.content === '') {
                    _stream = contentStream;
                    break;
                }

                if (delta?.tool_calls) {
                    const toolCall = delta?.tool_calls?.[0];
                    const index = toolCall?.index;

                    toolsInfo[index] = {
                        index,
                        role: 'tool',
                        id: (toolsInfo?.[index]?.id || '') + (toolCall?.id || ''),
                        type: (toolsInfo?.[index]?.type || '') + (toolCall?.type || ''),
                        name: (toolsInfo?.[index]?.name || '') + (toolCall?.function?.name || ''),
                        arguments: (toolsInfo?.[index]?.arguments || '') + (toolCall?.function?.arguments || ''),
                    };
                }
            }

            if (toolsInfo?.length > 0) {
                useTool = true;
            }

            message.tool_calls = toolsInfo.map((tool) => {
                return {
                    id: tool.id,
                    type: tool.type,
                    function: {
                        name: tool.name,
                        arguments: tool.arguments,
                    },
                };
            });

            return {
                data: { useTool, message, stream: _stream, toolsInfo },
            };
        } catch (error: any) {
            console.log('Error on toolUseLLMRequest: ', error);
            return { error };
        }
    }

    public async extractVisionLLMParams(config: any) {
        const params: LLMParams = await super.extractVisionLLMParams(config);

        return params;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        let tools: OpenAI.ChatCompletionTool[] = [];

        if (type === 'function') {
            tools = toolDefinitions.map((tool) => {
                const { name, description, properties, requiredFields } = tool;

                return {
                    type: 'function',
                    function: {
                        name,
                        description,
                        parameters: {
                            type: 'object',
                            properties,
                            required: requiredFields,
                        },
                    },
                };
            });
        }

        return tools?.length > 0 ? { tools, tool_choice: toolChoice || 'auto' } : {};
    }
}
