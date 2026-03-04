import { Agent, Model, TLLMEvent } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

import { Component, HookService, LLMConnector, SRE, Agent as SREAgent, THook } from '@smythos/sdk/core';

SRE.init({
    //Telemetry Service configuration
    Telemetry: {
        Connector: 'OTel', //we use OTel (OpenTelemetry) connector
        Settings: {
            endpoint: 'http://localhost:4318',

            //Optional settings
            //serviceName: 'smythos',
            //serviceVersion: '1.0.0',
            // headers: {
            //     'Authorization': 'Bearer your-api-key',
            // }
        },
    },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function main() {
    //.smyth file path
    const agentPath = path.resolve(__dirname, '../agents-data', 'crypto-info-agent.smyth');

    //Importing the agent workflow
    const agent = Agent.import(agentPath, {
        model: Model.OpenAI('gpt-4o'),
    });

    const result = await agent.prompt('What are the current prices of Bitcoin and Ethereum ?');

    console.log(result);
}

// This function sets up the hooks
async function setupHooks() {
    HookService.register(
        'Component.process', //runs before the component execution
        async function (input, settings, agent) {
            const component: Component = this.instance as Component;
            console.log('>> Component.process', component.constructor.name, input);
        },
        THook.NonBlocking //make it non-blocking to avoid degrading performances
    );

    HookService.registerAfter(
        'Component.process', //runs after the component execution
        async function ({ result, args, error }) {
            const component: Component = this.instance as Component;
            console.log('<< Component.process', component.constructor.name, result);
        },
        THook.NonBlocking
    );

    HookService.register(
        'SREAgent.process', //runs before the agent execution
        async function (endpointPath, input) {
            const agent: SREAgent = this.instance as SREAgent;

            console.log('>> SREAgent.process', {
                name: agent.name,
                id: agent.id,
                teamId: agent.teamId,
                endpointPath,
                method: agent.agentRequest.method,
                body: agent.agentRequest.body,
                query: agent.agentRequest.query,
                input,
            });
        },
        THook.NonBlocking
    );
    HookService.registerAfter(
        'SREAgent.process', //runs after the agent execution
        async function ({ result, args, error }) {
            console.log('<< SREAgent.process', result);
        },
        THook.NonBlocking
    );

    HookService.register(
        'LLMConnector.streamRequest', //runs before the LLM connector request
        async function ({ body }) {
            const instance = this.instance as LLMConnector;
            const llmName = instance.name;
            console.log('>> LLMConnector.request', llmName);
        },
        THook.NonBlocking
    );
    HookService.registerAfter(
        'LLMConnector.streamRequest', //runs after the LLM connector request
        async function ({ result, args, error }) {
            const instance = this.instance as LLMConnector;
            const llmName = instance.name;
            console.log('<< LLMConnector.request', llmName);

            //for the LLMs, the resurned result is an event emitter that emits LLMs events (the same ones used by the SDK)
            result.on(TLLMEvent.Data, (data, reqInfo) => {
                console.dir(data, { depth: null });
            });
        },
        THook.NonBlocking
    );
}
setupHooks();
main();
