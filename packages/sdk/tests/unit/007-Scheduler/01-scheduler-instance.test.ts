// prettier-ignore-file
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock scheduler request ---
const mockSchedulerRequest = {
    add: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
};

let mockConnectorValid = true;
let mockInitValid = true;

vi.mock('@smythos/sre', async () => {
    return {
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
            agent: (id: string) => ({ type: 'agent', id }),
        },
        ConnectorService: {
            getSchedulerConnector(providerId: string) {
                if (!mockConnectorValid) return { valid: false };
                return {
                    valid: true,
                    instance(settings: any) {
                        return {
                            requester(candidate: any) {
                                return mockSchedulerRequest;
                            },
                        };
                    },
                    settings: {},
                };
            },
            init(type: string, providerId: string, name: string, settings: any) {
                if (!mockInitValid) return { valid: false };
                return {
                    valid: true,
                    instance(settings: any) {
                        return {
                            requester(candidate: any) {
                                return mockSchedulerRequest;
                            },
                        };
                    },
                    settings: {},
                };
            },
        },
        TConnectorService: { Scheduler: 'Scheduler' },
        Job: class Job {
            constructor(public config: any) {}
        },
        Schedule: {
            every: (interval: string) => ({ type: 'interval', interval }),
        },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    };
});

// Mock the Agent module so instanceof checks work without pulling in the full Agent dependency tree
vi.mock('../../../src/Agent/Agent.class', () => {
    class MockAgent {
        id: string;
        constructor(id: string) {
            this.id = id;
        }
    }
    return { Agent: MockAgent };
});

import { SchedulerInstance } from '../../../src/Scheduler/SchedulerInstance.class';
import { Agent } from '../../../src/Agent/Agent.class';
import { Job, Schedule } from '@smythos/sre';

function createMockAgent(id: string): Agent {
    return new (Agent as any)(id);
}

