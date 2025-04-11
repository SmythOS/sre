import { isBase64, isBase64DataUrl } from '@sre/utils/base64.utils';
import dayjs from 'dayjs';
import { isPlainObject, isSmythFileObject, isSmythFsUrl, isUrl, uid } from '../utils';
import Agent from '@sre/AgentManager/Agent.class';
import { IAccessCandidate, TAccessRole } from '@sre/types/ACL.types';
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
    date: inferDateType,
    binary: inferBinaryType,
    text: inferStringType,
    image: inferBinaryType,
    audio: inferBinaryType,
    video: inferBinaryType,
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
    } else if (isBase64(value) || isBase64DataUrl(value)) {
        // If the value is a base64 string then return the value as it is
        return value;
    } else if (isSmythFileObject(value)) {
        const file = await _createBinaryInput(value, key, agent);
        const buffer = await file.getBuffer();
        const base64 = buffer.toString('base64');
        return file.mimetype ? `data:${file.mimetype};base64,${base64}` : base64;
    } else if (typeof value === 'object' || Array.isArray(value)) {
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

/**
 * Extracts the agent ID from a SmythFS URL
 * @param url - The SmythFS URL (e.g., smythfs://team.id/agent.id/_temp/filename.ext)
 * @returns The agent ID or null if the URL is invalid
 */
function extractSmythFsAgentId(url: string): string | null {
    if (!url?.startsWith('smythfs://')) return null;

    try {
        // Split by '/' and get the agent ID (third segment)
        const segments = url.split('/');
        if (segments.length < 4) return null;

        return segments[3];
    } catch {
        return null;
    }
}

async function _createBinaryInput(value: any, key?: string, agent?: Agent) {
    // If the value is already a BinaryInput, just return it
    if (value instanceof BinaryInput) {
        return value;
    }

    let candidate: IAccessCandidate | undefined;
    let agentId: string = '';
    let data: unknown;
    let mimetype: string = '';
    let fileName = `${uid()}-${key}`;

    if (value && typeof value === 'object' && value?.url && value?.mimetype) {
        const url = value?.url;
        mimetype = value?.mimetype;

        if (value?.name) {
            fileName = value?.name;
        }

        if (url?.startsWith('smythfs://')) {
            // If the URL uses the smythfs:// protocol, we can use the binary object directly since it's already in our internal file system
            data = value;

            // Extract agent ID from smythfs:// URLs to create an access candidate to read the file
            agentId = extractSmythFsAgentId(url);
        } else {
            data = url;
        }
    } else {
        if (typeof value === 'string' && value.startsWith('smythfs://')) {
            // Extract agent ID from smythfs:// URLs to create an access candidate to read the file
            agentId = extractSmythFsAgentId(value);
        }
        data = value;
    }

    if (agentId) {
        candidate = AccessCandidate.agent(agentId);
    }

    const binaryInput = BinaryInput.from(data, fileName, mimetype, candidate);
    await binaryInput.ready();
    return binaryInput;
}

async function inferBinaryType(value: string | string[], key?: string, agent?: Agent): Promise<BinaryInput | BinaryInput[]> {
    try {
        let binarySource: string | string[] = value;

        //#region Process string input
        if (typeof value === 'string') {
            const normalizedValue = value.trim();

            if (isUrl(normalizedValue) || isSmythFsUrl(normalizedValue) || isBase64(value) || isBase64DataUrl(value)) {
                // No transformation needed for a url, smythfs url, base64 or base64 data url
                binarySource = normalizedValue;
            } else {
                // Extract URLs from text content
                const extractedUrls = _extractUrls(value);
                if (extractedUrls.length > 0) {
                    binarySource = extractedUrls;
                }
            }
        }
        //#endregion
        // Handle any array (original or created from extraction)
        if (Array.isArray(binarySource)) {
            return await Promise.all(binarySource.map((item) => _createBinaryInput(item, key, agent)));
        }

        // Handle single value case
        return await _createBinaryInput(binarySource, key, agent);
    } catch (error) {
        logger.warn('Error processing binary input', { key, error: error.message });
        return null;
    }
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

/**
 * Extracts URLs from various string formats that may be returned by AI/LLM outputs.
 * The underscore prefix indicates this is an internal utility function.
 *
 * Handles the following formats:
 * - JSON stringified arrays or objects containing URLs
 * - Comma-separated URLs
 * - Newline-separated URLs
 * - Mixed formats (both comma and newline separators)
 * - Single URL strings
 *
 * @param value - String potentially containing one or more URLs (typically from AI/LLM outputs)
 * @returns Array of extracted URLs (empty array if none found)
 * @private
 */
function _extractUrls(value: string): string[] {
    // Return empty array for non-string inputs
    if (typeof value !== 'string') return [];

    try {
        // Try parsing as JSON first
        const parsedValue = JSONContent(value).tryParse();
        if (typeof parsedValue === 'object') {
            return Object.values(parsedValue)
                .map((val) => String(val).trim())
                .filter((val) => isUrl(val) || isSmythFsUrl(val));
        }

        // Split by both delimiters and flatten the results
        const urls = new Set([
            // Split by commas
            ...value
                .split(',')
                .map((val) => val.trim())
                .filter((val) => val && (isUrl(val) || isSmythFsUrl(val))),

            // Split by newlines
            ...value
                .split('\n')
                .map((val) => val.trim())
                .filter((val) => val && (isUrl(val) || isSmythFsUrl(val))),
        ]);

        return Array.from(urls);
    } catch (error) {
        logger.warn('Error extracting URLs from value', { error });
        return [];
    }
}
