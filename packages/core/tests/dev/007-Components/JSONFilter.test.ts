import { describe, it, expect, vi, afterEach } from 'vitest';

import JSONFilter from '@sre/Components/JSONFilter.class';

import Agent from '@sre/AgentManager/Agent.class';

// Mock Agent class as we just need to have agent.agentRuntime?.debug inside createComponentLogger()
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => ({
        agentRuntime: { debug: true },
    }));
    return { default: MockedAgent };
});

describe('jsonFilter: filter some specific properties from a JSON Object', () => {
    /* Ignore TypeScript's argument requirements for the Agent constructor.
       This is acceptable in this context because we're using a mocked version of Agent,
       which does not require any arguments to function as intended in our tests. */
    // @ts-ignore
    const agent = new Agent();

    const jsonFilter = new JSONFilter();

    const jsonDataFull = {
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

    const jsonDataPartial = {
        id: 3,
        name: 'Alex Smith',
        profile: {
            age: 35,
        },
    };

    const config = {
        id: 1,
        name: 'JSONFilter',
        data: {
            fields: 'name,email',
        },
    };

    const configWithNestedFields = {
        id: 1,
        name: 'JSONFilter',
        data: {
            fields: 'name,email,profile,location,city,state',
        },
    };

    // ⚠️ Warning from vitest doc (https://vitest.dev/guide/mocking#mocking) - "Always remember to clear or restore mocks before or after each test run to undo mock state changes between runs!"
    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Test case: Filtering with top level fields
    it('should return object with top level properties', async () => {
        let error;

        try {
            const expected = {
                name: 'John Doe',
                email: 'johndoe@example.com',
            };
            const result = await jsonFilter.process({ Input: jsonDataFull }, config, agent);

            let output = result.Output;

            expect(output).toBeDefined();

            expect(output).toEqual(expected);
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
            const result = await jsonFilter.process({ Input: jsonDataFull }, configWithNestedFields, agent);

            let output = result.Output;

            expect(output).toBeDefined();

            expect(output).toEqual(expected);
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
            const result = await jsonFilter.process({ Input: jsonDataPartial }, configWithNestedFields, agent);

            let output = result.Output;
            expect(output).toBeDefined();

            // Expected to only return the name, as email is missing
            expect(output).toEqual({
                name: 'Alex Smith',
                profile: {}, // TODO: It could be improved by removing empty parent objects when nested properties are missing.
            });
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
            const result = await jsonFilter.process({ Input: {} }, config, agent);

            let output = result.Output;
            expect(output).toBeDefined();

            // Expected to return an empty object
            expect(output).toEqual({});
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('should filter fields in an array', async () => {
        const input = {
            Input: [
                { id: 1, name: 'John Doe' },
                { email: 'johndoe@example.com', phone: '+1826234343' },
            ],
        };
        const expected = [{ name: 'John Doe' }, { email: 'johndoe@example.com' }];
        const result = await jsonFilter.process(input, config, agent);
        expect(result.Output).toEqual(expected);
    });

    it('should return the input if it is not an object or array', async () => {
        const input = { Input: 'string' };
        const expected = 'string';
        const result = await jsonFilter.process(input, config, agent);
        expect(result.Output).toEqual(expected);
    });

    // Test case: Empty config.data.fields
    it('should handle empty config.data.fields gracefully', async () => {
        const input = { Input: {} };
        const _config = { id: 1, name: 'JSONFilter', data: { fields: '' } };
        const expected = {};

        const result = await jsonFilter.process(input, _config, agent);
        expect(result.Output).toEqual(expected);
    });

    it('should return null if the Input is null', async () => {
        const input = { Input: null };
        const expected = null;
        const result = await jsonFilter.process(input, config, agent);
        expect(result.Output).toEqual(expected);
    });

    // Test case: throw error for null input
    it('should throw an Error if the Input is null', async () => {
        const _config = {
            id: 1,
            name: 'JSONFilter',
            data: {
                fields: 'name,email',
            },
        };
        await expect(jsonFilter.process(null, _config, agent)).rejects.toThrowError();
    });

    // * to have this test agent.agentRuntime?.debug must be 'true', as we expect something in the '_debug' property
    if (agent.agentRuntime?.debug) {
        // Test case: Missing config.data.fields
        it('should handle missing config.data.fields gracefully', async () => {
            const input = { Input: {} };
            const _config = { id: 1, name: 'JSONFilter', data: {} };
            const expected = {
                Output: {},
                _error: null,
                _debug: expect.anything(),
            };

            await expect(jsonFilter.process(input, _config, agent)).resolves.toEqual(expect.objectContaining(expected));
        });
    }
});
