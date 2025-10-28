import {
    AccessCandidate,
    ConnectorService,
    DEFAULT_TEAM_ID,
    IScheduledJob,
    ISchedulerRequest,
    IJobMetadata,
    Job,
    Schedule,
    SchedulerConnector,
    TConnectorService,
} from '@smythos/sre';

import { SDKObject } from '../Core/SDKObject.class';
import { TSchedulerProvider } from '../types/generated/Scheduler.types';
import { Agent } from '../Agent/Agent.class';
import EventEmitter from 'events';

/**
 * Simple hash function to generate a short unique ID from a string.
 * Not cryptographically secure - just for generating unique job IDs.
 */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Builder class for creating scheduled jobs with chainable syntax.
 * Requires calling `.every()` or `.cron()` to actually schedule the job.
 * After scheduling, provides methods to pause, resume, or delete the job.
 *
 * @internal
 */
class SchedulerJobCommand {
    private _schedulerRequest: ISchedulerRequest;
    private _jobId: string;
    private _jobConfig: any;
    private _scheduled: boolean = false;
    private job: Job;
    private _scheduledJob: IScheduledJob;

    constructor(schedulerRequest: ISchedulerRequest, jobId: string, jobConfig: any) {
        this._schedulerRequest = schedulerRequest;
        this._jobId = jobId;
        this._jobConfig = jobConfig;
    }

    /**
     * Complete the job scheduling with an interval.
     * Returns the builder to allow job control operations.
     *
     * @param interval - Time interval (e.g., '5s', '10m', '1h', '1d')
     * @returns The builder instance with pause, resume, and delete methods
     *
     * @example
     * ```typescript
     * const job = await scheduler.call('skill-name', args).every('5s');
     * // Later, you can pause, resume, or delete the job
     * await job.pause();
     * await job.resume();
     * await job.delete();
     * ```
     */
    async every(interval: string): Promise<void> {
        this._scheduled = true;
        this.job = new Job(this._jobConfig);
        const schedule = Schedule.every(interval);
        await this._schedulerRequest.add(this._jobId, this.job, schedule);
    }

    /**
     * Complete the job scheduling with a cron expression.
     *
     * @param cronExpression - Cron expression (e.g., '0 0 * * *' for daily at midnight)
     * @returns The builder instance with pause, resume, and delete methods
     *
     * @example
     * ```typescript
     * const job = await scheduler.call('backup', {}).cron('0 0 * * *');
     * await job.pause();
     * ```
     */
    //TODO : implement cron scheduling
    // async cron(cronExpression: string): Promise<this> {
    //     this._scheduled = true;
    //     const job = new Job(this._jobConfig);
    //     const schedule = Schedule.cron(cronExpression);
    //     await this._schedulerRequest.add(this._jobId, job, schedule);
    //     return this;
    // }

    /**
     * Pause the scheduled job.
     *
     * @returns Promise that resolves when the job is paused
     *
     * @example
     * ```typescript
     * const job = await scheduler.call('backup', {}).every('1h');
     * await job.pause();
     * ```
     */
    async pause(): Promise<void> {
        await this._schedulerRequest.pause(this._jobId);
    }

    /**
     * Resume a paused job.
     *
     * @returns Promise that resolves when the job is resumed
     *
     * @example
     * ```typescript
     * const job = await scheduler.call('backup', {}).every('1h');
     * await job.pause();
     * // Later...
     * await job.resume();
     * ```
     */
    async resume(): Promise<void> {
        await this._schedulerRequest.resume(this._jobId);
    }

    /**
     * Delete the scheduled job permanently.
     *
     * @returns Promise that resolves when the job is deleted
     *
     * @example
     * ```typescript
     * const job = await scheduler.call('backup', {}).every('1h');
     * // Later, when no longer needed...
     * await job.delete();
     * ```
     */
    async delete(): Promise<void> {
        await this._schedulerRequest.delete(this._jobId);
    }

    /**
     * Override the then() method to detect when the builder is awaited without calling .every() or .cron().
     * This makes the builder thenable, but will warn if scheduling is not completed properly.
     */
    then<TResult1 = void, TResult2 = never>(
        onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        if (!this._scheduled) {
            const warning =
                `⚠️  Warning: Job '${this._jobId}' was not scheduled.\n` +
                `   Complete the chain with .every('interval') in order to schedule the job.`;
            console.warn(warning);
        }
        return Promise.resolve().then(onfulfilled, onrejected);
    }
}

