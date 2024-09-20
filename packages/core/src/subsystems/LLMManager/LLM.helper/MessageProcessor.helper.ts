import type { TLLMMessageBlock } from '@sre/types/LLM.types';

export class MessageProcessor {
    /**
     * Checks if the given messages array contains a system message.
     *
     * @param {any} messages - The array of messages to check.
     * @returns {boolean} True if a system message is found, false otherwise.
     *
     * @description
     * This method determines whether the provided messages array contains a message with the role 'system'.
     * It first checks if the input is an array, returning false if it's not.
     * Then it uses the Array.some() method to check if any message in the array has a role of 'system'.
     *
     * @example
     * const messages = [
     *   { role: 'user', content: 'Hello' },
     *   { role: 'system', content: 'You are a helpful assistant' }
     * ];
     * const hasSystem = messageProcessor.hasSystemMessage(messages);
     * console.log(hasSystem); // true
     */
    public hasSystemMessage(messages: any): boolean {
        if (!Array.isArray(messages)) return false;
        return messages?.some((message) => message.role === 'system');
    }

    /**
     * Separates system messages from other messages in an array of LLM input messages.
     *
     * @param {TLLMMessageBlock[]} messages - An array of LLM input messages to process.
     * @returns {{ systemMessage: TLLMMessageBlock | {}, otherMessages: TLLMMessageBlock[] }} An object containing the separated messages.
     *
     * @description
     * This method takes an array of LLM input messages and separates them into two categories:
     * 1. System message: The first message with a 'system' role, if any.
     * 2. Other messages: All messages that are not system messages.
     *
     * If no system message is found, an empty object is returned as the systemMessage.
     *
     * @example
     * const messages = [
     *   { role: 'system', content: 'You are a helpful assistant' },
     *   { role: 'user', content: 'Hello' },
     *   { role: 'assistant', content: 'Hi there!' }
     * ];
     * const { systemMessage, otherMessages } = messageProcessor.separateSystemMessages(messages);
     * console.log(systemMessage); // { role: 'system', content: 'You are a helpful assistant' }
     * console.log(otherMessages); // [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi there!' }]
     */
    public separateSystemMessages(messages: TLLMMessageBlock[]): {
        systemMessage: TLLMMessageBlock | {};
        otherMessages: TLLMMessageBlock[];
    } {
        const systemMessage = messages.find((message) => message.role === 'system') || {};
        const otherMessages = messages.filter((message) => message.role !== 'system');

        return { systemMessage, otherMessages };
    }
}
