import { beforeAll, describe, expect, it } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { Schedule } from '@sre/AgentManager/Scheduler.service/Schedule.class';
import { Job } from '@sre/AgentManager/Scheduler.service/Job.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { LocalScheduler } from '@sre/AgentManager/Scheduler.service/connectors/LocalScheduler.class';

beforeAll(() => {
    setupSRE({
        Log: { Connector: 'ConsoleLog' },
    });
});

describe('Schedule - Unit tests for Schedule builder', () => {
    it('should create interval-based schedule', () => {
        const schedule = Schedule.every('10m');
        const data = schedule.toJSON();

        expect(data.interval).toBe('10m');
        expect(data.cron).toBeUndefined();
    });

    it('should create cron-based schedule', () => {
        const schedule = Schedule.cron('0 0 * * *');
        const data = schedule.toJSON();

        expect(data.cron).toBe('0 0 * * *');
        expect(data.interval).toBeUndefined();
    });

    it('should support fluent API with start/end dates', () => {
        const start = new Date('2025-01-01');
        const end = new Date('2025-12-31');

        const schedule = Schedule.every('1h').starts(start).ends(end);
        const data = schedule.toJSON();

        expect(data.interval).toBe('1h');
        expect(data.startDate).toBe(start.toISOString());
        expect(data.endDate).toBe(end.toISOString());
    });

    it('should serialize and deserialize correctly', () => {
        const original = Schedule.every('30s').starts(new Date('2025-06-01'));
        const json = original.toJSON();
        const restored = Schedule.fromJSON(json);

        expect(restored.toJSON()).toEqual(original.toJSON());
    });

    it('should validate schedule correctly', () => {
        const valid = Schedule.every('10m');
        expect(valid.validate().valid).toBe(true);

        const noCron = Schedule.fromJSON({});
        expect(noCron.validate().valid).toBe(false);
    });

    it('should parse intervals correctly', () => {
        expect(Schedule.parseInterval('10s')).toBe(10000);
        expect(Schedule.parseInterval('5m')).toBe(300000);
        expect(Schedule.parseInterval('2h')).toBe(7200000);
        expect(Schedule.parseInterval('1d')).toBe(86400000);
        expect(Schedule.parseInterval('1w')).toBe(604800000);
    });

    it('should reject invalid interval formats', () => {
        expect(() => Schedule.parseInterval('invalid')).toThrow();
        expect(() => Schedule.parseInterval('10x')).toThrow();
    });

    it('should calculate next run time for intervals', () => {
        const schedule = Schedule.every('10m');
        const lastRun = new Date('2025-01-01T10:00:00Z');
        const nextRun = schedule.calculateNextRun(lastRun);

        expect(nextRun).toBeInstanceOf(Date);
        expect(nextRun?.getTime()).toBe(lastRun.getTime() + 600000);
    });

    it('should respect date ranges in shouldRun', () => {
        const future = new Date(Date.now() + 86400000); // Tomorrow
        const past = new Date(Date.now() - 86400000); // Yesterday

        const scheduleNotStarted = Schedule.every('1h').starts(future);
        expect(scheduleNotStarted.shouldRun()).toBe(false);

        const scheduleEnded = Schedule.every('1h').ends(past);
        expect(scheduleEnded.shouldRun()).toBe(false);

        const scheduleActive = Schedule.every('1h');
        expect(scheduleActive.shouldRun()).toBe(true);
    });
});

