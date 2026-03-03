# Worker Mode

Worker mode allows an agent to dispatch complex, long-running tasks to background "copy" agents while the main agent stays fully interactive. When a worker finishes, its result is automatically surfaced back to the user through the main agent's conversation.

This mode is ideal when users submit tasks that take a while (research, code generation, multi-step analysis) and you want them to continue chatting or submit more tasks without blocking.

See the [Worker Mode Example](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill/04.2-chat-worker-mode.ts) for a complete, runnable implementation.

## Enabling Worker Mode

```typescript
import { Agent, TAgentMode } from '@smythos/sdk';

const agent = new Agent({
    name: 'Research Assistant',
    behavior: 'You are a research assistant capable of handling complex tasks.',
    model: 'gpt-4o',
    mode: TAgentMode.WORKER,
});
```

## How It Works

### Task Dispatching

When the user asks for something complex, the main agent's LLM evaluates the request:

- **Simple tasks** (quick questions, math, lookups): The agent answers directly — no worker needed.
- **Complex tasks** (research, analysis, code generation): The agent dispatches the task to a background worker via the internal `_sre_Worker_Dispatch` skill.

The main agent immediately confirms the dispatch and remains available for new prompts.

### Copy Agents

Each worker is a "copy" of the main agent — it shares the same skills and model but runs independently in its own chat session. The copy agent:

- Preserves the original agent behavior (system prompt) defined by the developer
- Gets all of the main agent's skills (except internal `_sre_*` skills)
- Receives additional instructions appended to the behavior, telling it to use `<worker_result>` and `<worker_question>` tags for communication
- Has no awareness of the main conversation — it only knows its assigned task

### Worker Communication

Workers communicate back to the main agent through two tag-based protocols:

- **`<worker_result>...</worker_result>`**: The worker wraps its final output in this tag when the task is complete.
- **`<worker_question>...</worker_question>`**: The worker wraps a follow-up question in this tag if it needs clarification from the user.

### Auto-Surfacing Results

When a worker completes or has a question, the result is automatically injected into the main agent's active chat session. The main agent's LLM then presents it naturally to the user — no manual polling needed.

The injection happens via an internal queue mechanism:

1. Worker finishes → result is pushed to the injection queue
2. When the main agent's current turn ends, the queue is drained
3. A synthetic prompt (`CHECK_WORKERS_RESULTS_QUEUE` or `CHECK_WORKERS_QUESTIONS_QUEUE`) is sent to the main agent
4. The main agent calls its status/results skills and writes a natural language response
5. That response streams through the chat's `TLLMEvent.Content` events — visible to the consumer like any other response

### Concurrency

Up to 3 workers can run simultaneously. Additional dispatches are queued and start automatically when a running worker completes.

## Events

Worker mode emits events on the `agent` object for real-time visibility into background task progress.

### WorkerDispatched

Fired when a task is dispatched to a background worker.

```typescript
agent.on('WorkerDispatched', ({ jobId, task }) => {
    console.log(`Task dispatched: ${jobId}`);
    console.log(`Description: ${task}`);
});
```

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | Unique identifier for the job |
| `task` | `string` | The task description sent to the worker |

### WorkerCompleted

Fired when a worker successfully completes its task.

```typescript
agent.on('WorkerCompleted', ({ jobId, result }) => {
    console.log(`Completed: ${jobId}`);
    console.log(`Result: ${result}`);
});
```

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | The job identifier |
| `result` | `string` | The worker's final result text |

### WorkerFailed

Fired when a worker encounters an error.

```typescript
agent.on('WorkerFailed', ({ jobId, error }) => {
    console.error(`Failed: ${jobId} — ${error}`);
});
```

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | The job identifier |
| `error` | `string` | Error message |

### WorkerQuestion

Fired when a worker needs clarification from the user.

```typescript
agent.on('WorkerQuestion', ({ jobId, questionId, question }) => {
    console.log(`Worker ${jobId} asks: ${question}`);
});
```

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | The job identifier |
| `questionId` | `string` | Unique identifier for the question |
| `question` | `string` | The question text |

### WorkerAnswered

Fired when a user's answer is relayed back to the worker.

```typescript
agent.on('WorkerAnswered', ({ jobId, answer }) => {
    console.log(`Answer sent to ${jobId}: ${answer}`);
});
```

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | The job identifier |
| `answer` | `string` | The user's answer |

### WorkerCancelled

Fired when a job is cancelled.

```typescript
agent.on('WorkerCancelled', ({ jobId }) => {
    console.log(`Cancelled: ${jobId}`);
});
```

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | The job identifier |

### WorkerStatusChanged

A catch-all event that fires on every status transition, alongside the more specific events above.

