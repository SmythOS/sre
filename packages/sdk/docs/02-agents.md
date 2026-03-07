# Building Agents

This section covers everything about creating, configuring, and extending agents in the SmythOS SDK.

## Contents

| Guide | Description |
|-------|-------------|
| [Creating Agents](agents/00-creating-agents.md) | Agent creation, .smyth file imports, and model configuration |
| [Skills](agents/01-skills.md) | Adding capabilities to agents with skills and direct invocation |
| [Agent Modes](agents/02-agent-modes.md) | Overview of execution modes (Default, Planner, Worker) |
| [Planner Mode](agents/03-planner-mode.md) | Systematic planning, task tracking, and progress reporting |
| [Worker Mode](agents/04-worker-mode.md) | Background task delegation to copy agents |

## Quick Start

```typescript
import { Agent, TAgentMode } from '@smythos/sdk';

// Simple agent
const agent = new Agent({
    name: 'My Agent',
    behavior: 'You are a helpful assistant.',
    model: 'gpt-4o',
});

// Agent with planner mode
const planner = new Agent({
    name: 'Planner Agent',
    behavior: 'You are a systematic assistant.',
    model: 'gpt-4o',
    mode: TAgentMode.PLANNER,
});

// Agent with combined modes
const powerAgent = new Agent({
    name: 'Power Agent',
    behavior: 'You are a research assistant.',
    model: 'gpt-4o',
    mode: [TAgentMode.PLANNER, TAgentMode.WORKER],
});
```

Start with [Creating Agents](agents/00-creating-agents.md) to learn the fundamentals.
