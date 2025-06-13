// import express from 'express';
// import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
// import { ConnectorService, AgentProcess } from '@smythos/sre';
// import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';
// const clientTransports = new Map<string, { transport: SSEServerTransport; server: Server }>();
// const defaultPort = 3388;
// export const startMcpServer = async (agentData, processArgs): Promise<void> => {
//     const { serverType, port } = parseMcpOptions(processArgs);
//     if (serverType === 'stdio') {
//         await getMCPServer(agentData, serverType, null);
//     } else {
//         const app = express();
//         app.use(express.json());
//         app.use(express.urlencoded({ extended: true }));
//         app.get('/mcp', async (req, res) => {
//             await getMCPServer(agentData, serverType, res);
//         });
//         app.post('/message', async (req: any, res: any) => {
//             const sessionId = req.query.sessionId;
//             const transport = clientTransports.get(sessionId as string)?.transport;
//             if (!transport) {
//                 return res.status(404).send({ error: 'Transport not found' });
//             }
//             await transport.handlePostMessage(req, res, req.body);
//         });
//         const mcpPort = port || defaultPort;
//         app.listen(mcpPort, () => {
//             console.log(`MCP Server running on port ${mcpPort}`);
//         });
//     }
// };

// const getMCPServer = async (agentData, serverType: string, res: any) => {
//     const formattedAgentData = { data: agentData };
//     const agentDataConnector = ConnectorService.getAgentDataConnector();
//     const openAPISpec = await agentDataConnector.getOpenAPIJSON(formattedAgentData, 'http://localhost/', agentData.version, true).catch((error) => {
//         console.error('Failed to get OpenAPI JSON:', error);
//         return null;
//     });
//     const server = new Server(
//         {
//             name: openAPISpec.info.title,
//             version: openAPISpec.info.version,
//         },
//         {
//             capabilities: {
//                 tools: {},
//             },
//         }
//     );

//     // Extract available endpoints and their methods
//     const tools: Tool[] = Object.entries(openAPISpec.paths).map(([path, methods]) => {
//         const method = Object.keys(methods)[0];
//         const endpoint = path.split('/api/')[1];
//         const operation = methods[method];
//         const schema = operation.requestBody?.content?.['application/json']?.schema;

//         const properties = schema?.properties || {};
//         for (const property in properties) {
//             const propertySchema = properties[property];

//             if (propertySchema.type === 'array') {
//                 properties[property] = {
//                     type: 'array',
//                     items: {
//                         type: ['string', 'number', 'boolean', 'object', 'array'],
//                     },
//                 };
//             }
//         }

//         return {
//             name: endpoint,
//             description:
//                 operation.summary || `Endpoint that handles ${method.toUpperCase()} requests to ${endpoint}. ` + `${schema?.description || ''}`,
//             inputSchema: {
//                 type: 'object',
//                 properties: properties,
//                 required: schema?.required || [],
//             },
//         };
//     });

//     // Tool handlers
//     server.setRequestHandler(ListToolsRequestSchema, async () => ({
//         tools,
//     }));

//     server.setRequestHandler(CallToolRequestSchema, async (request) => {
//         try {
//             const { name, arguments: args } = request.params;

//             if (!args) {
//                 throw new Error('No arguments provided');
//             }

//             // Find the matching tool from our tools array
//             const tool = tools.find((t) => t.name === name);
//             if (!tool) {
//                 return {
//                     content: [{ type: 'text', text: `Unknown tool: ${name}` }],
//                     isError: true,
//                 };
//             }

//             try {
//                 // Extract method and path from OpenAPI spec
//                 const pathEntry = Object.entries(openAPISpec.paths).find(([path]) => path.split('/api/')[1] === name);
//                 if (!pathEntry) {
//                     throw new Error(`Could not find path for tool: ${name}`);
//                 }

//                 const [path, methods] = pathEntry;
//                 const method = Object.keys(methods)[0];
//                 // Process the request through the agent
//                 // Format the path to ensure it starts with /api
//                 // #TODO: This is the temporary fix for the path issue, we need to fix it from smyth-runtime
//                 let formattedPath = path;

//                 // Check if path starts with /api
//                 if (!path.startsWith('/api')) {
//                     // If path starts with a version (v1.0.0/api/...), extract the /api part
//                     const versionMatch = path.match(/^\/v[0-9]+(\.[0-9]+)*\/api\/(.*)/);
//                     if (versionMatch) {
//                         formattedPath = `/api/${versionMatch[2]}`;
//                     }
//                 }
//                 const result = await AgentProcess.load(agentData).run({
//                     method: method,
//                     path: formattedPath,
//                     body: args,
//                 });

//                 return {
//                     content: [{ type: 'text', text: JSON.stringify(result) }],
//                     isError: false,
//                 };
//             } catch (error) {
//                 return {
//                     content: [{ type: 'text', text: `Error processing request: ${error.message}` }],
//                     isError: true,
//                 };
//             }
//         } catch (error) {
//             return {
//                 content: [
//                     {
//                         type: 'text',
//                         text: `Error: ${error instanceof Error ? error.message : String(error)}`,
//                     },
//                 ],
//                 isError: true,
//             };
//         }
//     });

//     if (serverType === 'stdio') {
//         const transport = new StdioServerTransport();
//         await server.connect(transport);
//     } else {
//         const transport = new SSEServerTransport('/message', res);
//         await server.connect(transport);
//         clientTransports.set(transport.sessionId, { transport, server });
//     }

//     return server;
// };

// function parseMcpOptions(argv: string[]): { serverType: string | undefined; port: number | undefined } {
//     const mcpIndex = argv.findIndex((arg) => arg === '--mcp');
//     if (mcpIndex === -1) {
//         return { serverType: undefined, port: undefined };
//     }

//     // Check if there's a value after --mcp
//     const nextArg = argv[mcpIndex + 1];
//     if (!nextArg || nextArg.startsWith('--')) {
//         return { serverType: 'stdio', port: undefined };
//     }

//     // Parse server type and port
//     const parts = nextArg.split(':');
//     const serverType = parts[0];
//     const port = parts[1] ? parseInt(parts[1], 10) : undefined;

//     return { serverType, port };
// }
