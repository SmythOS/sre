import { Agent, MCPTransport, Model, Scope, TLLMEvent } from '@smythos/sdk';
import { Component, HookService, THook, SRE, Agent as SREAgent } from '@smythos/sdk/core';
import path from 'path';
import { fileURLToPath } from 'url';

/*
 This example demonstrates how to use SmythOS hooks to monitor the agent workflow
 The hooks are a low level feature that allows you to bind custom logic to some internal functions of the SRE.
 /!\ Be careful when using them as they can alter the behavior of the SRE if not used correctly : do not alter the data that you capture in the hooks unless you know what you are doing.
 /!\ Hooks are meant to be mainly used for debugging and monitoring purposes.


 Note : This is an experimental feature, while we consider the interfaces as stable, we may change them if we find that they are not working as expected.

*/

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// This main function loads and run the agent
// the hooks can be set up completely separately, following SmythOS philosophy or non-interfering with the agent logic.
async function main() {
    //.smyth file path
    const agentPath = path.resolve(__dirname, '../agents-data', 'crypto-info-agent.smyth');

    //Importing the agent workflow
    const agent = Agent.import(agentPath, {
        model: Model.OpenAI('gpt-4o', { temperature: 1.0 }),
    });

    const result = await agent.prompt('What are the current prices of Bitcoin and Ethereum ?');

    console.log(result);
}

// This function sets up the hooks
async function setupHooks() {
    HookService.register(
        'Component.process', //runs before the component execution
        async function (input, settings, agent) {
            const component: Component = this as Component;
            console.log('>> Component.process', component.constructor.name, input);
        },
        THook.NonBlocking //make it non-blocking to avoid degrading performances
    );

    HookService.registerAfter(
        'Component.process', //runs after the component execution
        async function ({ result, args, error }) {
            const component: Component = this as Component;
            console.log('<< Component.process', component.constructor.name, result);
        },
        THook.NonBlocking
    );

    HookService.register(
        'SREAgent.process', //runs before the agent execution
        async function (endpointPath, input) {
            const agent: SREAgent = this as SREAgent;

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
            const llmName = this.name;
            console.log('>> LLMConnector.request', llmName);
        },
        THook.NonBlocking
    );
    HookService.registerAfter(
        'LLMConnector.streamRequest', //runs after the LLM connector request
        async function ({ result, args, error }) {
            const llmName = this.name;
            console.log('<< LLMConnector.request', llmName);

            //for the LLMs, the resurned result is an event emitter that emits LLMs events (the same ones used by the SDK)
            result.on(TLLMEvent.Data, (content) => {
                console.log('LLM data', content);
            });
        },
        THook.NonBlocking
    );
}

setupHooks();
main();