describe('SchedulerInstance', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockConnectorValid = true;
        mockInitValid = true;
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    describe('constructor', () => {
        it('creates with default provider and no candidate', () => {
            const scheduler = new SchedulerInstance();
            expect(scheduler).toBeInstanceOf(SchedulerInstance);
        });

        it('creates with explicit provider and AccessCandidate', () => {
            const candidate = { type: 'team', id: 'my-team' } as any;
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, candidate);
            expect(scheduler).toBeInstanceOf(SchedulerInstance);
        });

        it('creates with an Agent as candidate', () => {
            const agent = createMockAgent('agent-1');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);
            expect(scheduler).toBeInstanceOf(SchedulerInstance);
        });

        it('throws when connector is not available', () => {
            mockConnectorValid = false;
            mockInitValid = false;
            expect(
                () => new SchedulerInstance('BadProvider' as any, {})
            ).toThrow('Scheduler connector BadProvider is not available');
        });

        it('falls back to ConnectorService.init when getSchedulerConnector returns invalid', () => {
            // First call returns invalid, init returns valid
            mockConnectorValid = false;
            mockInitValid = true;
            const scheduler = new SchedulerInstance('FallbackProvider' as any, {});
            expect(scheduler).toBeInstanceOf(SchedulerInstance);
        });
    });

    // -----------------------------------------------------------------------
    // add()
    // -----------------------------------------------------------------------
    describe('add()', () => {
        it('returns true on success', async () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            const job = new Job({ fn: () => {} });
            const schedule = Schedule.every('5s');

            const result = await scheduler.add('job-1', job, schedule as any);

            expect(result).toBe(true);
            expect(mockSchedulerRequest.add).toHaveBeenCalledWith('job-1', job, schedule);
        });

        it('returns false when the underlying request throws', async () => {
            mockSchedulerRequest.add.mockRejectedValueOnce(new Error('add failed'));

            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            const result = await scheduler.add('job-fail', new Job({}), Schedule.every('1m') as any);

            expect(result).toBe(false);
            expect(errorSpy).toHaveBeenCalled();
        });

        it('returns false and does not rethrow the error', async () => {
            mockSchedulerRequest.add.mockRejectedValueOnce(new Error('boom'));
            const scheduler = new SchedulerInstance('LocalScheduler' as any);

            // Should not throw
            const result = await scheduler.add('x', new Job({}), Schedule.every('1s') as any);
            expect(result).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // list()
    // -----------------------------------------------------------------------
    describe('list()', () => {
        it('returns jobs array', async () => {
            const jobs = [{ id: 'j1', status: 'active' }, { id: 'j2', status: 'paused' }];
            mockSchedulerRequest.list.mockResolvedValueOnce(jobs);

            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            const result = await scheduler.list();

            expect(result).toEqual(jobs);
            expect(mockSchedulerRequest.list).toHaveBeenCalled();
        });

        it('returns empty array when no jobs exist', async () => {
            mockSchedulerRequest.list.mockResolvedValueOnce([]);
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            const result = await scheduler.list();
            expect(result).toEqual([]);
        });

        it('throws on error', async () => {
            mockSchedulerRequest.list.mockRejectedValueOnce(new Error('list error'));

            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            await expect(scheduler.list()).rejects.toThrow('list error');
        });
    });

    // -----------------------------------------------------------------------
    // get()
    // -----------------------------------------------------------------------
    describe('get()', () => {
        it('returns a job when found', async () => {
            const job = { id: 'j1', status: 'active' };
            mockSchedulerRequest.get.mockResolvedValueOnce(job);

            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            const result = await scheduler.get('j1');

            expect(result).toEqual(job);
            expect(mockSchedulerRequest.get).toHaveBeenCalledWith('j1');
        });

        it('returns undefined when job is not found', async () => {
            mockSchedulerRequest.get.mockResolvedValueOnce(undefined);

            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            const result = await scheduler.get('nonexistent');

            expect(result).toBeUndefined();
        });

        it('throws on error', async () => {
            mockSchedulerRequest.get.mockRejectedValueOnce(new Error('get error'));

            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            await expect(scheduler.get('bad-id')).rejects.toThrow('get error');
        });
    });

    // -----------------------------------------------------------------------
    // pause()
    // -----------------------------------------------------------------------
    describe('pause()', () => {
        it('delegates to scheduler request', async () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            await scheduler.pause('job-1');
            expect(mockSchedulerRequest.pause).toHaveBeenCalledWith('job-1');
        });

        it('throws on error', async () => {
            mockSchedulerRequest.pause.mockRejectedValueOnce(new Error('pause error'));

            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            await expect(scheduler.pause('bad')).rejects.toThrow('pause error');
        });
    });

    // -----------------------------------------------------------------------
    // resume()
    // -----------------------------------------------------------------------
    describe('resume()', () => {
        it('delegates to scheduler request', async () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            await scheduler.resume('job-1');
            expect(mockSchedulerRequest.resume).toHaveBeenCalledWith('job-1');
        });

        it('throws on error', async () => {
            mockSchedulerRequest.resume.mockRejectedValueOnce(new Error('resume error'));

            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            await expect(scheduler.resume('bad')).rejects.toThrow('resume error');
        });
    });

    // -----------------------------------------------------------------------
    // delete()
    // -----------------------------------------------------------------------
    describe('delete()', () => {
        it('delegates to scheduler request', async () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            await scheduler.delete('job-1');
            expect(mockSchedulerRequest.delete).toHaveBeenCalledWith('job-1');
        });

        it('throws on error', async () => {
            mockSchedulerRequest.delete.mockRejectedValueOnce(new Error('delete error'));

            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            await expect(scheduler.delete('bad')).rejects.toThrow('delete error');
        });
    });

    // -----------------------------------------------------------------------
    // call()
    // -----------------------------------------------------------------------
    describe('call()', () => {
        it('returns a SchedulerJobCommand with expected methods', () => {
            const agent = createMockAgent('agent-x');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            const command = scheduler.call('mySkill', { input: 'test' }, { name: 'Test Job' } as any);
            expect(command).toBeDefined();
            expect(typeof command.every).toBe('function');
            expect(typeof command.pause).toBe('function');
            expect(typeof command.resume).toBe('function');
            expect(typeof command.delete).toBe('function');
            expect(typeof command.then).toBe('function');
        });

        it('throws when no agent is associated', () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            expect(() => scheduler.call('mySkill')).toThrow('Cannot use .call() without an agent');
        });

        it('accepts optional args and metadata', () => {
            const agent = createMockAgent('agent-args');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            // No args, no metadata
            expect(() => scheduler.call('skillA')).not.toThrow();
            // With args only
            expect(() => scheduler.call('skillB', { key: 'val' })).not.toThrow();
            // With args and metadata
            expect(() => scheduler.call('skillC', [], { name: 'C' } as any)).not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // prompt()
    // -----------------------------------------------------------------------
    describe('prompt()', () => {
        it('returns a SchedulerJobCommand with hashed job ID', () => {
            const agent = createMockAgent('agent-p');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            const command = scheduler.prompt('Generate a report');
            expect(command).toBeDefined();
            expect(typeof command.every).toBe('function');
        });

        it('throws when no agent is associated', () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            expect(() => scheduler.prompt('Hello')).toThrow('Cannot use .prompt() without an agent');
        });

        it('error message mentions providing an Agent instance', () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            expect(() => scheduler.prompt('Hello')).toThrow('Please provide an Agent instance');
        });
    });

    // -----------------------------------------------------------------------
    // trigger()
    // -----------------------------------------------------------------------
    describe('trigger()', () => {
        it('returns a SchedulerJobCommand', () => {
            const agent = createMockAgent('agent-t');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            const command = scheduler.trigger('daily-sync', { name: 'Sync' } as any);
            expect(command).toBeDefined();
            expect(typeof command.every).toBe('function');
        });

        it('throws when no agent is associated', () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            expect(() => scheduler.trigger('sync')).toThrow('Cannot use .trigger() without an agent');
        });

        it('error message mentions providing an Agent instance', () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            expect(() => scheduler.trigger('sync')).toThrow('Please provide an Agent instance');
        });
    });

    // -----------------------------------------------------------------------
    // SchedulerJobCommand behavior
    // -----------------------------------------------------------------------
    describe('SchedulerJobCommand', () => {
        it('.every() schedules the job via add()', async () => {
            const agent = createMockAgent('agent-cmd');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            const command = scheduler.call('backup', { dest: '/tmp' });
            await command.every('5s');

            expect(mockSchedulerRequest.add).toHaveBeenCalledTimes(1);
            const [jobId, job, schedule] = mockSchedulerRequest.add.mock.calls[0];
            expect(jobId).toBe('agent-cmd-skill-backup');
            // schedule is produced by Schedule.every
            expect(schedule).toEqual({ type: 'interval', interval: '5s' });
        });

        it('.every() creates a Job from the config', async () => {
            const agent = createMockAgent('agent-job');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            await scheduler.call('mySkill', { x: 1 }, { name: 'My Job' } as any).every('10m');

            const [, job] = mockSchedulerRequest.add.mock.calls[0];
            // The job is a Job instance with config containing the skill info
            expect(job.config).toEqual({
                type: 'skill',
                agentId: 'agent-job',
                skillName: 'mySkill',
                args: { x: 1 },
                metadata: { name: 'My Job' },
            });
        });

        it('.pause() delegates to scheduler request with correct job ID', async () => {
            const agent = createMockAgent('agent-cmd');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            const command = scheduler.call('process');
            await command.pause();

            expect(mockSchedulerRequest.pause).toHaveBeenCalledWith('agent-cmd-skill-process');
        });

        it('.resume() delegates to scheduler request with correct job ID', async () => {
            const agent = createMockAgent('agent-cmd');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            const command = scheduler.call('process');
            await command.resume();

            expect(mockSchedulerRequest.resume).toHaveBeenCalledWith('agent-cmd-skill-process');
        });

        it('.delete() delegates to scheduler request with correct job ID', async () => {
            const agent = createMockAgent('agent-cmd');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            const command = scheduler.call('process');
            await command.delete();

            expect(mockSchedulerRequest.delete).toHaveBeenCalledWith('agent-cmd-skill-process');
        });

        it('warns when awaited without calling .every()', async () => {
            const agent = createMockAgent('agent-warn');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            const command = scheduler.call('noSchedule');
            // Awaiting the command without .every() triggers the warning via .then()
            await command;

            expect(warnSpy).toHaveBeenCalled();
            const warningMessage = warnSpy.mock.calls[0][0];
            expect(warningMessage).toContain('was not scheduled');
            expect(warningMessage).toContain('agent-warn-skill-noSchedule');
        });

        it('warning message suggests using .every()', async () => {
            const agent = createMockAgent('agent-hint');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            await scheduler.call('unscheduled');

            const warningMessage = warnSpy.mock.calls[0][0];
            expect(warningMessage).toContain('.every(');
        });

        it('does not warn when .every() was called before awaiting', async () => {
            const agent = createMockAgent('agent-ok');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            await scheduler.call('scheduled').every('10s');

            expect(warnSpy).not.toHaveBeenCalled();
        });

        it('prompt command uses hashed job ID containing agent ID', async () => {
            const agent = createMockAgent('agent-hash');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            await scheduler.prompt('Generate report').every('1h');

            const [jobId] = mockSchedulerRequest.add.mock.calls[0];
            expect(jobId).toMatch(/^agent-hash-prompt-/);
            // The hash portion should be a non-empty base-36 string
            const hashPart = jobId.replace('agent-hash-prompt-', '');
            expect(hashPart.length).toBeGreaterThan(0);
        });

        it('same prompt text produces same job ID (deterministic hash)', async () => {
            const agent = createMockAgent('agent-det');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            await scheduler.prompt('Hello world').every('1m');
            await scheduler.prompt('Hello world').every('2m');

            const [jobId1] = mockSchedulerRequest.add.mock.calls[0];
            const [jobId2] = mockSchedulerRequest.add.mock.calls[1];
            expect(jobId1).toBe(jobId2);
        });

        it('different prompt text produces different job IDs', async () => {
            const agent = createMockAgent('agent-diff');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            await scheduler.prompt('Alpha').every('1m');
            await scheduler.prompt('Beta').every('2m');

            const [jobId1] = mockSchedulerRequest.add.mock.calls[0];
            const [jobId2] = mockSchedulerRequest.add.mock.calls[1];
            expect(jobId1).not.toBe(jobId2);
        });

        it('trigger command uses correct job ID format', async () => {
            const agent = createMockAgent('agent-trig');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            await scheduler.trigger('daily-sync').every('1d');

            const [jobId] = mockSchedulerRequest.add.mock.calls[0];
            expect(jobId).toBe('agent-trig-trigger-daily-sync');
        });

        it('prompt job config includes prompt text and agent ID', async () => {
            const agent = createMockAgent('agent-pcfg');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            await scheduler.prompt('Run analysis', { name: 'Analysis' } as any).every('6h');

            const [, job] = mockSchedulerRequest.add.mock.calls[0];
            expect(job.config).toEqual({
                type: 'prompt',
                agentId: 'agent-pcfg',
                prompt: 'Run analysis',
                metadata: { name: 'Analysis' },
            });
        });

        it('trigger job config includes trigger name and agent ID', async () => {
            const agent = createMockAgent('agent-tcfg');
            const scheduler = new SchedulerInstance('LocalScheduler' as any, {}, agent);

            await scheduler.trigger('my-trigger', { name: 'Trig' } as any).every('12h');

            const [, job] = mockSchedulerRequest.add.mock.calls[0];
            expect(job.config).toEqual({
                type: 'trigger',
                agentId: 'agent-tcfg',
                triggerName: 'my-trigger',
                metadata: { name: 'Trig' },
            });
        });
    });

    // -----------------------------------------------------------------------
    // on() / off()
    // -----------------------------------------------------------------------
    describe('on() / off()', () => {
        it('on() delegates to scheduler request and returns this', () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            const listener = vi.fn();

            const result = scheduler.on('jobCompleted', listener);

            expect(mockSchedulerRequest.on).toHaveBeenCalledWith('jobCompleted', listener);
            expect(result).toBe(scheduler);
        });

        it('off() delegates to scheduler request and returns this', () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            const listener = vi.fn();

            const result = scheduler.off('jobCompleted', listener);

            expect(mockSchedulerRequest.off).toHaveBeenCalledWith('jobCompleted', listener);
            expect(result).toBe(scheduler);
        });

        it('supports chaining on() calls', () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            const l1 = vi.fn();
            const l2 = vi.fn();

            const result = scheduler.on('event1', l1).on('event2', l2);

            expect(result).toBe(scheduler);
            expect(mockSchedulerRequest.on).toHaveBeenCalledTimes(2);
        });

        it('supports chaining off() calls', () => {
            const scheduler = new SchedulerInstance('LocalScheduler' as any);
            const l1 = vi.fn();
            const l2 = vi.fn();

            const result = scheduler.off('event1', l1).off('event2', l2);

            expect(result).toBe(scheduler);
            expect(mockSchedulerRequest.off).toHaveBeenCalledTimes(2);
        });
    });
});
