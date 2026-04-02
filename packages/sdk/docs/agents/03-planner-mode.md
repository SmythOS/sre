# Planner Mode

Planner mode gives an agent systematic planning capabilities. When the agent receives a complex or multi-step task, it will create a structured plan, track each step's progress, and verify completion before finishing.

This mode is ideal for tasks that require methodical execution: code generation with multiple files, research with several phases, or any workflow where step-by-step transparency matters.

See the [Planner Mode Example](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill/04.1-chat-planner-coder.ts) for a complete, runnable implementation.

## Enabling Planner Mode

```typescript
import { Agent, TAgentMode } from '@smythos/sdk';

const agent = new Agent({
    name: 'Code Assistant',
    behavior: 'You are a senior developer who writes clean, well-tested code.',
    model: 'gpt-4o',
    mode: TAgentMode.PLANNER,
});
```

## How It Works

When a user sends a complex request, the agent will:

1. **Analyze** the request and reason about the approach (in `<thinking>` tags)
2. **Plan** the steps needed (in `<planning>` tags)
3. **Register** the plan as tracked tasks via the internal `_sre_Plan_Tasks` skill
4. **Execute** each step sequentially, updating task status along the way
5. **Verify** that all tasks are completed before finishing

The agent communicates its reasoning transparently using `<thinking>` tags, and uses `<planning>` tags to outline its approach. These tags allow the LLM to separate internal reasoning from user-facing output.

## Events

Planner mode emits events on the `agent` object so you can build UIs that reflect the agent's progress in real time.

### TasksAdded

Fired when the agent creates a new plan.

```typescript
agent.on('TasksAdded', (tasksList, allTasks) => {
    // tasksList: the newly added tasks
    // allTasks: all tasks in the planner (cumulative)
    for (const [id, task] of Object.entries(allTasks)) {
        console.log(`${task.status}: ${task.summary || task.description}`);
    }
});
```

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tasksList` | `object` | The tasks that were just added |
| `allTasks` | `object` | All tasks in the planner |

Each task object has the shape: `{ description: string, summary: string, status: 'planned' | 'ongoing' | 'completed' }`

### SubTasksAdded

Fired when the agent breaks a task into smaller subtasks.

```typescript
agent.on('SubTasksAdded', (parentTaskId, subTasksList, allTasks) => {
    console.log(`Task ${parentTaskId} broken into subtasks:`, subTasksList);
});
```

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `parentTaskId` | `string` | The ID of the parent task |
| `subTasksList` | `object` | The subtasks that were added |
| `allTasks` | `object` | All tasks in the planner |

### TasksUpdated

Fired when a task or subtask changes status.

```typescript
agent.on('TasksUpdated', (taskId, status, allTasks) => {
    const icon = status === 'completed' ? '✅' : status === 'ongoing' ? '⏳' : '📝';
    console.log(`${icon} Task ${taskId}: ${status}`);
});
```

**Payload:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `taskId` | `string` | The task ID (for subtasks: `"parentId.subtaskId"`) |
| `status` | `string` | New status: `'planned'`, `'ongoing'`, or `'completed'` |
| `allTasks` | `object` | All tasks in the planner |

### TasksCompleted

Fired when the agent verifies that all tasks and subtasks are completed.

```typescript
agent.on('TasksCompleted', (allTasks) => {
    console.log('All tasks completed!', allTasks);
});
```

### TasksCleared

Fired when the agent clears the planner to start a new plan.

```typescript
agent.on('TasksCleared', (allTasks) => {
    console.log('Planner cleared');
});
```

## Events Summary

| Event | Payload | When |
|-------|---------|------|
| `TasksAdded` | `(tasksList, allTasks)` | Agent creates a new plan |
| `SubTasksAdded` | `(parentTaskId, subTasksList, allTasks)` | Agent decomposes a task into subtasks |
| `TasksUpdated` | `(taskId, status, allTasks)` | A task or subtask changes status |
| `TasksCompleted` | `(allTasks)` | All tasks verified as completed |
| `TasksCleared` | `(allTasks)` | Planner is reset for a new plan |

## Full Example with Chat

```typescript
import { Agent, TAgentMode, TLLMEvent } from '@smythos/sdk';
import * as readline from 'readline';

const agent = new Agent({
    name: 'Code Assistant',
    behavior: 'You are a senior developer.',
    model: 'gpt-4o',
    mode: TAgentMode.PLANNER,
});

// Track planning events
agent.on('TasksAdded', (_, tasks) => {
    console.log('\n📋 Plan:');
    for (const [id, task] of Object.entries(tasks) as any) {
        console.log(`   📝 ${task.summary || task.description}`);
    }
});

agent.on('TasksUpdated', (taskId, status) => {
    const icon = status === 'completed' ? '✅' : '⏳';
    console.log(`   ${icon} ${taskId}: ${status}`);
});

agent.on('TasksCompleted', () => {
    console.log('   🎉 All tasks completed!');
});

// Start a chat session
const chat = agent.chat({ persist: false });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You: ',
});

chat.on(TLLMEvent.Content, (content) => {
    process.stdout.write(content);
});

chat.on(TLLMEvent.End, () => {
    console.log('\n');
    rl.prompt();
});

rl.on('line', (input) => {
    chat.prompt(input).stream();
});

rl.prompt();
```

## Combining with Worker Mode

Planner mode pairs naturally with Worker mode. The agent plans the work and dispatches complex subtasks to background workers:

```typescript
const agent = new Agent({
    name: 'Research Assistant',
    model: 'gpt-4o',
    mode: [TAgentMode.PLANNER, TAgentMode.WORKER],
});
```

See the [Combined Example](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill/04.3-chat-planner-worker-combined.ts) for a full implementation.

## Next Steps

-   [Worker Mode](04-worker-mode.md) - Background task delegation
-   [Agent Modes Overview](02-agent-modes.md) - All available modes
-   [Chat](../04-chat.md) - Maintaining conversations with context
