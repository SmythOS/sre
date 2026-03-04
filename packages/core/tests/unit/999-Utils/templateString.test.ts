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
    it('Parses nested object properties using JSONExpression', async () => {
        const data = {
            user: {
                name: 'Alice',
                profile: {
                    email: 'alice@example.com',
                    settings: {
                        theme: 'dark',
                    },
                },
            },
            items: [
                { title: 'First Item', id: 1 },
                { title: 'Second Item', id: 2 },
            ],
        };

        // Test dot notation for nested objects
        const result1 = TemplateString('User: {{user.name}}').parse(data).result;
        expect(result1).toBe('User: Alice');

        // Test deep nested properties
        const result2 = TemplateString('Email: {{user.profile.email}}').parse(data).result;
        expect(result2).toBe('Email: alice@example.com');

        // Test multiple nested properties in one template
        const result3 = TemplateString('{{user.name}} prefers {{user.profile.settings.theme}} theme').parse(data).result;
        expect(result3).toBe('Alice prefers dark theme');

        // Test array access with bracket notation
        const result4 = TemplateString('First: {{items[0].title}}, Second: {{items[1].title}}').parse(data).result;
        expect(result4).toBe('First: First Item, Second: Second Item');

        // Test non-existent properties return original placeholder
        const result5 = TemplateString('Missing: {{user.missing.property}}').parse(data).result;
        expect(result5).toBe('Missing: {{user.missing.property}}');
    });

    it('Replaces falsy values (0, "", false) correctly - ?? operator preserves them', async () => {
        const data = {
            count: 0,
            message: '',
            isActive: false,
        };

        // Number 0 is replaced with "0"
        const result1 = TemplateString('Count: {{count}}').parse(data).result;
        expect(result1).toBe('Count: 0');

        // Empty string is replaced (appears as blank)
        const result2 = TemplateString('Message: {{message}}').parse(data).result;
        expect(result2).toBe('Message: ');

        // Boolean false is replaced with "false"
        const result3 = TemplateString('Active: {{isActive}}').parse(data).result;
        expect(result3).toBe('Active: false');

        // All falsy values in one template
        const result4 = TemplateString('{{count}},{{message}},{{isActive}}').parse(data).result;
        expect(result4).toBe('0,,false');
    });

    it('Leaves null values as placeholder - ?? operator treats null as nullish', async () => {
        const data = {
            nullValue: null,
            user: {
                profile: null,
            },
        };

        // Direct key with null remains as placeholder
        const result1 = TemplateString('Value: {{nullValue}}').parse(data).result;
        expect(result1).toBe('Value: {{nullValue}}');

        // Nested path with null remains as placeholder
        const result2 = TemplateString('Profile: {{user.profile}}').parse(data).result;
        expect(result2).toBe('Profile: {{user.profile}}');
    });

    it('Resolves nested paths with falsy values (0, empty string, false)', async () => {
        const data = {
            user: {
                age: 0,
                bio: '',
                verified: false,
            },
            config: {
                settings: {
                    count: 0,
                },
            },
        };

        // Nested number 0
        const result1 = TemplateString('Age: {{user.age}}').parse(data).result;
        expect(result1).toBe('Age: 0');

        // Nested empty string
        const result2 = TemplateString('Bio: {{user.bio}}').parse(data).result;
        expect(result2).toBe('Bio: ');

        // Nested boolean false
        const result3 = TemplateString('Verified: {{user.verified}}').parse(data).result;
        expect(result3).toBe('Verified: false');

        // Deeply nested 0
        const result4 = TemplateString('Count: {{config.settings.count}}').parse(data).result;
        expect(result4).toBe('Count: 0');
    });

    it('Distinguishes between falsy values and missing keys', async () => {
        const data = {
            zero: 0,
            empty: '',
            no: false,
        };

        // Falsy values are replaced
        const result1 = TemplateString('{{zero}},{{empty}},{{no}}').parse(data).result;
        expect(result1).toBe('0,,false');

        // Missing keys remain as placeholders
        const result2 = TemplateString('{{missing}},{{alsoMissing}}').parse(data).result;
        expect(result2).toBe('{{missing}},{{alsoMissing}}');

        // Mix: falsy values replaced, missing keys unchanged
        const result3 = TemplateString('{{zero}},{{missing}},{{empty}}').parse(data).result;
        expect(result3).toBe('0,{{missing}},');
    });
});
