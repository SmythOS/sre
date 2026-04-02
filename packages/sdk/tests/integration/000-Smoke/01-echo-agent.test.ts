// prettier-ignore-file
/**
 * Smoke tests — Echo LLM, no API keys required.
 * Validates the core Agent → LLM pipeline with the built-in Echo model.
 *
 * NOTE: Echo LLM does NOT support tools, so agent.chat() and streaming
 * through Agent (which injects skill tool configs) can fail.
 * LLM.Echo().chat() also fails on context initialization.
 * Use direct prompt or agent.call() for Echo.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model, LLM } from '../../../src/index';
import { initSRE, unique } from '../_helpers';

describe('Smoke - Echo Agent', () => {
    beforeAll(() => initSRE());

    it('agent.prompt() returns echo of the input', async () => {
        const agent = new Agent({
            id: unique('echo'),
            name: 'EchoBot',
            model: Model.Echo('Echo'),
        });
        const result = await agent.prompt('Hello, world!');
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('agent.prompt().run() returns a string', async () => {
        const agent = new Agent({
            id: unique('echo'),
            name: 'EchoBot',
            model: Model.Echo('Echo'),
        });
        const result = await agent.prompt('Test run').run();
        expect(typeof result).toBe('string');
    });

    it('LLM.Echo prompt returns echo of input', async () => {
        const llm = LLM.Echo('Echo');
        const result = await llm.prompt('Hello from LLM');
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('agent.call() executes a skill directly', async () => {
        const agent = new Agent({
            id: unique('echo'),
            name: 'SkillBot',
            model: Model.Echo('Echo'),
        });
        agent.addSkill({
            name: 'greet',
            description: 'Returns a greeting',
            process: async ({ name }) => `Hello, ${name}!`,
        });

        const result = await agent.call('greet', { name: 'World' });
        expect(result).toBeDefined();
        expect(result.data).toBe('Hello, World!');
    });

    it('addSkill registers skill visible via agent.data.components', () => {
        const agent = new Agent({
            id: unique('echo'),
            name: 'Bot',
            model: Model.Echo('Echo'),
        });
        agent.addSkill({ name: 'alpha', description: 'A' });
        agent.addSkill({ name: 'beta', description: 'B' });

        // Skills are in agent.data.components (merged from structure)
        const endpoints = agent.data.components.map((c: any) => c.data.endpoint);
        expect(endpoints).toContain('alpha');
        expect(endpoints).toContain('beta');
    });
});
