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
     * This function tries to extract and parse a JSON object from a string. If it fails, it returns the original string.
     * if the string is not a JSON representation, but contains a JSON object, it will extract and parse it.
     * @returns
     */
    public tryParse() {
        const strInput = this._current;
        if (!isValidString(strInput)) return strInput;
        let str = (this.extractJsonFromString(strInput) || strInput).trim();

        if ((isDigits(str) && !isSafeNumber(str)) || (!str.startsWith('{') && !str.startsWith('['))) return str;

        try {
            return JSON.parse(str);
        } catch (e) {
            try {
                return JSON.parse(jsonrepair(str));
            } catch (e: any) {
                //console.warn('Error on parseJson: ', e.toString());
                //console.warn('   Tried to parse: ', str);
                return strInput;
            }
        }
    }

    private extractJsonFromString(str) {
        try {
            const regex = /(\{.*\})/s;

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
