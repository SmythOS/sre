// prettier-ignore-file
/**
 * Agent.import() and advanced features — no API keys required.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model } from '../../../src/index';
import { initSRE, unique } from '../_helpers';

describe('Agent - Import & configuration', () => {
    beforeAll(() => initSRE());

    it('Agent.import() from settings object', () => {
        const agent = Agent.import({
            name: 'ImportBot',
            model: Model.Echo('Echo'),
        });
        expect(agent).toBeDefined();
        expect(agent.data.name).toBe('ImportBot');
    });

    it('agent with multiple skills can call() each one', async () => {
        const agent = new Agent({
            id: unique('skill'),
            name: 'SkillBot',
            model: Model.Echo('Echo'),
        });

        agent.addSkill({
            name: 'add',
            description: 'Add two numbers',
            process: async ({ a, b }) => String(Number(a) + Number(b)),
        });

        agent.addSkill({
            name: 'multiply',
            description: 'Multiply two numbers',
            process: async ({ a, b }) => String(Number(a) * Number(b)),
        });

        // Verify skills visible in data (not skillNames — that reads from _data.components)
        const endpoints = agent.data.components.map((c: any) => c.data.endpoint);
        expect(endpoints).toContain('add');
        expect(endpoints).toContain('multiply');

        const r1 = await agent.call('add', { a: 3, b: 4 });
        expect(r1.data).toBe('7');

        const r2 = await agent.call('multiply', { a: 3, b: 4 });
        expect(r2.data).toBe('12');
    });

    it('agent with behavior passes it to the LLM', () => {
        const agent = new Agent({
            id: unique('behavior'),
            name: 'BehaviorBot',
            model: Model.Echo('Echo'),
            behavior: 'Always reply in JSON',
        });
        expect(agent.data.behavior).toBe('Always reply in JSON');
    });
});
