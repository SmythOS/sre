import { Task, TaskStatusUpdateEvent } from "@a2a-js/sdk";
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
} from "@a2a-js/sdk/server";
import { v4 as uuidv4 } from "uuid";
import { Agent } from "../Agent/Agent.class";
import { prepareConversation } from "../LLM/Chat.class";

export class SmythosAgentExecutor implements AgentExecutor {
  private agent: Agent;

  constructor(agent: Agent) {
    this.agent = agent;
  }
  private cancelledTasks = new Set<string>();

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
  };

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;

    const taskId = requestContext.taskId;
    const contextId = requestContext.contextId;

    console.log(
      `[MyAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

    if (!existingTask) {
      const initialTask: Task = {
        kind: "task",
        id: taskId,
        contextId: contextId,
        status: {
          state: "submitted",
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata,
        artifacts: [],
      };
      eventBus.publish(initialTask);
    }

    const workingStatusUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "working",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: "Processing agent request..." }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    await this.agent.ready;

    const conversation = await prepareConversation(this.agent.data);

    const result = await conversation
      .streamPrompt({ message: userMessage.parts[0].kind === 'text' ? userMessage.parts[0].text : '' })
      .catch((error) => {
        console.error('Error on streamPrompt: ', error);
        return { error };
      });

    if (this.cancelledTasks.has(taskId)) {
      console.log(`[MyAgentExecutor] Request cancelled for task: ${taskId}`);
      const cancelledUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "canceled",
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(cancelledUpdate);
      eventBus.finished();
      return;
    }

    const finalStatusUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "completed",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: typeof result === 'object' ? JSON.stringify(result) : result }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(finalStatusUpdate);
    eventBus.finished();
  }
}