import { jsonrepair } from 'jsonrepair';
import { isDigits, isSafeNumber, isValidString } from '@sre/utils';

export class JSONContentHelper {
    private _current: string;

    public get result() {
        return this._current;
    }
    private constructor(private dataString: string) {
        this._current = dataString;
    }

    public static create(dataString: string) {
        return new JSONContentHelper(dataString);
    }

    /**
     * This a permissive json parsing function : It tries to extract and parse a JSON object from a string. If it fails, it returns the original string.
     * if the string is not a JSON representation, but contains a JSON object, it will extract and parse it.
     * @returns
     */
    public tryParse() {
        const strInput = this._current;

        // is it an object ? a digit ? a safe number ?
        if (!isValidString(strInput) || isDigits(strInput) || isSafeNumber(strInput)) return strInput;

        let str = strInput.trim();

        // the string seems to be a json object
        if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
            try {
                return JSON.parse(str);
            } catch (e) {
                try {
                    const repairedJson = jsonrepair(str);
                    return JSON.parse(repairedJson);
                } catch (e: any) {}
            }
        }

        // the string does not seem to be a json object, so we try to extract a json object from it
        str = (this.extractJsonFromString(strInput) || strInput).trim();

        if ((isDigits(str) && !isSafeNumber(str)) || (!str.startsWith('{') && !str.startsWith('['))) return str;

        try {
            return JSON.parse(str);
        } catch (e) {
            try {
                const repairedJson = jsonrepair(str);
                return JSON.parse(repairedJson);
            } catch (e: any) {
                //console.warn('Error on parseJson: ', e.toString());
                //console.warn('   Tried to parse: ', str);
                return strInput;
            }
        }
    }

    // Same as tryParse but it does not extract JSON from string
    public tryFullParse() {
        const str = this._current;
        if (!str) return str;

        if ((isDigits(str) && !isSafeNumber(str)) || (!str.startsWith('{') && !str.startsWith('['))) return str;

        try {
            return JSON.parse(str);
        } catch (e) {
            try {
                return JSON.parse(jsonrepair(str));
            } catch (e: any) {
                console.warn('Error on parseJson: ', e.toString());
                console.warn('   Tried to parse: ', str);
                return { result: str, error: e.toString() };
            }
        }
    }

    private extractJsonFromString(str) {
        try {
            const regex = /(\{.*\})/s; // LLMs in smythOS are expected to generate json between curly brackets only

            const match = str.match(regex);

            return match?.[1];
        } catch {
            return null;
        }
    }
}

export function JSONContent(dataString: string) {
    return JSONContentHelper.create(dataString);
}
