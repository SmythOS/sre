import { Connector } from '@sre/Core/Connector.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import config from '@sre/config';
import { escapeString, TemplateString } from '@sre/helpers/TemplateString.helper';
import { JSONContent, JSONContentHelper } from '@sre/helpers/JsonContent.helper';

export interface IAgentDataConnector {
    getAgentData(agentId: string, version?: string): Promise<any>;
    getAgentIdByDomain(domain: string): Promise<string>;
    getAgentSettings(agentId: string, version?: string): Promise<any>;
    listTeamAgents(teamId: string, deployedOnly?: boolean, includeData?: boolean): Promise<any[]>;
    getAgentConfig(agentId: string): { [key: string]: any };
}

const openapiTemplate = JSON.stringify({
    openapi: '3.0.1',
    info: {
        title: '{{model_name}}',
        description: '{{model_description}}',
        version: '{{version}}',
    },
    servers: [
        {
            url: '{{server_url}}',
        },
    ],
    paths: {},
    components: {
        schemas: {},
    },
});

const openapiEndpointTemplate = JSON.stringify({
    summary: '{{summary}}',
    operationId: '{{operationId}}',
    'x-openai-isConsequential': false,
    requestBody: {
        required: true,
        content: {},
    },
    responses: {
        '200': {
            description: 'response',
            content: {
                'text/plain': {
                    schema: {
                        type: 'string',
                    },
                },
            },
        },
    },
});

