import { AgentCard, GetTaskResponse, SendMessageSuccessResponse, TaskQueryParams, GetTaskSuccessResponse, MessageSendParams, Message, Task, SendMessageResponse } from "@a2a-js/sdk";
import { Agent } from "../../Agent/Agent.class";
import fs from 'fs';
import { ConnectorService } from "@smythos/sre";
import { A2AClient } from "@a2a-js/sdk/client";
import { v4 as uuidv4 } from 'uuid';

export async function generateAgentCard(agent: Agent, port: number): Promise<AgentCard> {
    let agentData;
    const agentSource = agent.data;
    if (typeof agentSource === 'string') {
        if (!fs.existsSync(agentSource)) {
            throw new Error(`File ${agentSource} does not exist`);
        }
        agentData = JSON.parse(fs.readFileSync(agentSource, 'utf8'));
    } else {
        agentData = agentSource;
    }
    const formattedAgentData = { data: agentData };
    const agentDataConnector = ConnectorService.getAgentDataConnector();
    const openAPISpec = await agentDataConnector
        .getOpenAPIJSON(formattedAgentData, 'http://localhost/', agentData.version, true)
        .catch((error) => {
            console.error('Failed to get OpenAPI JSON:', error);
            return null;
        });

    const skills = Object.entries(openAPISpec.paths).map(([path, methods]) => {
        const method = Object.keys(methods)[0];
        const endpoint = path.split('/api/')[1];
        const operation = methods[method];
        return {
            id: endpoint,
            name: endpoint,
            description:
                operation.summary || `Endpoint that handles ${method.toUpperCase()} requests to ${endpoint}. `,
            inputModes: ["text/plain"],
            outputModes: ["text/plain"],
            tags: [endpoint],
        };
    });
    const agentCard: AgentCard = {
        name: agent.data.name,
        description: agent.data.behavior,
        url: `http://localhost:${port}`,
        provider: {
            organization: "SmythOS AI",
            url: "https://smythos.com",
        },
        version: "0.0.1",
        capabilities: {
        },
        securitySchemes: undefined,
        security: undefined,
        defaultInputModes: ["text/plain"],
        defaultOutputModes: ["text/plain"],
        skills: skills,
        supportsAuthenticatedExtendedCard: false,
    };

    return agentCard;
}

export async function executeRemoteA2AClientRequest(client: A2AClient, prompt: string) {
    const messageId = uuidv4();
    let taskId: string | undefined;
  
    try {
      const sendParams: MessageSendParams = {
        message: {
          messageId: messageId,
          role: "user",
          parts: [{ kind: "text", text: prompt }],
          kind: "message",
        },
        configuration: {
          blocking: true,
          acceptedOutputModes: ["text/plain"],
        },
      };
      const sendResponse: SendMessageResponse =
      await client.sendMessage(sendParams);

    const result = (sendResponse as SendMessageSuccessResponse).result;

    if (result.kind === "task") {
      const taskResult = result as Task;
      taskId = taskResult.id;
    } else if (result.kind === "message") {
      const messageResult = result as Message;
      return messageResult;
    }

    if (taskId) {
      const getParams: TaskQueryParams = { id: taskId };
      const getResponse: GetTaskResponse = await client.getTask(getParams);

      const getTaskResult = (getResponse as GetTaskSuccessResponse).result;
      return getTaskResult;
    }
  } catch (error) {
    console.error("A2A Client Communication Error:", error);
  }
}
