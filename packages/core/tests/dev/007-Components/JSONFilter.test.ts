import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';

import { describe, expect, it } from 'vitest';
const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
});

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');
describe('JSONFilter: filter some specific properties from a JSON Object', () => {
    // Test case: Filtering with top level fields
    it('should return object with top level properties', async () => {
        let error;
        try {
            const agentData = fs.readFileSync('./tests/data/test-jsonfilter-component-by-Forhad.smyth', 'utf-8');
            const data = JSON.parse(agentData);
            const date = new Date();

            const agentProcess = AgentProcess.load(data);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/filter_top_level_properties',
                body: {
                    json_data: {
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
                            preferences: {
                                newsletter: true,
                                notifications: ['email', 'sms'],
                            },
                        },
                    },
                },
            });

            let filteredOutput = output.result.Output;
            expect(filteredOutput).toBeDefined();

            expect(filteredOutput).toEqual({
                name: 'John Doe',
                email: 'johndoe@example.com',
            });
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
            const inputData = {
                id: 2,
                name: 'Jane Doe',
                email: 'janedoe@example.com',
                profile: {
                    age: 28,
                    gender: 'female',
                    location: {
                        city: 'Los Angeles',
                        state: 'CA',
                        country: 'USA',
                    },
                    preferences: {
                        newsletter: false,
                        notifications: ['email'],
                    },
                },
            };

            const agentProcess = AgentProcess.load(inputData);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/filter_nested_properties',
                body: {
                    json_data: inputData,
                },
            });

            let filteredOutput = output.result.Output;
            expect(filteredOutput).toBeDefined();

            expect(filteredOutput).toEqual({
                name: 'Jane Doe',
                email: 'janedoe@example.com',
                profile: {
                    location: {
                        city: 'Los Angeles',
                        state: 'CA',
                    },
                },
            });
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
            const inputData = {
                id: 3,
                name: 'Alex Smith',
                // email is intentionally missing
                profile: {
                    age: 35,
                    // gender is intentionally missing
                    location: {
                        city: 'Chicago',
                        state: 'IL',
                        country: 'USA',
                    },
                    preferences: {
                        newsletter: true,
                        notifications: ['sms'],
                    },
                },
            };

            const agentProcess = AgentProcess.load(inputData);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/filter_missing_properties',
                body: {
                    json_data: inputData,
                },
            });

            let filteredOutput = output.result.Output;
            expect(filteredOutput).toBeDefined();

            // Expected to only return the name, as email is missing
            expect(filteredOutput).toEqual({
                name: 'Alex Smith',
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
            const inputData = {};

            const agentProcess = AgentProcess.load(inputData);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/filter_empty_input',
                body: {
                    json_data: inputData,
                },
            });

            let filteredOutput = output.result.Output;
            expect(filteredOutput).toBeDefined();

            // Expected to return an empty object
            expect(filteredOutput).toEqual({});
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });
});
