import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogicOR } from '@sre/Components/LogicOR.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Agent } from '@sre/AgentManager/Agent.class';
import { setupSRE } from '../../utils/sre';

setupSRE();

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => ({
        id: 'agent-0000',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
        isKilled: () => false,
        modelsProvider: ConnectorService.getModelsProviderConnector(),
    }));
    return { Agent: MockedAgent };
});

describe('LogicOR: process function', () => {
    let agent;
    let logicOR;
    let config;

    beforeEach(() => {
        // @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
        agent = new Agent();
        logicOR = new LogicOR();
        config = {
            name: 'LogicOR',
            inputs: [],
        };
    });

    afterEach(() => {
        // ⚠️ Warning from vitest doc (https://vitest.dev/guide/mocking#mocking) - "Always remember to clear or restore mocks before or after each test run to undo mock state changes between runs!"
        vi.clearAllMocks();
    });

    it('should return `Output` as `true` and `Verified` as `true` when at least one expected input is truthy', async () => {
        const input = { a: true, b: false, c: 0, d: null };

        config.inputs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }];

        const expected = {
            Output: true,
            Verified: true,
        };

        const result = await logicOR.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` and `Unverified` as `true` when all expected inputs are falsy', async () => {
        const input = { a: false, b: 0, c: null, d: '' };

        config.inputs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }];

        const expected = {
            Output: undefined,
            Unverified: true,
        };

        const result = await logicOR.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `true` and `Verified` as `true` when some expected inputs are missing but at least one is truthy', async () => {
        const input = { a: true };

        config.inputs = [{ name: 'a' }, { name: 'b' }];

        const expected = {
            Output: true,
            Verified: true,
        };

        const result = await logicOR.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` and `Unverified` as `true` when no inputs are provided', async () => {
        const input = {};

        config.inputs = [{ name: 'a' }, { name: 'b' }];

        const expected = {
            Output: undefined,
            Unverified: true,
        };

        const result = await logicOR.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` and `Unverified` as `true` when configuration is empty', async () => {
        const input = { a: true };

        config.inputs = [];

        const expected = {
            Output: undefined,
            Unverified: true,
        };

        const result = await logicOR.process(input, config, agent);

        expect(result).toEqual(expected);
    });
});
