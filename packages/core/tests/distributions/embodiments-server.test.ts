import OpenAI from 'openai';
import { app } from '../../distributions/embodiments-server/app';

import { expect, describe, it } from 'vitest';

const local = 'http://localhost:7001';
const openAIApp = app.listen(7001, () => {
    console.log('Embodiments Server is running on port 7001');
});

const openai = new OpenAI({
    // apiKey: apiKey || process.env.OPENAI_API_KEY,
    baseURL: local,
    apiKey: 'any_key',
});
describe('Embodiments Server', () => {
    it('chat completion', async () => {
        const completion = await openai.chat.completions.create({
            messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
            model: 'gpt-4o-mini',
        });

        console.log(completion.choices[0]);

        expect(completion.choices[0].message.content).toBeDefined();
        expect(completion.model).toBe('gpt-4o-mini');
    }, 70_000);

    it('chat completion stream', async () => {
        // aggregate the stream
        const stream = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'What is the capital of France?' },
            ],
            model: 'gpt-4o-mini',
            stream: true,
        });

        let content = '';
        for await (const chunk of stream) {
            content += chunk.choices[0]?.delta?.content || '';
        }

        expect(content).toBeDefined();
    }, 100_000);

    it('should completetion with custom stream that emits tool call status', async () => {
        const stream = await openai.chat.completions.create(
            {
                messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
                model: 'gpt-4o-mini',
                stream: true,
            },
            {
                query: {
                    include_status: true,
                },
            }
        );

        let content = '';
        let encounteredStatus = 0;
        for await (const chunk of stream) {
            content += chunk.choices[0]?.delta?.content || '';
            if ((chunk.choices[0]?.delta as any)?.status) {
                encounteredStatus++;
            }
        }

        expect(content).toBeDefined();
        expect(encounteredStatus).toBeGreaterThan(0);
    }, 70_000);
});
