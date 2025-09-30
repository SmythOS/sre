import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogicAND } from '@sre/Components/LogicAND.class';
import { Agent } from '@sre/AgentManager/Agent.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
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

describe('LogicAND: process function', () => {
    let logicAND: LogicAND;
    let agent: Agent;
    let config: any;

    beforeEach(() => {
        // @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
        agent = new Agent();
        logicAND = new LogicAND();
        config = {
            name: 'LogicAND',
            inputs: [],
        };
    });

    afterEach(() => {
        // ⚠️ Warning from vitest doc (https://vitest.dev/guide/mocking#mocking) - "Always remember to clear or restore mocks before or after each test run to undo mock state changes between runs!"
        vi.clearAllMocks();
    });

    it('should return `Output` and `Verified` as `true` when all expected inputs are provided', async () => {
        const input = { a: true, b: 'string', c: {}, d: [] };

        config.inputs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }];

        const expected = {
            Output: true,
            Verified: true,
        };

        const result = await logicAND.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` and `Unverified` as `true` when some expected inputs are missing', async () => {
        const input = { a: true };

        config.inputs = [{ name: 'a' }, { name: 'b' }];

        const expected = {
            Output: undefined,
            Unverified: true,
        };

        const result = await logicAND.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` and `Unverified` as `true` when no inputs are provided', async () => {
        const input = {};

        config.inputs = [{ name: 'a' }, { name: 'b' }];

        const expected = {
            Output: undefined,
            Unverified: true,
        };

        const result = await logicAND.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `true` and `Verified` as `true` when both input and config.inputs are empty', async () => {
        const input = {};

        config.inputs = [];

        const expected = {
            Output: true,
            Verified: true,
        };

        const result = await logicAND.process(input, config, agent);

        expect(result).toEqual(expected);
    });
});
