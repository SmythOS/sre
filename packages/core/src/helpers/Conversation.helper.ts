import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { LLMContext } from '@sre/MemoryManager/LLMContext';
import { TAgentProcessParams } from '@sre/types/Agent.types';
import { IConversationSettings, ILLMContextStore, TLLMEvent, TLLMModel, ToolData } from '@sre/types/LLM.types';
import { isUrl } from '@sre/utils/data.utils';
import { processWithConcurrencyLimit, uid } from '@sre/utils/general.utils';
import axios, { AxiosRequestConfig } from 'axios';
import EventEmitter from 'events';
import { JSONContent } from './JsonContent.helper';
import { OpenAPIParser } from './OpenApiParser.helper';
import { Match, TemplateString } from './TemplateString.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { EventSource, FetchLike } from 'eventsource';
import { hookAsyncWithContext } from '@sre/Core/HookService';
import { randomUUID } from 'crypto';
import * as acorn from 'acorn';

const console = Logger('ConversationHelper');
type FunctionDeclaration = {
    name: string;
    description: string;
    properties: Record<string, any>;
    requiredFields: string[];
};
type ToolParams = {
    type: string;
    endpoint: string;
    args: Record<string, any>;
    method: string;
    baseUrl: string;
    headers?: Record<string, string>;
    agentCallback?: (data: any) => void;
};

//TODO: handle authentication
export class Conversation extends EventEmitter {
    private _agentId: string = '';
    public get agentId() {
        return this._agentId;
    }
    private _systemPrompt;
    private userDefinedSystemPrompt: string = '';
    public toolChoice: string = 'auto';
    public get systemPrompt() {
        return this._systemPrompt;
    }
    public set systemPrompt(systemPrompt) {
        this._systemPrompt = systemPrompt;
        if (this._context) this._context.systemPrompt = systemPrompt;
    }
    public assistantName;

    private _reqMethods;
    private _toolsConfig;
    private _toolStatusMap: Record<string, string> = {};
    private _endpoints;
    private _baseUrl;

    private _status = '';
    private _currentWaitPromise;

    private _llmContextStore: ILLMContextStore;
    private _context: LLMContext;

    private _maxContextSize = 1024 * 128;
    private _maxOutputTokens = 1024 * 8;
    private _teamId: string = undefined;
    private _agentVersion: string = undefined;
    public agentData: any;

    private _id: string = '';
    public get id() {
        return this._id;
    }

    // Tool call limit tracking
    private _toolCallCount: number = 0;
    private _maxToolCallsPerSession: number = Infinity; // Default limit
    private _disableToolsForNextCall: boolean = false;

    public get context() {
        return this._context;
    }

    public get storeId() {
        return this._llmContextStore?.id;
    }

    /**
     * Headers to be added to all tool call requests
     */
    public headers: Record<string, string> = {};

    private _lastError;
    private _spec;
    private _customToolsDeclarations: FunctionDeclaration[] = [];
    private _customToolsHandlers: Record<string, (args: Record<string, any>) => Promise<any>> = {};
    public stop = false;
    public set spec(specSource) {
        this.ready.then(() => {
            this._status = '';
            this._currentWaitPromise = undefined;
            this.loadSpecFromSource(specSource).then(async (spec) => {
                if (!spec) {
                    this._status = 'error';
                    this.emit('error', 'Invalid OpenAPI specification data format');
                    throw new Error('Invalid OpenAPI specification data format');
                }
                this._spec = spec;

                // teamId is required to load custom LLMs, we must assign it before updateModel()
                await this.assignTeamIdFromAgentId(this._agentId);

                await this.updateModel(this._model);
                this._status = 'ready';
            });
        });
    }

    public set model(model: string | TLLMModel) {
        this.ready.then(async () => {
            this._status = '';
            await this.updateModel(model);
            this._status = 'ready';
        });
    }
    public get model() {
        return this._model;
    }

    private _llmInference: LLMInference;
    public get llmInference() {
        return this._llmInference;
    }

    constructor(private _model: string | TLLMModel, private _specSource?: string | Record<string, any>, private _settings?: IConversationSettings) {
        //TODO: handle loading previous session (messages)
        super();

        this._id = 'conv_' + randomUUID();
        //this event listener avoids unhandled errors that can cause crashes
        this.on('error', (error) => {
            this._lastError = error;
            console.warn('Conversation Error: ', error?.message);
        });
        this._maxContextSize =
            _settings?.maxContextSize || (this._model as TLLMModel).tokens || (this._model as TLLMModel).keyOptions?.tokens || this._maxContextSize;
        this._maxOutputTokens =
            _settings?.maxOutputTokens ||
            (this._model as TLLMModel).completionTokens ||
            (this._model as TLLMModel).keyOptions?.completionTokens ||
            this._maxOutputTokens;

        if (_settings?.systemPrompt) {
            this.userDefinedSystemPrompt = _settings.systemPrompt;
        }
        if (_settings?.toolChoice) {
            this.toolChoice = _settings.toolChoice;
        }

        if (_settings?.store) {
            this._llmContextStore = _settings.store;
        }

        if (_settings?.maxToolCalls !== undefined) {
            this._maxToolCallsPerSession = _settings.maxToolCalls;
        }

        this._baseUrl = _settings?.baseUrl;

        this._agentVersion = _settings?.agentVersion;

        (async () => {
            if (_specSource) {
                this.loadSpecFromSource(_specSource)
                    .then(async (spec) => {
                        if (!spec) {
                            this._status = 'error';
                            this.emit('error', 'Unable to parse OpenAPI specifications');
                            throw new Error('Invalid OpenAPI specification data format');
                        }
                        this._spec = spec;

                        if (!this._agentId && _settings?.agentId) this._agentId = _settings.agentId;
                        if (!this._agentId) this._agentId = 'FAKE-AGENT-ID'; //We use a fake agent ID to avoid ACL check errors

                        // teamId is required to load custom LLMs, we must assign it before updateModel()
                        await this.assignTeamIdFromAgentId(this._agentId);

                        await this.updateModel(this._model);

                        this._status = 'ready';
                    })
                    .catch((error) => {
                        this._status = 'error';
                        this.emit('error', error);
                    });
            } else {
                await this.updateModel(this._model);
                this._status = 'ready';
            }
        })();
    }