/**
 * SDK wrapper for Scheduler operations.
 * Provides a simplified interface for scheduling and managing jobs.
 *
 * @example
 * ```typescript
 * const scheduler = new SchedulerInstance('LocalScheduler', {}, AccessCandidate.agent('my-agent'));
 *
 * await scheduler.add('cleanup', Schedule.every('1h'), new Job(
 *   async () => console.log('Cleanup'),
 *   { name: 'Cleanup Job' }
 * ));
 * ```
 */
export class SchedulerInstance extends SDKObject {
    private _candidate: AccessCandidate;
    private _agent: Agent;
    private _schedulerRequest: ISchedulerRequest;
    private _teamId: string;

    constructor(providerId?: TSchedulerProvider, schedulerSettings: any = {}, candidate?: AccessCandidate | Agent) {
        super();
        this._agent = candidate instanceof Agent ? (candidate as Agent) : (undefined as Agent);
        this._candidate = this._agent
            ? AccessCandidate.agent(this._agent.id)
            : (candidate as AccessCandidate) || AccessCandidate.team(DEFAULT_TEAM_ID);

        // Get or initialize the scheduler connector
        let connector = ConnectorService.getSchedulerConnector(providerId || '');

        if (!connector?.valid) {
            connector = ConnectorService.init(TConnectorService.Scheduler, providerId, providerId, schedulerSettings);

            if (!connector?.valid) {
                console.error(`Scheduler connector ${providerId} is not available`);
                throw new Error(`Scheduler connector ${providerId} is not available`);
            }
        }

        const instance: SchedulerConnector = connector.instance(schedulerSettings || connector.settings);
        this._schedulerRequest = instance.requester(this._candidate);
    }

    public on(event: string, listener: (...args: any[]) => void): this {
        this._schedulerRequest.on(event, listener);
        return this;
    }

    public off(event: string, listener: (...args: any[]) => void): this {
        this._schedulerRequest.off(event, listener);
        return this;
    }
    /**
     * Add or update a scheduled job.
     * If a job with the same ID exists, it will be updated.
     *
     * @param jobId - Unique identifier for the job
     * @param schedule - Schedule definition (interval or cron)
     * @param job - Job instance with execution function and metadata
     * @returns Promise that resolves when the job is scheduled
     *
     * @example
     * ```typescript
     * await scheduler.add('backup',
     *   Schedule.every('6h'),
     *   new Job(async () => {
     *     console.log('Running backup...');
     *   }, {
     *     name: 'Backup Job',
     *     retryOnFailure: true
     *   })
     * );
     * ```
     */
    async add(jobId: string, job: Job, schedule: Schedule): Promise<boolean> {
        try {
            await this._schedulerRequest.add(jobId, job, schedule);
            return true;
        } catch (error) {
            console.error(`❌ Error adding job ${jobId}:`, error.message || error);
        }
        return false;
    }

    /**
     * List all scheduled jobs for this candidate.
     *
     * @returns Promise that resolves to an array of scheduled jobs
     *
     * @example
     * ```typescript
     * const jobs = await scheduler.list();
     * jobs.forEach(job => {
     *   console.log(`${job.metadata.name}: ${job.status}`);
     * });
     * ```
     */
    async list(): Promise<IScheduledJob[]> {
        try {
            return await this._schedulerRequest.list();
        } catch (error) {
            console.error('Error listing jobs:', error);
            throw error;
        }
    }

