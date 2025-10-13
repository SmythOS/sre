//==[ SRE: LocalScheduler ]======================

import { Logger } from '@sre/helpers/Log.helper';
import { SchedulerConnector, IScheduledJob, IJobExecution } from '../SchedulerConnector';
import { Schedule, IScheduleData } from '../Schedule.class';
import { Job, IJobConfig } from '../Job.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel } from '@sre/types/ACL.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import fs from 'fs';
import path from 'path';
import { findSmythPath } from '../../../..';

const console = Logger('LocalScheduler');

export type LocalSchedulerConfig = {
    /**
     * The folder to use for scheduler storage.
     * Defaults to ~/.smyth/scheduler
     */
    folder?: string;

    /**
     * Auto-start scheduler on initialization
     * Defaults to true
     */
    autoStart?: boolean;

    /**
     * Keep execution history
     * Defaults to true
     */
    persistExecutionHistory?: boolean;

    /**
     * Maximum execution history entries to keep per job
     * Defaults to 100
     */
    maxHistoryEntries?: number;
};

/**
 * Runtime job data structure
 */
interface ScheduledJobRuntime extends IScheduledJob {
    timerId?: NodeJS.Timeout; // Timer reference for cleanup
    candidateRole: string; // Owner's role (not serialized, implicit from folder)
    candidateId: string; // Owner's ID (not serialized, implicit from folder)
}

/**
 * LocalScheduler - Disk-based scheduler implementation
 *
 * Stores jobs in JSON files under ~/.smyth/scheduler/ (or configured folder).
 * Loads and schedules jobs on initialization.
 * Provides full ACL-based access control and candidate isolation.
 *
 * @example
 * ```typescript
 * const scheduler = new LocalScheduler({ folder: '~/.smyth/scheduler' });
 * const candidate = new AccessCandidate(TAccessRole.User, 'user123');
 * const requester = scheduler.requester(candidate);
 *
 * const schedule = Schedule.every('10m');
 * const job = new Job(async () => {
 *     console.log('Running scheduled task');
 * }, { name: 'My Periodic Job' });
 *
 * await requester.add('job1', schedule, job);
 * ```
 */
export class LocalScheduler extends SchedulerConnector {
    public name = 'LocalScheduler';
    public id = 'local';

    private folder: string;
    private jobsPrefix = 'jobs'; // Job configurations
    private runtimePrefix = '.jobs.runtime'; // Execution history and runtime data
    private jobs: Map<string, ScheduledJobRuntime> = new Map();
    private isInitialized = false;
    private config: Required<LocalSchedulerConfig>;

    constructor(protected _settings?: LocalSchedulerConfig) {
        super(_settings);

        this.config = {
            folder: _settings?.folder || '',
            autoStart: _settings?.autoStart !== false,
            persistExecutionHistory: _settings?.persistExecutionHistory !== false,
            maxHistoryEntries: _settings?.maxHistoryEntries || 100,
        };

        this.folder = this.findSchedulerFolder(this.config.folder);
        this.initialize();

        if (!fs.existsSync(this.folder)) {
            console.error(`Invalid folder provided: ${this.folder}`);
        }
    }

    /**
     * Find or create the scheduler storage folder
     */
    private findSchedulerFolder(folder?: string): string {
        let _schedulerFolder = folder;

        if (_schedulerFolder && fs.existsSync(_schedulerFolder)) {
            return _schedulerFolder;
        }

        _schedulerFolder = findSmythPath('scheduler');

        if (fs.existsSync(_schedulerFolder)) {
            console.warn('Using alternative scheduler folder found in : ', _schedulerFolder);
            return _schedulerFolder;
        }

        console.warn('!!! All attempts to find an existing scheduler folder failed !!!');
        console.warn('!!! I will use this folder: ', _schedulerFolder);
        return _schedulerFolder;
    }

