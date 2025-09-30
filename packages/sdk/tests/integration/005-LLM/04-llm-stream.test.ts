// prettier-ignore-file
import { describe, it, expect } from 'vitest';

import { LLM } from '../../../src';

describe('INT LLM - streaming', () => {
    it('streams content and completes', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const stream = await llm.prompt('What is the capital of France?').stream();
        let result = '';
        await new Promise<void>((resolve, reject) => {
            stream.on('content', (c: string) => {
                result += c;
            });
            stream.on('end', () => resolve());
            stream.on('error', reject);
        });
        expect(result).toBeDefined();
        expect(result.toLowerCase()).toContain('paris');
    });
});
