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

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const MAX_FILE_COUNT = 10;

// Default maximum number of tokens allowed for LLM
export const DEFAULT_MAX_TOKENS_FOR_LLM = 2048;

// life cycle tag for daily purge of s3 objects
export const S3_DAILY_PURGE_LIFECYCLE_TAG = 'ExpirationPolicy=DeleteDaily';
export const S3_WEEKLY_PURGE_LIFECYCLE_TAG = 'ExpirationPolicy=DeleteWeekly';
export const S3_MONTHLY_PURGE_LIFECYCLE_TAG = 'ExpirationPolicy=DeleteMonthly';

export const TOOL_USE_DEFAULT_MODEL = 'gpt-4o-mini';

export const COMP_NAMES = {
    apiCall: 'APICall',
    code: 'Code',
    llmPrompt: 'PromptGenerator',
    visionLLM: 'VisionLLM',
};

export const JSON_RESPONSE_INSTRUCTION = `
Respond ONLY with a valid, parsable JSON object. Follow these strict guidelines:
1. The response must begin with '{' and end with '}'.
2. Use double quotes for all keys and string values.
3. Do not include any explanations, markdown, or text outside the JSON object.
4. Do not use newlines or indentation within the JSON structure.
5. For single-key responses, use the format: {"result": "your content here"}
6. For multiple keys, use: {"key1": "value1", "key2": "value2", ...}

Example of a valid response:
{"result": "This is a valid JSON response without any extra text."}
`;

export const SUPPORTED_MIME_TYPES_MAP = {
    OpenAI: {
        image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
        imageGen: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        document: ['application/pdf'],
    },
    TogetherAI: {
        image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'], // Same as OpenAI
    },
    Anthropic: {
        image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
    },
    GoogleAI: {
        image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'],
        imageGen: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        video: [
            'video/mp4',
            'video/mpeg',
            'video/mov',
            'video/avi',
            'video/x-msvideo', // mimetype for .avi files
            'video/x-flv',
            'video/mpg',
            'video/webm',
            'video/wmv',
            'video/3gpp',
        ],
        audio: ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac'],
        document: [
            'application/pdf',
            'application/x-javascript',
            'application/x-typescript',
            'application/x-python-code',
            'application/json',
            'application/rtf',
            'text/plain',
            'text/html',
            'text/css',
            'text/javascript',
            'text/x-typescript',
            'text/csv',
            'text/markdown',
            'text/x-python',
            'text/xml',
            'text/rtf',
        ],
    },
    Groq: {
        image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
    },
};

export const DEFAULT_SMYTHOS_LLM_PROVIDERS_SETTINGS = {
    openai: { enabled: true },
    anthropic: { enabled: true },
    googleai: { enabled: true },
    togetherai: { enabled: true },
    groq: { enabled: true },
    xai: { enabled: true },
};

export const BUILT_IN_MODEL_PREFIX = 'smythos/';

export const ENTERPRISE_MODELS_SETTING_KEY = 'custom-llm';
export const USER_CUSTOM_MODELS_SETTING_KEY = 'user-custom-llm';
