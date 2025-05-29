import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { PrepareSRETestEnvironment } from './common';

const { SREInstance, MockAgentData } = PrepareSRETestEnvironment();

describe('Async and Await Components', () => {
    it('should not wait for a job to be done without await', async () => {
        const agentData = fs.readFileSync('./tests/data/async-await-foreach-tests.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const date = new Date();

        const agentProcess = AgentProcess.load(data);
        const testJobTimeSec = 30_000;

        const start = process.hrtime();
        let output = await agentProcess.run({
            method: 'POST',
            path: '/api/no-await-async',
            body: {
                prompt: 'Hello',
            },
        });
        const end = process.hrtime(start);
        const elapsedSeconds = Math.round((end[0] + end[1] / 1e9) * 1000) / 1000;

        expect(elapsedSeconds).toBeLessThan(testJobTimeSec);
        expect(output.data).toEqual([]);
    });

    it('should resolve and wait for a job to be done with await', async () => {
        const agentData = fs.readFileSync('./tests/data/async-await-foreach-tests.smyth', 'utf-8');
        const data = JSON.parse(agentData);

        const agentProcess = AgentProcess.load(data);
        const minTestJobTimeSec = 10;

        const start = process.hrtime();
        let output = await agentProcess.run({
            method: 'POST',
            path: '/api/async-job',
            body: {
                prompt: 'Hello',
            },
        });

        const end = process.hrtime(start);
        const elapsedSeconds = Math.round((end[0] + end[1] / 1e9) * 1000) / 1000;

        const results = Object.entries(output.data?.result?.Results || {}) as [string, any][];
        expect(results.length).toBe(1);

        const jobStatus = results[0][1]?.status;
        expect(jobStatus).toBe('done');

        expect(elapsedSeconds).toBeGreaterThanOrEqual(minTestJobTimeSec);
    });

    // TODO: implement For-Each component first to test this
    it('should resolve and wait for multiple concurrent jobs with await', async () => {
        const agentData = fs.readFileSync('./tests/data/async-await-foreach-tests.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const date = new Date();

        const agentProcess = AgentProcess.load(data);

        let output = await agentProcess.run({
            method: 'POST',
            path: '/api/for-each-async-job',
            body: {
                prompts: ['Hello', 'World', 'Foo', 'Bar'],
            },
        });

        console.log(output);
        const results = output.data?.result?.Output?.results;
        expect(results).toBeDefined();

        const replies = Object.values(results).map((r: any) => r?.output?.result?.Reply);
        expect(replies).toHaveLength(4);

        expect(replies).toEqual(['Hello', 'World', 'Foo', 'Bar']);
    });
});