    /**
     * Initialize the scheduler
     */
    private async initialize() {
        // Create jobs folder if not exists
        const jobsFolderPath = path.join(this.folder, this.jobsPrefix);
        if (!fs.existsSync(jobsFolderPath)) {
            fs.mkdirSync(jobsFolderPath, { recursive: true });
            fs.writeFileSync(
                path.join(jobsFolderPath, 'README_IMPORTANT.txt'),
                'This folder contains scheduler job configurations. Do not delete it.'
            );
        }

        // Create runtime folder if not exists
        const runtimeFolderPath = path.join(this.folder, this.runtimePrefix);
        if (!fs.existsSync(runtimeFolderPath)) {
            fs.mkdirSync(runtimeFolderPath, { recursive: true });
            fs.writeFileSync(
                path.join(runtimeFolderPath, 'README_IMPORTANT.txt'),
                'This folder contains scheduler runtime data and execution history. Safe to delete if needed.'
            );
        }

        // Load existing jobs if autoStart is enabled
        if (this.config.autoStart) {
            await this.loadJobsFromDisk();
        }

        this.isInitialized = true;
        console.info('LocalScheduler initialized');
    }

    /**
     * Get the candidate folder name based on role and id
     * Examples: "john.user", "developers.team", "bot1.agent"
     */
    private getCandidateFolderName(candidate: IAccessCandidate): string {
        return `${candidate.id}.${candidate.role}`;
    }

