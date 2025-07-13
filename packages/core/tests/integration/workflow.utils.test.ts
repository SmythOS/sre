import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Agent } from '@smythos/sdk';
import { saveWorkflow, loadWorkflow } from '@smythos/sdk/utils';
import { testData } from '../utils/test-data-manager';

const tempFile = path.join(testData.getBaseDir(), 'temp-workflow.smyth');

afterAll(() => {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
});

describe('Workflow utils', () => {
    it('saves and loads workflow', () => {
        const agent = Agent.import(testData.getDataPath('sre-echo-LLMPrompt.smyth'));
        saveWorkflow(agent, tempFile);
        expect(fs.existsSync(tempFile)).toBe(true);
        const loaded = loadWorkflow(tempFile);
        expect(loaded.data.name).toBe(agent.data.name);
    });
});
