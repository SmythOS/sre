# Agent Subsystem Documentation

## User Prompt

@Scheduler.service/ implement a SchedulerConnector.ts here
it provides the following function

list() //list jobs
add(jobId, schedule, job) //add or update existing job
delete(jobId);

schedule is an instance of an object called Schedule that supports this syntax

Schedule.starts(Date).ends(Date).every("10m"); ==> returns a json representation that can be parsed.

job is an instance of Job class
job = new Job(fn(), metadata);

and also implement a version of this scheduler called LocalScheduler, it uses disk to store jobs data under a .smyth subfolder, and works entierly locally.
it loads the jobs every start (if any) and triggers them periodically.

for references check how @VectorDBConnector.ts and @RAMVecrtorDB.class.ts are implemented
other examples @StorageConnector.ts and @LocalStorage.class.ts

it's important to handle the access rights and isolation properly

## Important Instructions for LLMs

⚠️ **CRITICAL: Do NOT start implementation immediately**

When receiving a user prompt to create a new connector or service:

1. **Assess Information Completeness**

    - Review the user's request for completeness
    - Identify what information is missing or unclear
    - Determine what patterns and architecture decisions need to be defined

2. **DO NOT IMPLEMENT if information is incomplete**

    - If the prompt lacks critical details (interfaces, methods, config options, persistence strategy, etc.)
    - If access control requirements are unclear
    - If the connector pattern to follow is not specified
    - If testing requirements are not mentioned

3. **ASK QUESTIONS FIRST**

    - Request clarification on missing details
    - Ask about specific methods and their signatures
    - Inquire about configuration options
    - Confirm access control and isolation requirements
    - Verify testing expectations

4. **Establish an Elaborated Plan**

    - Only after gathering ALL necessary information
    - Create a detailed specification document (like the one below)
    - Include complete interfaces, method signatures, and config types
    - Define file structure and naming conventions
    - Specify testing requirements
    - Outline security and ACL patterns

5. **Get User Approval**

    - Present the elaborated plan to the user
    - Wait for confirmation before proceeding
    - Make adjustments based on feedback

6. **Then Implement**
    - Only start implementation after the plan is complete and approved
    - Follow the elaborated specification exactly
    - Maintain consistency with existing SRE patterns

## Processing the user prompt

Before processing the user prompt, elaborate it in order to make it more clear and detailed. check below :

## The elaborated prompt

Implement a **Scheduler service** following the SRE connector pattern. This service will manage scheduled jobs with full ACL-based access control and multi-candidate isolation.

### Architecture Requirements

#### 1. Service Structure

Create the following structure under `packages/core/src/subsystems/AgentManager/Scheduler.service/`:

```
Scheduler.service/
├── index.ts                          # Service entry point
├── SchedulerConnector.ts             # Abstract base connector
├── Schedule.class.ts                 # Schedule builder with fluent API
├── Job.class.ts                      # Job wrapper class
└── connectors/
    └── LocalScheduler.class.ts       # Local disk-based implementation
```

#### 2. SchedulerConnector (Abstract Base Class)

**File**: `SchedulerConnector.ts`

**Requirements**:

-   Extend `SecureConnector<ISchedulerRequest>`
-   Define the `ISchedulerRequest` interface with public-facing methods
-   Implement `requester(candidate: AccessCandidate): ISchedulerRequest` to expose access-controlled operations
-   Define abstract protected methods decorated with `@SecureConnector.AccessControl`
-   Implement `abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>`

**Core Methods** (to be exposed via ISchedulerRequest):

```typescript
interface ISchedulerRequest {
    list(): Promise<IScheduledJob[]>;
    add(jobId: string, schedule: Schedule, job: Job): Promise<void>;
    delete(jobId: string): Promise<void>;
    get(jobId: string): Promise<IScheduledJob | undefined>;
    pause(jobId: string): Promise<void>;
    resume(jobId: string): Promise<void>;
}
```

**Protected Abstract Methods** (implementations):

```typescript
protected abstract list(acRequest: AccessRequest): Promise<IScheduledJob[]>;
protected abstract add(acRequest: AccessRequest, jobId: string, schedule: Schedule, job: Job): Promise<void>;
protected abstract delete(acRequest: AccessRequest, jobId: string): Promise<void>;
protected abstract get(acRequest: AccessRequest, jobId: string): Promise<IScheduledJob | undefined>;
protected abstract pause(acRequest: AccessRequest, jobId: string): Promise<void>;
protected abstract resume(acRequest: AccessRequest, jobId: string): Promise<void>;
```

