---
title: 'subsystems/Agent Manager'
---

# Agent Manager Subsystem

The Agent Manager is the heart of agent execution within the SRE. It is responsible for the entire agent lifecycle, from loading and configuration to execution and monitoring. This subsystem brings together all other SRE services to provide the environment where agents live and operate.

## Key Responsibilities

### Agent Lifecycle Management

The Agent Manager handles the primary lifecycle states of an agent:

-   **Loading**: Reading an agent's definition (often from a `.smyth` file or a programmatic configuration) and preparing it for execution.
-   **Execution**: Running the agent's workflow. This involves creating a `RuntimeContext` and processing the agent's component graph. The Agent Manager steps through the components, resolves their inputs, executes their logic, and passes their outputs to the next components in the flow.
-   **Pausing/Resuming/Stopping**: Managing the agent's execution state.

### Component Workflow Orchestration

An agent's behavior is defined by a workflow of connected **Components**. The Agent Manager is the orchestrator for this workflow. It:

1.  Parses the component graph.
2.  Resolves the data dependencies between components.
3.  Executes components in the correct order.
4.  Manages the flow of data from one component's output to another's input.

### Real-time Monitoring

The Agent Manager provides hooks for real-time monitoring of an agent's execution. It emits events for various lifecycle stages and component executions, which can be streamed to a client via Server-Sent Events (SSE) for live feedback and debugging.

## Services

### Scheduler Service

The Scheduler Service provides cron-like scheduling capabilities for agents. It allows agents to schedule tasks (jobs) to run at specific intervals or times.

-   **Interface**: `ISchedulerRequest`
-   **Service Access**: `ConnectorService.getSchedulerConnector()`
-   **Default Implementation**: `LocalScheduler`

#### Job Types

1.  **Skill Execution**: Run a specific skill of an agent.
2.  **Trigger Execution**: Invoke a named trigger on an agent.
3.  **Prompt Execution**: Send a natural language prompt to an agent.

### AgentData Service

The AgentData Service is responsible for retrieving agent definitions, configuration, and metadata. It acts as the repository interface for agent blueprints.

-   **Interface**: `IAgentDataConnector`
-   **Service Access**: `ConnectorService.getAgentDataConnector()`

#### Key Methods

-   `getAgentData(agentId)`: Retrieve the full agent definition (components, connections, settings).
-   `getOpenAPIJSON(agentId)`: Generate an OpenAPI specification for the agent's exposed skills/endpoints.
-   `setEphemeralAgentData(agentId, data)`: Store temporary agent definitions (used by SDK for non-persisted agents).
