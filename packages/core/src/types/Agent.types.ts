import { AgentRequest } from '@sre/AgentManager/AgentRequest.class';
import { AgentRuntime } from '@sre/AgentManager/AgentRuntime.class';

import { AgentSSE } from '@sre/AgentManager/AgentSSE.class';
import { IModelsProviderRequest } from '@sre/LLMManager/ModelsProvider.service/ModelsProviderConnector';

export type TAgentProcessParams = {
    method: string;
    path: string;
    body?: Record<string, any>;
    query?: Record<string, any>;
    headers?: Record<string, string>;
    params?: any;
};

//TODO : refactor & document this interface
export interface IAgent {
    //if the agent was triggered from a conversation, this will be the conversation id
    conversationId: string;
    id: any;
    jobID: any; //forkedAgent
    async: boolean; //forkedAgent
    agentSettings: any;
    name: any;
    data: any;
    teamId: any;
    components: any;
    connections: any;
    endpoints: any;
    sessionId: any;
    sessionTag: any;
    callerSessionId: any;
    apiBasePath: any;
    triggerBasePath: any;
    agentRuntime: AgentRuntime | any;
    usingTestDomain: any;
    domain: any;
    debugSessionEnabled: any;
    circularLimit: any;
    version: any;
    agentVariables: any;
    kill: any;
    sse: AgentSSE;
    modelsProvider: IModelsProviderRequest;
    agentRequest: AgentRequest | any;
    callback: (data: any) => void;
    setRequest: (agentRequest: AgentRequest | any) => void;
    setCallback: (callback: (data: any) => void) => void;

    isKilled: () => boolean;

    process: (endpointPath: string, input: any) => Promise<any>;
    postProcess: (result: any) => Promise<any>;

    addSSE: (sseSource: Response | AgentSSE, monitorId?: string) => void;

    getConnectionSource: (connection: any) => any;
    getConnectionTarget: (connection: any) => any;
    findReadablePredecessors: (componentId: string) => any[];

    callComponent: (sourceId: string, componentId: string, input?: any) => Promise<any>;
    JSONExpression: (obj: any, propertyString: string) => any;
    callNextComponents: (componentId: string, output: any) => Promise<any>;
}
