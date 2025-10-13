# Scheduler Examples

This directory contains examples demonstrating the SmythOS Scheduler service with the new **agent-based Job API**.

## 🎯 New Job API Overview

Jobs in SmythOS are now **fully serializable** and execute based on:

1. **Agent Skills** - Call specific agent skills with arguments
2. **AI Prompts** - Send prompts to agents for AI-powered execution

### Why This Matters

✅ **No more function serialization issues** - Everything is JSON-serializable
✅ **Works after restart** - Jobs resume automatically without re-registration
✅ **Production-ready** - Perfect for distributed systems and microservices
✅ **AI-powered execution** - Leverage LLMs for intelligent task processing

### ⚠️ Important Requirement

**Agents must be saved** to the AgentDataConnector for scheduled jobs to access them:

```typescript
import { ConnectorService } from '@smythos/sre';

// After creating your agent
const agentDataConnector = ConnectorService.getAgentDataConnector();
await agentDataConnector.saveAgent(agent.data.id, agent.data);
```

This persists the agent data so the scheduler can retrieve it when executing jobs.

## Examples

### 00-default-scheduler.ts

Basic scheduler usage with both skill-based and prompt-based jobs.

**Features demonstrated:**

-   Creating an agent with skills
-   Skill-based jobs (calling agent skills)
-   Prompt-based jobs (AI-powered execution)
-   Job listing and inspection

**Run:**

```bash
tsx examples/13-scheduler/00-default-scheduler.ts
```

### 01-local-scheduler.ts

LocalScheduler with custom configuration.

**Features demonstrated:**

-   Custom scheduler settings
-   Multiple job types
-   Execution history tracking
-   Retry logic and timeouts

**Run:**

```bash
tsx examples/13-scheduler/01-local-scheduler.ts
```

### 02-agent-scheduler.ts

Using scheduler directly from an agent for automatic scoping.

**Features demonstrated:**

-   Agent-scoped scheduler access
-   Multiple skills per agent
-   Mix of skill and prompt jobs
-   Agent-specific job isolation

**Run:**

```bash
tsx examples/13-scheduler/02-agent-scheduler.ts
```

### 03-multi-agent-isolation.ts

Demonstrating job isolation between agents and teams.

**Features demonstrated:**

-   Agent vs Team scoped jobs
-   Data isolation
-   Independent job management

**Run:**

```bash
tsx examples/13-scheduler/03-multi-agent-isolation.ts
```

### 04-schedule-patterns.ts

Comprehensive schedule pattern examples.

**Features demonstrated:**

-   Various interval formats (30s, 5m, 2h, 1d, 1w)
-   Cron expressions for specific times
-   Date range scheduling
-   Retry and timeout configurations

**Run:**

```bash
tsx examples/13-scheduler/04-schedule-patterns.ts
```

### 05-job-persistence.ts

How job persistence works with the new API.

**Features demonstrated:**

-   Fully serializable jobs
-   Automatic persistence
-   No re-registration needed
-   Production deployment patterns

**Run:**

```bash
tsx examples/13-scheduler/05-job-persistence.ts
```

## Schedule Formats

### Intervals

Simple interval-based scheduling:

```typescript
Schedule.every('30s'); // Every 30 seconds
Schedule.every('5m'); // Every 5 minutes
Schedule.every('2h'); // Every 2 hours
Schedule.every('1d'); // Every 1 day
Schedule.every('1w'); // Every 1 week
```

### Cron Expressions

Traditional cron syntax:

```typescript
Schedule.cron('0 * * * *'); // Every hour
Schedule.cron('0 2 * * *'); // Every day at 2 AM
Schedule.cron('0 9 * * 1-5'); // Weekdays at 9 AM
Schedule.cron('0 0 1 * *'); // First day of month
```

### Date Ranges

Start and end dates:

```typescript
// Start now, end in 1 hour
Schedule.every('5m').starts(new Date()).ends(oneHourLater);

// Start in 10 minutes
Schedule.every('1m').starts(tenMinutesLater);

// End in 1 week
Schedule.every('1h').ends(oneWeekLater);
```

## Job Types

### Skill-Based Jobs

Execute specific agent skills:

```typescript
new Job({
    type: 'skill',
    agentId: 'my-agent',
    skillName: 'process_data',
    args: { input: 'some data' },
    metadata: {
        name: 'Data Processor',
        description: 'Processes data periodically',
        retryOnFailure: true,
        maxRetries: 3,
        timeout: 30000,
    },
});
```

### Prompt-Based Jobs

AI-powered execution:

```typescript
new Job({
    type: 'prompt',
    agentId: 'my-agent',
    prompt: 'Analyze system logs and report anomalies',
    metadata: {
        name: 'Log Analyzer',
        description: 'AI-powered log analysis',
    },
});
```