```typescript
agent.on('WorkerStatusChanged', ({ jobId, status }) => {
    console.log(`${jobId}: ${status}`);
});
```

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | The job identifier |
| `status` | `string` | New status: `'running'`, `'waiting_for_input'`, `'completed'`, `'failed'`, or `'cancelled'` |

## Events Summary

| Event | Payload | When |
|-------|---------|------|
| `WorkerDispatched` | `{ jobId, task }` | Task sent to a background worker |
| `WorkerCompleted` | `{ jobId, result }` | Worker finished successfully |
| `WorkerFailed` | `{ jobId, error }` | Worker encountered an error |
| `WorkerQuestion` | `{ jobId, questionId, question }` | Worker needs user clarification |
| `WorkerAnswered` | `{ jobId, answer }` | User's answer relayed to worker |
| `WorkerCancelled` | `{ jobId }` | Job was cancelled |
| `WorkerStatusChanged` | `{ jobId, status }` | Any status transition (fires with every event above) |

## Job Lifecycle

```
  Dispatched ──→ Running ──→ Completed
                   │  ↑           │
                   │  │      (auto-surface)
                   ↓  │
              Waiting for Input
                   │
                   ↓
               (answered) ──→ Running ──→ ...

  Any state ──→ Cancelled (via user request)
  Running   ──→ Failed    (on error)
```

## Full Example with Chat

```typescript
import { Agent, TAgentMode, TLLMEvent } from '@smythos/sdk';
import * as readline from 'readline';

const agent = new Agent({
    name: 'Research Assistant',
    behavior: `You are a helpful assistant. For simple questions, answer directly.
For complex research tasks, dispatch them to a background worker.`,
    model: 'gpt-4o',
    mode: TAgentMode.WORKER,
});

// Add skills that workers can use
agent.addSkill({
    name: 'WebSearch',
    description: 'Search the web for information',
    process: async ({ query }) => {
        // Your search implementation here
        return { results: [{ title: `Result for: ${query}` }] };
    },
});

// Track worker activity
agent.on('WorkerDispatched', ({ jobId, task }) => {
    console.log(`\n⚡ Worker started: ${task.substring(0, 60)}...`);
});

agent.on('WorkerCompleted', ({ jobId }) => {
    console.log(`\n✅ Worker ${jobId} completed`);
});

// Create a chat session
const chat = agent.chat({ persist: false });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You: ',
});

// Listen on the Chat object for all output (user-initiated + auto-surfaced)
let first = true;
chat.on(TLLMEvent.Content, (content) => {
    if (first) {
        process.stdout.write('\n🤖 Assistant: ');
        first = false;
    }
    process.stdout.write(content);
});

chat.on(TLLMEvent.End, () => {
    if (!first) {
        first = true;
        console.log('\n');
        rl.prompt();
    }
});

// Handle user input
rl.on('line', (input) => {
    if (input.trim() === '') return rl.prompt();
    chat.prompt(input).stream();
});

rl.prompt();
```

> **Note**: We listen on `chat.on(TLLMEvent.Content, ...)` rather than on the per-prompt emitter returned by `.stream()`. This ensures we see both user-initiated responses _and_ auto-surfaced worker results, since `ChatCommand.stream()` emits events on the Chat object for every prompt — including internally injected ones.

## Combining with Planner Mode

Worker mode pairs naturally with Planner mode. The agent plans the work and dispatches complex subtasks to background workers:

```typescript
const agent = new Agent({
    name: 'Research Assistant',
    model: 'gpt-4o',
    mode: [TAgentMode.PLANNER, TAgentMode.WORKER],
});
```

See the [Combined Example](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill/04.3-chat-planner-worker-combined.ts) for a full implementation.

## WorkerJob Type

For advanced use cases, the `WorkerJob` interface is exported from the SDK:

```typescript
import { WorkerJob } from '@smythos/sdk';
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique job identifier |
| `task` | `string` | The dispatched task description |
| `status` | `string` | Current status |
| `createdAt` | `number` | Timestamp of creation |
| `completedAt` | `number?` | Timestamp of completion |
| `result` | `string?` | Final result (when completed) |
| `error` | `string?` | Error message (when failed) |
| `pendingQuestion` | `object?` | `{ questionId, text }` when waiting for input |
| `interactions` | `array` | Full log of prompts and responses |
| `partialResult` | `string` | Accumulated response so far (while running) |
| `currentStep` | `string?` | Description of current tool call |

## Next Steps

-   [Planner Mode](03-planner-mode.md) - Systematic task planning
-   [Agent Modes Overview](02-agent-modes.md) - All available modes
-   [Chat](../04-chat.md) - Maintaining conversations with context
-   [Streaming Responses](../03-streaming.md) - Real-time output from agents