describe('Job - Unit tests for Job wrapper with new API', () => {
    it('should create skill-based job', () => {
        const job = new Job({
            type: 'skill',
            agentId: 'test-agent',
            skillName: 'test_skill',
            args: { input: 'test' },
            metadata: {
                name: 'Test Job',
                description: 'A test job',
            },
        });

        expect(job.getMetadata().name).toBe('Test Job');
        expect(job.getConfig().type).toBe('skill');
        expect(job.getConfig().agentId).toBe('test-agent');
        if (job.getConfig().type === 'skill') {
            expect(job.getConfig().skillName).toBe('test_skill');
        }
    });

    it('should create prompt-based job', () => {
        const job = new Job({
            type: 'prompt',
            agentId: 'test-agent',
            prompt: 'Do something intelligent',
            metadata: {
                name: 'AI Job',
            },
        });

        expect(job.getMetadata().name).toBe('AI Job');
        expect(job.getConfig().type).toBe('prompt');
        if (job.getConfig().type === 'prompt') {
            expect(job.getConfig().prompt).toBe('Do something intelligent');
        }
    });

    it('should require agentId', () => {
        expect(() => {
            new Job({
                type: 'skill',
                agentId: '',
                skillName: 'test',
                metadata: { name: 'Test' },
            } as any);
        }).toThrow('agentId');
    });

    it('should require skillName for skill jobs', () => {
        expect(() => {
            new Job({
                type: 'skill',
                agentId: 'test',
                metadata: { name: 'Test' },
            } as any);
        }).toThrow('skillName');
    });

    it('should require prompt for prompt jobs', () => {
        expect(() => {
            new Job({
                type: 'prompt',
                agentId: 'test',
                metadata: { name: 'Test' },
            } as any);
        }).toThrow('prompt');
    });

    it('should require name in metadata', () => {
        expect(() => {
            new Job({
                type: 'skill',
                agentId: 'test',
                skillName: 'test',
                metadata: {} as any,
            });
        }).toThrow('name');
    });

    it('should serialize to JSON completely', () => {
        const job = new Job({
            type: 'skill',
            agentId: 'test-agent',
            skillName: 'process_data',
            args: { input: 'test' },
            metadata: {
                name: 'Serialize Test',
                description: 'Test job',
                tags: ['test'],
            },
        });

        const json = job.toJSON();

        expect(json.type).toBe('skill');
        expect(json.agentId).toBe('test-agent');
        expect(json.metadata.name).toBe('Serialize Test');
        expect(json.metadata.description).toBe('Test job');
        expect(json.metadata.tags).toEqual(['test']);
        if (json.type === 'skill') {
            expect(json.skillName).toBe('process_data');
            expect(json.args).toEqual({ input: 'test' });
        }
    });

    it('should reconstruct job from JSON', () => {
        const config = {
            type: 'skill' as const,
            agentId: 'test-agent',
            skillName: 'restore_skill',
            args: { test: 'data' },
            metadata: {
                name: 'Restored Job',
                description: 'Restored from JSON',
            },
        };

        const job = Job.fromJSON(config);

        expect(job.getMetadata().name).toBe('Restored Job');
        expect(job.getConfig().type).toBe('skill');
        expect(job.getConfig().agentId).toBe('test-agent');
    });

    it('should handle prompt job serialization', () => {
        const job = new Job({
            type: 'prompt',
            agentId: 'ai-agent',
            prompt: 'Analyze this data',
            metadata: {
                name: 'AI Analysis',
                tags: ['ai', 'analysis'],
            },
        });

        const json = job.toJSON();
        const restored = Job.fromJSON(json);

        expect(restored.getConfig().type).toBe('prompt');
        if (restored.getConfig().type === 'prompt') {
            expect(restored.getConfig().prompt).toBe('Analyze this data');
        }
    });
});

