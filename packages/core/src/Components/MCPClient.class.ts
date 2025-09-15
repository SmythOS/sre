import Joi from 'joi';

import { IAgent as Agent } from '@sre/types/Agent.types';
import { Conversation } from '@sre/helpers/Conversation.helper';
import { TemplateString } from '@sre/helpers/TemplateString.helper';

import { Component } from './Component.class';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export class MCPClient extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().optional(),
        openAiModel: Joi.string().optional(), // for backward compatibility
        mcpUrl: Joi.string().max(2048).uri().required().description('URL of the MCP'),
        descForModel: Joi.string().max(5000).allow('').label('Description for Model'),
        name: Joi.string().max(500).required().allow(''),
        desc: Joi.string().max(5000).allow('').label('Description'),
        logoUrl: Joi.string().max(8192).allow(''),
        id: Joi.string().max(200),
        version: Joi.string().max(100).allow(''),
        domain: Joi.string().max(253).allow(''),
        prompt: Joi.string().max(5000).optional().allow('').label('Prompt'),
    });

    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);

        logger.debug(`=== MCP Client Log ===`);

        try {
            const mcpUrl = config?.data?.mcpUrl;
            if (!mcpUrl) {
                return { _error: 'Please provide a MCP URL!', _debug: logger.output };
            }

            const model = config?.data?.model || config?.data?.openAiModel;
            const descForModel = TemplateString(config?.data?.descForModel).parse(input).result;
            let prompt = TemplateString(config?.data?.prompt).parse(input).result;

            if (!prompt) {
                return { _error: 'Please provide a prompt', _debug: logger.output };
            }

            // TODO [Forhad]: Need to check and validate input prompt token
            const { client } = await this.connectMCP(mcpUrl);

            const toolsData = await client.listTools();
            const conv = new Conversation(
                model,
                {
                    openapi: '3.0.1',
                    info: {
                        title: `${agent?.name}`,
                        version: `${agent?.version}`,
                        description: descForModel,
                    },
                    servers: [
                        {
                            url: agent?.domain,
                        },
                    ],
                    paths: {},
                },
                { agentId: agent?.id }
            );

            for (const tool of toolsData.tools) {
                let toolArgs = {};
                Object.entries(tool.inputSchema.properties).forEach(([propName, propDetails]) => {
                    toolArgs[propName] = {
                        description: '',
                        required: ((tool.inputSchema.required as string[]) || []).includes(propName) || false,
                        type: (propDetails as any).type,
                        ...((propDetails as any).type === 'array' ? { items: { type: 'string' } } : {}),
                    };
                });
                await conv.addTool({
                    name: tool.name,
                    description: tool.description,
                    arguments: toolArgs,
                    handler: async (input) => {
                        const result = await client.callTool({
                            name: tool.name,
                            arguments: input,
                        });
                        return result;
                    },
                });
            }
            const result = await conv.prompt(prompt);

            logger.debug(`Response:\n`, result, '\n');

            return { Output: result, _debug: logger.output };
        } catch (error: any) {
            return { _error: `Error on running MCP Client!\n${error?.message || JSON.stringify(error)}`, _debug: logger.output };
        }
    }
    private async connectMCP(mcpUrl: string) {
        const client = new Client({ name: 'auto-client', version: '1.0.0' });

        // 1) Try Streamable HTTP first
        try {
            const st = new StreamableHTTPClientTransport(new URL(mcpUrl));
            await client.connect(st);
            console.debug('Connected to MCP using Streamable HTTP');
            return { client, transport: 'streamable' as const };
        } catch (e: any) {
            console.debug('Failed to connect to MCP using Streamable HTTP, falling back to SSE');
            // 2) If clearly unsupported, fall back to SSE
            const msg = String(e?.message || e);
            const isUnsupported = /404|405|ENOTFOUND|ECONNREFUSED|CORS/i.test(msg);

            // 406 means wrong/missing Accept for Streamable → retry Streamable with proper header
            const isAcceptProblem = /406|Not Acceptable|text\/event-stream/i.test(msg);
            if (isAcceptProblem) {
                throw new Error('Server is Streamable; include Accept: application/json, text/event-stream');
            }

            if (!isUnsupported) throw e;

            // SSE fallback
            const sse = new SSEClientTransport(new URL(mcpUrl));
            await client.connect(sse);
            return { client, transport: 'sse' as const };
        }
    }
}
