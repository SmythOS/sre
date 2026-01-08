import { type TLLMMessageBlock, TLLMMessageRole } from '@sre/types/LLM.types';

import axios from 'axios';
import imageSize from 'image-size';
import { encode } from 'gpt-tokenizer';
import { isBase64FileUrl, isUrl } from '@sre/utils';

export class LLMHelper {
    /**
     * Checks if the given array of messages contains a system message.
     *
     * @param {any} messages - The array of messages to check.
     * @returns {boolean} True if a system message is found, false otherwise.
     *
     * @example
     * const messages = [
     *   { role: 'user', content: 'Hello' },
     *   { role: 'system', content: 'You are a helpful assistant' }
     * ];
     * const hasSystem = LLMHelper.hasSystemMessage(messages);
     * console.log(hasSystem); // true
     */
    public static hasSystemMessage(messages: any): boolean {
        if (!Array.isArray(messages)) return false;
        return messages?.some((message) => message.role === 'system');
    }

    /**
     * Separates system messages from other messages in an array of LLM message blocks.
     *
     * @param {TLLMMessageBlock[]} messages - The array of message blocks to process.
     * @returns {Object} An object containing the system message (if any) and an array of other messages.
     * @property {TLLMMessageBlock | {}} systemMessage - The first system message found, or an empty object if none.
     * @property {TLLMMessageBlock[]} otherMessages - An array of all non-system messages.
     *
     * @example
     * const messages = [
     *   { role: 'system', content: 'You are a helpful assistant' },
     *   { role: 'user', content: 'Hello' },
     *   { role: 'assistant', content: 'Hi there!' }
     * ];
     * const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);
     * console.log(systemMessage); // { role: 'system', content: 'You are a helpful assistant' }
     * console.log(otherMessages); // [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi there!' }]
     */
    public static separateSystemMessages(messages: TLLMMessageBlock[]): {
        systemMessage: TLLMMessageBlock | {};
        otherMessages: TLLMMessageBlock[];
    } {
        const systemMessage = messages.find((message) => message.role === 'system') || {};
        const otherMessages = messages.filter((message) => message.role !== 'system');

        return { systemMessage, otherMessages };
    }

    /**
     * Counts the total number of tokens in a vision prompt, including both text and image tokens.
     *
     * @param {any} prompt - The vision prompt object containing text and image items.
     * @returns {Promise<number>} A promise that resolves to the total number of tokens in the prompt.
     *
     * @description
     * This method processes a vision prompt by:
     * 1. Counting tokens in the text portion of the prompt.
     * 2. Calculating tokens for each image in the prompt based on its dimensions.
     * 3. Summing up text and image tokens to get the total token count.
     *
     * IMPORTANT: This returns the base token calculation for rate limiting and quota management.
     * The actual tokens charged by OpenAI may differ significantly:
     * - GPT-4o: Uses base calculation (matches this result)
     * - GPT-4o-mini: Intentionally inflates image tokens by ~33x (e.g., 431 → 14,180 tokens)
     * - GPT-4.1 series: Uses different patch-based calculations with various multipliers
     *
     * For consistent user limits regardless of model choice, use this base calculation.
     * For billing estimates, refer to OpenAI's pricing calculator or API response.
     *
     * @see https://platform.openai.com/docs/guides/images-vision?api-mode=responses#calculating-costs
     *
     * @example
     * const prompt = [
     *   { type: 'text', text: 'Describe this image:' },
     *   { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } }
     * ];
     * const tokenCount = await countVisionPromptTokens(prompt);
     * console.log(tokenCount); // e.g., 150 (base calculation for rate limiting)
     */
    public static async countVisionPromptTokens(prompt: any): Promise<number> {
        let tokens = 0;

        const textObj = prompt?.filter((item) => ['text', 'input_text'].includes(item.type));
        const textTokens = encode(textObj?.[0]?.text).length;

        const images = prompt?.filter((item) => ['image_url', 'input_image'].includes(item.type));
        let imageTokens = 0;

        for (const image of images) {
            const imageUrl = image?.image_url?.url || image?.image_url; // image?.image_url?.url for 'chat.completions', image?.image_url for 'responses' interface
            const { width, height } = await this.getImageDimensions(imageUrl);
            const tokens = this.countImageTokens(width, height);
            imageTokens += tokens;
        }

        tokens = textTokens + imageTokens;
        return tokens;
    }

