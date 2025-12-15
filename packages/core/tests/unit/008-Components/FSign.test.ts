import { FSign } from '@sre/Components/FSign.class';
import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentSettings } from '@sre/AgentManager/AgentSettings.class';
import { loadAgentData } from '../../utils/test-data-manager';
import { setupSRE } from '../../utils/sre';
import crypto from 'crypto';

import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as tempStringHelpers from '@sre/helpers/TemplateString.helper';

setupSRE();

beforeEach(() => {
    // reset all mocks
    vi.restoreAllMocks();
});

describe('FSign Component', () => {
    it('should sign data using passed key', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/functions-components.smyth');
            const date = new Date();

            const agent = new Agent(10, data, new AgentSettings(10));

            const fsign = new FSign();
            const signingKey = crypto.randomBytes(16).toString('hex');
            const dataToSign = { test: 'data to sign' };
            const output = await fsign.process(
                { Data: dataToSign, Key: signingKey },
                {
                    data: {
                        signMethod: 'HMAC',
                        encoding: 'hex',
                        dataTransform: 'Stringify',
                        hashType: 'md5',
                    },
                },
                agent
            );

            expect(output.Signature).toBeDefined();

            const hmac = crypto.createHmac('md5', signingKey);
            hmac.update(JSON.stringify(dataToSign));
            const expected = hmac.digest('hex' as crypto.BinaryToTextEncoding);

            expect(output.Signature).toBe(expected);
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('should sign data using vault key', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/functions-components.smyth');
            const date = new Date();

            // const agentProcess = AgentProcess.load(data);

            // const
            // let output = await agentProcess.run({
            //     method: 'POST',
            //     path: '/api/sleep_10',
            //     body: {},
            // });

            // let outputResult = output?.result;

            const agent = new Agent(10, data, new AgentSettings(10));

            const fsign = new FSign();
            const dataToSign = { test: 'data to sign' };
            const vaultKey = '{{KEY(VAULT_KEY)}}';
            const vaultSigningKey = '0'.repeat(32);

            //@ts-ignore
            const spy = vi.spyOn(tempStringHelpers, 'TemplateString').mockImplementation((templateString: string) => {
                return {
                    parse: () => {
                        return {
                            result: templateString, // Return the original value for non-async parsing
                            parseTeamKeysAsync: () => {
                                return {
                                    asyncResult: vaultSigningKey,
                                };
                            },
                        };
                    },
                };
            });

            const output = await fsign.process(
                { Data: dataToSign },
                {
                    data: {
                        key: vaultKey,
                        signMethod: 'HMAC',
                        encoding: 'hex',
                        dataTransform: 'Stringify',
                        hashType: 'md5',
                    },
                },
                agent
            );

            expect(output.Signature).toBeDefined();

            expect(spy).toHaveBeenCalledWith(vaultKey);

            const hmac = crypto.createHmac('md5', vaultSigningKey);
            hmac.update(JSON.stringify(dataToSign));
            const expected = hmac.digest('hex' as crypto.BinaryToTextEncoding);

            expect(output.Signature).toBe(expected);
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });
});
