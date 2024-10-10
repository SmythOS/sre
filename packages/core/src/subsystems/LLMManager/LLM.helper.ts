import type { TLLMMessageBlock } from '@sre/types/LLM.types';

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
     * @example
     * const prompt = [
     *   { type: 'text', text: 'Describe this image:' },
     *   { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } }
     * ];
     * const tokenCount = await countVisionPromptTokens(prompt);
     * console.log(tokenCount); // e.g., 150
     */
    public static async countVisionPromptTokens(prompt: any): Promise<number> {
        let tokens = 0;

        const textObj = prompt?.filter((item) => item.type === 'text');
        const textTokens = encode(textObj?.[0]?.text).length;

        const images = prompt?.filter((item) => item.type === 'image_url');
        let imageTokens = 0;

        for (const image of images) {
            const imageUrl = image?.image_url?.url;
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
     * This method estimates the token count for image processing based on the image dimensions and detail mode.
     * It uses a tiling approach to calculate the token count, scaling the image if necessary.
     *
     * - If detailMode is 'low', it returns a fixed token count of 85.
     * - For other modes, it calculates based on the image dimensions:
     *   - Scales down images larger than 2048 pixels in any dimension.
     *   - Adjusts the scaled dimension to fit within a 768x1024 aspect ratio.
     *   - Calculates the number of 512x512 tiles needed to cover the image.
     *   - Returns the total token count based on the number of tiles.
     *
     * @example
     * const tokenCount = countImageTokens(1024, 768);
     * console.log(tokenCount); // Outputs the calculated token count
     */
    public static countImageTokens(width: number, height: number, detailMode: string = 'auto'): number {
        if (detailMode === 'low') return 85;

        const maxDimension = Math.max(width, height);
        const minDimension = Math.min(width, height);
        let scaledMinDimension = minDimension;

        if (maxDimension > 2048) {
            scaledMinDimension = (2048 / maxDimension) * minDimension;
        }
        scaledMinDimension = Math.floor((768 / 1024) * scaledMinDimension);

        let tileSize = 512;
        let tiles = Math.ceil(scaledMinDimension / tileSize);

        if (minDimension !== scaledMinDimension) {
            tiles *= Math.ceil((scaledMinDimension * (maxDimension / minDimension)) / tileSize);
        }

        return tiles * 170 + 85;
    }
}