**Pattern Reference**:

-   See `VectorDBConnector.ts` for how `requester()` wraps protected methods with candidate access requests
-   See `StorageConnector.ts` for the generic type parameter pattern `extends SecureConnector<IRequest>`

#### 3. Schedule Class (Fluent Builder)

**File**: `Schedule.class.ts`

**Requirements**:

-   Fluent API for building schedule definitions
-   Support for common time intervals: seconds (s), minutes (m), hours (h), days (d), weeks (w)
-   Optional start and end dates
-   Serializable to JSON for persistence
-   Parseable from JSON for restoration

**Example API**:

```typescript
// Build a schedule
const schedule = Schedule.starts(new Date('2025-01-01')).ends(new Date('2025-12-31')).every('10m');

// Alternative patterns
Schedule.every('30s');
Schedule.every('2h').starts(tomorrow);
Schedule.cron('0 0 * * *'); // Optional: cron syntax support

// Serialization
const json = schedule.toJSON();
const restored = Schedule.fromJSON(json);
```

**JSON Format** (suggested):

```typescript
interface IScheduleData {
    interval: string; // e.g., "10m", "30s", "2h"
    startDate?: string; // ISO 8601
    endDate?: string; // ISO 8601
    cron?: string; // Optional cron expression
}
```

#### 4. Job Class

**File**: `Job.class.ts`

**Requirements**:

-   Wrap executable function with metadata
-   Support async and sync functions
-   Store serializable metadata about the job
-   Handle execution context and error handling

**Example API**:

```typescript
const job = new Job(
    async () => {
        console.log('Executing scheduled task');
        // Task logic here
    },
    {
        name: 'Daily Cleanup',
        description: 'Clean up temporary files',
        tags: ['maintenance', 'cleanup'],
        retryOnFailure: true,
        maxRetries: 3,
    }
);
```

**Interface**:

```typescript
interface IJobMetadata {
    name: string;
    description?: string;
    tags?: string[];
    retryOnFailure?: boolean;
    maxRetries?: number;
    timeout?: number; // in milliseconds
    [key: string]: any; // Additional custom metadata
}

interface IScheduledJob {
    id: string;
    schedule: IScheduleData;
    metadata: IJobMetadata;
    acl: IACL;
    status: 'active' | 'paused'; // User-controlled state only (not execution results)
    lastRun?: Date;
    nextRun?: Date;
    createdBy: {
        role: TAccessRole;
        id: string;
    };
    executionHistory?: IJobExecution[]; // Execution results stored here
}
```

#### 5. LocalScheduler Implementation

**File**: `connectors/LocalScheduler.class.ts`

**Requirements**:

**Persistence**:

-   Store job data in JSON files under `~/.smyth/scheduler/` or configurable folder
-   File naming: `{candidateRole}_{candidateId}_{jobId}.json`
-   Each file contains: schedule, metadata, ACL, status, execution history
-   Load all jobs on initialization
-   Auto-save on add/update/delete operations

**Execution**:

-   Use `node-cron` or `node-schedule` library for time-based triggers (or implement custom timer logic)
-   On service start, load all jobs and schedule active ones
-   Execute jobs in their own try-catch blocks with error logging
-   Track last run time and calculate next run time
-   Support pause/resume functionality
-   Clean up completed or expired jobs

**Access Control**:

-   Each job is owned by the candidate who created it
-   Job IDs are scoped per candidate (different candidates can have jobs with same ID)
-   `getResourceACL()` should:
    -   Return owner-level ACL if job doesn't exist (allow creation)
    -   Return stored ACL if job exists
    -   Read ACL from the persisted JSON file
-   All protected methods must use `@SecureConnector.AccessControl` decorator
-   Follow ownership preservation pattern: creator ALWAYS retains Owner access

**Constructor Config**:

```typescript
export type LocalSchedulerConfig = {
    folder?: string; // Storage folder, defaults to ~/.smyth/scheduler
    autoStart?: boolean; // Auto-start scheduler on init, defaults to true
    persistExecutionHistory?: boolean; // Keep execution logs
};
```

**Internal Structure**:

