import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL, TAccessRole } from '@sre/types/ACL.types';
import { Schedule, IScheduleData } from './Schedule.class';
import { Job, IJobConfig } from './Job.class';

/**
 * Scheduled job data structure
 */
export interface IScheduledJob {
    id: string;
    schedule: IScheduleData;
    jobConfig: IJobConfig; // Full job configuration (type, agentId, skillName/prompt, args, metadata)
    acl: IACL;
    status: 'active' | 'paused' | 'completed' | 'failed';
    lastRun?: string; // ISO 8601 date string
    nextRun?: string; // ISO 8601 date string
    createdBy: {
        role: TAccessRole;
        id: string;
    };
    executionHistory?: IJobExecution[];
}

/**
 * Job execution record
 */
export interface IJobExecution {
    timestamp: string; // ISO 8601 date string
    success: boolean;
    error?: string;
    executionTime: number; // milliseconds
    retries?: number;
}

/**
 * Public interface for scheduler operations
 */
export interface ISchedulerRequest {
    list(): Promise<IScheduledJob[]>;
    add(jobId: string, schedule: Schedule, job: Job): Promise<void>;
    delete(jobId: string): Promise<void>;
    get(jobId: string): Promise<IScheduledJob | undefined>;
    pause(jobId: string): Promise<void>;
    resume(jobId: string): Promise<void>;
}

/**
 * Abstract base class for scheduler connectors
 *
 * Follows the SRE connector pattern with ACL-based access control.
 * All operations are secured and candidate-scoped.
 *
 * @example
 * ```typescript
 * const scheduler = new LocalScheduler({ folder: '~/.smyth/scheduler' });
 * const candidate = new AccessCandidate(TAccessRole.User, 'user123');
 * const requester = scheduler.requester(candidate);
 *
 * // Add a scheduled job
 * const schedule = Schedule.every('10m');
 * const job = new Job(async () => {
 *     console.log('Job executed');
 * }, { name: 'My Job' });
 *
 * await requester.add('job1', schedule, job);
 *
 * // List jobs
 * const jobs = await requester.list();
 * ```
 */
export abstract class SchedulerConnector extends SecureConnector<ISchedulerRequest> {
    public abstract id: string;
    public abstract name: string;

    /**
     * Get ACL for a specific job resource
     * @param resourceId - Job ID
     * @param candidate - Access candidate
     */
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;

    /**
     * Create a requester interface for the given candidate
     * This wraps all protected methods with access control
     */
    public requester(candidate: AccessCandidate): ISchedulerRequest {
        return {
            list: async () => {
                return await this.list(candidate.readRequest);
            },
            add: async (jobId: string, schedule: Schedule, job: Job) => {
                await this.add(candidate.writeRequest, jobId, schedule, job);
            },
            delete: async (jobId: string) => {
                await this.delete(candidate.writeRequest, jobId);
            },
            get: async (jobId: string) => {
                return await this.get(candidate.readRequest, jobId);
            },
            pause: async (jobId: string) => {
                await this.pause(candidate.writeRequest, jobId);
            },
            resume: async (jobId: string) => {
                await this.resume(candidate.writeRequest, jobId);
            },
        };
    }

    /**
     * List all jobs for the candidate
     * @param acRequest - Access request
     */
    protected abstract list(acRequest: AccessRequest): Promise<IScheduledJob[]>;

    /**
     * Add or update a scheduled job
     * @param acRequest - Access request
     * @param jobId - Job identifier
     * @param schedule - Schedule definition
     * @param job - Job to execute
     */
    protected abstract add(acRequest: AccessRequest, jobId: string, schedule: Schedule, job: Job): Promise<void>;

    /**
     * Delete a scheduled job
     * @param acRequest - Access request
     * @param jobId - Job identifier
     */
    protected abstract delete(acRequest: AccessRequest, jobId: string): Promise<void>;

    /**
     * Get a specific job
     * @param acRequest - Access request
     * @param jobId - Job identifier
     */
    protected abstract get(acRequest: AccessRequest, jobId: string): Promise<IScheduledJob | undefined>;

    /**
     * Pause a scheduled job
     * @param acRequest - Access request
     * @param jobId - Job identifier
     */
    protected abstract pause(acRequest: AccessRequest, jobId: string): Promise<void>;

    /**
     * Resume a paused job
     * @param acRequest - Access request
     * @param jobId - Job identifier
     */
    protected abstract resume(acRequest: AccessRequest, jobId: string): Promise<void>;

    /**
     * Construct a unique job identifier scoped to the candidate
     * @param candidate - Access candidate
     * @param jobId - Job ID
     */
    protected constructJobKey(candidate: IAccessCandidate, jobId: string): string {
        return `${candidate.role}_${candidate.id}_${jobId}`;
    }
}
