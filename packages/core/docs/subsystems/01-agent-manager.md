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
