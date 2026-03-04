import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogicAtLeast } from '@sre/Components/LogicAtLeast.class';
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

describe('LogicAtLeast: process function', () => {
    let logicAtLeast: LogicAtLeast;
    let agent: Agent;
    let config: any;

    beforeEach(() => {
        // @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
        agent = new Agent();
        logicAtLeast = new LogicAtLeast();
        config = {
            name: 'LogicAtLeast',
            inputs: [],
            data: { minSetInputs: '2' }, // TODO: minSetInputs must be string, maybe need to adjust this behavior in the process function
        };
    });

    afterEach(() => {
        // ⚠️ Warning from vitest doc (https://vitest.dev/guide/mocking#mocking) - "Always remember to clear or restore mocks before or after each test run to undo mock state changes between runs!"
        vi.clearAllMocks();
    });

    it('should return `Output` as `true` and `Verified` as `true` when at least minSetInputs are truthy', async () => {
        const input = { a: true, b: true, c: '', d: false };

        config.inputs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }];

        const expected = { Output: true, Verified: true };

        const result = await logicAtLeast.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` and `Unverified` as `true` when less than minSetInputs are truthy', async () => {
        const input = { a: true, b: false, c: false };

        config.inputs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];

        const expected = { Output: undefined, Unverified: true };

        const result = await logicAtLeast.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` and `Unverified` as `true` when no inputs are provided', async () => {
        const input = {};
        config.inputs = [{ name: 'a' }, { name: 'b' }];
        const expected = { Output: undefined, Unverified: true };

        const result = await logicAtLeast.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` when minSetInputs is not a valid number', async () => {
        const input = { a: true, b: true };

        config.data.minSetInputs = 'invalid';
        config.inputs = [{ name: 'a' }, { name: 'b' }];

        const expected = { Output: undefined };

        const result = await logicAtLeast.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `true` and `Verified` as `true` when minSetInputs is less than 0', async () => {
        const input = { a: true, b: true };
        config.data.minSetInputs = '-1';
        config.inputs = [{ name: 'a' }, { name: 'b' }];
        const expected = { Output: true, Verified: true };

        const result = await logicAtLeast.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `undefined` when minSetInputs is greater than 9', async () => {
        const input = { a: true, b: true };
        config.data.minSetInputs = '10';
        config.inputs = [{ name: 'a' }, { name: 'b' }];
        const expected = { Output: undefined };

        const result = await logicAtLeast.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `true` and `Verified` as `true` when exactly minSetInputs are truthy', async () => {
        const input = { a: true, b: true, c: false };
        config.data.minSetInputs = '2';
        config.inputs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
        const expected = { Output: true, Verified: true };

        const result = await logicAtLeast.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `true` and `Verified` as `true` when more than minSetInputs are truthy', async () => {
        const input = { a: true, b: true, c: true };
        config.data.minSetInputs = '2';
        config.inputs = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
        const expected = { Output: true, Verified: true };

        const result = await logicAtLeast.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `true` and `Verified` as `true` when minSetInputs is 0 and no inputs are truthy', async () => {
        const input = { a: false, b: false };
        config.data.minSetInputs = '0';
        config.inputs = [{ name: 'a' }, { name: 'b' }];
        const expected = { Output: true, Verified: true };

        const result = await logicAtLeast.process(input, config, agent);

        expect(result).toEqual(expected);
    });

    it('should return `Output` as `true` and `Verified` as `true` when minSetInputs is 0 and at least one input is truthy', async () => {
        const input = { a: true, b: false };
        config.data.minSetInputs = '0';
        config.inputs = [{ name: 'a' }, { name: 'b' }];
        const expected = { Output: true, Verified: true };

        const result = await logicAtLeast.process(input, config, agent);

        expect(result).toEqual(expected);
    });
});
