import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { LocalScheduler } from '@sre/AgentManager/Scheduler.service/connectors/LocalScheduler.class';
import { Schedule } from '@sre/AgentManager/Scheduler.service/Schedule.class';
import { Job } from '@sre/AgentManager/Scheduler.service/Job.class';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Create temporary test folder
const TEST_FOLDER = path.join(os.tmpdir(), `sre-scheduler-test-${Date.now()}`);

beforeAll(() => {
    setupSRE({
        Log: { Connector: 'ConsoleLog' },
    });

    // Create test folder
    if (!fs.existsSync(TEST_FOLDER)) {
        fs.mkdirSync(TEST_FOLDER, { recursive: true });
    }
});

afterAll(async () => {
    // Cleanup test folder
    if (fs.existsSync(TEST_FOLDER)) {
        const files = fs.readdirSync(TEST_FOLDER);
        for (const file of files) {
            fs.unlinkSync(path.join(TEST_FOLDER, file));
        }
        fs.rmdirSync(TEST_FOLDER);
    }
});

describe('LocalScheduler - Integration tests with real file system', () => {
    describe('Job Persistence', () => {
        it('should persist jobs to disk', async () => {
            const scheduler = new LocalScheduler({
                folder: TEST_FOLDER,
                autoStart: false,
            });

            const candidate = AccessCandidate.user('persist-test');
            const requester = scheduler.requester(candidate);

            const schedule = Schedule.every('5m');
            const job = new Job(
                async () => {
                    console.log('Persistent job');
                },
                { name: 'Persistent Job' }
            );

            await requester.add('persist-job', schedule, job);

            // Verify file exists
            const files = fs.readdirSync(TEST_FOLDER);
            const jobFiles = files.filter((f) => f.includes('persist-job') && f.endsWith('.json'));

            expect(jobFiles.length).toBe(1);

            // Verify file content
            const filePath = path.join(TEST_FOLDER, jobFiles[0]);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            expect(content.metadata.name).toBe('Persistent Job');
            expect(content.schedule.interval).toBe('5m');
            expect(content.status).toBe('active');

            await scheduler.shutdown();
        });

        it('should load jobs from disk on startup', async () => {
            // Create a job file manually
            const jobData = {
                id: 'user_load-test_preloaded-job',
                schedule: { interval: '10m' },
                metadata: { name: 'Preloaded Job' },
                acl: { user: { 'load-test': 'owner' } },
                status: 'active',
                createdBy: { role: 'user', id: 'load-test' },
            };

            fs.writeFileSync(path.join(TEST_FOLDER, 'user_load-test_preloaded-job.json'), JSON.stringify(jobData, null, 2));

            // Create scheduler (should load the job)
            const scheduler = new LocalScheduler({
                folder: TEST_FOLDER,
                autoStart: true,
            });

            const candidate = AccessCandidate.user('load-test');
            const requester = scheduler.requester(candidate);

            const jobs = await requester.list();

            expect(jobs.length).toBe(1);
            expect(jobs[0].metadata.name).toBe('Preloaded Job');

            await scheduler.shutdown();
        });

        it('should update existing job on disk', async () => {
            const scheduler = new LocalScheduler({
                folder: TEST_FOLDER,
                autoStart: false,
            });

            const candidate = AccessCandidate.user('update-test');
            const requester = scheduler.requester(candidate);

            // Create initial job
            const schedule1 = Schedule.every('5m');
            const job1 = new Job(async () => {}, { name: 'Original' });
            await requester.add('update-job', schedule1, job1);

            // Update job
            const schedule2 = Schedule.every('10m');
            const job2 = new Job(async () => {}, { name: 'Updated' });
            await requester.add('update-job', schedule2, job2);

            const jobs = await requester.list();

            expect(jobs.length).toBe(1);
            expect(jobs[0].metadata.name).toBe('Updated');
            expect(jobs[0].schedule.interval).toBe('10m');

            await scheduler.shutdown();
        });

        it('should delete job from disk', async () => {
            const scheduler = new LocalScheduler({
                folder: TEST_FOLDER,
                autoStart: false,
            });

            const candidate = AccessCandidate.user('delete-test');
            const requester = scheduler.requester(candidate);

            const schedule = Schedule.every('1m');
            const job = new Job(async () => {}, { name: 'To Delete' });

            await requester.add('delete-job', schedule, job);

            // Verify file exists
            let files = fs.readdirSync(TEST_FOLDER);
            let jobFiles = files.filter((f) => f.includes('delete-job'));
            expect(jobFiles.length).toBeGreaterThan(0);

            await requester.delete('delete-job');

            // Verify file is deleted
            files = fs.readdirSync(TEST_FOLDER);
            jobFiles = files.filter((f) => f.includes('delete-job'));
            expect(jobFiles.length).toBe(0);

            await scheduler.shutdown();
        });
    });

    describe('Job Execution', () => {
        it(
            'should execute job at scheduled interval',
            async () => {
                const scheduler = new LocalScheduler({
                    folder: TEST_FOLDER,
                    autoStart: true,
                });

                const candidate = AccessCandidate.user('exec-test');
                const requester = scheduler.requester(candidate);

                let executionCount = 0;
                const schedule = Schedule.every('100ms'); // Very short for testing
                const job = new Job(
                    async () => {
                        executionCount++;
                    },
                    { name: 'Execution Test' }
                );

                await requester.add('exec-job', schedule, job);

                // Wait for multiple executions
                await new Promise((resolve) => setTimeout(resolve, 350));

                expect(executionCount).toBeGreaterThanOrEqual(2);

                await scheduler.shutdown();
            },
            { timeout: 5000 }
        );

        it(
            'should not execute paused jobs',
            async () => {
                const scheduler = new LocalScheduler({
                    folder: TEST_FOLDER,
                    autoStart: true,
                });

                const candidate = AccessCandidate.user('pause-test');
                const requester = scheduler.requester(candidate);

                let executionCount = 0;
                const schedule = Schedule.every('100ms');
                const job = new Job(
                    async () => {
                        executionCount++;
                    },
                    { name: 'Pause Test' }
                );

                await requester.add('pause-job', schedule, job);

                // Wait for first execution
                await new Promise((resolve) => setTimeout(resolve, 150));
                const countBeforePause = executionCount;

                // Pause the job
                await requester.pause('pause-job');

                // Wait more time
                await new Promise((resolve) => setTimeout(resolve, 300));

                // Should not have executed more times
                expect(executionCount).toBe(countBeforePause);

                await scheduler.shutdown();
            },
            { timeout: 5000 }
        );

        it(
            'should resume paused jobs',
            async () => {
                const scheduler = new LocalScheduler({
                    folder: TEST_FOLDER,
                    autoStart: true,
                });

                const candidate = AccessCandidate.user('resume-test');
                const requester = scheduler.requester(candidate);

                let executionCount = 0;
                const schedule = Schedule.every('100ms');
                const job = new Job(
                    async () => {
                        executionCount++;
                    },
                    { name: 'Resume Test' }
                );

                await requester.add('resume-job', schedule, job);
                await requester.pause('resume-job');

                const countBeforeResume = executionCount;

                await requester.resume('resume-job');

                // Wait for executions after resume
                await new Promise((resolve) => setTimeout(resolve, 250));

                expect(executionCount).toBeGreaterThan(countBeforeResume);

                await scheduler.shutdown();
            },
            { timeout: 5000 }
        );

        it(
            'should track execution history',
            async () => {
                const scheduler = new LocalScheduler({
                    folder: TEST_FOLDER,
                    autoStart: true,
                    persistExecutionHistory: true,
                });

                const candidate = AccessCandidate.user('history-test');
                const requester = scheduler.requester(candidate);

                const schedule = Schedule.every('100ms');
                const job = new Job(
                    async () => {
                        // Job logic
                    },
                    { name: 'History Test' }
                );

                await requester.add('history-job', schedule, job);

                // Wait for executions
                await new Promise((resolve) => setTimeout(resolve, 350));

                const jobData = await requester.get('history-job');

                expect(jobData?.executionHistory).toBeDefined();
                expect(jobData?.executionHistory?.length).toBeGreaterThan(0);
                expect(jobData?.lastRun).toBeDefined();

                await scheduler.shutdown();
            },
            { timeout: 5000 }
        );

        it(
            'should handle job execution errors',
            async () => {
                const scheduler = new LocalScheduler({
                    folder: TEST_FOLDER,
                    autoStart: true,
                    persistExecutionHistory: true,
                });

                const candidate = AccessCandidate.user('error-test');
                const requester = scheduler.requester(candidate);

                const schedule = Schedule.every('100ms');
                const job = new Job(
                    async () => {
                        throw new Error('Intentional error');
                    },
                    { name: 'Error Test' }
                );

                await requester.add('error-job', schedule, job);

                // Wait for execution
                await new Promise((resolve) => setTimeout(resolve, 250));

                const jobData = await requester.get('error-job');

                expect(jobData?.status).toBe('failed');
                expect(jobData?.executionHistory?.[0]?.success).toBe(false);
                expect(jobData?.executionHistory?.[0]?.error).toContain('Intentional error');

                await scheduler.shutdown();
            },
            { timeout: 5000 }
        );
    });

    describe('Access Control & Isolation', () => {
        it('should enforce candidate isolation', async () => {
            const scheduler = new LocalScheduler({
                folder: TEST_FOLDER,
                autoStart: false,
            });

            const user1 = AccessCandidate.user('user1');
            const user2 = AccessCandidate.user('user2');

            const schedule = Schedule.every('1h');
            const job = new Job(async () => {}, { name: 'Isolation Test' });

            // Both users create a job with same ID
            await scheduler.requester(user1).add('same-id', schedule, job);
            await scheduler.requester(user2).add('same-id', schedule, job);

            const user1Jobs = await scheduler.requester(user1).list();
            const user2Jobs = await scheduler.requester(user2).list();

            // Each user should only see their own job
            expect(user1Jobs.length).toBe(1);
            expect(user2Jobs.length).toBe(1);

            // Jobs should be independent
            await scheduler.requester(user1).delete('same-id');

            const user2JobsAfter = await scheduler.requester(user2).list();
            expect(user2JobsAfter.length).toBe(1); // User2's job still exists

            await scheduler.shutdown();
        });

        it('should preserve ACL ownership on updates', async () => {
            const scheduler = new LocalScheduler({
                folder: TEST_FOLDER,
                autoStart: false,
            });

            const owner = AccessCandidate.user('owner');
            const requester = scheduler.requester(owner);

            const schedule = Schedule.every('1h');
            const job1 = new Job(async () => {}, { name: 'Original' });

            await requester.add('acl-job', schedule, job1);

            // Update the job
            const job2 = new Job(async () => {}, { name: 'Updated' });
            await requester.add('acl-job', schedule, job2);

            // Verify ownership is preserved
            const acl = await scheduler.getResourceACL('acl-job', owner);
            expect(acl.checkExactAccess(owner.ownerRequest)).toBe(true);

            await scheduler.shutdown();
        });

        it('should grant access to non-existent jobs for creation', async () => {
            const scheduler = new LocalScheduler({
                folder: TEST_FOLDER,
                autoStart: false,
            });

            const user = AccessCandidate.user('new-user');

            const acl = await scheduler.getResourceACL('nonexistent-job', user);

            // Should grant Owner access for creation
            expect(acl.checkExactAccess(user.ownerRequest)).toBe(true);

            await scheduler.shutdown();
        });
    });

    describe('Schedule Validation', () => {
        it('should reject invalid schedules', async () => {
            const scheduler = new LocalScheduler({
                folder: TEST_FOLDER,
                autoStart: false,
            });

            const candidate = AccessCandidate.user('validation-test');
            const requester = scheduler.requester(candidate);

            const invalidSchedule = Schedule.fromJSON({ interval: 'invalid' });
            const job = new Job(async () => {}, { name: 'Invalid' });

            await expect(requester.add('invalid-job', invalidSchedule, job)).rejects.toThrow();

            await scheduler.shutdown();
        });

        it(
            'should respect schedule date ranges',
            async () => {
                const scheduler = new LocalScheduler({
                    folder: TEST_FOLDER,
                    autoStart: true,
                });

                const candidate = AccessCandidate.user('range-test');
                const requester = scheduler.requester(candidate);

                let executionCount = 0;

                // Schedule that ends in the past
                const pastDate = new Date(Date.now() - 86400000); // Yesterday
                const schedule = Schedule.every('100ms').ends(pastDate);
                const job = new Job(
                    async () => {
                        executionCount++;
                    },
                    { name: 'Past Schedule' }
                );

                await requester.add('past-job', schedule, job);

                // Wait
                await new Promise((resolve) => setTimeout(resolve, 300));

                // Should not execute (schedule ended)
                expect(executionCount).toBe(0);

                await scheduler.shutdown();
            },
            { timeout: 5000 }
        );
    });

    describe('Scheduler Lifecycle', () => {
        it('should shutdown gracefully', async () => {
            const scheduler = new LocalScheduler({
                folder: TEST_FOLDER,
                autoStart: true,
            });

            const candidate = AccessCandidate.user('shutdown-test');
            const requester = scheduler.requester(candidate);

            const schedule = Schedule.every('1s');
            const job = new Job(async () => {}, { name: 'Shutdown Test' });

            await requester.add('shutdown-job', schedule, job);

            // Shutdown should not throw
            await expect(scheduler.shutdown()).resolves.not.toThrow();
        });

        it('should handle multiple concurrent operations', async () => {
            const scheduler = new LocalScheduler({
                folder: TEST_FOLDER,
                autoStart: false,
            });

            const candidate = AccessCandidate.user('concurrent-test');
            const requester = scheduler.requester(candidate);

            const schedule = Schedule.every('1h');

            // Create multiple jobs concurrently
            const promises = [];
            for (let i = 0; i < 10; i++) {
                const job = new Job(async () => {}, { name: `Job ${i}` });
                promises.push(requester.add(`job-${i}`, schedule, job));
            }

            await Promise.all(promises);

            const jobs = await requester.list();
            expect(jobs.length).toBe(10);

            await scheduler.shutdown();
        });
    });
});
