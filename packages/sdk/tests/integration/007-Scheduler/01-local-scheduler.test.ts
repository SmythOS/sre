// prettier-ignore-file
/**
 * Scheduler.LocalScheduler() integration — no API keys required.
 * Tests real LocalScheduler through the Agent.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model } from '../../../src/index';
import { initSRE, unique } from '../_helpers';

describe('Scheduler - LocalScheduler integration', () => {
    beforeAll(() => initSRE());

    it('agent.scheduler.LocalScheduler() creates instance', async () => {
        const agent = new Agent({
            id: unique('sched'),
            name: 'SchedulerBot',
            model: Model.Echo('Echo'),
        });
        const scheduler = agent.scheduler.LocalScheduler();
        expect(scheduler).toBeDefined();
    });

    it('call() schedules and the job appears in list', async () => {
        const agent = new Agent({
            id: unique('sched'),
            name: 'SchedulerBot',
            model: Model.Echo('Echo'),
        });
        agent.addSkill({
            name: 'ping',
            description: 'Ping skill',
            process: async () => 'pong',
        });

        const scheduler = agent.scheduler.LocalScheduler();
        const cmd = scheduler.call('ping', {});

        // Schedule to run every 1 hour (won't actually fire during test)
        await cmd.every('1h');

        const jobs = await scheduler.list();
        expect(jobs.length).toBeGreaterThanOrEqual(1);
    });
});
