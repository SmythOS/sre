import { afterAll, describe, expect, it, beforeAll } from 'vitest';
import express from 'express';
import config from '@sre/config';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { promisify } from 'util';
import fs from 'fs/promises'; // for promise-based file reading
import fsSync from 'fs';
import { AgentProcess } from '@sre/Core/AgentProcess.helper';

export const createRegressionTestSuite = async (base_dir: string, { server, port }: { server?: Server; port?: number }) => {
    let agentFiles = fsSync.readdirSync(base_dir);

    const _server = server || {
        listen: (port: number) => {
            console.log(`Dummy server is running on port ${port}`);
        },
        close: () => {
            console.log('Dummy server has been shut down');
        },
    };

    // Preload and prepare all data
    type PreparedAgentData = {
        agentFile: string;
        agentProcess: AgentProcess;
        systemPrompt: string;
        endpointPaths: string[];
    };

    const prepareAgentData = async (agentFile: string): Promise<PreparedAgentData> => {
        try {
            console.log(`Loading agent file: ${agentFile}`);
            const agentData = await fs.readFile(`${base_dir}/${agentFile}`, 'utf-8');
            const data = JSON.parse(agentData);
            const agentProcess = await AgentProcess.load(data);

            if (!agentProcess || !agentProcess.agent || !agentProcess.agent.data) {
                throw new Error('Invalid agent data structure');
            }

            const systemPrompt = agentProcess.agent.data.behavior || agentProcess.agent.data.shortDescription || agentProcess.agent.data.description;

            if (!Array.isArray(agentProcess.agent.data.components)) {
                throw new Error('AgentProcess.agent.data.components is not an array');
            }

            const endpointPaths = agentProcess.agent.data.components
                .filter((c) => c && c.name === 'APIEndpoint')
                .map((c) => c.data && c.data.endpoint)
                .filter(Boolean);

            console.log(`Endpoint paths for ${agentFile}:`, endpointPaths);

            return { agentFile, agentProcess, systemPrompt, endpointPaths };
        } catch (error) {
            console.error(`Error loading agent ${agentFile}:`, error);
            throw error;
        }
    };

    let preparedAgents: PreparedAgentData[];
    preparedAgents = await Promise.all(agentFiles.map(prepareAgentData)); // Preload all agent data

    describe('Agent Regression Tests', () => {
        beforeAll(async () => {
            const listen = promisify(_server.listen.bind(_server));
            await listen(port);
            console.log(`Server is running on port ${port}`);
        });

        afterAll(async () => {
            const close = promisify(_server.close.bind(_server));
            await close();
            console.log('Server has been shut down');
        });

        describe.each(preparedAgents)('Agent File: $agentFile', ({ agentFile, agentProcess, systemPrompt, endpointPaths }) => {
            it('should have valid endpoint paths', () => {
                expect(Array.isArray(endpointPaths)).toBe(true);
                expect(endpointPaths.length).toBeGreaterThan(0);
            });

            it.each(endpointPaths)(
                'should correctly handle endpoint: %s',
                async (path) => {
                    const sampleInput = agentProcess.agent.data.components.find((c) => c.title === `${path}:input`)?.data?.description;
                    const expectedOutput = agentProcess.agent.data.components.find((c) => c.title === `${path}:output`)?.data?.description;

                    if (!sampleInput || !expectedOutput) {
                        console.log(`Skipping test for ${path} due to missing input or output`);
                        return;
                    }

                    const conv = new Conversation('gpt-4o-mini', agentProcess.agent.data.id, { systemPrompt });

                    const result = await conv.prompt(
                        `call the endpoint ${path} with the following input: ${sampleInput}. return the response as it is
                        `,
                        {
                            'X-AGENT-ID': agentProcess.agent.data.id,
                        },
                    );

                    const evaluatorAgent = await fs.readFile('./tests/data/regression-tests-evalator.smyth', 'utf-8');
                    const evaluatorAgentData = JSON.parse(evaluatorAgent);

                    console.log(`Response: ${JSON.stringify(result)}. \n\n Expected: ${expectedOutput} \n\n`);

                    const evaluatorResult = await AgentProcess.load(evaluatorAgentData).run({
                        method: 'POST',
                        path: '/api/test',
                        body: {
                            data: JSON.stringify(result),
                            expectations: expectedOutput,
                        },
                    });

                    expect(evaluatorResult?.data?.result?.valid, `Evaluator result for ${path} is not valid`).toEqual('true');
                },
                100_000,
            );
        });
    });
};
