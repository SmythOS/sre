import { describe, expect, it } from 'vitest';
import { TemplateString, Match } from '@sre/helpers/TemplateString.helper';

describe('Template String parser', () => {
    it('Parses simple template', async () => {
        const result = TemplateString('Hello {{name}}').parse({ name: 'World' }).result;

        expect(result).toBe('Hello World');
    });
    it('Processes a template string', async () => {
        const result = TemplateString('Hello {{name}}').process((token) => token.toUpperCase()).result;

        expect(result).toBe('Hello NAME');
    });
    it('Leaves unparsed entries unmodified', async () => {
        const result = TemplateString('This {{var1}} wil be parsed, but {{var2}} and {{var3}} will not').parse({ var1: 'Variable' }).result;

        expect(result).toBe('This Variable wil be parsed, but {{var2}} and {{var3}} will not');
    });
    it('Parses an entry, processes another and leaves the last one unmodified', async () => {
        const result = TemplateString('Hello {{name}}, This {{statement}} will be censored')
            .parse({ name: 'World' })
            .process((token) => '#######').result;

        expect(result).toBe('Hello World, This ####### will be censored');
    });

    it('Cleans unparsed entries', async () => {
        const result = TemplateString('This {{var1}} wil be parsed, but {{var2}} will not').clean().result;

        expect(result).toBe('This  wil be parsed, but  will not');
    });
    it('Parses multiple entries', async () => {
        const result = TemplateString('Hello {{name}}, you are {{age}} years old').parse({ name: 'World', age: '100' }).result;

        expect(result).toBe('Hello World, you are 100 years old');
    });
    it('Parses multiple entries with prefix', async () => {
        const result = TemplateString('Hello {{PREFIXname}}, you are {{PREFIXage}} years old').parse(
            { name: 'World', age: '100' },
            Match.prefix('PREFIX')
        ).result;

        expect(result).toBe('Hello World, you are 100 years old');
    });
    it('Parses a function annotation', async () => {
        const result = TemplateString('using a vault key : {{KEY(key)}}').parse({ key: 'MySecret' }, Match.fn('KEY')).result;

        expect(result).toBe('using a vault key : MySecret');
    });
    it('Parses a string using a custom regex', async () => {
        const result = TemplateString('Hello ${name}').parse({ name: 'World' }, /\${(.*?)}/g).result;

        expect(result).toBe('Hello World');
    });
});
