import { Conversation } from '@sre/helpers/Conversation.helper';
import { uid } from '@sre/utils/general.utils';
import { Component } from './components/components.index';
import { TSkillSettings } from './components/Skill';
import EventEmitter from 'events';
import { ComponentWrapper } from './components/ComponentWrapper.class';
import * as acorn from 'acorn';
import { Chat } from './Chat.class';
import { TLLMConnectorParams, TLLMModel, TLLMProvider } from '@sre/types/LLM.types';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { LLM, LLMInstance, TLLMProviderInstances } from './LLM.class';
import { DEFAULT_TEAM_ID } from '@sre/types/ACL.types';

export type AgentData = {
    id: string;
    version: string;
    name: string;
    behavior: string;
    components: any[];
    connections: any[];
    defaultModel: string;
    teamId: string;
};

class AgentCommand {
    constructor(
        private prompt: string,
        private agent: Agent,
    ) {}

    then(resolve: (value: string) => void, reject?: (reason: any) => void) {
        return this.run().then(resolve, reject);
    }

    async run(): Promise<string> {
        console.log('run', this.agent.data);
        const filteredAgentData = {
            ...this.agent.data,
            components: this.agent.data.components.filter((c) => !c.process),
        };
        const conversation = new Conversation(this.agent.data.defaultModel, filteredAgentData, {
            agentId: this.agent.data.id,
        });

        // Register process skills as custom tools
        await this.registerProcessSkills(conversation);

        const result = await conversation.streamPrompt(this.prompt);
        return result;
    }

    private async registerProcessSkills(conversation: Conversation) {
        // Find all skills with process functions and register them as tools
        const processSkills = this.agent.structure.components.filter((c: ComponentWrapper) => c.internalData.process);

        for (const skill of processSkills) {
            //transforming a process function to a conversation tool
            //TODO : move this logic to the Conversation manager
            const process = skill.internalData.process;
            const openApiArgs = extractArgsAsOpenAPI(process);
            const _arguments = {};
            for (let arg of openApiArgs) {
                _arguments[arg.name] = arg.schema;
            }

            const handler = async (argsObj) => {
                const args = Object.values(argsObj);
                const result = await process(...args);
                return result;
            };
            await conversation.addTool({
                name: skill.data.data.endpoint,
                description: skill.data.data.description,
                arguments: _arguments,
                handler,
            });
        }
    }

    async stream(): Promise<EventEmitter> {
        const conversation = new Conversation(this.agent.data.defaultModel, this.agent.data, {
            agentId: this.agent.data.id,
        });
        conversation.streamPrompt(this.prompt);

        return conversation;
    }

    // Future extensibility:
    // async batch(): Promise<string[]>
    // temperature(temp: number): PromptBuilder : override the modelParams
    // maxTokens(maxTokens: number): PromptBuilder : override the modelParams
    // ...
    // params(...): PromptBuilder : override the modelParams
}

export class Agent {
    public structure: AgentData = {
        version: '1.0.0',
        name: '',
        behavior: '',
        components: [],
        connections: [],
        defaultModel: '',
        id: '',
        teamId: DEFAULT_TEAM_ID,
    };

    public get data(): AgentData {
        //console.log(this.structure);
        return {
            ...this.structure,
            components: this.structure.components.map((c) => c.data),
            connections: this.structure.connections,
        };
    }

    private _llmProviders: TLLMProviderInstances;
    public get llm() {
        if (!this._llmProviders) {
            for (const provider of Object.values(TLLMProvider)) {
                this._llmProviders[provider] = (modelParams: TLLMConnectorParams) =>
                    new LLMInstance(provider, modelParams, AccessCandidate.agent(this.structure.id));
            }
        }
        return this._llmProviders;
    }

    constructor({ name, model, behavior }: { name: string; model: string | TLLMModel; behavior?: string }) {
        this.structure.name = name;
        this.structure.defaultModel = model as string;
        this.structure.behavior = behavior || '';
        this.structure.id = uid() + '_' + uid();
    }

    addSkill(settings?: TSkillSettings) {
        const component = Component.Skill(settings, this);

        return component;
    }

    public prompt(prompt: string): AgentCommand {
        return new AgentCommand(prompt, this);
    }

    public chat() {
        return new Chat(this.structure.defaultModel, this.data, {
            agentId: this.structure.id,
        });
    }
}

function extractArgsAsOpenAPI(fn) {
    const ast = acorn.parse(`(${fn.toString()})`, { ecmaVersion: 'latest' });
    const params = (ast.body[0] as any).expression.params;

    let counter = 0;
    function handleParam(param) {
        if (param.type === 'Identifier') {
            return {
                name: param.name,
                in: 'query',
                required: true,
                schema: { type: 'string' },
            };
        }

        if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
            return {
                name: param.left.name,
                in: 'query',
                required: false,
                schema: { type: 'string' },
            };
        }

        if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
            return {
                name: param.argument.name,
                in: 'query',
                required: false,
                schema: { type: 'array', items: { type: 'string' } },
            };
        }

        if (param.type === 'ObjectPattern') {
            // For destructured objects, output as a single parameter with nested fields
            return {
                name: `[object_${counter++}]`,
                in: 'query',
                required: true,
                schema: {
                    type: 'object',
                    properties: Object.fromEntries(
                        param.properties.map((prop) => {
                            const keyName = prop.key.name || '[unknown]';
                            return [keyName, { type: 'string' }]; // default to string
                        }),
                    ),
                },
            };
        }

        return {
            name: `[unknown_${counter++}]`,
            in: 'query',
            required: true,
            schema: { type: 'string' },
        };
    }

    return params.map(handleParam);
}
