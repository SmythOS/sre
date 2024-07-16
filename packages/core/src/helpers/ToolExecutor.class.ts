import { TOOL_USE_DEFAULT_MODEL } from '@sre/constants';
import { createLogger } from '@sre/Core/Logger';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { ToolsConfig } from '@sre/types/LLM.types';
import { isUrl } from '@sre/utils/data.utils';
import axios, { AxiosRequestConfig } from 'axios';
import { JSONContent } from './JsonContent.helper';
import { OpenAPIParser } from './OpenApiParser.helper';
const console = createLogger('ToolExecutor');

type UseToolParams = {
    type: string;
    endpoint: string;
    args: Record<string, any>;
    method: string;
    baseUrl: string;
    responseType?: 'stream' | 'json';
    headers?: Record<string, string>;
};

type FunctionDeclaration = {
    name: string;
    description: string;
    properties: Record<string, any>;
    requiredFields: string[];
};

//@Forhad : what does this do ?
const cleanUrl = (urlString: string): string => {
    let parsedUrl = new URL(urlString);
    const cleanPath = parsedUrl.pathname.replace(/\/{2,}/g, '/');
    parsedUrl.pathname = cleanPath;

    let url = parsedUrl.toString();

    url = url.replace(/%7B/g, '{').replace(/%7D/g, '}');

    return url;
};

export default class ToolExecutor {
    private _spec;
    private _reqMethods;
    private _toolsConfig;
    private _endpoints;
    private _baseUrl;

    private _ready = false;
    private _currentWaitPromise;

    constructor(private model: string, private openAPISource: string) {
        this.prepareData(this.model);
    }

    private get ready() {
        if (this._currentWaitPromise) return this._currentWaitPromise;
        return new Promise((resolve, reject) => {
            const maxWaitTime = 30000;
            let waitTime = 0;
            const interval = 100;

            const wait = setInterval(() => {
                if (this._ready) {
                    clearInterval(wait);
                    resolve(true);
                } else {
                    waitTime += interval;
                    if (waitTime >= maxWaitTime) {
                        clearInterval(wait);
                        reject('Timeout: Failed to prepare data');
                    }
                }
            }, interval);
        });
    }

    public async run({ messages, toolHeaders = {}, teamId = '' }) {
        await this.ready;

        const reqMethods = this._reqMethods;
        const toolsConfig = this._toolsConfig;
        const endpoints = this._endpoints;
        const baseUrl = this._baseUrl;

        /* ==================== STEP ENTRY ==================== */
        console.debug('Request to LLM with the given model, messages and functions properties.', {
            model: this.model || TOOL_USE_DEFAULT_MODEL,
            messages,
            toolsConfig,
        });
        /* ==================== STEP ENTRY ==================== */
        const llmHelper: LLMHelper = LLMHelper.load(this.model);

        const { data: llmResponse, error } = await llmHelper.toolRequest({
            model: this.model,
            messages,
            toolsConfig,
            apiKey: '', //await getLLMApiKey(this.model, teamId),
        });

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
                    plugin_url: this.resolveToolEndpoint(baseUrl, endpoint, args),
                    arguments: args,
                });
                /* ==================== STEP ENTRY ==================== */

                let { data: functionResponse, error } = await this.useTool(toolArgs);

                if (error) {
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

            messages.push(...messagesWithToolResult);

            return this.run({ messages, toolHeaders, teamId });
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

    private async prepareData(model) {
        const spec = await this.getOpenAPISpecJSON();

        if (!spec) {
            throw new Error('Failed to parse the OpenAPI specification');
        }

        const reqMethods = OpenAPIParser.mapReqMethods(spec?.paths);
        const toolsConfig = await this.toolsConfig(model);
        const endpoints = OpenAPIParser.mapEndpoints(spec?.paths);
        const baseUrl = spec?.servers?.[0].url;

        this._spec = spec;
        this._reqMethods = reqMethods;
        this._toolsConfig = toolsConfig;
        this._endpoints = endpoints;
        this._baseUrl = baseUrl;
    }

    private getOpenAPISpecJSON() {
        if (isUrl(this.openAPISource)) {
            return OpenAPIParser.getJsonFromUrl(this.openAPISource);
        }

        return OpenAPIParser.getJson(this.openAPISource);
    }

    private async functionDeclarations(): Promise<FunctionDeclaration[]> {
        await this.ready;
        const spec = this._spec;
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

    private async toolsConfig(model: string): Promise<ToolsConfig | void> {
        const functionDeclarations = await this.functionDeclarations();
        const llmHelper: LLMHelper = LLMHelper.load(this.model);

        const toolsConfig = llmHelper.connector.formatToolsConfig({ type: 'function', toolDefinitions: functionDeclarations, toolChoice: 'auto' });

        return toolsConfig;
    }

    private hasUrlParam(path: string): boolean {
        return /\{[^{}]+\}/.test(path);
    }

    private setUrlParams(url: string, params: Record<string, any>): string {
        // Define a regular expression to match URL parameter placeholders
        const urlParamRegex = /\{([^{}]+)\}/g;
        let _url = url;

        if (this.hasUrlParam(url)) {
            // Replace each URL parameter placeholder with its corresponding value
            _url = url.replace(urlParamRegex, (_, paramName) => params[paramName]);
        } else {
            // If no URL parameters, then append the params to the URL
            _url += `?${Object.keys(params)
                .map((key) => `${key}=${params[key]}`)
                .join('&')}`;
        }

        return _url;
    }

    private resolveToolEndpoint(baseUrl: string, endpoint: string, params: Record<string, any>): string {
        let url = cleanUrl(baseUrl + endpoint);

        if (Object.keys(params)?.length > 0) {
            url = this.setUrlParams(url, params);
        }

        return url;
    }

    private async useTool(params: UseToolParams): Promise<{
        data: any;
        error;
    }> {
        const { type, endpoint, args, method, baseUrl, responseType = 'json', headers = {} } = params;

        if (type === 'function') {
            const url = this.resolveToolEndpoint(baseUrl, endpoint, method == 'get' ? args : {});

            const reqConfig: AxiosRequestConfig = {
                method,
                url,
                responseType,
                headers,
            };

            if (method !== 'get') {
                if (Object.keys(args).length) {
                    reqConfig.data = args;
                }
                (reqConfig.headers as Record<string, unknown>)['Content-Type'] = 'application/json';
            }

            try {
                //TODO: if it's a local agent, invoke it directly without axios

                console.log('Calling tool: ', reqConfig);
                const response = await axios.request(reqConfig);

                return { data: response.data, error: null };
            } catch (error: any) {
                console.error('Error calling Tool: ', reqConfig);
                console.error('  ====>', error);
                return { data: null, error: error?.response?.data || error?.message };
            }
        }

        return { data: null, error: `'${type}' tool type not supported at the moment` };
    }
}
