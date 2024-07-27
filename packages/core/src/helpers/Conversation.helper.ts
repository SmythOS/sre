import Agent from '@sre/AgentManager/Agent.class';
import EventEmitter from 'events';
import { OpenAPIParser } from './OpenApiParser.helper';
import { isUrl } from '@sre/utils/data.utils';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { ToolsConfig } from '@sre/types/LLM.types';
import { JSONContent } from './JsonContent.helper';
import axios, { AxiosRequestConfig } from 'axios';
import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { TAgentProcessParams } from '@sre/types/Agent.types';
import { LLMContext } from '@sre/MemoryManager/LLMContext';
import { concurrentAsyncProcess } from '@sre/utils/general.utils';
import { Logger } from '@sre/helpers/Log.helper';
import { Match, TemplateString } from './TemplateString.helper';

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

    public systemPrompt;
    public assistantName;

    private _reqMethods;
    private _toolsConfig;
    private _endpoints;
    private _baseUrl;

    private _status = '';
    private _currentWaitPromise;

    private _context: LLMContext;
    public get context() {
        return this._context;
    }

    private _spec;
    public set spec(specSource) {
        this.ready.then(() => {
            this._status = '';
            this.loadSpecFromSource(specSource).then((spec) => {
                if (!spec) {
                    this._status = 'error';
                    this.emit('error', 'Invalid OpenAPI specification data format');
                    throw new Error('Invalid OpenAPI specification data format');
                }
                this._spec = spec;
                this.updateModel(this._model);
                this._status = 'ready';
            });
        });
    }

    public set model(model: string) {
        this.ready.then(() => {
            this._status = '';
            this.updateModel(model);
            this._status = 'ready';
        });
    }
    public get model() {
        return this._model;
    }
    constructor(private _model: string, private _specSource?: string | Record<string, any>) {
        super();

        if (_specSource) {
            this.loadSpecFromSource(_specSource).then((spec) => {
                if (!spec) {
                    this._status = 'error';
                    this.emit('error', 'Invalid OpenAPI specification data format');
                    throw new Error('Invalid OpenAPI specification data format');
                }
                this._spec = spec;

                this.updateModel(this._model);
                this._status = 'ready';
            });
        } else {
            this.updateModel(this._model);
            this._status = 'ready';
        }
    }

    private get ready() {
        if (this._currentWaitPromise) return this._currentWaitPromise;
        this._currentWaitPromise = new Promise((resolve, reject) => {
            if (this._status) {
                return resolve(true);
            }

            const maxWaitTime = 30000;
            let waitTime = 0;
            const interval = 100;

            const wait = setInterval(() => {
                if (this._status) {
                    clearInterval(wait);
                    return resolve(true);
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

    public async prompt(message?: string, toolHeaders = {}) {
        await this.ready;

        const reqMethods = this._reqMethods;
        const toolsConfig = this._toolsConfig;
        const endpoints = this._endpoints;
        const baseUrl = this._baseUrl;

        /* ==================== STEP ENTRY ==================== */
        console.debug('Request to LLM with the given model, messages and functions properties.', {
            model: this.model,
            message,
            toolsConfig,
        });
        /* ==================== STEP ENTRY ==================== */
        const llmHelper: LLMHelper = LLMHelper.load(this.model);

        if (message) this._context.addUserMessage(message);
        const contextWindow = this._context.getContextWindow(4096); //FIXME: handle configurable context window size
        const { data: llmResponse, error } = await llmHelper.toolRequest(
            {
                model: this.model,
                messages: contextWindow,
                toolsConfig,
            },
            this._agentId
        );

        if (error) {
            throw new Error(
                '[LLM Request Error]\n' +
                    JSON.stringify({
                        code: error?.name || 'LLMRequestFailed',
                        message: error?.message || 'Something went wrong while calling LLM.',
                    })
            );
        }

        // useTool = true means we need to use it
        if (llmResponse?.useTool) {
            /* ==================== STEP ENTRY ==================== */
            console.debug({
                type: 'ToolsInfo',
                message: 'Tool(s) is available for use.',
                toolsInfo: llmResponse?.toolsInfo,
            });
            /* ==================== STEP ENTRY ==================== */

            const toolsData: any[] = [];

            for (const tool of llmResponse?.toolsInfo) {
                const endpoint = endpoints?.get(tool?.name);
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

                this.emit('beforeToolCall', toolArgs);
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

            const llmMessage = llmResponse?.message;

            const messagesWithToolResult = llmMessage ? [llmMessage] : [];
            //const messagesWithToolResult = LLMHelper.formatMessagesWithToolResult(this.model, { llmMessage, toolsData });
            toolsData.forEach((toolData) => {
                messagesWithToolResult.push({
                    tool_call_id: toolData.id,
                    role: toolData.role,
                    name: toolData.name,
                    content: toolData.result, // we have error when the content is an object
                });
            });

            this._context.push(...messagesWithToolResult);

            return this.prompt(null, toolHeaders);
        }

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

    public async streamPrompt(message?: string, toolHeaders = {}, concurrentToolCalls = 4) {
        await this.ready;

        const reqMethods = this._reqMethods;
        const toolsConfig = this._toolsConfig;
        const endpoints = this._endpoints;
        const baseUrl = this._baseUrl;

        /* ==================== STEP ENTRY ==================== */
        console.debug('Request to LLM with the given model, messages and functions properties.', {
            model: this.model,
            message,
            toolsConfig,
        });
        /* ==================== STEP ENTRY ==================== */
        const llmHelper: LLMHelper = LLMHelper.load(this.model);

        if (message) this._context.addUserMessage(message);
        const contextWindow = this._context.getContextWindow(1024 * 16); //FIXME: handle configurable context window size
        const { data: llmResponse, error } = await llmHelper.streamToolRequest(
            {
                model: this.model,
                messages: contextWindow,
                toolsConfig,
            },
            this._agentId
        );

        if (error) {
            throw new Error(
                '[LLM Request Error]\n' +
                    JSON.stringify({
                        code: error?.name || 'LLMRequestFailed',
                        message: error?.message || 'Something went wrong while calling LLM.',
                    })
            );
        }

        // useTool = true means we need to use it
        if (llmResponse?.useTool) {
            let toolsData: any[] = [];
            const llmMessage = llmResponse?.message;
            const toolsInfo = llmResponse?.toolsInfo;

            /* ==================== STEP ENTRY ==================== */
            console.debug({
                type: 'ToolsInfo',
                message: 'Tool(s) is available for use.',
                toolsInfo: llmResponse?.toolsInfo,
            });
            /* ==================== STEP ENTRY ==================== */

            this.emit('toolInfo', toolsInfo); // replaces onFunctionCallResponse in legacy code

            toolsData = await concurrentAsyncProcess(
                toolsInfo,
                async (tool: { index: number; name: string; type: string; arguments: Record<string, any> }) => {
                    const endpoint = endpoints?.get(tool?.name);
                    // Sometimes we have object response from the LLM such as Anthropic

                    let args = typeof tool?.arguments === 'string' ? JSONContent(tool?.arguments).tryParse() || {} : tool?.arguments;

                    if (args?.error) {
                        throw new Error('[Tool] Arguments Parsing Error\n' + JSON.stringify({ message: args?.error }));
                    }

                    //await beforeFunctionCall(llmMessage, toolsInfo[tool.index]);
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

                    //await afterFunctionCall(functionResponse, toolsInfo[tool.index]);
                    this.emit('afterToolCall', { tool, args }, functionResponse);

                    return { ...tool, result: functionResponse };
                },
                concurrentToolCalls
            );

            const messagesWithToolResult = llmMessage ? [llmMessage] : [];
            //const messagesWithToolResult = LLMHelper.formatMessagesWithToolResult(this.model, { llmMessage, toolsData });
            toolsData.forEach((toolData) => {
                messagesWithToolResult.push({
                    tool_call_id: toolData.id,
                    role: toolData.role,
                    name: toolData.name,
                    content: toolData.result, // we have error when the content is an object
                });
            });

            this._context.push(...messagesWithToolResult);

            return this.streamPrompt(null, toolHeaders, concurrentToolCalls);
        }
        let _content = '';
        if (llmResponse.content) {
            _content = llmResponse.content;
        }
        if (llmResponse.stream) {
            this.emit('start');
            for await (const part of llmResponse.stream) {
                const delta = part.choices[0].delta;

                //if (!_content) delta.content = '\n\n' + delta.content;
                //onResponse(delta);
                this.emit('data', delta);
                if (delta.content) this.emit('content', delta.content);
                _content += delta.content || '';
            }

            this.emit('end');
        }
        let content = JSONContent(_content).tryParse();

        /* ==================== STEP ENTRY ==================== */
        console.debug({
            type: 'FinalResult',
            message: 'Here is the final result after processing all the tools and LLM response.',
            response: content,
        });
        /* ==================== STEP ENTRY ==================== */

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
            try {
                const url = this.resolveToolEndpoint(baseUrl, method, endpoint, method == 'get' ? args : {});

                const reqConfig: AxiosRequestConfig = {
                    method,
                    url,
                    headers,
                };

                if (method !== 'get') {
                    if (Object.keys(args).length) {
                        reqConfig.data = args;
                    }
                    (reqConfig.headers as Record<string, unknown>)['Content-Type'] = 'application/json';
                }

                console.debug('Calling tool: ', reqConfig);
                if (reqConfig.url.includes('localhost')) {
                    //if it's a local agent, invoke it directly
                    const response = await AgentProcess.load(reqConfig.headers['X-AGENT-ID']).run(reqConfig as TAgentProcessParams);
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
    /**
     * updates LLM model, if spec is available, it will update the tools config
     * @param model
     */
    private updateModel(model: string) {
        this._model = model;

        if (this._spec) {
            this._reqMethods = OpenAPIParser.mapReqMethods(this._spec?.paths);
            this._endpoints = OpenAPIParser.mapEndpoints(this._spec?.paths);
            this._baseUrl = this._spec?.servers?.[0].url;

            const functionDeclarations = this.getFunctionDeclarations(this._spec);
            const llmHelper: LLMHelper = LLMHelper.load(this._model);
            this._toolsConfig = llmHelper.connector.formatToolsConfig({
                type: 'function',
                toolDefinitions: functionDeclarations,
                toolChoice: 'auto',
            });

            let messages = [];
            if (this._context) messages = this._context.messages; // preserve messages

            this._context = new LLMContext(this._model, this.systemPrompt, messages);
        } else {
            this._toolsConfig = null;
            this._reqMethods = null;
            this._endpoints = null;
            this._baseUrl = null;
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
            if (OpenAPIParser.isValidOpenAPI(specSource)) return this.patchSpec(specSource);
            return null;
        }

        if (typeof specSource === 'string') {
            if (isUrl(specSource as string)) {
                const spec = await OpenAPIParser.getJsonFromUrl(specSource as string);
                if (spec.info?.description) this.systemPrompt = spec.info.description;
                if (spec.info?.title) this.assistantName = spec.info.title;

                const defaultBaseUrl = new URL(specSource as string).origin;

                if (!spec?.servers) spec.servers = [{ url: defaultBaseUrl }];
                if (spec.servers?.length == 0) spec.servers = [{ url: defaultBaseUrl }];

                if (this.assistantName) {
                    this.systemPrompt = `Assistant Name : ${this.assistantName}\n\n${this.systemPrompt}`;
                }

                return this.patchSpec(spec);
            }
            const agentDataConnector = ConnectorService.getAgentDataConnector();
            const agentId = specSource as string;
            const agentData = await agentDataConnector.getAgentData(agentId).catch((error) => null);
            if (!agentData) return null;
            this._agentId = agentId;
            this.systemPrompt = agentData?.data?.behavior || this.systemPrompt;
            this.assistantName = agentData?.data?.name || agentData?.data?.templateInfo?.name || this.assistantName;
            if (this.assistantName) {
                this.systemPrompt = `Assistant Name : ${this.assistantName}\n\n${this.systemPrompt}`;
            }
            const spec = await agentDataConnector.getOpenAPIJSON(agentData, 'http://localhost/', 'latest', true).catch((error) => null);
            return this.patchSpec(spec);
        }
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
}
