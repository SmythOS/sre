# Agent Modes

Agent modes are pluggable execution strategies that augment how an agent processes and responds to tasks. Each mode adds specialized capabilities through additional behavior (system prompt) instructions and hidden skills, all managed transparently by the SDK.

## Available Modes

| Mode | Enum Value | Description |
|------|-----------|-------------|
| **Default** | `TAgentMode.DEFAULT` | No extra capabilities. The agent uses only the skills and behavior you provide. |
| **Planner** | `TAgentMode.PLANNER` | Adds systematic planning, task tracking, and progress reporting. |
| **Worker** | `TAgentMode.WORKER` | Adds background task delegation to "copy" agents while the main agent stays interactive. |

## Setting a Mode

### Single Mode

```typescript
import { Agent, TAgentMode } from '@smythos/sdk';

const agent = new Agent({
    name: 'Research Assistant',
    model: 'gpt-4o',
    behavior: 'You are a helpful research assistant.',
    mode: TAgentMode.PLANNER,
});
```

### Combining Multiple Modes

Modes can be combined using an array. Each mode's capabilities are layered on top of each other:

```typescript
const agent = new Agent({
    name: 'Research Assistant',
    model: 'gpt-4o',
    behavior: 'You are a helpful research assistant.',
    mode: [TAgentMode.PLANNER, TAgentMode.WORKER],
});
```

When combining Planner and Worker modes, the agent will plan complex tasks into steps (Planner) and dispatch heavy subtasks to background workers (Worker).

## How Modes Work Under the Hood

When a mode is applied to an agent, two things happen:

1. **Behavior (system prompt) extension**: The mode appends instructions to the agent's `behavior`, telling the LLM how to use the mode's capabilities.
2. **Hidden skills**: The mode registers internal skills (prefixed with `_sre_`) that the LLM can call. These skills are not visible to end users but power the mode's functionality.

All mode-managed skills are automatically filtered out when creating copy agents (Worker mode) or exporting agent configurations.

## Default Mode

The default mode gives you full control over the agent's behavior. The agent relies only on the skills and behavior you provide:

```typescript
const agent = new Agent({
    name: 'My Agent',
    behavior: 'You are a helpful assistant',
    model: 'gpt-4o',
    // mode: TAgentMode.DEFAULT  // This is the default, no need to specify
});
```

## Planner Mode

When enabled, the agent gains systematic planning capabilities. It breaks complex tasks into steps, tracks progress, and reports status to the user.

For full details, see [Planner Mode](03-planner-mode.md).

### Quick Example

```typescript
import { Agent, TAgentMode } from '@smythos/sdk';

const agent = new Agent({
    name: 'Code Assistant',
    behavior: 'You are a code assistant...',
    model: 'gpt-4o',
    mode: TAgentMode.PLANNER,
});

agent.on('TasksAdded', (tasksList, tasks) => {
    console.log('Plan created:', tasks);
});

agent.on('TasksUpdated', (taskId, status, tasks) => {
    console.log(`Task ${taskId}: ${status}`);
});

agent.on('TasksCompleted', (tasks) => {
    console.log('All tasks completed!');
});
```

## Worker Mode

When enabled, the agent can dispatch complex tasks to background "copy" agents. The main agent stays interactive while workers process tasks asynchronously. Results and follow-up questions are automatically surfaced back to the user.

For full details, see [Worker Mode](04-worker-mode.md).

### Quick Example

```typescript
import { Agent, TAgentMode } from '@smythos/sdk';

const agent = new Agent({
    name: 'Research Assistant',
    behavior: 'You are a research assistant...',
    model: 'gpt-4o',
    mode: TAgentMode.WORKER,
});

agent.on('WorkerDispatched', ({ jobId, task }) => {
    console.log(`Task dispatched: ${jobId}`);
});

agent.on('WorkerCompleted', ({ jobId, result }) => {
    console.log(`Task completed: ${jobId}`);
});
```

## Removing Modes at Runtime

Modes can be removed dynamically:

```typescript
agent.removeMode(TAgentMode.PLANNER);
```

This removes the mode's behavior (system prompt) and unregisters all its hidden skills.

## Next Steps

-   [Planner Mode](03-planner-mode.md) - Deep dive into planning and task tracking
-   [Worker Mode](04-worker-mode.md) - Deep dive into background task delegation
-   [Streaming Responses](../03-streaming.md) - Real-time output from agents
-   [Chat](../04-chat.md) - Maintaining conversations with context
