import { A2AExpressApp, AgentExecutor, DefaultRequestHandler, InMemoryTaskStore, TaskStore } from '@a2a-js/sdk/server';
import { Agent } from '../Agent/Agent.class';
import express from 'express';
import { SmythosAgentExecutor } from './Executor.class';
import { executeRemoteA2AClientRequest, generateAgentCard } from './helpers/a2a.helper';
import { A2AClient } from '@a2a-js/sdk/client';

export type A2ASettings = {
    port?: number;
};

const DEFAULT_A2A_PORT = 41241;

export class A2A {
    private _app: express.Application;
    private _port: number;
    private _clients: string[];
    private _agent: Agent;
    constructor(private agent: Agent, port: number = DEFAULT_A2A_PORT, clients: string[] = []) {
        this._port = port;
        this._clients = clients;
        this._agent = agent;
    }

    public async start(): Promise<void> {
        if (this._clients.length > 0) {
            await this.addA2AClientsSkills();
        }
        await this.startA2AServer();
        console.log('A2A server started');
        return;
    }

    private async startA2AServer(): Promise<string> {
        const smythosAgentCard = await generateAgentCard(this._agent, this._port || DEFAULT_A2A_PORT);

        this._app = express();
        this._app.use(express.json());
        this._app.use(express.urlencoded({ extended: true }));
        const taskStore: TaskStore = new InMemoryTaskStore();
        const agentExecutor: AgentExecutor = new SmythosAgentExecutor(this._agent);

        const requestHandler = new DefaultRequestHandler(
            smythosAgentCard,
            taskStore,
            agentExecutor
        );

        const appBuilder = new A2AExpressApp(requestHandler);
        const expressApp = appBuilder.setupRoutes(express(), "");

        expressApp.listen(this._port, () => {
            console.log(
                `[MyAgent] Server using new framework started on http://localhost:${this._port}`
            );
            console.log(
                `[MyAgent] Agent Card: http://localhost:${this._port}/.well-known/agent.json`
            );
            console.log("[MyAgent] Press Ctrl+C to stop the server");
        });
        return 'stdio';
    }

    private async addA2AClientsSkills() {
        const clients = this._clients;
        for (const client of clients) {
            const a2aClient = new A2AClient(client);
            const agentCard = await a2aClient.getAgentCard();
            const skill = this._agent.addSkill({
                name: agentCard.name,
                description: agentCard.description,
                process: async ({ prompt }) => {
                    const response = await executeRemoteA2AClientRequest(a2aClient, prompt);
                    return response;
                }
            });

            skill.in({
                prompt: {
                    type: 'Text',
                    description: 'The prompt to send to the remote agent'
                }
            })
        }
    }
}