# Scheduler Examples

This directory contains examples demonstrating the SmythOS Scheduler functionality.

## Available Examples

### 00-default-scheduler.ts

Basic scheduler usage with both traditional and chainable syntax patterns.

**Features demonstrated:**

-   Traditional `scheduler.add()` with explicit Job creation
-   chainable syntax with `.call()` and `.prompt()`
-   Job listing and inspection
-   Both agent-scoped and team-scoped scheduling

### 01-chainable-syntax.ts

Comprehensive demonstration of the new chainable syntax for scheduling jobs.

**Features demonstrated:**

-   `.call()` method for scheduling skill execution
-   `.prompt()` method for scheduling prompts
-   `.trigger()` method for scheduling trigger execution
-   `.every()` for interval-based scheduling
-   `.cron()` for cron-based scheduling
-   Warning detection when `.every()` or `.cron()` is forgotten

## Chainable Syntax Overview

The scheduler supports a concise chainable syntax:

```typescript
// Schedule a skill to run every 5 seconds
await scheduler.call('skillName', args, metadata).every('5s');

// Schedule a prompt every hour
await scheduler.prompt('Generate report', metadata).every('1h');

// Schedule a trigger daily
await scheduler.trigger('daily-sync', metadata).every('1d');

// Use cron expressions
await scheduler.call('backup', {}).cron('0 0 * * *'); // Daily at midnight
```

### Key Features

1. **Automatic Job ID Generation**: No need to manually specify job IDs
2. **Cleaner Syntax**: Less boilerplate compared to traditional method
3. **Type Safety**: Full TypeScript support
4. **Warning Detection**: If you forget to call `.every()` or `.cron()`, you'll get a helpful warning

### Warning Detection

The chainable syntax uses the `then()` method override to detect when you forget to complete the chain:

```typescript
// ❌ This will show a warning
await scheduler.call('skillName', args);
// ⚠️  Warning: Scheduled job 'agent-id-skill-skillName' was awaited without calling .every() or .cron().
//    The job was NOT scheduled. Complete the chain with .every('interval') or .cron('expression').

// ✅ Correct usage
await scheduler.call('skillName', args).every('5s');
```

## Traditional vs Chainable Syntax

### Traditional Syntax

```typescript
await scheduler.add(
    'my-job-id',
    new Job({
        type: 'skill',
        agentId: agent.id,
        skillName: 'processData',
        args: { input: 'test' },
        metadata: {
            name: 'Data Processor',
            retryOnFailure: true,
        },
    }),
    Schedule.every('5s')
);
```

### Chainable Syntax

```typescript
await scheduler.call('processData', { input: 'test' }, { name: 'Data Processor', retryOnFailure: true }).every('5s');
```

## Requirements

The chainable syntax methods (`.call()`, `.prompt()`, `.trigger()`) require an agent to be associated with the scheduler instance:

```typescript
// ✅ Correct - agent passed to scheduler
const scheduler = agent.scheduler.default();
await scheduler.call('skillName', args).every('5s'); // Works!

// ❌ Incorrect - no agent
const scheduler = Scheduler.default();
await scheduler.call('skillName', args).every('5s'); // Throws error!
```

For team-scoped scheduling without an agent, use the traditional `scheduler.add()` method.

## Running the Examples

```bash
# Run from the monorepo root
cd examples/13-scheduler

# Run basic example
npx tsx 00-default-scheduler.ts

# Run chainable syntax example
npx tsx 01-chainable-syntax.ts
```
