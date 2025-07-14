import { describe, it, expect } from 'vitest';
import { canConnect } from '../../src/utils/connectUtils';

const nodes = [
    { id: '1', type: 'A' },
    { id: '2', type: 'B' },
];

const components = [
    { name: 'A', outputs: { out: { type: 'string' } } },
    { name: 'B', inputs: { inp: { type: 'number' } } },
];

describe('canConnect', () => {
    it('returns false for incompatible types', () => {
        expect(canConnect({ source: '1', target: '2' }, nodes, components)).toBe(false);
    });

    it('returns true for matching types', () => {
        const comps = [
            { name: 'A', outputs: { out: { type: 'string' } } },
            { name: 'B', inputs: { inp: { type: 'string' } } },
        ];
        expect(canConnect({ source: '1', target: '2' }, nodes, comps)).toBe(true);
    });
});
