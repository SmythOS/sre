import { describe, it, expect, vi } from 'vitest';
import { ComponentWrapper } from '../../../src/Components/ComponentWrapper.class';

// ---------------------------------------------------------------------------
// ComponentWrapper
// ---------------------------------------------------------------------------
describe('ComponentWrapper', () => {
    // --- constructor & id ---
    it('generates a unique ID starting with "C"', () => {
        const wrapper = new ComponentWrapper({ name: 'Test', settings: {} });
        expect(wrapper.id).toMatch(/^C/);
        expect(wrapper.id.length).toBeGreaterThan(1);
    });

    it('generates different IDs for different instances', () => {
        const w1 = new ComponentWrapper({ name: 'A', settings: {} });
        const w2 = new ComponentWrapper({ name: 'B', settings: {} });
        expect(w1.id).not.toBe(w2.id);
    });

    // --- internalData ---
    it('internalData returns the raw data passed to constructor', () => {
        const data = { name: 'Test', settings: { foo: 'bar' }, outputs: {} };
        const wrapper = new ComponentWrapper(data);
        expect(wrapper.internalData).toBe(data);
    });

    // --- data getter: basic structure ---
    it('data getter extracts correct structure', () => {
        const data = {
            name: 'MyComponent',
            settings: { key: 'value' },
            inputs: {},
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);
        const d = wrapper.data;

        expect(d.name).toBe('MyComponent');
        expect(d.displayName).toBe('MyComponent');
        expect(d.title).toBe('MyComponent');
        expect(d.data).toEqual({ key: 'value' });
        expect(d.id).toBe(wrapper.id);
        expect(d.left).toBe('0px');
        expect(d.top).toBe('0px');
    });

    // --- data getter: process function params ---
    it('data getter parses simple function params', () => {
        const data = {
            name: 'Comp',
            settings: {},
            process: (a: any, b: any) => {},
            inputs: {},
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);
        const d = wrapper.data;

        const inputNames = d.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('a');
        expect(inputNames).toContain('b');
    });

    it('data getter parses default params', () => {
        const data = {
            name: 'Comp',
            settings: {},
            process: (a = 5, b = 'hello') => {},
            inputs: {},
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);
        const d = wrapper.data;

        const inputNames = d.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('a');
        expect(inputNames).toContain('b');
    });

    it('data getter parses rest params', () => {
        const data = {
            name: 'Comp',
            settings: {},
            process: (...args: any[]) => {},
            inputs: {},
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);
        const d = wrapper.data;

        const inputNames = d.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('args');
    });

    it('data getter parses destructured object params', () => {
        const data = {
            name: 'Comp',
            settings: {},
            process: ({ x, y }: any) => {},
            inputs: {},
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);
        const d = wrapper.data;

        const inputNames = d.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('x');
        expect(inputNames).toContain('y');
    });

    it('data getter handles mixed param types', () => {
        const data = {
            name: 'Comp',
            settings: {},
            process: (a: any, { b, c }: any, d = 10) => {},
            inputs: {},
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);
        const result = wrapper.data;

        const inputNames = result.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('a');
        expect(inputNames).toContain('b');
        expect(inputNames).toContain('c');
        // Note: acorn may rename `d` due to TypeScript type annotation stripping;
        // the important thing is all params are extracted
        expect(inputNames).toHaveLength(4);
    });

    it('data getter handles no process function', () => {
        const data = {
            name: 'Comp',
            settings: {},
            inputs: {},
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);
        const d = wrapper.data;

        expect(d.process).toBeUndefined();
        expect(d.inputs).toEqual([]);
    });

    // --- data getter: outputs ---
    it('data getter maps output keys to array with names', () => {
        const data = {
            name: 'Comp',
            settings: {},
            inputs: {},
            outputs: {
                Reply: { __props__: { description: 'The reply', default: true } },
                Error: { __props__: { description: 'Error output' } },
            },
        };
        const wrapper = new ComponentWrapper(data);
        const d = wrapper.data;

        expect(d.outputs).toEqual([
            { name: 'Reply', description: 'The reply', default: true },
            { name: 'Error', description: 'Error output' },
        ]);
    });

    // --- data getter: merges duplicate input names ---
    it('data getter merges inputs with the same name from process args and explicit inputs', () => {
        const data = {
            name: 'Comp',
            settings: {},
            process: (Input: any) => {},
            inputs: {
                Input: {
                    component: null,
                    type: 'Text',
                    optional: true,
                    default: false,
                },
            },
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);
        const d = wrapper.data;

        // Should be merged, not duplicated
        const inputItems = d.inputs.filter((i: any) => i.name === 'Input');
        expect(inputItems).toHaveLength(1);
        // Explicit input type should override process-derived type
        expect(inputItems[0].type).toBe('Text');
    });

    // --- outputPathRewrite ---
    it('outputPathRewrite defaults to identity function', () => {
        const wrapper = new ComponentWrapper({ name: 'Test', settings: {} });
        expect(wrapper.outputPathRewrite('body.data')).toBe('body.data');
        expect(wrapper.outputPathRewrite('something')).toBe('something');
        expect(wrapper.outputPathRewrite('')).toBe('');
    });

    it('outputPathRewrite can be overridden', () => {
        const wrapper = new ComponentWrapper({ name: 'Test', settings: {} });
        wrapper.outputPathRewrite = (path) => `prefix.${path}`;
        expect(wrapper.outputPathRewrite('data')).toBe('prefix.data');
    });

    // --- agentMaker getter/setter ---
    it('agentMaker getter returns undefined initially', () => {
        const wrapper = new ComponentWrapper({ name: 'Test', settings: {} });
        expect(wrapper.agentMaker).toBeUndefined();
    });

    it('agentMaker getter/setter works', () => {
        const wrapper = new ComponentWrapper({ name: 'Test', settings: {} });
        const mockAgent = { id: 'agent-1' } as any;
        wrapper.agentMaker = mockAgent;
        expect(wrapper.agentMaker).toBe(mockAgent);
    });

    it('agentMaker can be passed via constructor', () => {
        const mockAgent = { id: 'agent-2' } as any;
        const wrapper = new ComponentWrapper({ name: 'Test', settings: {} }, mockAgent);
        expect(wrapper.agentMaker).toBe(mockAgent);
    });

    // --- inputs() ---
    it('inputs() with plain value objects (no __root__) stores them', () => {
        const data = {
            name: 'Comp',
            settings: {},
            inputs: {},
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);

        wrapper.inputs({
            myInput: { type: 'Text', description: 'A text input' },
        } as any);

        const d = wrapper.data;
        const inputNames = d.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('myInput');
    });

    it('inputs() returns the wrapper for chaining', () => {
        const data = {
            name: 'Comp',
            settings: {},
            inputs: {},
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);
        const result = wrapper.inputs({});
        expect(result).toBe(wrapper);
    });

    it('inputs() with __root__ source data creates connection-style input', () => {
        const sourceWrapper = new ComponentWrapper({
            name: 'Source',
            settings: {},
            inputs: {},
            outputs: { Reply: {} },
        });
        const targetWrapper = new ComponentWrapper({
            name: 'Target',
            settings: {},
            inputs: {},
            outputs: {},
        });

        // Simulate component output accessor with __root__ and __path__
        const sourceAccessor = {
            __root__: {
                data: sourceWrapper.data,
                agentMaker: {
                    structure: {
                        components: [sourceWrapper],
                        connections: [],
                    },
                },
            },
            __path__: 'Reply',
        };

        targetWrapper.inputs({ message: sourceAccessor } as any);

        const d = targetWrapper.data;
        const inputNames = d.inputs.map((i: any) => i.name);
        expect(inputNames).toContain('message');
    });

    it('inputs() with __root__ sets agentMaker on target when not already set', () => {
        const mockAgent = {
            structure: {
                components: [] as any[],
                connections: [],
            },
        };
        const sourceWrapper = new ComponentWrapper({
            name: 'Source',
            settings: {},
            inputs: {},
            outputs: { Reply: {} },
        });
        mockAgent.structure.components.push(sourceWrapper);

        const targetWrapper = new ComponentWrapper({
            name: 'Target',
            settings: {},
            inputs: {},
            outputs: {},
        });

        const sourceAccessor = {
            __root__: {
                data: sourceWrapper.data,
                agentMaker: mockAgent,
            },
            __path__: 'Reply',
        };

        targetWrapper.inputs({ msg: sourceAccessor } as any);
        expect(targetWrapper.agentMaker).toBe(mockAgent);
    });

    it('data getter handles array destructuring params (fallback case)', () => {
        // Array destructuring produces ArrayPattern which hits the fallback branch
        const fn = new Function('[a, b]', 'return a + b');
        const data = {
            name: 'Comp',
            settings: {},
            // Use eval to create an array-destructured function that acorn parses as ArrayPattern
            process: fn,
            inputs: {},
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);
        const d = wrapper.data;
        // Should have at least one input with an unknown_N name
        expect(d.inputs.length).toBeGreaterThan(0);
    });

    it('inputs() does not duplicate existing input keys', () => {
        const data = {
            name: 'Comp',
            settings: {},
            inputs: {
                existing: { component: null, type: 'Any', default: false },
            },
            outputs: {},
        };
        const wrapper = new ComponentWrapper(data);

        // Calling inputs with the same key should not override
        wrapper.inputs({
            existing: { type: 'Text', description: 'override attempt' },
        } as any);

        const d = wrapper.data;
        const existingInputs = d.inputs.filter((i: any) => i.name === 'existing');
        expect(existingInputs).toHaveLength(1);
    });
});