```typescript
class LocalScheduler extends SchedulerConnector {
    public name = 'LocalScheduler';
    public id = 'local';

    private folder: string;
    private jobs: Map<string, ScheduledJobRuntime>; // In-memory job registry
    private isInitialized = false;

    constructor(protected _settings?: LocalSchedulerConfig) {
        super(_settings);
        this.folder = this.findSchedulerFolder(_settings?.folder);
        this.initialize();
    }

    private async initialize() {
        // Create storage folder if not exists
        // Load all job files from disk
        // Schedule active jobs
        // Start internal timer/scheduler
    }

    private constructJobPath(candidate: IAccessCandidate, jobId: string): string {
        // Return: {folder}/{role}_{candidateId}_{jobId}.json
    }

    private async scheduleJob(jobData: IScheduledJob) {
        // Parse schedule and set up timer
        // Store timer reference for cleanup
    }

    private async unscheduleJob(jobId: string) {
        // Cancel timer
        // Remove from active jobs
    }
}
```

**Pattern References**:

-   See `LocalStorage.class.ts` for:
    -   File-based persistence patterns
    -   Folder initialization (`~/.smyth/...`)
    -   Metadata serialization/deserialization
    -   ACL preservation in `setACL()` method (line 244)
-   See `RAMVectorDB.class.ts` for:
    -   In-memory data structures
    -   Static storage for shared state across instances
    -   `getResourceACL()` implementation (line 82-93)
    -   Access control patterns

#### 6. Service Index

**File**: `index.ts`

Export all public classes and types:

```typescript
export { SchedulerConnector } from './SchedulerConnector';
export { LocalScheduler } from './connectors/LocalScheduler.class';
export { Schedule } from './Schedule.class';
export { Job } from './Job.class';
export type { ISchedulerRequest, IScheduledJob, IJobMetadata, IScheduleData } from './SchedulerConnector';
```

### Security & Isolation Requirements

1. **ACL Ownership Preservation** ⚠️ CRITICAL

    - When updating job ACL, ALWAYS preserve original creator's Owner access
    - Pattern: `ACL.from(acl).addAccess(candidate.role, candidate.id, TAccessLevel.Owner)`

2. **Candidate Isolation**

    - Jobs are scoped per candidate (role + id)
    - Candidates can only list/access their own jobs (unless shared via ACL)
    - File paths must include candidate identifier

3. **Access Control Decorator**

    - ALL protected methods MUST use `@SecureConnector.AccessControl`
    - This decorator automatically validates access before method execution
    - Throws error if access denied

4. **Resource Naming**
    - JobId as resourceId for ACL lookup
    - Construct unique paths: `{role}_{id}_{jobId}`

### Testing Requirements

Create comprehensive tests following SRE patterns:

**Unit Tests** (`tests/unit/scheduler.test.ts`):

-   Mock file system operations
-   Test Schedule builder API
-   Test Job class
-   Test ACL validation logic
-   Test schedule parsing and calculation

**Integration Tests** (`tests/integration/scheduler.test.ts`):

-   Real LocalScheduler instance
-   Create/list/delete jobs
-   Test job execution triggers
-   Verify persistence across restarts
-   Test multi-candidate isolation
-   Validate ACL ownership preservation

### Dependencies

Add to `packages/core/package.json` if needed:

```json
{
    "dependencies": {
        "node-cron": "^3.0.3" // or "node-schedule": "^2.1.1"
    }
}
```

### Implementation Checklist

-   [ ] Create service folder structure
-   [ ] Implement `ISchedulerRequest` interface
-   [ ] Implement `SchedulerConnector` abstract base class
-   [ ] Implement `Schedule` class with fluent API
-   [ ] Implement `Job` class
-   [ ] Implement `LocalScheduler` with file persistence
-   [ ] Add job scheduling/execution logic
-   [ ] Implement `getResourceACL()` with proper ACL handling
-   [ ] Add `@SecureConnector.AccessControl` to all protected methods
-   [ ] Create service index with exports
-   [ ] **Integrate service into SRE boot sequence** (see below)
-   [ ] Write unit tests (mocked)
-   [ ] Write integration tests (real connector)
-   [ ] Update main exports in `packages/core/src/index.ts`
-   [ ] Add documentation
-   [ ] Test ACL ownership preservation
-   [ ] Test candidate isolation

### Integrating a New Service into SRE Boot Sequence

When creating a **brand new service** (not just a connector for an existing service), you must integrate it into the SRE initialization process. Follow these steps:

#### 1. Update Type Definitions (`packages/core/src/types/SRE.types.ts`)

Add your service to the type system:

