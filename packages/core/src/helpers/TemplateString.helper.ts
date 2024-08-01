import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';

export type TemplateStringMatch = RegExp;

export const Match = {
    default: /{{(.*?)}}/g,
    //matches all placeholders
    doubleCurly: /{{(.*?)}}/g,
    singleCurly: /{(.*?)}/g,
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

export const TPLProcessor = {
    vaultTeam(teamId: string): (token) => Promise<string> {
        //the token here represents the vault key name
        return async (token) => await VaultHelper.getTeamKey(token, teamId);
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

    //this queue is used to wait for asyncronous results when async processors are used
    //if all processors are synchronous, this queue will be empty and .result getter can be used
    //if any processor is async, the .result getter will throw an error and you should use .asyncResult instead
    private _promiseQueue: Promise<any>[] = [];

    public get result() {
        if (this._promiseQueue.length <= 0) return this._current;
        throw new Error('This template object has async results, you should use .asyncResult with await instead of .result');
    }

    public get asyncResult() {
        return new Promise(async (resolve, reject) => {
            await Promise.all(this._promiseQueue);
            resolve(this._current);
        });
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
     * This is a shortcut function that parses vault key values and replace them with corresponding values from team vault
     * @param teamId
     * @returns
     */
    public parseTeamKeys(teamId: string) {
        return this.process(TPLProcessor.vaultTeam(teamId), Match.fn('KEY'));
    }

    /**
     * Processes a template string by replacing the placeholders with the result of the provided processor function
     * The processor function receives the token as an argument and should return the value to replace the token with
     * If the processor function returns undefined, the token will be left as is
     */
    public process(processor: (token) => Promise<string> | string, regex: TemplateStringMatch = Match.default) {
        if (typeof this._current !== 'string') return this;
        //first build a json object with all matching tokens
        let tokens = {};
        let match;

        const prosessorPromises = [];
        while ((match = regex.exec(this._current)) !== null) {
            const token = match[1];
            tokens[token] = match[0];

            const _processor = processor(token);

            //if an async processor is used, the TemplateStringHelper switches to async mode
            if (_processor instanceof Promise) {
                _processor.then((result) => {
                    if (result === undefined) {
                        return match[0];
                    }
                    tokens[token] = result;
                });
                prosessorPromises.push(_processor);
            } else {
                tokens[token] = _processor;
            }
        }

        if (prosessorPromises.length > 0) {
            const promise = new Promise(async (resolve, reject) => {
                await Promise.all(prosessorPromises);
                this.parse(tokens, regex);
                resolve(true);
            });
            this._promiseQueue.push(Promise.all(prosessorPromises));
        } else {
            this.parse(tokens, regex);
        }

        // this._current = await asyncReplace(this._current, regex, async (match, token) => {
        //     let result = await processor(token);
        //     if (result === undefined) {
        //         return match;
        //     }
        //     return result;
        // });

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

    // public toString() {
    //     if (this._promiseQueue.length <= 0) return this._current;
    //     return new Promise(async (resolve, reject) => {
    //         await Promise.all(this._promiseQueue);
    //         resolve(this._current);
    //     });
    // }
}

/**
 * a helper function that takes a string and escape it
 * This is useful when you have a stringified json and want to replace one of its values while making sure it won't break the json structure (e.g new lines, double quotes ...etc)
 */
export function escapeString(str?: string) {
    if (!str) return str;
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

export function TemplateString(templateString: string) {
    return TemplateStringHelper.create(templateString);
}