    /**
     * Retrieves the dimensions (width and height) of an image from a given URL or base64 encoded string.
     *
     * @param {string} imageUrl - The URL or base64 encoded string of the image.
     * @returns {Promise<{ width: number; height: number }>} A promise that resolves to an object containing the width and height of the image.
     * @throws {Error} If the provided imageUrl is invalid or if there's an error retrieving the image dimensions.
     *
     * @example
     * // Using a URL
     * const dimensions = await getImageDimensions('https://example.com/image.jpg');
     * console.log(dimensions); // { width: 800, height: 600 }
     *
     * @example
     * // Using a base64 encoded string
     * const dimensions = await getImageDimensions('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==');
     * console.log(dimensions); // { width: 1, height: 1 }
     */
    public static async getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
        try {
            let buffer: Buffer;

            if (isBase64FileUrl(imageUrl)) {
                const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
                buffer = Buffer.from(base64Data, 'base64');
            } else if (isUrl(imageUrl)) {
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                buffer = Buffer.from(response.data);
            } else {
                throw new Error('Please provide a valid image url!');
            }

            const dimensions = imageSize(buffer);

            return {
                width: dimensions?.width || 0,
                height: dimensions?.height || 0,
            };
        } catch (error) {
            console.error('Error getting image dimensions', error);
            throw new Error('Please provide a valid image url!');
        }
    }

    /**
     * Calculates the number of tokens required to process an image based on its dimensions and detail mode.
     *
     * @param {number} width - The width of the image in pixels.
     * @param {number} height - The height of the image in pixels.
     * @param {string} detailMode - The detail mode for processing the image. Defaults to 'auto'.
     * @returns {number} The number of tokens required to process the image.
     *
     * @description
     * This method calculates the token count for image processing based on OpenAI's official documentation:
     *
     * For 'low' detail mode: Returns 85 tokens regardless of image size.
     *
     * For 'high' detail mode (default):
     * 1. Scale image to fit within 2048x2048 square (maintaining aspect ratio)
     * 2. Scale image so shortest side is 768px (if both dimensions > 768px)
     * 3. Calculate number of 512x512 tiles needed
     * 4. Return 85 + (170 * number_of_tiles)
     *
     * @example
     * const tokenCount = countImageTokens(1024, 768);
     * console.log(tokenCount); // Outputs the calculated token count
     */
    public static countImageTokens(width: number, height: number, detailMode: string = 'auto'): number {
        // For low detail mode, always return 85 tokens
        if (detailMode === 'low') {
            return 85;
        }

        // Step 1: Scale to fit within 2048x2048 square (maintaining aspect ratio)
        if (width > 2048 || height > 2048) {
            const aspectRatio = width / height;
            if (aspectRatio > 1) {
                width = 2048;
                height = Math.floor(2048 / aspectRatio);
            } else {
                height = 2048;
                width = Math.floor(2048 * aspectRatio);
            }
        }

        // Step 2: Scale such that shortest side is 768px (if both dimensions > 768px)
        if (width > 768 && height > 768) {
            const aspectRatio = width / height;
            if (aspectRatio > 1) {
                // height is shorter, scale to 768px
                height = 768;
                width = Math.floor(768 * aspectRatio);
            } else {
                // width is shorter, scale to 768px
                width = 768;
                height = Math.floor(768 / aspectRatio);
            }
        }

        // Step 3: Calculate number of 512x512 tiles needed
        const tilesWidth = Math.ceil(width / 512);
        const tilesHeight = Math.ceil(height / 512);
        const totalTiles = tilesWidth * tilesHeight;

        // Step 4: Calculate total tokens (85 base + 170 per tile)
        return 85 + 170 * totalTiles;
    }

    /**
     * Removes duplicate user messages from the beginning and end of the messages array.
     *
     * This method checks if there are two consecutive user messages at the start or end of the array
     *
     * @param {Array<{ role: string; content: string }>} messages - The array of message objects to process.
     *
     * @example
     * const messages = [
     *   { role: 'user', content: 'Hello' },
     *   { role: 'user', content: 'Hello' },
     *   { role: 'assistant', content: 'Hi there!' }
     * ];
     * LLMHelper.removeDuplicateUserMessages(messages);
     * console.log(messages); // [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi there!' }]
     *
     * @returns {TLLMMessageBlock[]} The modified array of message objects.
     */
    public static removeDuplicateUserMessages(messages: TLLMMessageBlock[]): TLLMMessageBlock[] {
        const _messages = JSON.parse(JSON.stringify(messages));

        // Check for two user messages at the beginning
        if (_messages.length > 1 && _messages[0].role === TLLMMessageRole.User && _messages[1].role === TLLMMessageRole.User) {
            _messages.shift(); // Remove the first user message
        }

        // Check for two user messages at the end
        if (
            _messages.length > 1 &&
            _messages[_messages.length - 1].role === TLLMMessageRole.User &&
            _messages[_messages.length - 2].role === TLLMMessageRole.User
        ) {
            _messages.pop(); // Remove the last user message
        }

        return _messages;
    }

    /**
     * Checks if the given model is part of the Claude 4 family.
     *
     * @param {string} modelId - The model identifier to check.
     * @returns {boolean} True if the model is Claude 4 family, false otherwise.
     *
     * @example
     * const isClaude4 = LLMHelper.isClaude4Family('claude-sonnet-4-20250514');
     * console.log(isClaude4); // true
     *
     * @example
     * const isClaude4 = LLMHelper.isClaude4Family('claude-opus-4-5');
     * console.log(isClaude4); // true
     *
     * @example
     * const isClaude4 = LLMHelper.isClaude4Family('gpt-4-turbo');
     * console.log(isClaude4); // false
     */
    public static isClaude4Family(modelId: string): boolean {
        if (!modelId) return false;
        // Match patterns like: claude-4-*, claude-{variant}-4-*, claude-{variant}-4
        // Examples: claude-opus-4-5, claude-sonnet-4-20250514, claude-4-opus
        return /claude-(?:\w+-)?4(?:-|$)/i.test(modelId);
    }
}