    public get ready() {
        if (this._currentWaitPromise) return this._currentWaitPromise;
        this._currentWaitPromise = new Promise((resolve, reject) => {
            if (this._status) {
                return resolve(this._status);
            }

            const maxWaitTime = 30000;
            let waitTime = 0;
            const interval = 100;

            const wait = setInterval(() => {
                if (this._status) {
                    clearInterval(wait);
                    return resolve(this._status);
                } else {
                    waitTime += interval;
                    if (waitTime >= maxWaitTime) {
                        clearInterval(wait);
                        return reject('Timeout: Failed to prepare data');
                    }
                }
            }, interval);
        });

        return this._currentWaitPromise;
    }

    //TODO : handle attachments
    @hookAsyncWithContext('Conversation.prompt', async (instance: Conversation) => {
        await instance.ready;

        return {
            teamId: instance._teamId,
            agentId: instance._agentId,
            model: instance._model,
            agentData: instance.agentData,
        };
    })
    public async prompt(message?: string | any, toolHeaders = {}, concurrentToolCalls = 4, abortSignal?: AbortSignal) {
        // if an error occured while streaming, we need to propagate it so for this, we register a one time error listener
        let error = null;
        const errListener = (err) => (error = err);
        this.once('error', errListener);
        const result = await this.streamPrompt(message, toolHeaders, concurrentToolCalls, abortSignal);

        // if an error event occured, throw the error
        if (error) {
            throw error;
        }

        this.removeListener('error', errListener);
        return result;
    }

