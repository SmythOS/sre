import { describe, expect, it } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { IAccessCandidate, TAccessRole } from 'index';

setupSRE({
    Code: {
        Connector: 'ECMASandbox',
        Settings: {},
    },
    Log: {
        Connector: 'ConsoleLog',
    },
});

describe('ECMASandbox Tests', () => {
    it(
        'Runs a simple code and returns the output',
        async () => {
            const mockCandidate: IAccessCandidate = {
                id: 'test-user',
                role: TAccessRole.User,
            };

            const codeConnector = ConnectorService.getCodeConnector('ECMASandbox');
            const result = await codeConnector.agent(mockCandidate.id).execute(Date.now().toString(), {
                code: `async function main(prompt) { 
                return prompt + ' ' + 'Hello World'; 
                }`,
                inputs: {
                    prompt: 'Say'
                }
            });

            const output = result.output;
            expect(output).toBe('Say Hello World');
        },
    );
    it(
        'Try to run a simple code without main function',
        async () => {
            const mockCandidate: IAccessCandidate = {
                id: 'test-user',
                role: TAccessRole.User,
            };

            const codeConnector = ConnectorService.getCodeConnector('ECMASandbox');
            const result = await codeConnector.agent(mockCandidate.id).execute(Date.now().toString(), {
                code: `async function testFunction(prompt) { return prompt + ' ' + 'Hello World'; }`,
                inputs: {
                    prompt: 'Say'
                }
            });
            const error = result.errors;
            expect(error).toContain('No main function found at root level');
        },
    );
});
