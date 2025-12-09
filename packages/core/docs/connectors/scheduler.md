# Scheduler Connector (beta)

The Scheduler Connector provides the interface for scheduling and managing jobs within the SRE. It supports various job types and scheduling patterns.

## Interface: `ISchedulerRequest`

### Methods

#### `list()`

Returns a list of all scheduled jobs accessible to the current candidate.

-   **Returns**: `Promise<IScheduledJob[]>`

#### `add(jobId, job, schedule)`

Adds a new job or updates an existing one.

-   **jobId**: `string` - Unique identifier for the job.
-   **job**: `Job` - The job definition (type, agent, arguments).
-   **schedule**: `Schedule` - The execution schedule.
-   **Returns**: `Promise<void>`

#### `delete(jobId)`

Removes a scheduled job.

-   **jobId**: `string` - The ID of the job to delete.
-   **Returns**: `Promise<void>`

#### `get(jobId)`

Retrieves details of a specific job.

-   **Returns**: `Promise<IScheduledJob | undefined>`

#### `pause(jobId)`

Pauses a job, preventing it from executing until resumed.

-   **Returns**: `Promise<void>`

#### `resume(jobId)`

Resumes a paused job.

-   **Returns**: `Promise<void>`

## Connectors

### LocalScheduler

A file-based scheduler that runs jobs locally using `node-cron`. It persists job definitions to disk, ensuring they survive restarts.

-   **Settings**:
    -   `folder`: Path to storage folder (default: `~/.smyth/scheduler`).
    -   `autoStart`: Whether to start the scheduler automatically (default: `true`).

## Examples

### Scheduling a Recurring Task

```typescript
const scheduler = ConnectorService.getSchedulerConnector().requester(candidate);

const job = new Job({
    type: 'skill',
    agentId: 'agent-123',
    skillName: 'backup',
    metadata: { name: 'Daily Backup' },
});

const schedule = Schedule.cron('0 0 * * *'); // Daily at midnight

await scheduler.add('backup-job', job, schedule);
```
