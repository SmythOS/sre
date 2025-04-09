import Agent from './Agent.class';

export class AgentSSE {
    private connections: Map<string, any> = new Map();

    /**
     * Creates a new AgentSSE instance
     * @param agent - The agent instance this SSE belongs to
     */
    constructor(private agent: Agent) {}

    /**
     * Updates or adds a response object with the given monitor ID
     * Maintains backward compatibility by also setting the res property
     * @param res - The response object to add or update
     * @param monitorId - The monitor ID associated with this connection
     * @returns The connection ID that was created or updated
     */
    public add(res: any, monitorId: string) {
        // Store the connection
        this.connections.set(monitorId, res);
    }

    public [Symbol.iterator](): IterableIterator<[string, any]> {
        return this.connections.entries();
    }

    /**
     * Sends an event to all connected clients
     * @param _type - The event type
     * @param _data - The event data
     */
    public async send(_type: string, _data: any): Promise<void> {
        if (!_type || !_data) return;

        // Format the data once
        const data = typeof _data === 'string' ? _data : JSON.stringify(_data);
        const message = `event: ${_type}\ndata: ${data}\n\n`;

        // Send to all connections
        for (const [id, connection] of this.connections.entries()) {
            try {
                if (connection && !connection.finished) {
                    connection.write(message);
                } else {
                    // Remove closed connections
                    this.connections.delete(id);
                }
            } catch (error) {
                // Handle errors (connection might be closed)
                console.error(`Error sending SSE to connection ${id}:`, error);
                this.connections.delete(id);
            }
        }
    }

    /**
     * Removes a specific connection
     * @param connectionId - The ID of the connection to remove
     * @returns True if the connection was found and removed, false otherwise
     */
    public remove(connectionId: string): boolean {
        const connection = this.connections.get(connectionId);
        if (connection) {
            try {
                if (connection && !connection.finished) {
                    connection.end();
                }
            } catch (error) {
                console.error(`Error closing connection ${connectionId}:`, error);
            }
            return this.connections.delete(connectionId);
        }
        return false;
    }

    /**
     * Closes all connections
     */
    public async close(): Promise<void> {
        for (const [id, connection] of this.connections.entries()) {
            try {
                if (connection && !connection.finished) {
                    connection.end();
                    console.log('Delibertly shutting down sse connection with id: ', id);
                }
            } catch (error) {
                console.error(`Error closing connection ${id}:`, error);
            }
        }
        this.connections.clear();
    }

    /**
     * Gets the number of active connections
     * @returns The number of active connections
     */
    public getConnectionCount(): number {
        return this.connections.size;
    }
}

export default AgentSSE;
