# Scheduler Chainable Syntax - Recent Changes

## Summary of Changes

This document describes the recent improvements to the `SchedulerInstance` chainable syntax.

## Changes Made

### 1. Prompt Job ID Uses Hash Instead of Timestamp

**Previous behavior:**

```typescript
const jobId = `${this._agent.id}-prompt-${Date.now()}`;
```

**New behavior:**

```typescript
const promptHash = simpleHash(prompt);
const jobId = `${this._agent.id}-prompt-${promptHash}`;
```

**Why:** Using a hash of the prompt text creates a deterministic, unique ID based on the prompt content. This means the same prompt will always generate the same job ID, making it easier to identify and manage recurring prompts.

**Hash function:** Uses a simple non-cryptographic hash (djb2-style) that converts the string to a base-36 number for a short, readable ID.

### 2. Job Control via Returned Object

**Previous behavior:**

```typescript
await scheduler.call('skill', args).every('5s'); // Returns void
```

**New behavior:**

```typescript
const job = await scheduler.call('skill', args).every('5s');
// Returns IScheduledJobControl with:
await job.pause(); // Pause the job
await job.resume(); // Resume the job
await job.delete(); // Delete the job
```

**Why:** This provides a clean API to control scheduled jobs after they're created, without needing to track job IDs manually.

### 3. SchedulerJobBuilder as Job Control

The `SchedulerJobBuilder` itself now acts as the job control object. After calling `.every()`, it returns itself (`this`) with all the control methods available.

**Benefits:**

-   Simpler design - no separate interface needed
-   More object-oriented - the builder manages its own job
-   Same API surface - works exactly as expected

## Updated API Examples

### Creating and Managing Jobs

```typescript
// Create a scheduled job and get control object
const job = await scheduler.call('processData', { input: 'test' }, { name: 'Data Processor' }).every('5s');

// Later, pause the job
await job.pause();

// Resume it
await job.resume();

// Or delete it permanently
await job.delete();
```

### Prompt Jobs with Deterministic IDs

```typescript
// Same prompt = same job ID every time
const job1 = await scheduler.prompt('Generate daily report').every('1h');
const job2 = await scheduler.prompt('Generate daily report').every('1h');
// job1 and job2 have the same underlying job ID
```

### Warning Detection Still Works

```typescript
// If you forget .every(), you'll still get a warning
await scheduler.call('processData', {});
// ⚠️  Warning: Job 'agent-id-skill-processData' was not scheduled.
//    Complete the chain with .every('interval') in order to schedule the job.
```

## Implementation Details

### Simple Hash Function

```typescript
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}
```

-   Fast and simple
-   Not cryptographically secure (not needed for job IDs)
-   Produces short, readable IDs in base-36
-   Deterministic: same input = same output

### Job Control via Builder Pattern

The `.every()` method simply returns `this` (the builder instance itself):

```typescript
async every(interval: string): Promise<this> {
    this._scheduled = true;
    const job = new Job(this._jobConfig);
    const schedule = Schedule.every(interval);
    await this._schedulerRequest.add(this._jobId, job, schedule);
    return this;  // ← Return the builder itself!
}
```

The builder already has `pause()`, `resume()`, and `delete()` methods, so it naturally acts as the job control object. This is cleaner than creating a separate interface or object literal.

## Breaking Changes

### Type Changes

If you were explicitly typing the return value of `.every()`, you'll need to update:

```typescript
// Before
const result: void = await scheduler.call('skill', {}).every('5s');

// After
const result = await scheduler.call('skill', {}).every('5s');
// result is of type SchedulerJobBuilder (with pause/resume/delete methods)
```

In practice, you rarely need to explicitly type this - TypeScript infers it correctly.

### No Breaking Changes for Existing Code

If you were already using the chainable syntax without capturing the return value, your code will continue to work:

```typescript
// This still works fine
await scheduler.call('skill', {}).every('5s');
await scheduler.prompt('Generate report').every('1h');
```

## Migration Guide

### If you need job control

**Before:**

```typescript
await scheduler.call('backup', {}).every('1h');
// Later, to pause:
await scheduler.pause('agent-id-skill-backup');
```

**After:**

```typescript
const job = await scheduler.call('backup', {}).every('1h');
// Later, to pause:
await job.pause();
```

### If you don't need job control

No changes needed! Your code will work as before.

## Future Improvements

-   [ ] Implement `.cron()` method (currently commented out)
-   [ ] Add `.starts()` and `.ends()` chaining for schedule constraints
-   [ ] Consider adding `.get()` method to job control for fetching job details
-   [ ] Add job events (onComplete, onError, etc.)
