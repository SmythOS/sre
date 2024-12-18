import os from 'os';

// supported request methods
export const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export const REQUEST_CONTENT_TYPES = {
    none: 'none',
    urlEncodedFormData: 'application/x-www-form-urlencoded',
    multipartFormData: 'multipart/form-data',
    json: 'application/json',
    text: 'text/plain',
    xml: 'application/xml',
    binary: 'binary',
};

export enum EMBODIMENT_TYPES {
    ChatBot = 'chatBot',
    ChatGPT = 'chatGPT',
}

export const ERR_MSG_INVALID_IMAGE_SOURCE =
    'Please provide a valid Image Source. Supported image sources are: HTTP(S) URL, Base64 string, Data URL, Output Image from other component(s).';
export const ERR_MSG_INVALID_BINARY =
    'Please provide a valid data that is either a Blob, SmythFileObject (Binary Output from any Component), ArrayBuffer, Buffer, Base64 string, Data URL, or HTTP(s) URL';
export const ERR_MSG_MAX_DEPTH = 'The maximum depth has been exceeded for the provided array or object.';
export const ERR_MSG_MAX_ARRAY_SIZE = 'The maximum array size has been exceeded for the provided array.';
export const ERR_MSG_MAX_OBJECT_SIZE = 'The maximum object size has been exceeded for the provided object.';

export const MAX_DEPTH = 10;
export const MAX_OBJECT_SIZE = 1000;
export const MAX_ARRAY_SIZE = 1000;

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 10MB

export const MAX_FILE_COUNT = 10;

// Default maximum number of tokens allowed for LLM
export const DEFAULT_MAX_TOKENS_FOR_LLM = 2048;

// life cycle tag for daily purge of s3 objects
export const S3_DAILY_PURGE_LIFECYCLE_TAG = 'ExpirationPolicy=DeleteDaily';
export const S3_WEEKLY_PURGE_LIFECYCLE_TAG = 'ExpirationPolicy=DeleteWeekly';
export const S3_MONTHLY_PURGE_LIFECYCLE_TAG = 'ExpirationPolicy=DeleteMonthly';

export const TOOL_USE_DEFAULT_MODEL = 'gpt-3.5-turbo';

export const COMP_NAMES = {
    apiCall: 'APICall',
    code: 'Code',
    llmPrompt: 'PromptGenerator',
    visionLLM: 'VisionLLM',
};

export const JSON_RESPONSE_INSTRUCTION =
    '\nAll responses should be in valid JSON format, compacted without newlines, indentations, or additional JSON syntax markers.';