describe('LocalScheduler - Unit tests for scheduler internals', () => {
    it('should construct job keys with candidate scope', () => {
        const scheduler = new LocalScheduler({ autoStart: false });
        const candidate = AccessCandidate.user('user123');

        const key = (scheduler as any).constructJobKey(candidate, 'myJob');

        expect(key).toBe('user_user123_myJob');
    });

    it('should grant Owner ACL before job creation', async () => {
        const scheduler = new LocalScheduler({ autoStart: false });
        const candidate = AccessCandidate.user('test-user');

        const acl = await scheduler.getResourceACL('newJob', candidate);

        expect(acl.checkExactAccess(candidate.ownerRequest)).toBe(true);
    });

    it('should add job with proper ACL', async () => {
        const scheduler = new LocalScheduler({ autoStart: false });
        const candidate = AccessCandidate.user('test-user');
        const requester = scheduler.requester(candidate);

        const schedule = Schedule.every('1m');
        const job = new Job({
            type: 'skill',
            agentId: 'test-agent',
            skillName: 'test_skill',
            metadata: { name: 'Test Job' },
        });

        await requester.add('job1', schedule, job);

        const jobs = await requester.list();
        expect(jobs.length).toBe(1);
        expect(jobs[0].jobConfig.metadata.name).toBe('Test Job');
        expect(jobs[0].createdBy.id).toBe('test-user');
    });

    it('should isolate jobs between candidates', async () => {
        const scheduler = new LocalScheduler({ autoStart: false });

        const user1 = AccessCandidate.user('user1');
        const user2 = AccessCandidate.user('user2');

        const schedule = Schedule.every('1m');
        const job = new Job({
            type: 'skill',
            agentId: 'test-agent',
            skillName: 'test_skill',
            metadata: { name: 'Test Job' },
        });

        await scheduler.requester(user1).add('job1', schedule, job);
        await scheduler.requester(user2).add('job1', schedule, job);

        const user1Jobs = await scheduler.requester(user1).list();
        const user2Jobs = await scheduler.requester(user2).list();

        expect(user1Jobs.length).toBe(1);
        expect(user2Jobs.length).toBe(1);
        expect(user1Jobs[0].createdBy.id).toBe('user1');
        expect(user2Jobs[0].createdBy.id).toBe('user2');
    });

    it('should delete job correctly', async () => {
        const scheduler = new LocalScheduler({ autoStart: false });
        const candidate = AccessCandidate.user('test-user');
        const requester = scheduler.requester(candidate);

        const schedule = Schedule.every('1m');
        const job = new Job({
            type: 'prompt',
            agentId: 'test-agent',
            prompt: 'Test prompt',
            metadata: { name: 'To Delete' },
        });

        await requester.add('job1', schedule, job);
        expect((await requester.list()).length).toBe(1);

        await requester.delete('job1');
        expect((await requester.list()).length).toBe(0);
    });

    it('should pause and resume jobs', async () => {
        const scheduler = new LocalScheduler({ autoStart: false });
        const candidate = AccessCandidate.user('test-user');
        const requester = scheduler.requester(candidate);

        const schedule = Schedule.every('1m');
        const job = new Job({
            type: 'skill',
            agentId: 'test-agent',
            skillName: 'test_skill',
            metadata: { name: 'Pause Test' },
        });

        await requester.add('job1', schedule, job);

        let jobData = await requester.get('job1');
        expect(jobData?.status).toBe('active');

        await requester.pause('job1');
        jobData = await requester.get('job1');
        expect(jobData?.status).toBe('paused');

        await requester.resume('job1');
        jobData = await requester.get('job1');
        expect(jobData?.status).toBe('active');
    });

    it('should validate schedule before adding', async () => {
        const scheduler = new LocalScheduler({ autoStart: false });
        const candidate = AccessCandidate.user('test-user');
        const requester = scheduler.requester(candidate);

        const invalidSchedule = Schedule.fromJSON({ interval: 'invalid' });
        const job = new Job({
            type: 'skill',
            agentId: 'test-agent',
            skillName: 'test_skill',
            metadata: { name: 'Invalid Schedule' },
        });

        await expect(requester.add('job1', invalidSchedule, job)).rejects.toThrow();
    });

    it('should preserve ACL ownership on updates', async () => {
        const scheduler = new LocalScheduler({ autoStart: false });
        const owner = AccessCandidate.user('owner');
        const requester = scheduler.requester(owner);

        const schedule = Schedule.every('1m');
        const job1 = new Job({
            type: 'skill',
            agentId: 'test-agent',
            skillName: 'skill1',
            metadata: { name: 'Original' },
        });
        const job2 = new Job({
            type: 'skill',
            agentId: 'test-agent',
            skillName: 'skill2',
            metadata: { name: 'Updated' },
        });

        // Create job
        await requester.add('job1', schedule, job1);

        // Update job
        await requester.add('job1', schedule, job2);

        // Verify ownership is preserved
        const jobData = await requester.get('job1');
        expect(jobData?.jobConfig.metadata.name).toBe('Updated');
        expect(jobData?.createdBy.id).toBe('owner');

        const acl = await scheduler.getResourceACL('job1', owner);
        expect(acl.checkExactAccess(owner.ownerRequest)).toBe(true);
    });

    it('should store jobConfig in scheduled jobs', async () => {
        const scheduler = new LocalScheduler({ autoStart: false });
        const candidate = AccessCandidate.user('test-user');
        const requester = scheduler.requester(candidate);

        const schedule = Schedule.every('5m');
        const job = new Job({
            type: 'skill',
            agentId: 'data-agent',
            skillName: 'process_batch',
            args: { batchId: '123' },
            metadata: {
                name: 'Batch Processor',
                retryOnFailure: true,
                maxRetries: 3,
            },
        });

        await requester.add('batch-job', schedule, job);

        const jobs = await requester.list();
        expect(jobs.length).toBe(1);
        expect(jobs[0].jobConfig.type).toBe('skill');
        expect(jobs[0].jobConfig.agentId).toBe('data-agent');
        if (jobs[0].jobConfig.type === 'skill') {
            expect(jobs[0].jobConfig.skillName).toBe('process_batch');
            expect(jobs[0].jobConfig.args).toEqual({ batchId: '123' });
        }
    });
});
