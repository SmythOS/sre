import Anthropic from '@anthropic-ai/sdk';

import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMParams, ToolInfo, LLMInputMessage } from '@sre/types/LLM.types';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { LLMChatResponse, LLMConnector, LLMStream } from '../LLMConnector';
import EventEmitter from 'events';
import { Readable } from 'stream';

import { processWithConcurrencyLimit, isDataUrl, isUrl, getMimeTypeFromUrl, isRawBase64, parseBase64, isValidString } from '@sre/utils';

const console = Logger('AnthropicAIConnector');

type FileObject = {
    base64data: string;
    mimetype: string;
};

const VALID_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const PREFILL_TEXT_FOR_JSON_RESPONSE = '{';
const TOOL_USE_DEFAULT_MODEL = 'claude-3-opus-20240229';

export class AnthropicAIConnector extends LLMConnector {
    public name = 'LLM:AnthropicAI';

    private validImageMimeTypes = VALID_IMAGE_MIME_TYPES;

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        params.messages = params?.messages || [];

        // set prompt as user message if provided
        if (prompt) {
            params.messages.push({
                role: 'user',
                content: prompt,
            });
        }

        if (this.hasSystemMessage(params.messages)) {
            // in Claude we need to provide system message separately
            const { systemMessage, otherMessages } = this.separateSystemMessages(params.messages);

            params.messages = otherMessages;

            params.system = (systemMessage as LLMInputMessage)?.content;
        }

        const responseFormat = params?.responseFormat || 'json';
        if (responseFormat === 'json') {
            params.system += JSON_RESPONSE_INSTRUCTION;
            params.messages.push({ role: 'assistant', content: PREFILL_TEXT_FOR_JSON_RESPONSE });
        }

        // We do not provide default API key for claude, so user/team must provide their own API key
        const apiKey = params?.apiKey;

        if (!apiKey) throw new Error('Please provide an API key for Claude');

        const anthropic = new Anthropic({
            apiKey: apiKey,
        });

        // TODO: implement claude specific token counting to validate token limit
        // this.validateTokenLimit(params);

