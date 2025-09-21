import { describe, it, expect } from 'vitest';
import { WorkflowValidatorService } from '@sre/AgentManager/WorkflowValidator.service';

function makeComponent(id: string, name: string, inputs: string[] = [], required: boolean[] = [], outputs: string[] = []) {
    return {
        id,
        name,
        inputs: inputs.map((n, i) => ({ name: n, optional: !(required[i] ?? true), default: false })),
        outputs: outputs.map((n) => ({ name: n })),
    };
}

describe('WorkflowValidatorService', () => {
    it('Valid linear workflow -> no issues; returns topo order', () => {
        const validator = new WorkflowValidatorService();
        const components = [
            makeComponent('A', 'APIEndpoint', [], [], ['Response']),
            makeComponent('B', 'GenAILLM', ['prompt'], [true], ['Text']),
            makeComponent('C', 'APIOutput', ['result'], [true], []),
        ];
        const connections = [
            { sourceId: 'A', targetId: 'B', sourceIndex: 0, targetIndex: 'prompt' },
            { sourceId: 'B', targetId: 'C', sourceIndex: 'Text', targetIndex: 0 },
        ];

        const result = validator.validate({ components, connections });
        expect(result.errors.length).toBe(0);
        expect(result.isValid).toBe(true);
        expect(result.topologicalOrder?.length).toBe(3);
    });

    it('Missing component reference -> error', () => {
        const validator = new WorkflowValidatorService();
        const components = [makeComponent('A', 'APIEndpoint', [], [], ['Response'])];
        const connections = [{ sourceId: 'A', targetId: 'B', sourceIndex: 0, targetIndex: 0 }];
        const result = validator.validate({ components, connections });
        expect(result.errors.some((e) => e.code === 'MISSING_TARGET')).toBe(true);
        expect(result.isValid).toBe(false);
    });

    it('Missing required input mapping -> error', () => {
        const validator = new WorkflowValidatorService();
        const components = [
            makeComponent('A', 'APIEndpoint', [], [], ['Response']),
            makeComponent('B', 'GenAILLM', ['prompt'], [true], ['Text']),
        ];
        const connections: any[] = []; // no mapping for B.prompt
        const result = validator.validate({ components, connections });
        expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_INPUT')).toBe(true);
        expect(result.isValid).toBe(false);
    });

    it('Cycle -> error listing cycle path', () => {
        const validator = new WorkflowValidatorService();
        const components = [
            makeComponent('A', 'GenAILLM', ['x'], [true], ['y']),
            makeComponent('B', 'Classifier', ['u'], [true], ['v']),
        ];
        const connections = [
            { sourceId: 'A', targetId: 'B', sourceIndex: 'y', targetIndex: 'u' },
            { sourceId: 'B', targetId: 'A', sourceIndex: 'v', targetIndex: 'x' },
        ];
        const result = validator.validate({ components, connections });
        expect(result.errors.concat(result.warnings).some((e) => e.code === 'CYCLE_DETECTED')).toBe(true);
    });

    it('Dead component -> warning', () => {
        const validator = new WorkflowValidatorService();
        const components = [
            makeComponent('A', 'APIEndpoint', [], [], ['Response']),
            makeComponent('B', 'GenAILLM', ['prompt'], [true], ['Text']),
            makeComponent('D', 'GenAILLM', ['foo'], [true], ['Bar']), // Unconnected
        ];
        const connections = [{ sourceId: 'A', targetId: 'B', sourceIndex: 0, targetIndex: 'prompt' }];
        const result = validator.validate({ components, connections });
        expect(result.warnings.some((w) => w.code === 'DEAD_COMPONENT')).toBe(true);
        expect(result.isValid).toBe(true); // only warnings
    });
});


