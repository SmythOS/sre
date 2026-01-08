import OpenAI from 'openai';

// * We may move some OpenAI Connector–related utility functions here in the future.

/**
 * Type guard to check if a value is a valid OpenAI reasoning effort.
 * Uses array includes for better maintainability when OpenAI adds new values.
 */
export function isValidOpenAIReasoningEffort(value: unknown): value is OpenAI.Responses.ResponseCreateParams['reasoning']['effort'] {
    return ['minimal', 'low', 'medium', 'high', 'xhigh'].includes(value as string);
}
