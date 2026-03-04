import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogicAtMost } from '@sre/Components/LogicAtMost.class';
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

describe('LogicAtMost: process function', () => {
    let logicAtMost: LogicAtMost;
    let agent: Agent;
    let config: any;

    beforeEach(() => {
        // @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
        agent = new Agent();
        logicAtMost = new LogicAtMost();
        config = {
            name: 'LogicAtMost',
            inputs: [],
            data: { maxSetInputs: '2' },
        };
    });

    afterEach(() => {
        // ⚠️ Warning from vitest doc (https://vitest.dev/guide/mocking#mocking) - "Always remember to clear or restore mocks before or after each test run to undo mock state changes between runs!"
        vi.clearAllMocks();
    });

    it('should return `Output` as `undefined` when maxSetInputs is a non-numeric string', async () => {
        const input = {};

        config.data.maxSetInputs = 'abc';

        const result = await logicAtMost.process(input, config, agent);

        expect(result).toEqual({ Output: undefined });
    });

    it('should return `Output` as `undefined` when maxSetInputs is an empty string', async () => {
        const input = {};

        config.data.maxSetInputs = '';

        const expected = { Output: undefined };

        const result = await logicAtMost.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` when maxSetInputs is NaN', async () => {
        const input = {};

        config.data.maxSetInputs = 'NaN';

        const expected = { Output: undefined };

        const result = await logicAtMost.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `true` and `Verified` as `true` when at most maxSetInputs are truthy', async () => {
        const input = { a: true, b: true, c: false };

        config.inputs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];

        const expected = { Output: true, Verified: true };

        const result = await logicAtMost.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` and `Unverified` as `true` when more than maxSetInputs are truthy', async () => {
        const input = { a: true, b: true, c: true };

        config.inputs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];

        const expected = { Output: undefined, Unverified: true };

        const result = await logicAtMost.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `true` and `Verified` as `true` when exactly maxSetInputs are truthy', async () => {
        const input = { a: true, b: true, c: false };

        config.data.maxSetInputs = '2';
        config.inputs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];

        const expected = { Output: true, Verified: true };

        const result = await logicAtMost.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` and `Unverified` as `true` when maxSetInputs is less than 0', async () => {
        const input = { a: true, b: true };

        config.data.maxSetInputs = '-1';
        config.inputs = [{ name: 'a' }, { name: 'b' }];

        const expected = { Output: undefined, Unverified: true };

        const result = await logicAtMost.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` when maxSetInputs is greater than 9', async () => {
        const input = { a: true, b: true };

        config.data.maxSetInputs = '10';
        config.inputs = [{ name: 'a' }, { name: 'b' }];

        const expected = { Output: undefined };

        const result = await logicAtMost.process(input, config, agent);

        expect(result).toEqual(expected);
    });
});
