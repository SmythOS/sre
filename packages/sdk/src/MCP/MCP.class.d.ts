import { Agent } from '../Agent/Agent.class';
export declare enum MCPTransport {
    STDIO = "stdio",
    SSE = "sse"
}
export type MCPSettings = {
    transport: MCPTransport;
    port?: number;
};
/**
 * MCP (Model Context Protocol) server
 *
 * The MCP server is a server that can be used to interact with the agent
 *
 * The MCP server can be started in two ways:
 * - STDIO: The MCP server will be started in STDIO mode
 * - SSE: The MCP server will be started in SSE mode, this is case the listening url will be **http://localhost:<port>/mcp**
 *
 *
 */
export declare class MCP {
    private agent;
    private clientTransports;
    private _app;
    private _port;
    private _server;
    constructor(agent: Agent);
    start(settings: MCPSettings): Promise<string>;
    startStdioServer(): Promise<string>;
    starSSEpServer(port: any): Promise<string>;
    private getMCPServer;
    /**
     * Stop the MCP server
     *
     * @example
     * ```typescript
     * const mcp = agent.mcp(MCPTransport.SSE, 3389);
     * mcp.stop();
     * ```
     */
    stop(): void;
    private extractMCPToolSchema;
}
