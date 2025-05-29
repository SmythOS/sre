import { Agent } from '@sre/AgentManager/Agent.class';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import util from 'util';
import path from 'path';
import { Classifier } from '@sre/Components/Classifier.class';
import config from '@sre/config';
import { PrepareSRETestEnvironment } from './common';

const { SREInstance, MockAgentData } = PrepareSRETestEnvironment();

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => MockAgentData);

    return { Agent: MockedAgent };
});

describe('Classifier Component', () => {
    it('should correctly classify an input using one of the options', async () => {
        // @ts-ignore
        const agent = new Agent();
        const input = `I'm upset`;
        const options = ['happy', 'sad', 'excited'];
        const answer = 'sad';
        const classifier = new Classifier();

        const output = await classifier.process(
            {
                Input: input,
            },
            {
                name: 'Classifier',
                data: {
                    model: 'gpt-4o',
                    prompt: `Classify the input content to one of the categories. Set the selected category to true and the others to empty value`,
                },
                outputs: options.map((option) => ({
                    name: option,
                    description: '',
                })),
            },
            agent,
        );

        expect(output).toBeDefined();
        // expect(output[answer]).toBe(true);

        for (let option of options) {
            if (option === answer) {
                expect(output[option]).toBeTruthy();
            } else {
                expect(output[option]).toBeFalsy();
            }
        }
    });
});
