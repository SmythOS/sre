export type TemplateStringMatch = RegExp;

export const Match = {
    default: /{{(.*?)}}/g,
    //matches all placeholders
    all: /{{(.*?)}}/g,
    //matches only the placeholders that have a specific prefix
    prefix(prefix: string) {
        return new RegExp(`{{${prefix}(.*?)}}`, 'g');
    },

    //matches only the placeholders that have a specific suffix
    suffix(suffix: string) {
        return new RegExp(`{{(.*?)${suffix}}}`, 'g');
    },
    //matches only the placeholders that have a specific prefix and suffix
    prefSuf(prefix: string, suffix: string) {
        return new RegExp(`{{${prefix}(.*?)${suffix}}}`, 'g');
    },

    //matches a function annotation with a given name, just like prefix but with wrapping parenthesis
    fn(name: string) {
        return new RegExp(`{{${name}\\((.*?)\\)}}`, 'g');
    },
};

/**
 * Provides a chainable to manipulate template strings
 *
 * Template strings are strings that can contain placeholders, which are expressions that get evaluated to produce a resulting string.
 * The placeholders are defined by double curly braces `{{` and `}}`.
 */
export class TemplateStringHelper {
    private _current: string;

    public get result() {
        return this._current;
    }
    private constructor(private templateString: string) {
        this._current = templateString;
    }

    public static create(templateString: string) {
        return new TemplateStringHelper(templateString);
    }

    /**
     * Parses a template string by replacing the placeholders with the values from the provided data object
     * unmatched placeholders will be left as is
     */
    public parse(data: Record<string, string>, regex: TemplateStringMatch = Match.default) {
        if (typeof this._current !== 'string') return this;
        this._current = this._current.replace(regex, (match, token) => {
            return data[token] || match;
        });

        return this;
    }

    /**
     * Processes a template string by replacing the placeholders with the result of the provided processor function
     * The processor function receives the token as an argument and should return the value to replace the token with
     * If the processor function returns undefined, the token will be left as is
     */
    public process(processor: Function, regex: TemplateStringMatch = Match.default) {
        if (typeof this._current !== 'string') return this;
        this._current = this._current.replace(regex, (match, token) => {
            let result = processor(token);
            if (result === undefined) {
                return match;
            }
            return result;
        });

        return this;
    }

    /**
     * Removes all placeholders from the template string, leaving only the plain text
     * This is useful when you want to clean up a template string that has placeholders that were not parsed
     */
    public clean(regex: TemplateStringMatch = Match.default) {
        if (typeof this._current !== 'string') return this;
        this._current = this._current.replace(regex, '');
        return this;
    }

    public toString() {
        return this._current;
    }
}

export function TemplateString(templateString: string) {
    return TemplateStringHelper.create(templateString);
}