```typescript
// Import the service class
import { SchedulerService } from '@sre/AgentManager/Scheduler.service';

// Add to TServiceRegistry
export type TServiceRegistry = {
    // ... existing services
    Scheduler?: SchedulerService;
};

// Add to TConnectorService enum
export enum TConnectorService {
    // ... existing connectors
    Scheduler = 'Scheduler',
}
```

#### 2. Create Service Class (`packages/core/src/subsystems/.../YourService/index.ts`)

Create a service class that extends `ConnectorServiceProvider`:

```typescript
//==[ SRE: YourService ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { YourConnector } from './connectors/YourConnector.class';

export class YourService extends ConnectorServiceProvider {
    public register() {
        // Register all connector implementations for this service
        ConnectorService.register(TConnectorService.YourService, 'DefaultConnector', YourConnector);
        // Register additional connectors if needed
    }
}

// Export your connector classes and types below
export { YourConnector } from './YourConnector';
// ... other exports
```

#### 3. Update Boot Sequence (`packages/core/src/Core/boot.ts`)

Register your service in the boot sequence:

```typescript
// Add import
import { YourService } from '@sre/path/to/YourService';

export function boot() {
    // ... existing code

    // Add service instantiation (order matters for dependencies)
    service.YourService = new YourService();

    // ... rest of boot code
}
```

**Note**: Service initialization order matters if there are dependencies. For example, NKV should be loaded before VectorDB.

#### 4. Add Default Configuration (`packages/core/src/Core/SmythRuntime.class.ts`)

Add default connector configuration:

```typescript
private defaultConfig: SREConfig = {
    // ... existing configs
    YourService: {
        Connector: 'DefaultConnector',
        Settings: {
            // Default settings
            option1: true,
            option2: 'default-value',
        },
    },
};
```

#### 5. Add Connector Getter (`packages/core/src/Core/ConnectorsService.ts`)

Add import and getter method:

```typescript
// Add import at top
import { YourConnector } from '@sre/path/to/YourService/YourConnector';

// Add getter method in ConnectorService class
static getYourServiceConnector(name?: string): YourConnector {
    return ConnectorService.getInstance<YourConnector>(TConnectorService.YourService, name);
}
```

#### 6. Verification

After integration, verify:

-   ✅ Service appears in `TServiceRegistry` type
-   ✅ Connector type in `TConnectorService` enum
-   ✅ Service instantiated in `boot.ts`
-   ✅ Default config in `SmythRuntime.class.ts`
-   ✅ Getter method in `ConnectorsService.ts`
-   ✅ Service class extends `ConnectorServiceProvider`
-   ✅ Connectors registered in service's `register()` method

#### Example: Scheduler Service Integration

```typescript
// 1. SRE.types.ts
import { SchedulerService } from '@sre/AgentManager/Scheduler.service';
export type TServiceRegistry = {
    Scheduler?: SchedulerService;
};
export enum TConnectorService {
    Scheduler = 'Scheduler',
}

// 2. Scheduler.service/index.ts
export class SchedulerService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Scheduler, 'LocalScheduler', LocalScheduler);
    }
}

// 3. boot.ts
import { SchedulerService } from '@sre/AgentManager/Scheduler.service';
service.Scheduler = new SchedulerService();

// 4. SmythRuntime.class.ts
Scheduler: {
    Connector: 'LocalScheduler',
    Settings: { autoStart: true },
},

// 5. ConnectorsService.ts
import { SchedulerConnector } from '@sre/AgentManager/Scheduler.service/SchedulerConnector';
static getSchedulerConnector(name?: string): SchedulerConnector {
    return ConnectorService.getInstance<SchedulerConnector>(TConnectorService.Scheduler, name);
}
```

### Key Patterns to Follow

1. **Connector Pattern**: Abstract base + concrete implementations
2. **Requester Pattern**: Public interface via `requester(candidate)`
3. **Access Control**: Decorator on all protected methods
4. **ACL Ownership**: Always preserve creator's Owner access
5. **Naming Convention**: `.class.ts` for classes, `.service.ts` for top-level services
6. **Isolation**: Candidate-scoped resources
7. **Serialization**: JSON for persistence, include ACL in stored data

### Summary

This scheduler service provides cron-like functionality with:

-   ✅ Full ACL-based access control
-   ✅ Multi-candidate isolation
-   ✅ Persistent local storage
-   ✅ Fluent schedule definition API
-   ✅ Automatic job execution
-   ✅ Pause/resume capabilities
-   ✅ Follows established SRE connector patterns

The implementation should be production-ready, well-tested, and consistent with existing SRE subsystems.
