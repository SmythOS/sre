import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { CLIAgentDataConnector } from '@sre/AgentManager/AgentData.service/connectors/CLIAgentDataConnector.class';
import { setupSRE } from '../../utils/sre';
import { loadAgentData, loadTestData } from '../../utils/test-data-manager';

setupSRE();

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');
describe('Strong Data typing Features', () => {
    it('APIEndpoint : nominal case', async () => {
        let error;
        try {
            // const agentData = fs.readFileSync('./tests/data/general-unit-tests.smyth', 'utf-8');
            const data = loadAgentData('AgentData/general-unit-tests.smyth');
            const date = new Date();

            const agentProcess = AgentProcess.load(data);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/test_strong_typing',
                body: {
                    any: 'some data',
                    string: 'Hello world',
                    number: '1337.42',
                    integer: '42',
                    boolean: 'true',
                    array: '[1,2,3]',
                    object: '{"key":"value"}',
                    binary: 'https://smythos.com/wp-content/themes/generatepress_child/img/smythos-light.svg',
                    date: date.toISOString(),
                },
            });

            let outputBody = output?.data?.result?.body;
            expect(outputBody).toBeDefined();

            expect(outputBody?.string).toBeTypeOf('string');
            expect(outputBody?.number).toBeTypeOf('number');
            expect(Math.round(outputBody?.integer)).toEqual(42);
            expect(outputBody?.boolean).toBeTypeOf('boolean');

            expect(outputBody?.array).toBeInstanceOf(Array);
            expect(outputBody?.array).toEqual([1, 2, 3]);

            expect(outputBody?.object).toBeInstanceOf(Object);
            expect(outputBody?.binary?.url).toContain('smythfs://');
            expect(new Date(outputBody?.date)).toEqual(date);
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('APIEndpoint with Array variation', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/general-unit-tests.smyth');
            const date = new Date();

            const agentProcess = AgentProcess.load(data);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/test_strong_typing',
                body: {
                    any: 'some data',
                    array: 'a,b,c',
                },
            });

            let outputBody = output?.data?.result?.body;
            expect(outputBody).toBeDefined();

            expect(outputBody?.array).toBeInstanceOf(Array);
            expect(outputBody?.array).toEqual(['a', 'b', 'c']);
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('APIEndpoint : should detect invalid formats', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/general-unit-tests.smyth');

            const agentProcess = AgentProcess.load(data);

            const testCases = [
                {
                    fields: { number: 'abc' },
                    message: 'Invalid number format',
                },
                {
                    fields: { integer: 'abc' },
                    message: 'Invalid integer format',
                },
                {
                    fields: { boolean: 'abc' },
                    message: 'Invalid boolean format',
                },
                {
                    fields: { object: 'abc' },
                    message: 'Invalid object format',
                },
                {
                    fields: { date: 'abc' },
                    message: 'Invalid date format',
                },
            ];

            for (let testCase of testCases) {
                let output = await agentProcess.run({
                    method: 'POST',
                    path: '/api/test_strong_typing',
                    body: {
                        ...testCase.fields,
                    },
                });
                agentProcess.reset();

                if (!output?.data?.result?._error) {
                    console.log(testCase.message, testCase.fields);
                    console.log('Received', output?.data?.result?.body);
                }

                expect(output?.data?.result?._error).toBeDefined();
            }
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('APIEndpoint : default values', async () => {
        const data = loadAgentData('AgentData/general-unit-tests.smyth');

        const agentProcess = AgentProcess.load(data);

        let output = await agentProcess.run({
            method: 'POST',
            path: '/api/test_strong_typing_default_vals',
            body: {},
        });

        let outputBody = output?.data?.result?.body;

        console.log('>>>>>>', outputBody);
        expect(outputBody.string).toBe('Hello world');
        expect(outputBody.number).toBe(123);
        expect(outputBody.integer).toBe(1234);
        expect(outputBody.boolean).toBe(true);
        expect(outputBody.array).toEqual(['a', 'b', 'c', 'd']);
        expect(outputBody.object).toEqual({ message: 'hello world' });
        expect(outputBody.binary.size).toEqual(9);
        expect(outputBody.date).toEqual('2024-01-19T23:00:00.000Z');
    });
});