    /**
     * Get details of a specific scheduled job.
     *
     * @param jobId - Unique identifier of the job
     * @returns Promise that resolves to the job details, or undefined if not found
     *
     * @example
     * ```typescript
     * const job = await scheduler.get('backup');
     * if (job) {
     *   console.log(`Status: ${job.status}`);
     *   console.log(`Next run: ${job.nextRun}`);
     * }
     * ```
     */
    async get(jobId: string): Promise<IScheduledJob | undefined> {
        try {
            return await this._schedulerRequest.get(jobId);
        } catch (error) {
            console.error(`Error getting job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Pause a scheduled job.
     * The job will not execute until resumed.
     *
     * @param jobId - Unique identifier of the job to pause
     * @returns Promise that resolves when the job is paused
     *
     * @example
     * ```typescript
     * await scheduler.pause('backup');
     * console.log('Backup job paused');
     * ```
     */
    async pause(jobId: string): Promise<void> {
        try {
            await this._schedulerRequest.pause(jobId);
        } catch (error) {
            console.error(`Error pausing job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Resume a paused job.
     * The job will start executing according to its schedule.
     *
     * @param jobId - Unique identifier of the job to resume
     * @returns Promise that resolves when the job is resumed
     *
     * @example
     * ```typescript
     * await scheduler.resume('backup');
     * console.log('Backup job resumed');
     * ```
     */
    async resume(jobId: string): Promise<void> {
        try {
            await this._schedulerRequest.resume(jobId);
        } catch (error) {
            console.error(`Error resuming job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Delete a scheduled job.
     * This removes the job permanently and stops all scheduled executions.
     *
     * @param jobId - Unique identifier of the job to delete
     * @returns Promise that resolves when the job is deleted
     *
     * @example
     * ```typescript
     * await scheduler.delete('backup');
     * console.log('Backup job deleted');
     * ```
     */
    async delete(jobId: string): Promise<void> {
        try {
            await this._schedulerRequest.delete(jobId);
        } catch (error) {
            console.error(`Error deleting job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Schedule an agent skill execution with chainable syntax.
     * Requires an agent to be associated with this scheduler instance.
     *
     * @param skillName - Name of the skill to execute
     * @param args - Arguments to pass to the skill
     * @param metadata - Optional job metadata (name, description, retryOnFailure, etc.)
     * @returns SchedulerJobBuilder that can be chained with .every() or .cron()
     *
     * @throws Error if no agent is associated with this scheduler
     *
     * @example
     * ```typescript
     * // Schedule a skill to run every 5 seconds
     * await scheduler.call('processData', { input: 'test' }, { name: 'Data Processor' }).every('5s');
     *
     * // Schedule with cron expression
     * await scheduler.call('backup', {}, { retryOnFailure: true }).cron('0 0 * * *');
     * ```
     */
    call(skillName: string, args?: Record<string, any> | any[], metadata?: IJobMetadata): SchedulerJobCommand {
        if (!this._agent) {
            throw new Error('Cannot use .call() without an agent. ');
        }

        const jobId = `${this._agent.id}-skill-${skillName}`;
        const jobConfig = {
            type: 'skill' as const,
            agentId: this._agent.id,
            skillName: skillName,
            args: args,
            metadata: metadata,
        };

        return new SchedulerJobCommand(this._schedulerRequest, jobId, jobConfig);
    }

    /**
     * Schedule an agent prompt execution with chainable syntax.
     * Requires an agent to be associated with this scheduler instance.
     *
     * @param prompt - The prompt text to send to the agent
     * @param metadata - Optional job metadata (name, description, retryOnFailure, etc.)
     * @returns SchedulerJobBuilder that can be chained with .every() or .cron()
     *
     * @throws Error if no agent is associated with this scheduler
     *
     * @example
     * ```typescript
     * // Schedule a prompt to run every hour
     * await scheduler.prompt('Generate daily report', { name: 'Daily Report' }).every('1h');
     *
     * // Schedule with cron expression
     * await scheduler.prompt('Summarize news', { name: 'News Summary' }).cron('0 9 * * *');
     * ```
     */
    prompt(prompt: string, metadata?: IJobMetadata): SchedulerJobCommand {
        if (!this._agent) {
            throw new Error(
                'Cannot use .prompt() without an agent. ' +
                    'Please provide an Agent instance when creating the SchedulerInstance: ' +
                    'new SchedulerInstance(provider, settings, agent)'
            );
        }

        const promptHash = simpleHash(prompt);
        const jobId = `${this._agent.id}-prompt-${promptHash}`;
        const jobConfig = {
            type: 'prompt' as const,
            agentId: this._agent.id,
            prompt: prompt,
            metadata: metadata,
        };

        return new SchedulerJobCommand(this._schedulerRequest, jobId, jobConfig);
    }

    /**
     * Schedule an agent trigger execution with chainable syntax.
     * Requires an agent to be associated with this scheduler instance.
     *
     * @param triggerName - Name of the trigger to execute
     * @param metadata - Optional job metadata (name, description, retryOnFailure, etc.)
     * @returns SchedulerJobBuilder that can be chained with .every() or .cron()
     *
     * @throws Error if no agent is associated with this scheduler
     *
     * @example
     * ```typescript
     * // Schedule a trigger to run every day
     * await scheduler.trigger('daily-sync', { name: 'Daily Sync' }).every('1d');
     *
     * // Schedule with cron expression
     * await scheduler.trigger('weekly-report', { name: 'Weekly Report' }).cron('0 0 * * 0');
     * ```
     */
    trigger(triggerName: string, metadata?: IJobMetadata): SchedulerJobCommand {
        if (!this._agent) {
            throw new Error(
                'Cannot use .trigger() without an agent. ' +
                    'Please provide an Agent instance when creating the SchedulerInstance: ' +
                    'new SchedulerInstance(provider, settings, agent)'
            );
        }

        const jobId = `${this._agent.id}-trigger-${triggerName}`;
        const jobConfig = {
            type: 'trigger' as const,
            agentId: this._agent.id,
            triggerName: triggerName,
            metadata: metadata,
        };

        return new SchedulerJobCommand(this._schedulerRequest, jobId, jobConfig);
    }
}
