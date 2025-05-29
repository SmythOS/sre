import { Conversation } from '@sre/helpers/Conversation.helper';
import { uid } from '@sre/utils/general.utils';
import { Component } from './components/components.index';
import { TSkillSettings } from './components/Skill';
import EventEmitter from 'events';
export type AgentData = {
    id: string;
    version: string;
    name: string;
    behavior: string;
    components: any[];
    connections: any[];
    defaultModel: string;
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
        const conversation = new Conversation(this.agent.data.defaultModel, this.agent.data, {
            agentId: this.agent.data.id,
        });
        const result = await conversation.streamPrompt(this.prompt);

        return result;
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
    public structure: AgentData = { version: '1.0.0', name: '', behavior: '', components: [], connections: [], defaultModel: '', id: '' };

    public get data(): AgentData {
        //console.log(this.structure);
        return {
            ...this.structure,
            components: this.structure.components.map((c) => c.data),
            connections: this.structure.connections,
        };
    }

    constructor({ name, model, behavior }: { name: string; model: string; behavior?: string }) {
        this.structure.name = name;
        this.structure.defaultModel = model;
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
}