    /**
     * Get the job configuration file path
     * Format: scheduler/jobs/<username>.user/<jobId>.json
     */
    private getJobFilePath(candidate: IAccessCandidate, jobId: string, createFoldersIfNotExists: boolean = false): string {
        const candidateFolder = this.getCandidateFolderName(candidate);
        const fullPath = path.join(this.folder, this.jobsPrefix, candidateFolder, `${jobId}.json`);

        if (createFoldersIfNotExists) {
            const folder = path.dirname(fullPath);
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder, { recursive: true });
            }
        }

        return fullPath;
    }

    /**
     * Get the runtime data file path
     * Format: scheduler/.jobs.runtime/<username>.user/<jobId>.json
     */
    private getRuntimeFilePath(candidate: IAccessCandidate, jobId: string, createFoldersIfNotExists: boolean = false): string {
        const candidateFolder = this.getCandidateFolderName(candidate);
        const fullPath = path.join(this.folder, this.runtimePrefix, candidateFolder, `${jobId}.json`);

        if (createFoldersIfNotExists) {
            const folder = path.dirname(fullPath);
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder, { recursive: true });
            }
        }

        return fullPath;
    }

    /**
     * Load all jobs from disk and schedule active ones
     */
    private async loadJobsFromDisk() {
        try {
            const jobsFolderPath = path.join(this.folder, this.jobsPrefix);
            if (!fs.existsSync(jobsFolderPath)) {
                return;
            }

            // Iterate through candidate folders (format: "<id>.<role>")
            const candidateFolders = fs.readdirSync(jobsFolderPath).filter((f) => {
                const fullPath = path.join(jobsFolderPath, f);
                return fs.statSync(fullPath).isDirectory();
            });

            for (const candidateFolder of candidateFolders) {
                // Parse candidate info from folder name: "username.user" -> {id: "username", role: "user"}
                const lastDotIndex = candidateFolder.lastIndexOf('.');
                if (lastDotIndex === -1) {
                    console.warn(`Invalid candidate folder format: ${candidateFolder}`);
                    continue;
                }

                const candidateId = candidateFolder.substring(0, lastDotIndex);
                const candidateRole = candidateFolder.substring(lastDotIndex + 1);

                const candidate: IAccessCandidate = {
                    id: candidateId,
                    role: candidateRole as any, // Role is validated by folder structure
                };

                const candidatePath = path.join(jobsFolderPath, candidateFolder);
                const jobFiles = fs.readdirSync(candidatePath).filter((f) => f.endsWith('.json'));

                for (const file of jobFiles) {
                    try {
                        const filePath = path.join(candidatePath, file);
                        const data = fs.readFileSync(filePath, 'utf-8');
                        const jobConfig: Partial<ScheduledJobRuntime> = JSON.parse(data);

                        // Load runtime data if it exists
                        const runtimeData = await this.loadRuntimeDataFromDisk(candidate, jobConfig.id!);

                        // Merge config and runtime data
                        const jobData: ScheduledJobRuntime = {
                            ...jobConfig,
                            ...runtimeData,
                            candidateRole: candidate.role,
                            candidateId: candidate.id,
                        } as ScheduledJobRuntime;

                        // Construct job key based on candidate and job id
                        const jobKey = this.constructJobKey(candidate, jobData.id);

                        // Store in memory
                        this.jobs.set(jobKey, jobData);

                        // Schedule active jobs for execution
                        if (jobData.status === 'active') {
                            console.info(`Job ${jobData.id} loaded from ${candidateFolder} and scheduled for execution`);
                            await this.scheduleJob(jobData);
                        }
                    } catch (error) {
                        console.error(`Error loading job file ${file} from ${candidateFolder}:`, error);
                    }
                }
            }

            console.info(`Loaded ${this.jobs.size} jobs from disk`);
        } catch (error) {
            console.error('Error loading jobs from disk', error);
        }
    }

    /**
     * Save job configuration to disk (without execution history or candidate info)
     */
    private async saveJobToDisk(candidate: IAccessCandidate, jobData: ScheduledJobRuntime): Promise<void> {
        try {
            const filePath = this.getJobFilePath(candidate, jobData.id, true);

            // Don't serialize: timer, execution history, candidate info (implicit from folder), createdBy (deprecated)
            const { timerId, executionHistory, lastRun, nextRun, candidateRole, candidateId, createdBy, ...configData } = jobData;

            fs.writeFileSync(filePath, JSON.stringify(configData, null, 2), 'utf-8');
        } catch (error) {
            console.error(`Error saving job ${jobData.id} to disk`, error);
            throw error;
        }
    }

    /**
     * Save runtime data to disk (execution history, last run, next run)
     */
    private async saveRuntimeDataToDisk(candidate: IAccessCandidate, jobData: ScheduledJobRuntime): Promise<void> {
        try {
            const filePath = this.getRuntimeFilePath(candidate, jobData.id, true);

            const runtimeData = {
                executionHistory: jobData.executionHistory || [],
                lastRun: jobData.lastRun,
                nextRun: jobData.nextRun,
            };

            fs.writeFileSync(filePath, JSON.stringify(runtimeData, null, 2), 'utf-8');
        } catch (error) {
            console.error(`Error saving runtime data for job ${jobData.id}`, error);
            throw error;
        }
    }

    /**
     * Load runtime data from disk
     */
    private async loadRuntimeDataFromDisk(candidate: IAccessCandidate, jobId: string): Promise<Partial<ScheduledJobRuntime>> {
        try {
            const filePath = this.getRuntimeFilePath(candidate, jobId);
            if (!fs.existsSync(filePath)) {
                return {};
            }

            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error loading runtime data for job ${jobId}`, error);
            return {};
        }
    }

    /**
     * Delete job files from disk (both config and runtime)
     */
    private async deleteJobFromDisk(candidate: IAccessCandidate, jobId: string): Promise<void> {
        try {
            // Delete job configuration
            const jobFilePath = this.getJobFilePath(candidate, jobId);
            if (fs.existsSync(jobFilePath)) {
                fs.unlinkSync(jobFilePath);
            }

            // Delete runtime data
            const runtimeFilePath = this.getRuntimeFilePath(candidate, jobId);
            if (fs.existsSync(runtimeFilePath)) {
                fs.unlinkSync(runtimeFilePath);
            }
        } catch (error) {
            console.error(`Error deleting job ${jobId} from disk`, error);
            throw error;
        }
    }

    /**
     * Schedule a job for execution
     * Jobs are fully serializable and can be executed after restart
     */
    private async scheduleJob(jobData: ScheduledJobRuntime): Promise<void> {
        // Only schedule if job is active
        if (jobData.status !== 'active') {
            return;
        }

        const schedule = Schedule.fromJSON(jobData.schedule);

        // Validate schedule
        const validation = schedule.validate();
        if (!validation.valid) {
            console.error(`Invalid schedule for job ${jobData.id}: ${validation.error}`);
            return;
        }

        // For interval-based scheduling
        if (jobData.schedule.interval) {
            const intervalMs = Schedule.parseInterval(jobData.schedule.interval);

            // Schedule the job
            const timer = setInterval(async () => {
                await this.executeJob(jobData);
            }, intervalMs);

            // Store timer reference
            jobData.timerId = timer;

            // Execute immediately if no last run
            if (!jobData.lastRun) {
                await this.executeJob(jobData);
            }
        }

        // For cron-based scheduling (would require node-cron)
        if (jobData.schedule.cron) {
            console.warn(`Cron scheduling not yet implemented for job ${jobData.id}`);
        }
    }

    /**
     * Unschedule a job
     */
    private async unscheduleJob(jobId: string): Promise<void> {
        const jobData = this.jobs.get(jobId);
        if (jobData && jobData.timerId) {
            clearInterval(jobData.timerId);
            jobData.timerId = undefined;
        }
    }

    /**
     * Execute a job
     */
    private async executeJob(jobData: ScheduledJobRuntime): Promise<void> {
        if (!jobData.jobConfig) {
            console.warn(`Skipping execution of job ${jobData.id}: job configuration not available.`);
            return;
        }

        const schedule = Schedule.fromJSON(jobData.schedule);

        // Check if job should run (date range validation)
        if (!schedule.shouldRun()) {
            console.info(`Job ${jobData.id} skipped - outside schedule window`);
            return;
        }

        const job = Job.fromJSON(jobData.jobConfig);

        console.info(`Executing job ${jobData.id} (${jobData.jobConfig.metadata.name})`);

        const result = await job.executeWithRetry();

        // Update job data
        jobData.lastRun = new Date().toISOString();
        const nextRun = schedule.calculateNextRun(new Date(jobData.lastRun));
        jobData.nextRun = nextRun ? nextRun.toISOString() : undefined;

        if (!result.success) {
            console.error(`Job ${jobData.id} failed:`, result.error?.message);
            jobData.status = 'failed';
        }

        // Add to execution history
        if (this.config.persistExecutionHistory) {
            if (!jobData.executionHistory) {
                jobData.executionHistory = [];
            }

            jobData.executionHistory.unshift({
                timestamp: new Date().toISOString(),
                success: result.success,
                error: result.error?.message,
                executionTime: result.executionTime,
                retries: result.retries,
            });

            // Limit history size
            if (jobData.executionHistory.length > this.config.maxHistoryEntries) {
                jobData.executionHistory = jobData.executionHistory.slice(0, this.config.maxHistoryEntries);
            }
        }

        // Construct candidate object for file operations
        const candidate: IAccessCandidate = {
            role: jobData.candidateRole as any,
            id: jobData.candidateId,
        };

        // Save updated job configuration
        await this.saveJobToDisk(candidate, jobData);

        // Save runtime data (execution history)
        if (this.config.persistExecutionHistory) {
            await this.saveRuntimeDataToDisk(candidate, jobData);
        }
    }

    /**
     * Get resource ACL for a job
     */
    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const jobKey = this.constructJobKey(candidate, resourceId);
        const jobData = this.jobs.get(jobKey);

        if (!jobData) {
            // Resource doesn't exist, grant Owner access to allow creation
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }

        return ACL.from(jobData.acl);
    }

    @SecureConnector.AccessControl
    protected async list(acRequest: AccessRequest): Promise<IScheduledJob[]> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const result: IScheduledJob[] = [];

        // Filter jobs by candidate (using candidateRole and candidateId from folder structure)
        for (const [key, jobData] of this.jobs) {
            if (jobData.candidateRole === acRequest.candidate.role && jobData.candidateId === acRequest.candidate.id) {
                // Don't include timerId or internal candidate fields in the result
                const { timerId, candidateRole, candidateId, ...serializableData } = jobData;
                result.push(serializableData);
            }
        }

        return result;
    }

    @SecureConnector.AccessControl
    protected async add(acRequest: AccessRequest, jobId: string, schedule: Schedule, job: Job): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Validate schedule
        const validation = schedule.validate();
        if (!validation.valid) {
            throw new Error(`Invalid schedule: ${validation.error}`);
        }

        const jobKey = this.constructJobKey(acRequest.candidate, jobId);
        const existingJob = this.jobs.get(jobKey);

        // Create ACL
        let acl: ACL;
        if (existingJob) {
            // Preserve existing ACL with owner access
            acl = ACL.from(existingJob.acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner);
        } else {
            // New job - create ACL with owner access
            acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner);
        }

        // Calculate next run time
        const nextRun = schedule.calculateNextRun();

        const jobData: ScheduledJobRuntime = {
            id: jobId, // Use original jobId, not jobKey
            schedule: schedule.toJSON(),
            jobConfig: job.toJSON(),
            acl: acl.ACL,
            status: 'active',
            nextRun: nextRun ? nextRun.toISOString() : undefined,
            createdBy: {
                role: acRequest.candidate.role,
                id: acRequest.candidate.id,
            },
            candidateRole: acRequest.candidate.role,
            candidateId: acRequest.candidate.id,
            executionHistory: existingJob?.executionHistory || [],
        };

        // Unschedule existing job if updating
        if (existingJob) {
            await this.unscheduleJob(jobKey);
        }

        // Store in memory
        this.jobs.set(jobKey, jobData);

        // Save to disk
        await this.saveJobToDisk(acRequest.candidate, jobData);

        // Schedule for execution
        await this.scheduleJob(jobData);

        console.info(`Job ${jobId} added successfully`);
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, jobId: string): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const jobKey = this.constructJobKey(acRequest.candidate, jobId);
        const jobData = this.jobs.get(jobKey);

        if (!jobData) {
            throw new Error(`Job ${jobId} not found`);
        }

        // Unschedule
        await this.unscheduleJob(jobKey);

        // Remove from memory
        this.jobs.delete(jobKey);

        // Delete from disk
        await this.deleteJobFromDisk(acRequest.candidate, jobId);

        console.info(`Job ${jobId} deleted successfully`);
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, jobId: string): Promise<IScheduledJob | undefined> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const jobKey = this.constructJobKey(acRequest.candidate, jobId);
        const jobData = this.jobs.get(jobKey);

        if (!jobData) {
            return undefined;
        }

        // Don't include timerId or internal candidate fields in the result
        const { timerId, candidateRole, candidateId, ...serializableData } = jobData;
        return serializableData;
    }

    @SecureConnector.AccessControl
    protected async pause(acRequest: AccessRequest, jobId: string): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const jobKey = this.constructJobKey(acRequest.candidate, jobId);
        const jobData = this.jobs.get(jobKey);

        if (!jobData) {
            throw new Error(`Job ${jobId} not found`);
        }

        if (jobData.status === 'paused') {
            return; // Already paused
        }

        // Unschedule
        await this.unscheduleJob(jobKey);

        // Update status
        jobData.status = 'paused';

        // Save to disk
        await this.saveJobToDisk(acRequest.candidate, jobData);

        console.info(`Job ${jobId} paused`);
    }

    @SecureConnector.AccessControl
    protected async resume(acRequest: AccessRequest, jobId: string): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const jobKey = this.constructJobKey(acRequest.candidate, jobId);
        const jobData = this.jobs.get(jobKey);

        if (!jobData) {
            throw new Error(`Job ${jobId} not found`);
        }

        if (jobData.status !== 'paused') {
            return; // Not paused
        }

        // Update status
        jobData.status = 'active';

        // Save to disk
        await this.saveJobToDisk(acRequest.candidate, jobData);

        // Schedule for execution
        await this.scheduleJob(jobData);

        console.info(`Job ${jobId} resumed`);
    }

    /**
     * Cleanup - stop all scheduled jobs
     */
    public async shutdown(): Promise<void> {
        console.info('Shutting down LocalScheduler...');

        for (const [jobId, jobData] of this.jobs) {
            if (jobData.timerId) {
                await this.unscheduleJob(jobId);
            }
        }

        console.info('LocalScheduler shutdown complete');
    }
}
