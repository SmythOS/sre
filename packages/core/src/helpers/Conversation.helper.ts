import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { LLMContext } from '@sre/MemoryManager/LLMContext';
import { TAgentProcessParams } from '@sre/types/Agent.types';
import { ILLMContextStore, ToolData } from '@sre/types/LLM.types';
import { isUrl } from '@sre/utils/data.utils';
import { processWithConcurrencyLimit, uid } from '@sre/utils/general.utils';
import axios, { AxiosRequestConfig } from 'axios';
import EventEmitter from 'events';
import { JSONContent } from './JsonContent.helper';
import { OpenAPIParser } from './OpenApiParser.helper';
import { Match, TemplateString } from './TemplateString.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

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
};

//TODO: handle authentication
export class Conversation extends EventEmitter {
    private _agentId: string = '';
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
    private _endpoints;
    private _baseUrl;

    private _status = '';
    private _currentWaitPromise;

    private _llmContextStore: ILLMContextStore;
    private _context: LLMContext;
    private _maxContextSize = 1024 * 16;
    private _maxOutputTokens = 1024 * 8;
    private _teamId: string = undefined;
    private _agentVersion: string = undefined;

    public get context() {
        return this._context;
    }

    private _lastError;
    private _spec;
    private _customToolsDeclarations: FunctionDeclaration[] = [];
    private _customToolsHandlers: Record<string, (args: Record<string, any>) => Promise<any>> = {};
    public stop = false;
    public set spec(specSource) {
        this.ready.then(() => {
            this._status = '';
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

    public set model(model: string) {
        this.ready.then(async () => {
            this._status = '';
            await this.updateModel(model);
            this._status = 'ready';
        });
    }
    public get model() {
        return this._model;
    }

    constructor(
        private _model: string,
        private _specSource?: string | Record<string, any>,
        private _settings?: {
            maxContextSize?: number;
            maxOutputTokens?: number;
            systemPrompt?: string;
            toolChoice?: string;
            store?: ILLMContextStore;
            experimentalCache?: boolean;
            toolsStrategy?: (toolsConfig) => any;
            agentId?: string;
            agentVersion?: string;
        }
    ) {
        //TODO: handle loading previous session (messages)
        super();

        //this event listener avoids unhandled errors that can cause crashes
        this.on('error', (error) => {
            this._lastError = error;
            console.warn('Conversation Error: ', error?.message);
        });
        if (_settings?.maxContextSize) this._maxContextSize = _settings.maxContextSize;
        if (_settings?.maxOutputTokens) this._maxOutputTokens = _settings.maxOutputTokens;
        if (_settings?.systemPrompt) {
            this.userDefinedSystemPrompt = _settings.systemPrompt;
        }
        if (_settings?.toolChoice) {
            this.toolChoice = _settings.toolChoice;
        }

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
    public async prompt(message?: string, toolHeaders = {}) {
        if (this.stop) return;
        await this.ready;

        const reqMethods = this._reqMethods;
        const toolsConfig = this._toolsConfig;
        const endpoints = this._endpoints;
        const baseUrl = this._baseUrl;
        const message_id = 'msg_' + uid();

        /* ==================== STEP ENTRY ==================== */
        console.debug('Request to LLM with the given model, messages and functions properties.', {
            model: this.model,
            message,
            toolsConfig,
        });
        /* ==================== STEP ENTRY ==================== */
        const llmInference: LLMInference = await LLMInference.getInstance(this.model, this._teamId);

        if (!this._context) {
            throw new Error('Conversation context is not initialized');
        }

        if (message) this._context.addUserMessage(message, message_id);

        const contextWindow = await this._context.getContextWindow(this._maxContextSize, this._maxOutputTokens);

        const { data: llmResponse } = await llmInference
            .toolRequest(
                {
                    model: this.model,
                    messages: contextWindow,
                    toolsConfig: this._settings?.toolsStrategy ? this._settings.toolsStrategy(toolsConfig) : toolsConfig,
                    maxTokens: this._maxOutputTokens,
                },
                this._agentId
            )
            .catch((error: any) => {
                throw new Error(
                    '[LLM Request Error]\n' +
                        JSON.stringify({
                            code: error?.name || 'LLMRequestFailed',
                            message: error?.message || 'Something went wrong while calling LLM.',
                        })
                );
            });

        // useTool = true means we need to use it
        if (llmResponse?.useTool) {
            /* ==================== STEP ENTRY ==================== */
            console.debug({
                type: 'ToolsData',
                message: 'Tool(s) is available for use.',
                toolsData: llmResponse?.toolsData,
            });
            /* ==================== STEP ENTRY ==================== */

            const toolsData: ToolData[] = [];

            for (const tool of llmResponse?.toolsData) {
                const endpoint = endpoints?.get(tool?.name) || tool?.name;
                // Sometimes we have object response from the LLM such as Anthropic
                const parsedArgs = JSONContent(tool?.arguments).tryParse();
                let args = typeof tool?.arguments === 'string' ? parsedArgs || {} : tool?.arguments;

                if (args?.error) {
                    throw new Error('[Tool] Arguments Parsing Error\n' + JSON.stringify({ message: args?.error }));
                }

                const toolArgs = {
                    type: tool?.type,
                    method: reqMethods?.get(tool?.name),
                    endpoint,
                    args,
                    baseUrl,
                    headers: toolHeaders,
                };

                /* ==================== STEP ENTRY ==================== */
                console.debug({
                    type: 'UseTool',
                    message: 'As LLM returned a tool to use, so use it with the provided arguments.',
                    plugin_url: { baseUrl, endpoint, args },
                    arguments: args,
                });
                /* ==================== STEP ENTRY ==================== */

                this.emit('beforeToolCall', { tool, args });
                //TODO: Should we run these tools in parallel?
                let { data: functionResponse, error } = await this.useTool(toolArgs);

                if (error) {
                    this.emit('toolCallError', toolArgs, error);
                    functionResponse = typeof error === 'object' && typeof error !== null ? JSON.stringify(error) : error;
                }

                functionResponse =
                    typeof functionResponse === 'object' && typeof functionResponse !== null ? JSON.stringify(functionResponse) : functionResponse;

                /* ==================== STEP ENTRY ==================== */
                console.debug({
                    type: 'ToolResult',
                    message: 'Result from the tool',
                    response: functionResponse,
                });
                /* ==================== STEP ENTRY ==================== */

                this.emit('afterToolCall', toolArgs, functionResponse);
                toolsData.push({ ...tool, result: functionResponse });
            }

            // const messagesWithToolResult = llmInference.connector.transformToolMessageBlocks({ messageBlock: llmResponse?.message, toolsData });

            // this._context.push(...messagesWithToolResult);

            //this._context.push({ messageBlock: llmResponse?.message, toolsData });
            this._context.addToolMessage(llmResponse?.message, toolsData, message_id);

            return this.prompt(null, toolHeaders);
        }

        //this._context.push(llmResponse?.message);
        this._context.addAssistantMessage(llmResponse?.message?.content, message_id);

        let content = JSONContent(llmResponse?.content).tryParse();

        /* ==================== STEP ENTRY ==================== */
        console.debug({
            type: 'FinalResult',
            message: 'Here is the final result after processing all the tools and LLM response.',
            response: content,
        });
        /* ==================== STEP ENTRY ==================== */

        return content;
    }

    //TODO : handle attachments
    public async streamPrompt(message?: string, toolHeaders = {}, concurrentToolCalls = 4) {
        if (this.stop) return;
        await this.ready;

        //let promises = [];
        let _content = '';
        const reqMethods = this._reqMethods;
        const toolsConfig = this._toolsConfig;
        const endpoints = this._endpoints;
        const baseUrl = this._baseUrl;
        const message_id = 'msg_' + uid();

        /* ==================== STEP ENTRY ==================== */
        // console.debug('Request to LLM with the given model, messages and functions properties.', {
        //     model: this.model,
        //     message,
        //     toolsConfig,
        // });
        /* ==================== STEP ENTRY ==================== */
        const llmInference: LLMInference = await LLMInference.getInstance(this.model, this._teamId);

        if (message) this._context.addUserMessage(message, message_id);

        const contextWindow = await this._context.getContextWindow(this._maxContextSize, this._maxOutputTokens);

        const eventEmitter: any = await llmInference
            .streamRequest(
                {
                    model: this.model,
                    messages: contextWindow,
                    toolsConfig: this._settings?.toolsStrategy ? this._settings.toolsStrategy(toolsConfig) : toolsConfig,
                    maxTokens: this._maxOutputTokens,
                    cache: this._settings?.experimentalCache,
                },
                this._agentId
            )
            .catch((error) => {
                console.error('Error on streamRequest: ', error);
            });

        if (!eventEmitter || eventEmitter.error) {
            throw new Error('[LLM Request Error]');
        }

        if (message) this.emit('start');
        eventEmitter.on('data', (data) => {
            this.emit('data', data);
        });

        eventEmitter.on('content', (content) => {
            _content += content;
            //console.log('content', content);
            this.emit('content', content);
        });

        let toolsPromise = new Promise((resolve, reject) => {
            let hasTools = false;
            let hasError = false;
            eventEmitter.on('error', (error) => {
                hasError = true;
                reject(error);
            });

            eventEmitter.on('toolsData', async (toolsData) => {
                hasTools = true;
                let llmMessage: any = {
                    role: 'assistant',
                    content: _content,
                    tool_calls: [],
                };
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

                this.emit('toolInfo', toolsData); // replaces onFunctionCallResponse in legacy code

                const toolProcessingTasks = toolsData.map(
                    (tool: { index: number; name: string; type: string; arguments: Record<string, any> }) => async () => {
                        const endpoint = endpoints?.get(tool?.name) || tool?.name;
                        // Sometimes we have object response from the LLM such as Anthropic

                        let args = typeof tool?.arguments === 'string' ? JSONContent(tool?.arguments).tryParse() || {} : tool?.arguments;

                        if (args?.error) {
                            throw new Error('[Tool] Arguments Parsing Error\n' + JSON.stringify({ message: args?.error }));
                        }

                        //await beforeFunctionCall(llmMessage, toolsData[tool.index]);
                        this.emit('beforeToolCall', { tool, args });

                        const toolArgs = {
                            type: tool?.type,
                            method: reqMethods?.get(tool?.name),
                            endpoint,
                            args,
                            baseUrl,
                            headers: toolHeaders,
                        };

                        let { data: functionResponse, error } = await this.useTool(toolArgs);

                        if (error) {
                            functionResponse = typeof error === 'object' && typeof error !== null ? JSON.stringify(error) : error;
                        }

                        functionResponse =
                            typeof functionResponse === 'object' && typeof functionResponse !== null
                                ? JSON.stringify(functionResponse)
                                : functionResponse;

                        //await afterFunctionCall(functionResponse, toolsData[tool.index]);
                        this.emit('afterToolCall', { tool, args }, functionResponse);

                        return { ...tool, result: functionResponse };
                    }
                );

                const processedToolsData = await processWithConcurrencyLimit<ToolData>(toolProcessingTasks, concurrentToolCalls);

                // const messagesWithToolResult = llmInference.connector.transformToolMessageBlocks({
                //     messageBlock: llmMessage,
                //     toolsData: processedToolsData,
                // });

                // this._context.push(...messagesWithToolResult);
                // this._context.push({
                //     //store raw tool call data, we'll convert it when reading the context window
                //     messageBlock: llmMessage,
                //     toolsData: processedToolsData,
                // });

                this._context.addToolMessage(llmMessage, processedToolsData, message_id);

                this.streamPrompt(null, toolHeaders, concurrentToolCalls).then(resolve).catch(reject);

                //const result = await resolve(await this.streamPrompt(null, toolHeaders, concurrentToolCalls));
                //console.log('Result after tool call: ', result);
            });

            eventEmitter.on('end', async (toolsData, usage_data) => {
                if (usage_data) {
                    //FIXME : normalize the usage data format
                    this.emit('usage', usage_data);
                }
                if (hasError) return;

                if (!hasTools) {
                    //console.log(' ===> resolved content no tool', _content);
                    //this._context.push({ role: 'assistant', content: _content });
                    this._context.addAssistantMessage(_content, message_id);
                    resolve(''); //the content were already emitted through 'content' event
                }
            });
        });

        const toolsContent = await toolsPromise.catch((error) => {
            console.error('Error in toolsPromise: ', error);
            //this.emit('error', error);
            this.emit('error', error);
            return '';
        });
        _content += toolsContent;
        let content = JSONContent(_content).tryParse();

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
            this.emit('end');
        } else {
            //console.log('tool content', content);
        }

        return content;
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

    private async useTool(params: ToolParams): Promise<{
        data: any;
        error;
    }> {
        const { type, endpoint, args, method, baseUrl, headers = {} } = params;

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
                };

                if (method !== 'get') {
                    if (Object.keys(args).length) {
                        reqConfig.data = args;
                    }
                    //(reqConfig.headers as Record<string, unknown>)['Content-Type'] = 'application/json';
                    reqConfig.headers['Content-Type'] = 'application/json';
                }

                console.debug('Calling tool: ', reqConfig);

                //TODO : implement a timeout for the tool call
                if (reqConfig.url.includes('localhost')) {
                    //if it's a local agent, invoke it directly
                    const response = await AgentProcess.load(
                        reqConfig.headers['X-AGENT-ID'] || this._agentId,
                        reqConfig.headers['X-AGENT-VERSION'] || this._agentVersion
                    ).run(reqConfig as TAgentProcessParams);
                    return { data: response.data, error: null };
                } else {
                    //if it's a remote agent, call the API via HTTP
                    const response = await axios.request(reqConfig);

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
        arguments: Record<string, any>;
        handler: (args: Record<string, any>) => Promise<any>;
    }) {
        const requiredFields = Object.values(tool.arguments)
            .map((arg) => (arg.required ? arg.name : null))
            .filter((arg) => arg !== null);

        const properties = {};
        for (let entry in tool.arguments) {
            properties[entry] = {
                type: typeof tool.arguments[entry],
                description: tool.arguments[entry].description,
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

        const llmInference: LLMInference = await LLMInference.getInstance(this.model, this._teamId);
        const toolsConfig: any = llmInference.connector.formatToolsConfig({
            type: 'function',
            toolDefinitions: [toolDefinition],
            toolChoice: this.toolChoice,
        });

        if (this._toolsConfig) this._toolsConfig.tools.push(...toolsConfig?.tools);
        else this._toolsConfig = toolsConfig;
    }
    /**
     * updates LLM model, if spec is available, it will update the tools config
     * @param model
     */
    // TODO [Forhad]: For now updateModel does not required await, but when we will have tools implementation in custom model then we need to await for it
    private async updateModel(model: string) {
        try {
            this._model = model;

            if (this._spec) {
                this._reqMethods = OpenAPIParser.mapReqMethods(this._spec?.paths);
                this._endpoints = OpenAPIParser.mapEndpoints(this._spec?.paths);
                this._baseUrl = this._spec?.servers?.[0].url;

                const functionDeclarations = this.getFunctionDeclarations(this._spec);
                functionDeclarations.push(...this._customToolsDeclarations);
                const llmInference: LLMInference = await LLMInference.getInstance(this._model, this._teamId);
                this._toolsConfig = llmInference.connector.formatToolsConfig({
                    type: 'function',
                    toolDefinitions: functionDeclarations,
                    toolChoice: this.toolChoice,
                });

                let messages = [];
                if (this._context) messages = this._context.messages; // preserve messages

                this._context = new LLMContext(llmInference, this.systemPrompt, this._llmContextStore);
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
            if (OpenAPIParser.isValidOpenAPI(specSource)) return this.patchSpec(specSource);
            //is this a valid agent data?
            if (specSource?.behavior && specSource?.components && specSource?.connections) return await this.loadSpecFromAgent(specSource);
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

            const agentData = await agentDataConnector.getAgentData(agentId, this._agentVersion).catch((error) => null);
            if (!agentData) return null;

            const spec = await this.loadSpecFromAgent(agentData);
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

        const spec = await agentDataConnector.getOpenAPIJSON(agentData, 'http://localhost/', this._agentVersion, true).catch((error) => null);
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
}