//TODO: use SecureConnector instead of Connector to harden agent data security
//When implemented, the getEphemeralAgentData becomes part of the default requester
export abstract class AgentDataConnector extends Connector implements IAgentDataConnector {
    //Ephemeral agent data is used to store data that is not persistent and is only available for the current session
    //this is usually the case of programmatic agents implemented with the SDK
    static ephemeralAgentData: Map<string, any> = new Map();
    public name = 'AgentDataConnector';
    public abstract getAgentData(agentId: string, version?: string): Promise<any>;
    public abstract getAgentIdByDomain(domain: string): Promise<string>;
    public abstract getAgentSettings(agentId: string, version?: string): Promise<{ [key: string]: any }>;
    public abstract getAgentEmbodiments(agentId: string): Promise<any>;
    public abstract isDeployed(agentId: string): Promise<boolean>;
    public abstract listTeamAgents(teamId: string, deployedOnly?: boolean, includeData?: boolean): Promise<any[]>;
    public abstract getAgentConfig(agentId: string): { [key: string]: any };
    /**
     * Loads openAPI JSON for the agent
     * @param source this represents either the agentId or the agent data
     * @param domain
     * @param version
     * @param aiOnly
     * @returns
     */
    public async getOpenAPIJSON(source: string | Record<string, any>, server_url, version, aiOnly: boolean = false) {
        if (!source) {
            throw new Error('Agent not found');
        }

        const apiBasePath = version && version != 'latest' ? `/v${version}/api` : '/api';

        let agentData: any = typeof source === 'object' ? source : await this.getAgentData(source, version);
        if (agentData.data) agentData = agentData.data;
        const name = agentData.name;

        let description = aiOnly ? agentData.behavior : agentData.shortDescription;
        if (!description) description = agentData.description; //data.description is deprecated, we just use it as a fallback for now

        const _version = agentData.version || '1.0.0';

        const openAPITpl = TemplateString(openapiTemplate)
            .parse({
                model_name: escapeString(name),
                model_description: escapeString(description),
                server_url,
                version: _version,
            })
            .clean().result;
        const openAPIObj = JSON.parse(openAPITpl);

        const components = agentData.components.filter((component: any) => component.name === 'APIEndpoint');
        for (let component of components) {
            const ai_exposed = component.data.ai_exposed || typeof component.data.ai_exposed === 'undefined';
            if (aiOnly && !ai_exposed) continue;
            let method = (component.data.method || 'post').toLowerCase();
            let summary = aiOnly ? component.data.description || component.data.doc : component.data.doc || component.data.description;

            const openAPIEntry = JSONContent(
                TemplateString(openapiEndpointTemplate)
                    .parse({
                        summary: summary?.replace(/"/g, '\\"'),
                        operationId: component?.data?.endpoint,
                    })
                    .clean().result
            ).tryParse();

            if (typeof openAPIEntry !== 'object') {
                console.warn('Error on openAPIEntry: ', openAPIEntry);
                continue;
            }

            if (!openAPIObj.paths[apiBasePath + '/' + component.data.endpoint]) openAPIObj.paths[apiBasePath + '/' + component.data.endpoint] = {};
            //const componentsSchemas = openAPIObj.components.schemas;

            openAPIObj.paths[apiBasePath + '/' + component.data.endpoint][method] = openAPIEntry;

            if (component.inputs.length > 0) {
                if (method === 'get') {
                    delete openAPIEntry.requestBody;

                    openAPIEntry.parameters = [];

                    for (let input of component.inputs) {
                        const parameter: {
                            name: string;
                            in: string;
                            description: string;
                            required: boolean;
                            schema: { type: string };
                            style?: string;
                            explode?: boolean;
                        } = {
                            name: input.name,
                            in: 'query',
                            description: input.description,
                            required: !input.optional,
                            schema: getOpenAPIInputSchema(input.type),
                        };

                        // for array and object types
                        const { style, explode } = getOpenAPIParameterStyle(input.type);
                        if (style) {
                            parameter.style = style;
                            parameter.explode = explode;
                        }

                        openAPIEntry.parameters.push(parameter);
                    }
                } else {
                    const requiredProps: any = [];

                    const hasBinaryType = !aiOnly && component.inputs.some((input) => input.type.toLowerCase().trim() === 'binary');
                    //if it's an AI format, we force application/json format, becauwe we want to receive binary data as a url
                    const mimetype = hasBinaryType ? 'multipart/form-data' : 'application/json';
                    openAPIEntry.requestBody.content[mimetype] = {};
                    for (let input of component.inputs) {
                        if (!input.optional) requiredProps.push(input.name);

                        if (!openAPIEntry.requestBody.content[mimetype].schema)
                            openAPIEntry.requestBody.content[mimetype].schema = { type: 'object' };

                        const schema: any = openAPIEntry.requestBody.content[mimetype].schema || {
                            type: 'object',
                        };

                        if (!schema.properties) schema.properties = {};
                        schema.properties[input.name] = {
                            ...getOpenAPIInputSchema(input.type),
                            format: !aiOnly && input.type.toLowerCase().trim() === 'binary' ? 'binary' : undefined,
                            description: input.description,
                            default: input.defaultVal,
                        };
                        schema.required = requiredProps;

                        if (!openAPIEntry.requestBody.content[mimetype].schema) openAPIEntry.requestBody.content['application/json'].schema = schema;
                    }
                }
            } else {
                delete openAPIEntry.requestBody;
            }
        }

        return openAPIObj;
    }

    /**
     * Sets ephemeral agent data for the given agent ID
     * @param agentId
     * @param data
     */
    public async setEphemeralAgentData(agentId: string, data: any) {
        AgentDataConnector.ephemeralAgentData.set(agentId, data);
    }
    /**
     * Gets ephemeral agent data for the given agent ID
     * @param agentId
     * @returns
     */
    public async getEphemeralAgentData(agentId: string) {
        return AgentDataConnector.ephemeralAgentData.get(agentId);
    }
}

function getOpenAPIInputSchema(input_type) {
    switch (input_type?.toLowerCase()) {
        case 'binary':
        case 'string':
        case 'any':
            return { type: 'string' };
        case 'number':
        case 'float':
            return { type: 'number' };
        case 'integer':
            return { type: 'integer' };
        case 'boolean':
            return { type: 'boolean' };
        case 'array':
            return { type: 'array', items: {} };
        case 'object':
            return { type: 'object', additionalProperties: {} };
        default:
            return { type: 'string' };
    }
}

function getOpenAPIParameterStyle(input_type) {
    switch (input_type.toLowerCase()) {
        case 'array':
            return {
                style: 'form',
                explode: false, // results in `ids=1,2,3`
            };
        case 'object':
            return {
                style: 'deepObject',
                explode: true, // results in `lat=value1&long=value2`
            };
        default:
            return { style: '', explode: false };
    }
}
