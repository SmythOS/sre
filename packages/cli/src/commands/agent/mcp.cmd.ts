import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ConnectorService } from '@smythos/sre';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import fs from 'fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';
import { Agent } from '@smythos/sdk';
const clientTransports = new Map<string, { transport: SSEServerTransport; server: Server }>();
const defaultPort = 3388;
export const startMcpServer = async (agentData, serverType, port, flags): Promise<void> => {
    if (serverType.toLowerCase() === 'stdio') {
        await getMCPServer(agentData, serverType, null);
        return;
    }

    if (serverType.toLowerCase() === 'sse') {
        const app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.get('/mcp', async (req, res) => {
            await getMCPServer(agentData, serverType, res);
        });
        app.post('/message', async (req: any, res: any) => {
            const sessionId = req.query.sessionId;
            const transport = clientTransports.get(sessionId as string)?.transport;
            if (!transport) {
                return res.status(404).send({ error: 'Transport not found' });
            }
            await transport.handlePostMessage(req, res, req.body);
        });
        const mcpPort = port || defaultPort;
        app.listen(mcpPort, () => {
            console.log(`MCP Server running on http://localhost:${mcpPort}/mcp`);
        });
    }
};

const getMCPServer = async (agentSource, serverType: string, res: any) => {
    let agentData;
    if (typeof agentSource === 'string') {
        if (!fs.existsSync(agentSource)) {
            throw new Error(`File ${agentSource} does not exist`);
        }

        agentData = JSON.parse(fs.readFileSync(agentSource, 'utf8'));
    } else {
        agentData = agentSource;
    }

    const formattedAgentData = { data: agentData };
    const agentDataConnector = ConnectorService.getAgentDataConnector();
    const openAPISpec = await agentDataConnector.getOpenAPIJSON(formattedAgentData, 'http://localhost/', agentData.version, true).catch((error) => {
        console.error('Failed to get OpenAPI JSON:', error);
        return null;
    });
    const server = new Server(
        {
            name: openAPISpec.info.title,
            version: openAPISpec.info.version,
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    // Extract available endpoints and their methods
    const tools: Tool[] = Object.entries(openAPISpec.paths).map(([path, methods]) => {
        const method = Object.keys(methods)[0];
        const endpoint = path.split('/api/')[1];
        const operation = methods[method];
        const schema = extractMCPToolSchema(operation, method);

        const properties = schema?.properties || {};
        for (const property in properties) {
            const propertySchema = properties[property];

            if (propertySchema.type === 'array') {
                properties[property] = {
                    type: 'array',
                    items: {
                        type: ['string', 'number', 'boolean', 'object', 'array'],
                    },
                };
            }
        }

        return {
            name: endpoint,
            description:
                operation.summary || `Endpoint that handles ${method.toUpperCase()} requests to ${endpoint}. ` + `${schema?.description || ''}`,
            inputSchema: {
                type: 'object',
                properties: properties,
                required: schema?.required || [],
            },
        };
    });

    // Tool handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools,
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        try {
            const { name, arguments: args } = request.params;
            const agent = Agent.import(agentSource);

            const result = await agent.call(name, args);

            return {
                content: [{ type: 'text', text: JSON.stringify(result) }],
                isError: false,
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error processing request: ${error.message}` }],
                isError: true,
            };
        }
    });

    if (serverType === 'stdio') {
        const transport = new StdioServerTransport();
        await server.connect(transport);
    } else {
        const transport = new SSEServerTransport('/message', res);
        await server.connect(transport);
        clientTransports.set(transport.sessionId, { transport, server });
    }

    return server;
};

function extractMCPToolSchema(jsonSpec: any, method: string) {
    if (method.toLowerCase() === 'get') {
        const schema = jsonSpec?.parameters;
        if (!schema) return {};

        const properties = {};
        const required = [];

        schema.forEach((param) => {
            if (param.in === 'query') {
                properties[param.name] = param.schema;
                if (param.required) {
                    required.push(param.name);
                }
            }
        });

        return {
            type: 'object',
            properties,
            required,
        };
    }
    const schema = jsonSpec?.requestBody?.content?.['application/json']?.schema;
    return schema;
}
