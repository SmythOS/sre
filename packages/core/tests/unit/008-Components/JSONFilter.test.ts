import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { JSONFilter } from '@sre/Components/JSONFilter.class';

import { Agent } from '@sre/AgentManager/Agent.class';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';

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

describe('jsonFilter: filter some specific properties from a JSON Object', () => {
    let agent;
    let jsonFilter;
    let input;
    let config;

    beforeEach(() => {
        // @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
        agent = new Agent();
        jsonFilter = new JSONFilter();
        input = {
            id: 1,
            name: 'John Doe',
            email: 'johndoe@example.com',
            profile: {
                age: 30,
                gender: 'male',
                location: {
                    city: 'New York',
                    state: 'NY',
                    country: 'USA',
                },
            },
        };
        config = {
            id: 1,
            name: 'JSONFilter',
            data: {
                fields: 'name,email',
            },
        };
    });

    afterEach(() => {
        // ⚠️ Warning from vitest doc (https://vitest.dev/guide/mocking#mocking) - "Always remember to clear or restore mocks before or after each test run to undo mock state changes between runs!"
        vi.clearAllMocks();
    });

    // Test case: Filtering with top level fields
    it('should return object with top level properties', async () => {
        let error;

        try {
            const expected = {
                name: 'John Doe',
                email: 'johndoe@example.com',
            };
            const result = await jsonFilter.process({ Input: input }, config, agent);

            expect(result.Output).toEqual(expected);
        } catch (e) {
            error = e;
            console.error(e.message);
        }

        expect(error).toBeUndefined();
    });

    // Test case: Filtering nested properties
    it('should correctly filter nested properties', async () => {
        let error;
        try {
            config.data.fields = 'name,email,profile,location,city,state';

            const expected = {
                name: 'John Doe',
                email: 'johndoe@example.com',
                profile: {
                    location: {
                        city: 'New York',
                        state: 'NY',
                    },
                },
            };

            const result = await jsonFilter.process({ Input: input }, config, agent);

            expect(result.Output).toEqual(expected);
        } catch (e) {
            error = e;
            console.error(e.message);
        }

        expect(error).toBeUndefined();
    });

    // Test case: Filtering with missing properties
    it('should handle missing properties gracefully', async () => {
        let error;
        try {
            delete input.email;
            delete input.profile.gender;
            delete input.profile.location;

            config.data.fields = 'name,email,profile,location,city,state';

            const expected = {
                name: 'John Doe',
                profile: {}, // TODO: It could be improved by removing empty parent objects from the `Output` when nested properties are missing.
            };

            const result = await jsonFilter.process({ Input: input }, config, agent);

            // Expected to only return the name, as email is missing
            expect(result.Output).toEqual(expected);
        } catch (e) {
            error = e;
            console.error(e.message);
        }

        expect(error).toBeUndefined();
    });

    // Test case: Filtering with empty input
    it('should return an empty object when input is empty', async () => {
        let error;
        try {
            const expected = {};

            const result = await jsonFilter.process({ Input: {} }, config, agent);

            expect(result.Output).toEqual(expected);
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('should filter fields in an array', async () => {
        const _input = {
            Input: [
                { id: 1, name: 'John Doe' },
                { email: 'johndoe@example.com', phone: '+1826234343' },
            ],
        };
        const expected = [{ name: 'John Doe' }, { email: 'johndoe@example.com' }];

        const result = await jsonFilter.process(_input, config, agent);

        expect(result.Output).toEqual(expected);
    });

    it('should return the input if it is not an object or array', async () => {
        const _input = { Input: 'string' };
        const expected = 'string';

        const result = await jsonFilter.process(_input, config, agent);

        expect(result.Output).toEqual(expected);
    });

    // Test case: Empty config.data.fields
    it('should handle empty config.data.fields gracefully', async () => {
        const _input = { Input: {} };

        config.data.fields = '';

        const expected = {};

        const result = await jsonFilter.process(_input, config, agent);

        expect(result.Output).toEqual(expected);
    });

    it('should return Output as null if the Input is null', async () => {
        const _input = { Input: null };
        const expected = null;

        const result = await jsonFilter.process(_input, config, agent);

        expect(result.Output).toEqual(expected);
    });

    // Test case: throw error for null input
    it('should throw an Error if the Input is null', async () => {
        await expect(jsonFilter.process(null, config, agent)).rejects.toThrowError();
    });

    // Test case: Missing config.data.fields
    it('should handle missing config.data.fields gracefully', async () => {
        const _input = { Input: {} };

        delete config.data.fields;

        const expected = {
            Output: {},
            _error: null,
            _debug: agent?.agentRuntime?.debug ? expect.anything() : undefined,
        };

        await expect(jsonFilter.process(_input, config, agent)).resolves.toEqual(expect.objectContaining(expected));
    });
});
