import { Agent } from './Agent.class';
import { AgentRequest } from './AgentRequest.class';

import { Logger } from '@sre/helpers/Log.helper';
import { uid } from '@sre/utils';
const console = Logger('ForkedAgent');

/**
 * This class creates a forked agent from a parent agent branch, it allows running a sub-branch of the parent agent asynchrounously by providing a separate agent context
 * We use composition instead of inheritance to avoid circular dependencies between Agent and ForkedAgent
 */
export class ForkedAgent {
    public agent: Agent;
    public get agentRequest() {
        return this.agent.agentRequest;
    }
    public get components() {
        return this.agent.components;
    }
    public get agentRuntime() {
        return this.agent.agentRuntime;
    }
    public get jobID() {
        return this.agent.jobID;
    }
    constructor(
        private parent: Agent,
        componentId: string, //the component to fork from
    ) {
        const data: any = fork(this.parent.data, componentId);
        data.variables = JSON.parse(JSON.stringify(this.parent?.data?.variables || {})); //copy parent Agent variables to forked agent
        data.teamId = this.parent.teamId;
        //TODO : we need to create a default APIEndpoint bound to the root component if root component is not an APIEndpoint
        const content = { name: this.parent.name, data, teamId: this.parent.teamId, debugSessionEnabled: false, version: this.parent.version };

        const agentRequest = new AgentRequest(this.parent.agentRequest.req);
        agentRequest.headers = []; //clear all headers from parent agent to conflict with child agent

        this.agent = new Agent(this.parent.id, content, this.parent.agentSettings, agentRequest);
        const JobID = componentId + '-' + uid();
        this.agent.jobID = JobID;
        //since the jobID was updated we need to create a different runtime
        //FIXME : we need to find a way to avoid creating default runtime for forked agents, then replace it
        //this.agent.agentRuntime = new AgentRuntime(this.agent);

        //super(parent.id, content, agentRequest);
    }

    process(path: string, input: any) {
        return this.agent.process(path, input);
    }
}

// Helper function to clone a component and update its ID
function cloneComponent(component) {
    const newComponent = JSON.parse(JSON.stringify(component));
    newComponent.id = component.id;
    return newComponent;
}

// Helper function to recursively clone components and their connections
function cloneRecursively(componentData, currentID, newIDMap, clonedComponents, clonedConnections) {
    const componentToClone = componentData.components.find((c) => c.id === currentID);
    if (!componentToClone) {
        return;
    }

    const clonedComponent = cloneComponent(componentToClone);
    newIDMap[currentID] = clonedComponent.id; // Map old ID to new ID
    clonedComponents.push(clonedComponent);

    // Find all outgoing connections for the current component
    const outgoingConnections = componentData.connections.filter((conn) => conn.sourceId === currentID);
    outgoingConnections.forEach((conn) => {
        // Clone the connection and update the IDs
        const clonedConnection = JSON.parse(JSON.stringify(conn));
        clonedConnection.sourceId = clonedComponent.id;
        if (!newIDMap[conn.targetId]) {
            // Recursively clone the connected component if it hasn't been cloned yet
            cloneRecursively(componentData, conn.targetId, newIDMap, clonedComponents, clonedConnections);
        }
        clonedConnection.targetId = newIDMap[conn.targetId];
        clonedConnections.push(clonedConnection);
    });
}

function fork(componentData, componentID) {
    const clonedComponents: any[] = [];
    const clonedConnections: any[] = [];
    const newIDMap = {}; // Map to keep track of old to new ID mappings

    // Start the cloning process from the specified component ID
    cloneRecursively(componentData, componentID, newIDMap, clonedComponents, clonedConnections);

    const rootComponentData = clonedComponents.find((e) => e.id == componentID);
    if (rootComponentData) {
        if (rootComponentData.name !== 'APIEndpoint') {
            const APIEndpointData: any = {
                id: `${componentID}_ENDPOINT`,
                name: 'APIEndpoint',
                outputs: [
                    { name: 'headers', index: 0, default: true },
                    { name: 'body', index: 1, default: true },
                    { name: 'query', index: 2, default: true },
                ],
                inputs: [],
                data: { endpoint: componentID, description: '', method: 'POST' },
                displayName: 'APIEndpoint',
                title: 'APIEndpoint',
                description: '',
            };

            //APIEndpointData.inputs = JSON.parse(JSON.stringify(rootComponentData.inputs));
            clonedComponents.push(APIEndpointData);

            //find all previously connected forked inputs
            const incomingConnections = componentData.connections.filter((conn) => conn.targetId === componentID);
            // //deduplicate connections by targetId
            // const uniqueIncomingConnections = incomingConnections.filter(
            //     (conn, index, self) => index === self.findIndex((t) => t.targetId === conn.targetId && t.sourceIndex === conn.sourceIndex && t.targetIndex === conn.targetIndex),
            // );

            let i = 3;
            for (let con of incomingConnections) {
                const input = rootComponentData.inputs.find((e) => e.index == con.targetIndex);
                const epInput = JSON.parse(JSON.stringify(input));
                APIEndpointData.inputs.push(epInput);

                const epOutput = {
                    name: input.name,
                    expression: `body.${input.name}`,
                    optional: false,
                    index: i++,
                    default: false,
                };
                APIEndpointData.outputs.push(epOutput);

                clonedConnections.push({
                    sourceId: APIEndpointData.id,
                    targetId: rootComponentData.id,
                    sourceIndex: epOutput.index,
                    targetIndex: input.index,
                });
            }
        }
    }
    // Return the cloned sub-workflow
    return {
        components: clonedComponents,
        connections: clonedConnections,
    };
}