        try {
            const messageCreateParams = {
                model: params.model,
                messages: params.messages,
                max_tokens: params.max_tokens,
                temperature: params.temperature,
                stop_sequences: params.stop_sequences,
                top_p: params.top_p,
                top_k: params.top_k,
            };
            const response = await anthropic.messages.create(messageCreateParams);
            let content = (response.content?.[0] as Anthropic.TextBlock)?.text;
            const finishReason = response?.stop_reason;

            if (responseFormat === 'json') {
                content = `${PREFILL_TEXT_FOR_JSON_RESPONSE}${content}`;
            }

            return { content, finishReason };
        } catch (error) {
            console.error('Error in componentLLMRequest in Claude: ', error);

            if (error instanceof Anthropic.APIError) {
                throw error;
            } else {
                throw new Error('Internal server error! Please try again later or contact support.');
            }
        }
    }
    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent) {
        params.messages = params?.messages || [];

        const fileSources = params?.fileSources || [];

        const agentId = agent instanceof Agent ? agent.id : agent;
        const agentCandidate = AccessCandidate.agent(agentId);

        const validFiles = await this.processValidFiles(fileSources, agentCandidate);

        if (validFiles?.length === 0) {
            throw new Error(`Unsupported file(s). Please make sure your file is one of the following types: ${this.validImageMimeTypes.join(', ')}`);
        }

        const fileObjectsArray = validFiles.map((file) => ({
            type: 'image',
            source: {
                type: 'base64',
                data: file.base64data,
                media_type: file.mimetype,
            },
        }));

        const content = [{ type: 'text', text: prompt }, ...fileObjectsArray];
        params.messages.push({ role: 'user', content });

        const responseFormat = params?.responseFormat || 'json';
        if (responseFormat === 'json') {
            params.system = JSON_RESPONSE_INSTRUCTION;
            params.messages.push({ role: 'assistant', content: PREFILL_TEXT_FOR_JSON_RESPONSE });
        }

        // We do not provide default API key for claude, so user/team must provide their own API key
        const apiKey = params?.apiKey;

        if (!apiKey) throw new Error('Please provide an API key for Claude');

        const anthropic = new Anthropic({
            apiKey: apiKey,
        });

        // TODO (Forhad): implement claude specific token counting properly
        // this.validateTokenLimit(params);

        try {
            const messageCreateParams = {
                model: params.model,
                messages: params.messages,
                max_tokens: params.max_tokens,
                temperature: params.temperature,
                stop_sequences: params.stop_sequences,
                top_p: params.top_p,
                top_k: params.top_k,
            };

            const response = await anthropic.messages.create(messageCreateParams);
            let content = (response?.content?.[0] as Anthropic.TextBlock)?.text;
            const finishReason = response?.stop_reason;

            if (responseFormat === 'json') {
                content = `${PREFILL_TEXT_FOR_JSON_RESPONSE}${content}`;
            }

            return { content, finishReason };
        } catch (error) {
            console.error('Error in componentLLMRequest in Calude: ', error);

            if (error instanceof Anthropic.APIError) {
                throw error;
            } else {
                throw new Error('Internal server error! Please try again later or contact support.');
            }
        }
    }

    protected async toolRequest(
        acRequest: AccessRequest,
        { model = 'claude-3-opus-20240229', messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        try {
            const anthropic = new Anthropic({
                apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
            });

            const messageCreateParams: Anthropic.MessageCreateParamsNonStreaming = {
                model,
                messages: [],
                // TODO (Forhad): Need to set max dynamically based on the model
                max_tokens: 4096, // * max token is required
            };

            if (this.hasSystemMessage(messages)) {
                // in Claude we need to provide system message separately
                const { systemMessage, otherMessages } = this.separateSystemMessages(messages);

                messageCreateParams.system = ((systemMessage as LLMInputMessage)?.content as string) || '';

                messageCreateParams.messages = otherMessages as Anthropic.MessageParam[];
            }

            if (tools && tools.length > 0) messageCreateParams.tools = tools;

            // TODO (Forhad): implement claude specific token counting properly
            // this.validateTokenLimit(params);

            const result = await anthropic.messages.create(messageCreateParams);
            const message = {
                role: result?.role || 'user',
                content: result?.content || '',
            };
            const stopReason = result?.stop_reason;

            let toolsInfo: ToolInfo[] = [];
            let useTool = false;

            if ((stopReason as 'tool_use') === 'tool_use') {
                const toolInfo: any = result?.content?.find((c) => (c.type as 'tool_use') === 'tool_use');

                // Set the tool information for the message content when a tool is used. This is necessary because Claude returns an additional text block describing the process, which leads to incorrect responses.
                message.content = [toolInfo];

                toolsInfo = [
                    {
                        index: 0,
                        id: toolInfo?.id,
                        type: 'function', // We call API only when the tool type is 'function' in src/services/LLMHelper/ToolExecutor.class.ts`. Even though Claude returns the type as 'tool_use', it should be interpreted as 'function'.
                        name: toolInfo?.name,
                        arguments: toolInfo?.input,
                        role: 'user',
                    },
                ];

                useTool = true;
            }

            const content = (result?.content?.[0] as Anthropic.TextBlock)?.text;

            return {
                data: {
                    useTool,
                    message,
                    content,
                    toolsInfo,
                },
            };
        } catch (error) {
            throw error;
        }
    }

    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        try {
            const anthropic = new Anthropic({
                apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
            });

            const messageCreateParams: Anthropic.MessageCreateParamsNonStreaming = {
                model,
                messages: [],
                // TODO (Forhad): Need to set max dynamically based on the model
                max_tokens: 4096, // * max token is required
            };

            if (this.hasSystemMessage(messages)) {
                // in Claude we need to provide system message separately
                const { systemMessage, otherMessages } = this.separateSystemMessages(messages);

                messageCreateParams.system = ((systemMessage as LLMInputMessage)?.content as string) || '';

                messageCreateParams.messages = otherMessages as Anthropic.MessageParam[];
            }

            if (tools && tools.length > 0) messageCreateParams.tools = tools;

            // TODO (Forhad): implement claude specific token counting properly
            // this.validateTokenLimit(params);

            /* Send request to Claude */
            const result = await anthropic.messages.create(messageCreateParams);
            const stopReason = result?.stop_reason;

            const message = {
                role: result?.role || 'user',
                content: result?.content || '',
            };

            let toolsInfo: ToolInfo[] = [];
            let useTool = false;

            if ((stopReason as 'tool_use') === 'tool_use') {
                const toolInfo: any = result?.content?.find((c) => (c.type as 'tool_use') === 'tool_use');

                // Set the tool information for the message content when a tool is used. This is necessary because Claude returns an additional text block describing the process, which leads to incorrect responses.
                message.content = [toolInfo];

                toolsInfo = [
                    {
                        index: 0,
                        id: toolInfo?.id,
                        type: 'function', // We call API only when the tool type is 'function' in src/services/LLMHelper/ToolExecutor.class.ts`. Even though Claude returns the type as 'tool_use', it should be interpreted as 'function'.
                        name: toolInfo?.name,
                        arguments: toolInfo?.input,
                        role: 'user',
                    },
                ];

                useTool = true;
            }

            const content = (result?.content?.[0] as Anthropic.TextBlock)?.text;

            return {
                data: {
                    useTool,
                    message,
                    content,
                    toolsInfo,
                },
            };
        } catch (error: any) {
            console.log('Error in toolUseLLMRequest: ', error);
            return { error };
        }
    }

    protected async streamRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<EventEmitter> {
        try {
            throw new Error('Stream request is not implemented for AnthropicAI');
        } catch (error) {
            throw error;
        }
    }

    public async extractVisionLLMParams(config: any) {
        const params: LLMParams = await super.extractVisionLLMParams(config);

        return params;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        let tools: {
            name: string;
            description: string;
            input_schema: {
                type: 'object';
                properties: Record<string, unknown>;
                required: string[];
            };
        }[] = [];

        if (type === 'function') {
            tools = toolDefinitions.map((tool) => {
                const { name, description, properties, requiredFields } = tool;

                return {
                    name,
                    description,
                    input_schema: {
                        type: 'object',
                        properties,
                        required: requiredFields,
                    },
                };
            });
        }

        return tools?.length > 0 ? { tools } : {};
    }

    private async processValidFiles(fileSources: string[] | Record<string, any>[], candidate: IAccessCandidate): Promise<FileObject[]> {
        const fileProcessingTasks = fileSources.map((fileSource) => async (): Promise<FileObject> => {
            if (!fileSource) return null;

            if (typeof fileSource === 'object' && fileSource.url && fileSource.mimetype) {
                return await this.processObjectFileSource(fileSource, candidate);
            }

            if (isValidString(fileSource as string)) {
                return await this.processStringFileSource(fileSource as string, candidate);
            }

            return null;
        });

        const validFiles = await processWithConcurrencyLimit(fileProcessingTasks);

        return validFiles as FileObject[];
    }

    private async processObjectFileSource(fileSource: Record<string, string>, candidate: IAccessCandidate): Promise<FileObject | null> {
        const { mimetype } = fileSource;

        if (!this.validImageMimeTypes.includes(mimetype)) return null;

        const binaryInput = new BinaryInput(fileSource);
        const base64data = (await binaryInput.getBuffer()).toString('base64');

        return { base64data, mimetype };
    }

    private async processStringFileSource(fileSource: string, candidate: IAccessCandidate): Promise<FileObject | null> {
        let mimetype = '';

        if (isUrl(fileSource)) {
            mimetype = await getMimeTypeFromUrl(fileSource);
        } else if (isDataUrl(fileSource) || isRawBase64(fileSource)) {
            const parsedBase64 = await parseBase64(fileSource);
            mimetype = parsedBase64.mimetype;
        }

        if (!this.validImageMimeTypes.includes(mimetype)) return null;

        const binaryInput = new BinaryInput(fileSource);
        const base64data = (await binaryInput.getBuffer()).toString('base64');

        return { base64data, mimetype };
    }
}
