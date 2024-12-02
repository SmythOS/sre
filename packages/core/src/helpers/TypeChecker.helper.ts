import { isRawBase64, isDataUrl } from '@sre/utils/base64.utils';
import dayjs from 'dayjs';
import { isBinaryData, isBuffer, isPlainObject, isSmythFileObject, isUrl, uid } from '../utils';
import Agent from '@sre/AgentManager/Agent.class';
import { TAccessRole } from '@sre/types/ACL.types';
import { BinaryInput } from './BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { JSONContent } from './JsonContent.helper';
import { Logger } from './Log.helper';

export const inputErrMsg = (type, name) => `Invalid ${type} value for Input: ${name}`;
const logger = Logger('TypeChecker.helper');

const InferenceStrategies = {
    any: inferAnyType,
    string: inferStringType,
    number: inferNumberType,
    integer: inferIntegerType,
    boolean: inferBooleanType,
    array: inferArrayType,
    object: inferObjectType,
    binary: inferBinaryType,
    date: inferDateType,
};

/**
 * Performs type inference on the inputs based on the input config
 * @param inputs - The inputs to perform type inference on
 * @param inputConfig - The input config to perform type inference on
 * @param agent - The agent to perform type inference on
 * @returns The inputs with the inferred types
 */
export async function performTypeInference(
    inputs: Record<string, any>,
    inputConfig: Record<string, any>[],
    agent: Agent
): Promise<Record<string, any>> {
    try {
        if (!inputConfig || Object.keys(inputConfig)?.length === 0) return inputs;

        // Clone the input object to avoid modifying the original object
        const _inputs = { ...inputs };
        const _inputConfig = {};

        for (const input of inputConfig) {
            if (input?.name) {
                _inputConfig[input.name] = { ...input };
            }
        }

        for (const [key, config] of Object.entries(_inputConfig)) {
            let value = inputs?.[key] || '';

            if (!value) continue;

            const type = (config as any)?.type?.toLowerCase() || 'any';

            if (!InferenceStrategies[type]) {
                //* For backward compatibility, we don't throw an error if the type is not supported. instead, we return the value as it is.
                // throw new Error(`Invalid type: ${type} for Input: ${key}`);
                logger.warn(`Unsupported type: ${type} for Input: ${key} for agent: ${agent?.id} input: ${key}`);
                continue;
            }

            _inputs[key] = await InferenceStrategies[type](value, key, agent);
        }

        return _inputs;
    } catch (error) {
        throw error;
    }
}

async function inferStringType(value: any, key?: string, agent?: Agent) {
    if (value === null || value === undefined || value === 'null' || value === 'undefined') {
        return '';
    } else if (isRawBase64(value) || isDataUrl(value)) {
        // If the value is a base64 string then return the value as it is
        return value;
    } /*else if (isSmythFileObject(value) || isBuffer(value) || isBinaryData(value)) {
        const file = new SmythFile(value);
        const base64Obj = await file.toBase64Object();
        return `data:${base64Obj.mimetype};base64,${base64Obj.base64}`;
    }*/ else if (typeof value === 'object' || Array.isArray(value)) {
        return JSON.stringify(value);
    } else {
        return String(value);
    }
}

async function inferNumberType(value: any, key?: string, agent?: Agent) {
    const floatVal = parseFloat(value);

    if (isNaN(floatVal)) {
        throw new Error('Invalid Number value');
    }

    return floatVal;
}

async function inferIntegerType(value: any, key?: string, agent?: Agent) {
    const intVal = parseInt(value);

    if (isNaN(intVal)) throw new Error('Invalid Integer value');

    return intVal;
}

async function inferBooleanType(value: any, key?: string, agent?: Agent) {
    if (typeof value === 'boolean') {
        return value;
    } else if (typeof value === 'string' || typeof value === 'number') {
        const lowerCaseValue = String(value).toLowerCase();
        if (['true', '1'].includes(lowerCaseValue)) {
            return true;
        } else if (['false', '0'].includes(lowerCaseValue)) {
            return false;
        } else {
            throw new Error('Invalid Boolean value');
        }
    } else {
        throw new Error('Invalid Boolean value');
    }
}

async function inferArrayType(value: any, key?: string, agent?: Agent) {
    try {
        if (Array.isArray(value)) return value;

        if (typeof value !== 'string') throw new Error('Invalid Array value');

        try {
            // We need to consider array with comma separated values like "item1, item2, item3", as it's provided by Swagger UI
            return value.trim().startsWith('[') ? JSONContent(value).tryParse() : value.split(',');
        } catch {
            throw new Error('Invalid Array value');
        }
    } catch (error) {
        throw new Error('Invalid Array value');
    }
}

async function inferObjectType(value: any, key?: string, agent?: Agent) {
    try {
        // use parseJson instead of JSON.parse because the data may come from LLM responses
        const obj = isPlainObject(value) ? value : JSONContent(value).tryParse();
        if (!isPlainObject(obj)) throw new Error('Invalid Object value');
        return obj;
    } catch (error) {
        throw new Error('Invalid Object value');
    }
}

async function inferBinaryType(value: any, key?: string, agent?: Agent) {
    if (value && typeof value === 'object' && value?.url) {
        const binaryInput = await BinaryInput.from(value.url, uid() + '-' + key, value?.mimetype);
        await binaryInput.ready();
        return binaryInput;
    }

    const binaryInput = BinaryInput.from(value, uid() + '-' + key);
    await binaryInput.ready();
    return binaryInput;
}

async function inferDateType(value: any, key?: string, agent?: Agent) {
    const errMsg = `Invalid Date value\nThe date string is expected to be in a format commonly used in English-speaking countries.`;

    // Make sure we only accept string or number to parse as date
    if (typeof value !== 'string' && typeof value !== 'number') throw new Error(errMsg);

    let date;
    if (typeof value === 'string' && isNaN(Number(value))) {
        date = dayjs(value).locale('en'); // parse as date string
    } else {
        // parse as Unix timestamp
        const timestamp = typeof value === 'number' ? value : Number(value);
        date = dayjs.unix(timestamp / 1000);
    }

    if (!date.isValid()) throw new Error(errMsg);

    return date.toISOString();
}

async function inferAnyType(value: any) {
    return value;
}