    //TODO : handle attachments
    @hookAsyncWithContext('Conversation.streamPrompt', async (instance: Conversation) => {
        await instance.ready;

        return {
            teamId: instance._teamId,
            agentId: instance._agentId,
            model: instance._model,
            agentData: instance.agentData,
        };
    })
    public async streamPrompt(message?: string | any, toolHeaders = {}, concurrentToolCalls = 4, abortSignal?: AbortSignal) {
        let options = typeof message === 'object' ? message : { message };
        message = options?.message;
        const files = options?.files;

        if (message) {
            //initial call, reset stop flag

            this.stop = false;
        }
        if (this.stop) {
            this.emit('interrupted', 'interrupted');
            this.emit('end');
            return;
        }
        await this.ready;

        // Add an abort handler
        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                //this.emit('error', { name: 'AbortError', message: 'Request aborted by user!' });
                this.emit('aborted', 'Aborted by user!');
                //const error = new Error('Request aborted by user!');
                //error.name = 'AbortError';
                //throw error;
            });
        }

        const passThroughtContinueMessage = 'Continue with the next tool call if there are any, or just inform the user that you are done';
        //let promises = [];
        let _content = '';
        const reqMethods = this._reqMethods;
        const toolsConfig = this._toolsConfig;
        const endpoints = this._endpoints;
        const baseUrl = this._baseUrl;
        const message_id = 'msg_' + randomUUID();
        const isDebugSession = toolHeaders['X-DEBUG'];
        for (let [key, value] of Object.entries(this.headers)) {
            toolHeaders[key] = value;
        }

        /* ==================== STEP ENTRY ==================== */
        // console.debug('Request to LLM with the given model, messages and functions properties.', {
        //     model: this.model,
        //     message,
        //     toolsConfig,
        // });
        /* ==================== STEP ENTRY ==================== */

        if (message) this._context.addUserMessage(message, message_id);

        const contextWindow = await this._context.getContextWindow(this._maxContextSize, this._maxOutputTokens);

        let maxTokens = this._maxOutputTokens;
        if (typeof this.model === 'object' && this.model?.params?.maxTokens) {
            maxTokens = this.model.params.maxTokens;
        }

        const llmReqUid = randomUUID();
        this.emit(TLLMEvent.Requested, {
            model: typeof this.model === 'string' ? this.model : this.model?.modelId,
            contextWindow,
            files,
            maxTokens,
            agentId: this._agentId,
            requestId: llmReqUid,
        });

        // Disable tools if we've reached the limit (for final synthesis call)
        const effectiveToolsConfig = this._disableToolsForNextCall ? null : toolsConfig;
        this._disableToolsForNextCall = false; // Reset flag after using it

        const eventEmitter: any = await this.llmInference
            .promptStream({
                contextWindow,
                files,
                params: {
                    model: this.model,
                    toolsConfig: this._settings?.toolsStrategy ? this._settings.toolsStrategy(effectiveToolsConfig) : effectiveToolsConfig,
                    maxTokens,
                    cache: this._settings?.experimentalCache,
                    agentId: this._agentId,
                    abortSignal,
                },
            })
            .catch((error) => {
                console.error('Error on promptStream: ', error);
                this.emit(TLLMEvent.Error, error, { requestId: llmReqUid });
            });

        // remove listeners from llm event emitter to stop receiving stream data
        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                eventEmitter.removeAllListeners();
            });
        }
        if (!eventEmitter || eventEmitter.error) {
            throw new Error('[LLM Request Error]');
        }

        if (message) this.emit('start', { requestId: llmReqUid });
        // eventEmitter.on(TLLMEvent.Data, (data) => {
        //     if (this.stop) return;
        //     this.emit('data', data);
        // });

        eventEmitter.on(TLLMEvent.Thinking, (thinking) => {
            if (this.stop) return;
            this.emit(TLLMEvent.Thinking, thinking, { requestId: llmReqUid });
        });

        eventEmitter.on(TLLMEvent.Data, (data) => {
            if (this.stop) return;
            this.emit(TLLMEvent.Data, data, {
                contextWindow,
                requestId: llmReqUid,
                model: typeof this.model === 'string' ? this.model : this.model?.modelId,
            });
        });

        eventEmitter.on(TLLMEvent.Content, (content) => {
            if (this.stop) return;
            // if (toolHeaders['x-passthrough']) {
            //     console.log('Passthrough skiped content ', content);
            //     return;
            // }
            //const lastMessage = this._context?.messages?.[this._context?.messages?.length - 1];
            //const skip = lastMessage?.__smyth_data__?.internal;

            //skip if the content is the last generated message after a passthrough content
            // if (skip) {
            //     let s = true;
            // }
            _content += content;
            this.emit(TLLMEvent.Content, content, { requestId: llmReqUid });
        });

        let finishReason = 'stop';

        let toolsPromise = new Promise((resolve, reject) => {
            let hasTools = false;
            let hasError = false;
            let passThroughContent = '';

            eventEmitter.on(TLLMEvent.Error, (error) => {
                hasError = true;
                reject(error);
            });

            eventEmitter.on(TLLMEvent.ToolInfo, async (toolsData, thinkingBlocks = []) => {
                if (this.stop) return;
                hasTools = true;
                let llmMessage: any = {
                    role: 'assistant',
                    content: _content,
                    tool_calls: [],
                };

                if (thinkingBlocks?.length > 0) {
                    this.emit(
                        'thoughtProcess',
                        thinkingBlocks
                            .filter((block) => block.type === 'thinking')
                            .map((block) => block.thinking || '')
                            .join('\n')
                    );

                    llmMessage.thinkingBlocks = thinkingBlocks;
                }

                // Check if we're at or over the tool call limit BEFORE processing this batch
                const remainingToolCalls = this._maxToolCallsPerSession - this._toolCallCount;

                if (remainingToolCalls <= 0) {
                    // Already at limit, don't execute any tools from this batch - all will be pending
                    const pendingToolNames = toolsData.map((t: ToolData) => t.name).join(', ');
                    const systemInstruction = `You have reached the maximum number of tool calls (${this._maxToolCallsPerSession}). The following tools were requested but marked as "pending": ${pendingToolNames}. Please provide a helpful response based on the information you've gathered so far. You may acknowledge these pending tools and suggest the user can continue in a follow-up request.`;
                    this._context.addUserMessage(systemInstruction, message_id, { internal: true });
                    this.emit(TLLMEvent.Interrupted, 'max_tool_calls', { requestId: llmReqUid });
                    this._disableToolsForNextCall = true;

                    // Continue to get final synthesis without executing tools
                    this.streamPrompt(null, toolHeaders, concurrentToolCalls, abortSignal).then(resolve).catch(reject);
                    return;
                }

                // If this batch would exceed the limit, truncate to only execute remaining quota
                let actualToolsData = toolsData;
                let skippedToolsData: ToolData[] = [];

                if (toolsData.length > remainingToolCalls) {
                    actualToolsData = toolsData.slice(0, remainingToolCalls);
                    skippedToolsData = toolsData.slice(remainingToolCalls);

                    const skippedToolNames = skippedToolsData.map((t) => t.name).join(', ');
                    console.warn(
                        `Tool call limit will be reached. Executing only ${remainingToolCalls} of ${toolsData.length} requested tools. ` +
                            `Skipped tools: ${skippedToolNames}`
                    );
                }

                //add tool status for every tool entry
                actualToolsData.forEach((tool) => {
                    tool.status = tool.name ? this._toolStatusMap?.[tool.name] : undefined;
                });
                actualToolsData.content = _content;
                actualToolsData.requestId = llmReqUid;
                actualToolsData.contextWindow = contextWindow;

                llmMessage.tool_calls = toolsData.map((tool) => {
                    return {
                        id: tool.id,
                        type: tool.type,
                        function: {
                            name: tool.name,
                            arguments: tool.arguments,
                        },
                    };
                });

                //if (llmMessage.tool_calls?.length <= 0) return;

                // Emit ToolInfo with only the tools we'll actually execute
                this.emit(TLLMEvent.ToolInfo, actualToolsData);

                //initialize the agent callback logic
                const _agentCallback = (data) => {
                    if (this.stop) return;
                    //if (typeof data !== 'string') return;
                    let content = '';
                    let thinking = '';
                    if (typeof data === 'object') {
                        if (data.content) {
                            content = data.content;

                            passThroughContent += content;
                            eventEmitter.emit(TLLMEvent.Content, content);
                        }
                        if (data.thinking) {
                            thinking = data.thinking;
                            eventEmitter.emit(TLLMEvent.Thinking, thinking);
                        }
                        return;
                    }
                    if (typeof data === 'string') {
                        passThroughContent += data;
                        eventEmitter.emit(TLLMEvent.Content, data);
                    }

                    //passThroughContent += data;
                    //this is currently used to handle agent callbacks when running local agents
                    //this.emit('agentCallback', data);

                    //this.emit('content', data);
                    //this.emit('content', data);
                    //eventEmitter.emit('content', data);
                };

                // Only process tools up to the limit
                const toolProcessingTasks = actualToolsData.map(
                    (tool: { index: number; name: string; type: string; arguments: Record<string, any> }) => async () => {
                        const endpoint = endpoints?.get(tool?.name) || tool?.name;
                        // Sometimes we have object response from the LLM such as Anthropic

                        let args = typeof tool?.arguments === 'string' ? JSONContent(tool?.arguments).tryParse() || {} : tool?.arguments;

                        if (args?.error) {
                            throw new Error('[Tool] Arguments Parsing Error\n' + JSON.stringify({ message: args?.error }));
                        }

                        //await beforeFunctionCall(llmMessage, toolsData[tool.index]);
                        // TODO [Forhad]: Make sure toolsData[tool.index] and tool do the same thing
                        this.emit('beforeToolCall', { tool, args }, llmMessage); //deprecated

                        const status = tool.name ? this._toolStatusMap?.[tool.name] : undefined;
                        this.emit(TLLMEvent.ToolCall, { tool, status, _llmRequest: llmMessage, requestId: llmReqUid });

                        const toolArgs = {
                            type: tool?.type,
                            method: reqMethods?.get(tool?.name),
                            endpoint,
                            args,
                            baseUrl,
                            headers: toolHeaders,
                            agentCallback: _agentCallback,
                        };

                        let { data: functionResponse, error } = await this.useTool(toolArgs, abortSignal);

                        if (error) {
                            functionResponse = typeof error === 'object' && typeof error !== null ? JSON.stringify(error) : error;
                        }

                        const result = functionResponse;

                        functionResponse =
                            typeof functionResponse === 'object' && typeof functionResponse !== null
                                ? JSON.stringify(functionResponse)
                                : functionResponse;

                        //await afterFunctionCall(functionResponse, toolsData[tool.index]);
                        this.emit('afterToolCall', { tool, args }, functionResponse); // Deprecated
                        this.emit(TLLMEvent.ToolResult, { tool, result, requestId: llmReqUid });

                        // Increment tool call counter
                        this._toolCallCount++;

                        return { ...tool, result: functionResponse };
                    }
                );

                const processedToolsData = await processWithConcurrencyLimit<ToolData>(toolProcessingTasks, concurrentToolCalls);

                // Add skipped tools with pending status (not errors - they can be executed in next request)
                const skippedToolsWithPendingStatus = skippedToolsData.map((tool) => ({
                    ...tool,
                    result: JSON.stringify({
                        status: 'pending',
                        message: `Tool execution deferred - maximum tool call limit (${this._maxToolCallsPerSession}) reached for this request. This tool can be executed in a follow-up request.`,
                        pending: true,
                    }),
                }));

                // Combine executed tools and pending tools for context
                const allToolsData = [...processedToolsData, ...skippedToolsWithPendingStatus];

                // Emit pending status for skipped tools (not errors - these are valid requests)
                skippedToolsWithPendingStatus.forEach((tool) => {
                    this.emit(TLLMEvent.ToolResult, {
                        tool,
                        result: { status: 'pending', message: 'Tool execution deferred - limit reached', pending: true },
                        requestId: llmReqUid,
                    });
                });

                //if (!passThroughContent) {

                if (!passThroughContent) {
                    this._context.addToolMessage(llmMessage, allToolsData, message_id);
                    //delete toolHeaders['x-passthrough'];
                } else {
                    //this._context.addAssistantMessage(passThroughContent, message_id);

                    //llmMessage.content += '\n' + passThroughContent;
                    this._context.addToolMessage(llmMessage, allToolsData, message_id, { passThrough: true });

                    //this._context.addAssistantMessage(passThroughContent, message_id, { passthrough: true });
                    //this should not be stored in the persistent conversation store
                    //it's just a workaround to avoid generating more content after passthrough content
                    //this._context.addUserMessage(passThroughtContinueMessage, message_id, { internal: true });
                    //toolHeaders['x-passthrough'] = 'true';
                }

                // Check if tool call limit has been reached AFTER processing this batch
                const limitReached = this._toolCallCount >= this._maxToolCallsPerSession;
                const hasPendingTools = skippedToolsWithPendingStatus.length > 0;

                if (limitReached) {
                    // Disable tools for the next (final) call to prevent infinite loops
                    this._disableToolsForNextCall = true;

                    if (hasPendingTools) {
                        // Only add system instruction if there are pending tools
                        // If no pending tools, LLM completed naturally - don't confuse it with limit messages
                        const systemInstruction = `You have reached the maximum number of tool calls (${this._maxToolCallsPerSession}) for this request. Some tools are marked as "pending" and were not executed. Please provide a helpful response based on the information you've gathered so far. You may acknowledge these pending tools and suggest the user can continue in a follow-up request.`;

                        this._context.addUserMessage(systemInstruction, message_id, { internal: true });
                        this.emit(TLLMEvent.Interrupted, 'max_tool_calls', { requestId: llmReqUid });
                    }
                }

                this.streamPrompt(null, toolHeaders, concurrentToolCalls, abortSignal).then(resolve).catch(reject);

                //} else {
                //TODO : add passthrough content to the context window ??

                //if passThroughContent is not empty, it means that the current agent streamed content through components
                //resolve(passThroughContent);
                //}
                //const result = await resolve(await this.streamPrompt(null, toolHeaders, concurrentToolCalls));
                //console.log('Result after tool call: ', result);
            });

            eventEmitter.on(TLLMEvent.End, async (toolsData, usage_data, _finishReason) => {
                if (_finishReason) finishReason = _finishReason;
                if (usage_data) {
                    //FIXME : normalize the usage data format
                    this.emit(TLLMEvent.Usage, usage_data, { requestId: llmReqUid });
                }
                if (hasError) return;

                if (!hasTools || passThroughContent) {
                    //console.log(' ===> resolved content no tool', _content);
                    //this._context.push({ role: 'assistant', content: _content });
                    const lastMessage = this._context?.messages?.[this._context?.messages?.length - 1];
                    let metadata;
                    if (lastMessage?.content?.includes(passThroughtContinueMessage) && lastMessage?.__smyth_data__?.internal) {
                        metadata = { internal: true };
                    }
                    this._context.addAssistantMessage(_content, message_id, metadata);
                    resolve(''); //the content were already emitted through 'content' event
                }
            });
        });

        const toolsContent = await toolsPromise.catch((error) => {
            console.error('Error in toolsPromise: ', error);
            this.emit(TLLMEvent.Error, error, { requestId: llmReqUid });
            throw error;
        });
        _content += toolsContent;
        //let content = JSONContent(_content).tryParse();

        // let streamPromise = new Promise((resolve, reject) => {
        //     eventEmitter.on('end', async () => {
        //         if (toolsPromise) await toolsPromise;

        //         let content = JSONContent(_content).tryParse();
        //         resolve({ content });
        //     });
        // });

        // promises.push(streamPromise);

        //await Promise.all(promises);
        //return content;

        if (message) {
            //console.log('main content', content);
            //this._context.push({ role: 'assistant', content: content });

            if (finishReason !== 'stop') {
                this.emit(TLLMEvent.Interrupted, finishReason, { requestId: llmReqUid });
            }
            this.emit(TLLMEvent.End, { requestId: llmReqUid });
        } else {
            //console.log('tool content', content);
        }

        return _content;
    }

    private resolveToolEndpoint(baseUrl: string, method: string, endpoint: string, params: Record<string, any>): string {
        //handle query params
        let templateParams = {};
        if (params) {
            const parameters = this._spec?.paths?.[endpoint]?.[method.toLowerCase()]?.parameters || [];
            for (let p of parameters) {
                if (p.in === 'path') {
                    templateParams[p.name] = params[p.name] || '';
                    delete params[p.name];
                }
            }
        }
        const parsedEndpoint = TemplateString(endpoint).parse(templateParams, Match.singleCurly).clean().result;

        // Create a new URL object using the base URL and endpoint
        const url = new URL(parsedEndpoint, baseUrl);

        // Iterate over the params object and append each key/value pair to the URL search parameters
        Object.keys(params).forEach((key) => {
            url.searchParams.append(key, params[key]);
        });

        // Return the full URL as a string
        return url.toString();
    }

    private async useTool(
        params: ToolParams,
        abortSignal?: AbortSignal
    ): Promise<{
        data: any;
        error;
    }> {
        if (this.stop) {
            return { data: null, error: 'Conversation Interrupted' };
        }

        const { type, endpoint, args, method, baseUrl, headers = {}, agentCallback } = params;

        if (type === 'function') {
            const toolHandler = this._customToolsHandlers[endpoint];
            if (toolHandler) {
                try {
                    const result = await toolHandler(args);
                    return { data: result, error: null };
                } catch (error) {
                    return { data: null, error: error?.message || 'Custom tool handler failed' };
                }
            }
            try {
                const url = this.resolveToolEndpoint(baseUrl, method, endpoint, method == 'get' ? args : {});

                const reqConfig: AxiosRequestConfig = {
                    method,
                    url,
                    headers: {
                        ...headers,
                    },
                    signal: abortSignal,
                };

                if (method !== 'get') {
                    if (Object.keys(args).length) {
                        reqConfig.data = args;
                    }
                    //(reqConfig.headers as Record<string, unknown>)['Content-Type'] = 'application/json';
                    reqConfig.headers['Content-Type'] = 'application/json';
                }

                console.debug('Calling tool: ', reqConfig);

                reqConfig.headers['X-CACHE-ID'] = this._context?.llmCache?.id;

                //reqConfig.headers['X-REQUEST-TAG'] = this.id;
                /*
                 * Objective for the following conditions:
                 * - In case it is not a debug call and there is no monitor id, then we need to run the agent locally to reduce latency
                 * - but if it a debug call, we need to forward req to sre-builder-debugger since it holds the debug promises
                 * - or if there is a monitor id, we need to forward req to sre-builder-debugger since it holds the monitor SSE connections.
                 * - a remote call is often needed for file parsing be default agent we inject, it should not be loaded locally.
                 * So the objecive is mainly reducing latency when possible
                 */
                //TODO : implement a timeout for the tool call

                const canRunLocally = reqConfig.url.includes('localhost') || reqConfig.headers['X-AGENT-ID'];
                const requiresRemoteCall =
                    reqConfig.headers['X-DEBUG'] !== undefined ||
                    reqConfig.headers['X-MONITOR-ID'] !== undefined ||
                    //This is used for cases that requre to inject a default attachment handler
                    //TODO : this need to be removed from the conversation helper in the future since default attachment handler is a specific server feature
                    //reqConfig.headers['X-AGENT-HAS-ATTACHMENTS'] !== undefined;
                    reqConfig.headers['x-conversation-id'] !== undefined;

                //we force the conversationId header after checking that it was not remotely set
                if (!reqConfig.headers['x-conversation-id']) {
                    reqConfig.headers['x-conversation-id'] = this.id;
                }
                if (canRunLocally && !requiresRemoteCall) {
                    console.log('RUNNING AGENT LOCALLY');
                    let agentProcess;
                    if (this.agentData === this._specSource) {
                        //the agent was loaded from data
                        agentProcess = AgentProcess.load(this.agentData, this._agentVersion);
                    } else {
                        //the agent was loaded from a spec
                        agentProcess = AgentProcess.load(
                            reqConfig.headers['X-AGENT-ID'] || this._agentId,
                            reqConfig.headers['X-AGENT-VERSION'] || this._agentVersion
                        );
                    }
                    //if it's a local agent, invoke it directly

                    const response = await agentProcess.run(reqConfig as TAgentProcessParams, agentCallback);
                    return { data: response.data, error: null };
                } else {
                    console.log('RUNNING AGENT REMOTELY');
                    let eventSource;

                    // if debug mode is on OR the user attached a monitor to the call, then we need to attach a monitor to the agent call
                    if ((reqConfig.headers['X-DEBUG'] && reqConfig.headers['X-AGENT-ID']) || reqConfig.headers['X-MONITOR-ID']) {
                        console.log('ATTACHING MONITOR TO REMOTE AGENT CALL');
                        const monitUrl = reqConfig.url.split('/api')[0] + '/agent/' + reqConfig.headers['X-AGENT-ID'] + '/monitor';

                        // Create custom fetch implementation that includes our headers
                        const customFetch: FetchLike = (url, init) => {
                            return fetch(url, {
                                ...init,
                                headers: {
                                    ...(init?.headers || {}),
                                    ...Object.fromEntries(Object.entries(reqConfig.headers).map(([k, v]) => [k, String(v)])),
                                },
                            });
                        };

                        eventSource = new EventSource(monitUrl, {
                            fetch: customFetch,
                        });
                        let monitorId = '';

                        eventSource.addEventListener('init', (event) => {
                            monitorId = event.data;
                            console.log('monitorId', monitorId);
                            if (reqConfig.headers['X-MONITOR-ID']) {
                                // an external monitor was sent, so we do not override it
                                reqConfig.headers['X-MONITOR-ID'] = `${reqConfig.headers['X-MONITOR-ID']},${monitorId}`;
                            } else {
                                reqConfig.headers['X-MONITOR-ID'] = monitorId;
                            }
                        });
                        eventSource.addEventListener('llm/passthrough/content', (event: any) => {
                            if (params.agentCallback) params.agentCallback({ content: event.data.replace(/\\n/g, '\n') });
                        });
                        eventSource.addEventListener('llm/passthrough/thinking', (event: any) => {
                            if (params.agentCallback) params.agentCallback({ thinking: event.data.replace(/\\n/g, '\n') });
                        });

                        await new Promise((resolve) => {
                            let maxTime = 5 * 1000; //5 seconds
                            let itv = setInterval(() => {
                                if (monitorId || maxTime <= 0) {
                                    clearInterval(itv);
                                    resolve(true);
                                }
                                maxTime -= 100;
                            }, 100);
                        });
                    }

                    //if it's a remote agent, call the API via HTTP
                    const response = await axios.request(reqConfig);

                    if (eventSource) {
                        eventSource.close();
                        console.log('eventSource closed');
                    }
                    return { data: response.data, error: null };
                }
            } catch (error: any) {
                console.warn('Failed to call Tool: ', baseUrl, endpoint);
                console.warn('  ====>', error);
                return { data: null, error: error?.response?.data || error?.message };
            }
        }

        return { data: null, error: `'${type}' tool type not supported at the moment` };
    }

    public async addTool(tool: {
        name: string;
        description: string;
        arguments?: Record<string, any> | string[];
        handler: (args: Record<string, any>) => Promise<any>;
        inputs?: any[];
    }) {
        await this.ready;
        if (!tool.arguments) {
            //if no arguments are provided, we need to extract them from the function
            const toolFunction = tool.handler as Function;
            const openApiArgs = this.extractArgsAsOpenAPI(toolFunction);
            const _arguments: any = {};
            for (let arg of openApiArgs) {
                _arguments[arg.name] = arg.schema;
                if (tool.inputs) {
                    if (arg.schema.properties) {
                        const required = [];
                        for (let prop in arg.schema.properties) {
                            const input = tool.inputs?.find((i) => i.name === prop);
                            if (!arg.schema.properties[prop].description) {
                                arg.schema.properties[prop].description = input?.description;
                            }
                            if (!input?.optional) {
                                required.push(prop);
                            }
                        }
                        if (required.length) {
                            arg.schema.required = required;
                        }
                    } else {
                        const input = tool.inputs?.find((i) => i.name === arg.name);
                        arg.schema.description = input?.description;
                    }
                }
            }

            tool.arguments = _arguments;
            tool.handler = async (argsObj: any) => {
                const args = Object.values(argsObj);
                const result = await toolFunction(...args);
                return result;
            };
        }

        const requiredFields = Object.values(tool.arguments)
            .map((arg) => (arg.required ? arg.name : null))
            .filter((arg) => arg);

        const properties = {};
        for (let entry in tool.arguments) {
            properties[entry] = {
                type: tool.arguments[entry].type || 'string',
                properties: tool.arguments[entry].properties,
                description: tool.arguments[entry].description,
                ...(tool.arguments[entry].type === 'array' ? { items: { type: tool.arguments[entry].items?.type || 'string' } } : {}),
            };
        }
        const toolDefinition = {
            name: tool.name,
            description: tool.description,
            properties,
            requiredFields,
        };
        this._customToolsDeclarations.push(toolDefinition);
        this._customToolsHandlers[tool.name] = tool.handler;

        //deduplicate tools

        this._customToolsDeclarations = this._customToolsDeclarations.filter(
            (tool, index, self) => self.findIndex((t) => t.name === tool.name) === index
        );
        const toolsConfig: any = this.llmInference.connector.formatToolsConfig({
            type: 'function',
            toolDefinitions: this._customToolsDeclarations,
            toolChoice: this.toolChoice,
        });

        //if (this._toolsConfig) this._toolsConfig.tools.push(...toolsConfig?.tools);
        //else this._toolsConfig = toolsConfig;

        this._toolsConfig = toolsConfig;
    }

    async removeTool(toolName: string) {
        await this.ready;
        this._customToolsDeclarations = this._customToolsDeclarations.filter((tool) => tool.name !== toolName);
        delete this._customToolsHandlers[toolName];

        const toolsConfig: any = this.llmInference.connector.formatToolsConfig({
            type: 'function',
            toolDefinitions: this._customToolsDeclarations,
            toolChoice: this.toolChoice,
        });
        this._toolsConfig = toolsConfig;
    }

    public get toolNames() {
        return this._customToolsDeclarations.map((tool) => tool.name);
    }
    /**
     * updates LLM model, if spec is available, it will update the tools config
     * @param model
     */
    // TODO [Forhad]: For now updateModel does not required await, but when we will have tools implementation in custom model then we need to await for it
    private async updateModel(model: string | TLLMModel) {
        try {
            this._model = model;

            if (this._spec) {
                this._reqMethods = OpenAPIParser.mapReqMethods(this._spec?.paths);
                this._endpoints = OpenAPIParser.mapEndpoints(this._spec?.paths);
                this._baseUrl = this._spec?.servers?.[0].url;

                const functionDeclarations = this.getFunctionDeclarations(this._spec);
                //functionDeclarations.push(...this._customToolsDeclarations);
                this._customToolsDeclarations.push(...functionDeclarations);
                this._llmInference = await LLMInference.getInstance(this._model, AccessCandidate.team(this._teamId));
                if (!this._llmInference.connector) {
                    this.emit('error', 'No connector found for model: ' + this._model);
                    return;
                }
                this._customToolsDeclarations = this._customToolsDeclarations.filter(
                    (tool, index, self) => self.findIndex((t) => t.name === tool.name) === index
                );
                this._toolsConfig = this.llmInference.connector.formatToolsConfig({
                    type: 'function',
                    toolDefinitions: this._customToolsDeclarations,
                    toolChoice: this.toolChoice,
                });

                let messages = [];
                if (this._context) messages = this._context.messages; // preserve messages

                this._context = new LLMContext(this.llmInference, this.systemPrompt, this._llmContextStore);
            } else {
                this._toolsConfig = null;
                this._reqMethods = null;
                this._endpoints = null;
                this._baseUrl = null;
            }
        } catch (error) {
            this.emit('error', error);
        }
    }

    /**
     * this function is used to patch the spec with missing fields that are required for the tool to work
     * @param spec
     */
    private patchSpec(spec: Record<string, any>) {
        const paths = spec?.paths;
        for (const path in paths) {
            const pathData = paths[path];

            // it's possible we have multiple methods for a single path
            for (const key in pathData) {
                const data = pathData[key];
                if (!data?.operationId) {
                    //normalize path and use it as operationId
                    data.operationId = path.replace(/\//g, '_').replace(/{|}/g, '').replace(/\./g, '_');
                }
            }
        }
        return spec;
    }
    /**
     * Loads OpenAPI specification from source
     * @param specSource
     * @returns
     */
    private async loadSpecFromSource(specSource: string | Record<string, any>) {
        if (typeof specSource === 'object') {
            //is this a valid OpenAPI spec?
            if (OpenAPIParser.isValidOpenAPI(specSource)) {
                this.systemPrompt = specSource?.info?.description || '';
                return this.patchSpec(specSource);
            }
            //is this a valid agent data?
            if (typeof specSource?.behavior === 'string' && specSource?.components && specSource?.connections) {
                this.agentData = specSource; //agent loaded from data directly
                this._specSource = specSource;
                this._agentId = specSource.id;
                return await this.loadSpecFromAgent(specSource);
            }

            return null;
        }

        if (typeof specSource === 'string') {
            //is this an openAPI url?
            if (isUrl(specSource as string)) {
                const spec = await OpenAPIParser.getJsonFromUrl(specSource as string);

                if (spec.info?.description) this.systemPrompt = spec.info.description;

                // we always overwrite system prompt with user defined one
                if (this.userDefinedSystemPrompt) this.systemPrompt = this.userDefinedSystemPrompt;

                if (spec.info?.title) this.assistantName = spec.info.title;

                const specUrl = new URL(specSource as string);
                const defaultBaseUrl = specUrl.origin;

                if (!spec?.servers) spec.servers = [{ url: defaultBaseUrl }];
                if (spec.servers?.length == 0) spec.servers = [{ url: defaultBaseUrl }];

                if (this.assistantName) {
                    this.systemPrompt = `Assistant Name : ${this.assistantName}\n\n${this.systemPrompt}`;
                }

                //this._agentId = specUrl.hostname; //just set an agent ID in order to identify the agent in SRE //FIXME: maybe this requires a better solution
                return this.patchSpec(spec);
            }
            //is this an agentId ?
            const agentDataConnector = ConnectorService.getAgentDataConnector();
            const agentId = specSource as string;
            this._agentId = agentId;

            if (this._agentVersion === undefined) {
                const isDeployed = await agentDataConnector.isDeployed(agentId);
                this._agentVersion = isDeployed ? 'latest' : '';
            }

            this.agentData = await agentDataConnector.getAgentData(agentId, this._agentVersion).catch((error) => null);
            if (!this.agentData) return null;

            const spec = await this.loadSpecFromAgent(this.agentData);
            return spec;
        }
    }
    private async loadSpecFromAgent(agentData: Record<string, any>) {
        //handle the case where agentData object contains the agent schema directly
        //agents retrieved from the database have a wrapping object with agent name and version number
        //local agent might include the agent data directly
        if (agentData?.components) {
            agentData = { name: agentData?.name, data: agentData, version: '1.0.0' };
        }

        const agentDataConnector = ConnectorService.getAgentDataConnector();
        this.systemPrompt = agentData?.data?.behavior || this.systemPrompt;

        // we always overwrite system prompt with user defined one
        if (this.userDefinedSystemPrompt) this.systemPrompt = this.userDefinedSystemPrompt;

        this.assistantName = agentData?.data?.name || agentData?.data?.templateInfo?.name || this.assistantName;
        if (this.assistantName) {
            this.systemPrompt = `Assistant Name : ${this.assistantName}\n\n${this.systemPrompt}`;
        }

        this._toolStatusMap = agentData?.data?.components
            ?.filter((component) => component.name === 'APIEndpoint')
            .reduce((map, component) => {
                if (component?.data?.endpoint) {
                    map[component.data.endpoint] =
                        component?.data?.status_message || `Calling ${component?.data?.endpointLabel || component.data.endpoint}`;
                }
                return map;
            }, {});

        let baseUrl = this._baseUrl || 'http://localhost/';
        if (baseUrl && !baseUrl.endsWith('/')) {
            baseUrl += '/';
        }

        const spec = await agentDataConnector.getOpenAPIJSON(agentData, baseUrl, this._agentVersion, true).catch((error) => null);
        return this.patchSpec(spec);
    }

    /**
     * Extracts function declarations from OpenAPI specification
     * @param spec
     * @returns
     */
    private getFunctionDeclarations(spec): FunctionDeclaration[] {
        const paths = spec?.paths;
        const reqMethods = OpenAPIParser.mapReqMethods(paths);

        let declarations: FunctionDeclaration[] = [];

        for (const path in paths) {
            const pathData = paths[path];

            // it's possible we have multiple methods for a single path
            for (const key in pathData) {
                const data = pathData[key];

                if (!data?.operationId) continue;

                const method = reqMethods.get(data?.operationId) || 'get';

                let properties = {};
                let requiredFields: string[] = [];

                if (method.toLowerCase() === 'get') {
                    const params = data?.parameters || [];
                    for (const prop of params) {
                        properties[prop.name] = {
                            ...prop.schema,
                            description: prop.description,
                        };

                        if (prop.required === true) {
                            requiredFields.push(prop?.name || '');
                        }
                    }
                } else {
                    properties = data?.requestBody?.content?.['application/json']?.schema?.properties;
                    requiredFields = data?.requestBody?.content?.['application/json']?.schema?.required;

                    // Open AI doesn't support 'required' to be boolean inside property
                    for (const prop in properties) {
                        delete properties[prop]?.required;
                    }
                }

                if (!properties) properties = {};
                if (!requiredFields) requiredFields = [];

                const declaration = {
                    name: data?.operationId,
                    description: data?.description || data?.summary || '',
                    properties,
                    requiredFields,
                };
                declarations.push(declaration);
            }
        }

        return declarations;
    }

    private async assignTeamIdFromAgentId(agentId: string) {
        if (agentId) {
            const accountConnector = ConnectorService.getAccountConnector();
            const teamId = await accountConnector.getCandidateTeam(AccessCandidate.agent(agentId))?.catch(() => '');
            this._teamId = teamId || '';
        }
    }

    private extractArgsAsOpenAPI(fn) {
        const ast = acorn.parse(`(${fn.toString()})`, { ecmaVersion: 'latest' });
        const params = (ast.body[0] as any).expression.params;

        let counter = 0;
        function handleParam(param) {
            if (param.type === 'Identifier') {
                return {
                    name: param.name,
                    in: 'query',
                    required: true,
                    schema: { type: 'string', name: param.name, required: true },
                };
            }

            if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
                return {
                    name: param.left.name,
                    in: 'query',
                    required: false,
                    schema: { type: 'string', name: param.left.name, required: false },
                };
            }

            if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
                return {
                    name: param.argument.name,
                    in: 'query',
                    required: false,
                    schema: { type: 'array', items: { type: 'string' } },
                };
            }

            if (param.type === 'ObjectPattern') {
                // For destructured objects, output as a single parameter with nested fields
                const name = `object___${counter++}`;
                return {
                    name,
                    in: 'query',
                    required: true,
                    schema: {
                        type: 'object',
                        required: true,
                        name,
                        properties: Object.fromEntries(
                            param.properties.map((prop) => {
                                const keyName = prop.key.name || '[unknown]';
                                return [keyName, { type: 'string' }]; // default to string
                            })
                        ),
                    },
                };
            }

            const name = `unknown___${counter++}`;
            return {
                name,
                in: 'query',
                required: true,
                schema: { type: 'string', name, required: true },
            };
        }

        return params.map(handleParam);
    }
}