## Metadata Options

```typescript
{
    name: string;           // Required: Job name
    description?: string;   // Optional: Job description
    tags?: string[];        // Optional: Organizational tags
    retryOnFailure?: boolean; // Optional: Enable retry logic
    maxRetries?: number;    // Optional: Max retry attempts
    timeout?: number;       // Optional: Timeout in milliseconds
}
```

## Persistence

Jobs are stored in:

-   **Job configs**: `~/.smyth/scheduler/jobs/<owner>/`
-   **Runtime data**: `~/.smyth/scheduler/.jobs.runtime/<owner>/`

### Folder Structure

```
~/.smyth/scheduler/
├── jobs/
│   ├── username.user/
│   │   ├── job1.json
│   │   └── job2.json
│   ├── teamname.team/
│   │   └── team-job.json
│   └── agentname.agent/
│       └── agent-job.json
└── .jobs.runtime/
    ├── username.user/
    │   ├── job1.json
    │   └── job2.json
    └── ...
```

## Access Control

Jobs inherit ACL from their creator:

```typescript
// Agent-scoped (requires explicit agent ID)
const scheduler = agent.scheduler.default();

// Team-scoped
const scheduler = agent.scheduler.default({ scope: Scope.TEAM });

// Or use the global factory
const scheduler = Scheduler.default();
```

## Notes

-   Jobs are **fully serializable** (no function storage issues)
-   **Automatic resume** after restart - no re-registration needed
-   Each job has its own execution history
-   Retry logic uses exponential backoff
-   Jobs can be paused without losing configuration
-   Execution history is stored separately and can be cleared safely

## Key Differences from Old API

### Old API (Function-based)

```typescript
// ❌ Old way - functions can't be serialized
const job = new Job(
    async () => {
        // function code here
    },
    { name: 'My Job' }
);

// Required re-registration after restart
```

### New API (Agent-based)

```typescript
// ✅ New way - fully serializable
const job = new Job({
    type: 'skill',
    agentId: 'my-agent',
    skillName: 'my_skill',
    args: { data: 'value' },
    metadata: { name: 'My Job' },
});

// No re-registration needed - works after restart!
```

## Best Practices

1. **Define skills in your agents** - Create reusable skills for common tasks
2. **Use descriptive job names** - Makes debugging easier
3. **Enable retry for critical jobs** - Add `retryOnFailure: true` for important tasks
4. **Set appropriate timeouts** - Prevent jobs from hanging indefinitely
5. **Use tags for organization** - Group related jobs with tags
6. **Monitor execution history** - Check `executionHistory` for job health
7. **Use AI prompts wisely** - Great for analysis, insights, and decision-making tasks

## Common Patterns

### Periodic Data Processing

```typescript
await scheduler.add(
    'data-sync',
    Schedule.every('15m'),
    new Job({
        type: 'skill',
        agentId: 'data-agent',
        skillName: 'sync_data',
        metadata: {
            name: 'Data Sync',
            retryOnFailure: true,
            maxRetries: 3,
        },
    })
);
```

### AI-Powered Analysis

```typescript
await scheduler.add(
    'insights',
    Schedule.every('1h'),
    new Job({
        type: 'prompt',
        agentId: 'analyst-agent',
        prompt: 'Analyze recent data and provide insights',
        metadata: { name: 'Hourly Insights' },
    })
);
```

### Maintenance Tasks

```typescript
await scheduler.add(
    'cleanup',
    Schedule.cron('0 3 * * *'), // 3 AM daily
    new Job({
        type: 'skill',
        agentId: 'maintenance-agent',
        skillName: 'cleanup',
        metadata: {
            name: 'Daily Cleanup',
            timeout: 300000, // 5 minutes
        },
    })
);
```

## Troubleshooting

**Jobs not executing after restart?**

-   Ensure your agent skills are defined before scheduler loads
-   Verify agentId matches your agent's ID
-   Check that the agent is properly initialized

**Jobs failing?**

-   Check execution history: `job.executionHistory`
-   Enable retry: `retryOnFailure: true`
-   Increase timeout if jobs are timing out

**Can't find jobs?**

-   Jobs are scoped by creator (user/agent/team)
-   Use correct scope when accessing scheduler
-   Check `~/.smyth/scheduler/jobs/` directory

## Further Reading

-   [Scheduler Service Documentation](../../packages/core/docs/subsystems/scheduler.md)
-   [Agent Skills Guide](../../packages/sdk/docs/02-agents.md)
-   [Schedule Syntax Reference](../../packages/core/src/subsystems/AgentManager/Scheduler.service/Schedule.class.ts)
