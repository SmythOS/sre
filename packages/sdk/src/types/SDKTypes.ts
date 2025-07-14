import { ILLMContextStore, TLLMModel } from '@smythos/sre';
import { ComponentWrapper } from '../Components/ComponentWrapper.class';

export type InputSettings = {
    type?: 'Text' | 'Number' | 'Boolean' | 'Object' | 'Array' | 'Any' | 'Binary';
    description?: string;
    optional?: boolean;
    default?: boolean;
};

export type AgentData = {
    id: string;
    teamId: string;
    name: string;
    behavior: string;
    components: any[];
    connections: any[];
    defaultModel: string | TLLMModel;
};

export type ChatOptions = {
    /**
     * The ID of the chat. If not provided, a random ID will be generated.
     *
     * If provided, it will be used to identify the chat in the storage provider and try to load the previous messages from the storage provider
     * if the chat is not found, a new chat will be created
     */
    id?: string;
    /**
     * If true, the chat will be persisted in the default SRE storage provider :
     * next time you create a chat with the same chat ID and same agent ID, it will load the previous messages from the storage provider
     *
     * If false, the chat will not be persisted
     *
     * If a ILLMContextStore is provided, the chat will be persisted in the provided store
     *
     *
     */
    persist?: boolean | ILLMContextStore;
};

export enum Scope {
    AGENT = 'agent',
    TEAM = 'team',
}
export type ComponentInput = { source?: any; component?: ComponentWrapper } & InputSettings;
