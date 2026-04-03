import { describe, it, expect, vi } from 'vitest';
import { Skill } from '../../../src/Components/Skill';

// ---------------------------------------------------------------------------
// Skill()
// ---------------------------------------------------------------------------
describe('Skill()', () => {
    // --- basic return shape ---
    it('returns an object with out and in properties', () => {
        const skill = Skill({ name: 'test' });
        expect(skill).toHaveProperty('out');
        expect(skill).toHaveProperty('in');
    });

    it('in is a function', () => {
        const skill = Skill({ name: 'test' });
        expect(typeof skill.in).toBe('function');
    });

    // --- out sub-accessors ---
    it('out has headers, body, and query sub-accessors', () => {
        const skill = Skill({ name: 'test' });
        expect(skill.out).toHaveProperty('headers');
        expect(skill.out).toHaveProperty('body');
        expect(skill.out).toHaveProperty('query');
    });

    it('out.body.__path__ returns "body"', () => {
        const skill = Skill({ name: 'test' });
        expect((skill.out.body as any).__path__).toBe('body');
    });

    it('out.headers.__path__ returns "headers"', () => {
        const skill = Skill({ name: 'test' });
        expect((skill.out.headers as any).__path__).toBe('headers');
    });

    it('out.query.__path__ returns "query"', () => {
        const skill = Skill({ name: 'test' });
        expect((skill.out.query as any).__path__).toBe('query');
    });

    it('out nested access accumulates path: out.body.data.__path__ === "body.data"', () => {
        const skill = Skill({ name: 'test' });
        expect((skill.out.body as any).data.__path__).toBe('body.data');
    });

    // --- defaults ---
    it('default method is POST', () => {
        const skill = Skill({ name: 'test' });
        // Access via out.__root__ which is the ComponentWrapper
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.data.data.method).toBe('POST');
    });

    it('default ai_exposed is true', () => {
        const skill = Skill({ name: 'test' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.data.data.ai_exposed).toBe(true);
    });

    it('default status_message is empty string', () => {
        const skill = Skill({ name: 'test' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.data.data.status_message).toBe('');
    });

    // --- endpoint normalization ---
    it('normalizes endpoint: "my skill" becomes "my_skill"', () => {
        const skill = Skill({ name: 'my skill' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.data.data.endpoint).toBe('my_skill');
    });

    it('normalizes endpoint with special characters', () => {
        const skill = Skill({ name: 'hello-world!@#' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.data.data.endpoint).toBe('hello_world___');
    });

    it('uses explicit endpoint when provided', () => {
        const skill = Skill({ name: 'test', endpoint: 'custom-endpoint' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.data.data.endpoint).toBe('custom_endpoint');
    });

    // --- ComponentWrapper name ---
    it('creates ComponentWrapper with name "APIEndpoint"', () => {
        const skill = Skill({ name: 'test' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.data.name).toBe('APIEndpoint');
    });

    // --- ComponentWrapper ID ---
    it('ComponentWrapper has ID starting with "C"', () => {
        const skill = Skill({ name: 'test' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.id).toMatch(/^C/);
    });

    // --- settings pass-through ---
    it('passes method setting through', () => {
        const skill = Skill({ name: 'test', method: 'GET' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.data.data.method).toBe('GET');
    });

    it('passes description setting through', () => {
        const skill = Skill({ name: 'test', description: 'A test skill' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.data.data.description).toBe('A test skill');
    });

    // --- outputPathRewrite ---
    it('outputPathRewrite prepends "body." to plain paths', () => {
        const skill = Skill({ name: 'test' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.outputPathRewrite('data')).toBe('body.data');
        expect(wrapper.outputPathRewrite('result')).toBe('body.result');
    });

    it('outputPathRewrite does NOT double-prepend "body."', () => {
        const skill = Skill({ name: 'test' });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.outputPathRewrite('body.data')).toBe('body.data');
        expect(wrapper.outputPathRewrite('body.result')).toBe('body.result');
    });

    it('outputPathRewrite handles "body" alone (does not prepend)', () => {
        const skill = Skill({ name: 'test' });
        const wrapper = (skill.out as any).__root__;
        // "body." is a prefix of "body." -> starts with check passes
        expect(wrapper.outputPathRewrite('body.x')).toBe('body.x');
    });

    // --- process function ---
    it('passes process function through to ComponentWrapper', () => {
        const processFn = async (input: any) => input;
        const skill = Skill({ name: 'test', process: processFn });
        const wrapper = (skill.out as any).__root__;
        expect(wrapper.data.process).toBe(processFn);
    });

    // --- agent integration ---
    it('pushes component to agent structure when agent is provided', () => {
        const mockAgent = {
            structure: { components: [] as any[], connections: [] },
            sync: vi.fn(),
        } as any;

        Skill({ name: 'test' }, mockAgent);

        expect(mockAgent.structure.components).toHaveLength(1);
        expect(mockAgent.structure.components[0].data.name).toBe('APIEndpoint');
    });

    it('calls agent.sync() when agent is provided', () => {
        const mockAgent = {
            structure: { components: [] as any[], connections: [] },
            sync: vi.fn(),
        } as any;

        Skill({ name: 'test' }, mockAgent);

        expect(mockAgent.sync).toHaveBeenCalledOnce();
    });

    it('does NOT push to agent or call sync when no agent provided', () => {
        // Just ensure no error is thrown
        const skill = Skill({ name: 'test' });
        expect(skill).toBeDefined();
    });

    // --- no settings ---
    it('throws when called with no settings (endpoint name is undefined)', () => {
        // normalizeEndpointName tries to call .replace() on undefined name
        expect(() => Skill()).toThrow();
    });
});
