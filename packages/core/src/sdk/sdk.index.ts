import { Conversation } from '@sre/helpers/Conversation.helper';
import { uid } from '../utils';
import { Component } from './components/components.index';
import { TSkillSettings } from './components/Skill';

export type AgentData = {
    id: string;
    version: string;
    name: string;
    behavior: string;
    components: any[];
    connections: any[];
    defaultModel: string;
};

export class ComponentWrapper {
    private _id: string;

    public get id() {
        return this._id;
    }
    public get agentMaker() {
        return this._agentMaker;
    }
    public set agentMaker(agentMaker: AgentMaker) {
        this._agentMaker = agentMaker;
    }

    public get data() {
        const data = {
            name: this._name,
            data: this._settings,
            displayName: this._name,
            title: this._name,
            id: this._id,
            left: '0px',
            top: '0px',
            inputs: Object.keys(this._inputs).map((key) => ({
                name: key,
                type: this._inputs[key].type || 'Any',
                description: this._inputs[key].description || undefined,
                optional: this._inputs[key].optional || false,
                default: this._inputs[key].default || undefined,
                //value: this._inputs[key],
            })),
            outputs: Object.keys(this._outputs).map((key) => ({
                name: key,
                ...(this._outputs[key]?.['__props__'] || {}),
            })),
        };
        return data;
    }
    private get _name() {
        return this.dataObject.name;
    }
    private get _settings() {
        return this.dataObject.settings;
    }
    private get _inputs() {
        return this.dataObject.inputs;
    }
    private get _outputs() {
        return this.dataObject.outputs;
    }

    constructor(
        private dataObject: any,
        private _agentMaker?: AgentMaker,
    ) {
        this._id = 'C' + uid();
    }

    public inputs<T extends Record<string, any>>(inputsList: T) {
        for (let key in inputsList) {
            // if (this._inputs[key]) {
            //     console.warn(`Input ${key} already exists, overriding`);
            // }

            const val = inputsList[key];

            //console.log('__root__', val?.__root__);
            //console.log('__path__', val?.__path__);

            const sourceData = val?.['__root__']?.data;
            const path = val?.['__path__'];
            const agentMaker = val?.['__root__']?.agentMaker;

            //console.log('Connecting input', key, 'to', rootData?.id, path);

            if (agentMaker) {
                if (!this.agentMaker) {
                    this.agentMaker = agentMaker;
                }
                const found = agentMaker?.structure?.components.find((c) => c.id == this._id);
                if (!found) {
                    agentMaker?.structure?.components?.push(this);
                }

                const sourceId = sourceData?.id;
                const targetId = this._id;

                if (sourceId && targetId) {
                    const sourceComponent = agentMaker?.structure?.components?.find((c) => c.id == sourceId);
                    const sourceOutput = sourceComponent?._outputs[path];
                    if (!sourceOutput) {
                        sourceComponent._outputs[path] = createSafeAccessor({}, sourceComponent, path);
                    }
                    const connection = {
                        sourceId,
                        targetId,
                        sourceIndex: path,
                        targetIndex: key,
                    };
                    agentMaker?.data?.connections?.push(connection);
                }
            }

            //console.log('connection', connection);

            (inputsList as any)[key] = {
                source: val,
            };
            const targetInput = this._inputs[key];
            if (!targetInput) {
                this._inputs[key] = {
                    source: val,
                    component: this,
                    type: 'Any',
                    default: false,
                };
            }

            //console.log('input', key, rootData);

            //this.dataObject.connections.push(connection);
        }
        return this;
    }
}

export function createSafeAccessor<T extends object>(base: T, root?: any, currentPath?: string, props?: Record<string, any>): T {
    return new Proxy(base, {
        get(target, prop: string) {
            // special properties, return their values
            if (prop === '__root__') {
                return root;
            }

            if (prop === '__path__') {
                return currentPath || '';
            }

            if (prop === '__props__') {
                return props || {};
            }

            //function properties
            if (typeof target[prop] === 'function') {
                return target[prop];
            }

            if (!(prop in target)) {
                // Build the new path by appending current property
                const newPath = currentPath ? `${currentPath}.${prop}` : prop;
                const obj = {};
                // return another Proxy to go deeper with the accumulated path
                return createSafeAccessor(obj, root, newPath);
            }
            return (target as any)[prop];
        },
    }) as T;
}

export interface LLMProviderMap {
    openai?: any;
    anthropic?: any;
    gemini?: any;
    deepseek?: any;
}

export class AgentMaker {
    public structure: AgentData = { version: '1.0.0', name: '', behavior: '', components: [], connections: [], defaultModel: '', id: '' };

    public get data() {
        //console.log(this.structure);
        return {
            ...this.structure,
            components: this.structure.components.map((c) => c.data),
            connections: this.structure.connections,
        };
    }
    public llm: LLMProviderMap = {
        openai: {},
        anthropic: {},
        gemini: {},
        deepseek: {},
    };

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

    async prompt(prompt: string) {
        const conversation = new Conversation(this.structure.defaultModel, this.data, {
            agentId: this.structure.id,
        });
        const result = await conversation.streamPrompt(prompt);

        return result;
    }
}
