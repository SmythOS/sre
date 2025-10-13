import {
    AccessCandidate,
    ConnectorService,
    DEFAULT_TEAM_ID,
    IScheduledJob,
    ISchedulerRequest,
    Job,
    Schedule,
    SchedulerConnector,
    TConnectorService,
} from '@smythos/sre';

import { SDKObject } from '../Core/SDKObject.class';
import { TSchedulerProvider } from '../types/generated/Scheduler.types';

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
    private _schedulerRequest: ISchedulerRequest;
    private _teamId: string;

    constructor(providerId?: TSchedulerProvider, schedulerSettings: any = {}, candidate?: AccessCandidate) {
        super();
        this._candidate = candidate || AccessCandidate.team(DEFAULT_TEAM_ID);

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
    async add(jobId: string, schedule: Schedule, job: Job): Promise<void> {
        try {
            await this._schedulerRequest.add(jobId, schedule, job);
        } catch (error) {
            console.error(`Error adding job ${jobId}:`, error);
            throw error;
        }
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
}
