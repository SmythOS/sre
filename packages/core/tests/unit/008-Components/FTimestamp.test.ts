import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { setupSRE } from '../../utils/sre';
import { loadAgentData } from '../../utils/test-data-manager';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FTimestamp } from '../../../src/Components/FTimestamp.class';
import { IAgent } from '../../../src/types/Agent.types';

setupSRE();

const mockAgent: IAgent = {
    id: 'test-agent-id',
    agentRuntime: { debug: false },
    sse: null,
    isKilled: vi.fn(() => false),
} as any;
const mockTimestamp = 1642780800000; // January 21, 2022 12:00:00 UTC
describe('FTimestamp Component', () => {
    let component: FTimestamp;
    let originalDateNow: () => number;

    beforeEach(() => {
        component = new FTimestamp();
        originalDateNow = Date.now;
        Date.now = vi.fn(() => mockTimestamp);
    });

    afterEach(() => {
        Date.now = originalDateNow;
    });

    it('should return unix timestamp by default', async () => {
        const result = await component.process({}, { data: {}, name: 'test' }, mockAgent);

        expect(result.Timestamp).toBe(mockTimestamp);
        expect(result._error).toBeUndefined();
        expect(typeof result.Timestamp).toBe('number');
    });

    it('should return unix timestamp when format is "unix"', async () => {
        const config = { data: { format: 'unix' }, name: 'test' };
        const result = await component.process({}, config, mockAgent);

        expect(result.Timestamp).toBe(mockTimestamp);
        expect(typeof result.Timestamp).toBe('number');
    });

    it('should return ISO string when format is "iso"', async () => {
        const config = { data: { format: 'iso' }, name: 'test' };
        const result = await component.process({}, config, mockAgent);

        expect(typeof result.Timestamp).toBe('string');
        expect(typeof result.Timestamp).toBe('string');
    });

    it('should format using custom dayjs patterns', async () => {
        const config = { data: { format: 'YYYY-MM-DD' }, name: 'test' };
        const result = await component.process({}, config, mockAgent);

        expect(typeof result.Timestamp).toBe('string');
        expect(result.Timestamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should include standard component output properties', async () => {
        const result = await component.process({}, { data: {}, name: 'test' }, mockAgent);

        expect(result).toHaveProperty('Timestamp');
        expect(result).toHaveProperty('_error');
        expect(result).toHaveProperty('_debug');
        expect(result).toHaveProperty('_debug_time');
    });

    it('should return error for invalid custom format strings', async () => {
        const config = { data: { format: 'INVALID_FORMAT' }, name: 'test' };
        const result = await component.process({}, config, mockAgent);

        expect(result._error).toBeDefined();
    });

    it('should handle null format gracefully', async () => {
        const invalidConfig = { data: { format: null }, name: 'test' };
        const result = await component.process({}, invalidConfig, mockAgent);

        // Should fallback to default behavior since null becomes 'unix'
        expect(result.Timestamp).toBeDefined();
        expect(result._error).toBeUndefined();
    });

    it('Call from agent (.smyth file)', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/functions-components.smyth');
            const date = new Date();

            const agentProcess = AgentProcess.load(data);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/timestamp',
                body: {},
            });

            let outputResult = output?.data?.result;
            expect(outputResult).toBeDefined();

            expect(outputResult?.Timestamp).toBeDefined();
            expect(outputResult?.Timestamp).toEqual(mockTimestamp); // Timestamp should be greater than current time

            expect(outputResult?._error).toBeUndefined();
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });
});
