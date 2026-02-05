import { type TLLMMessageBlock, TLLMMessageRole, TLLMFinishReason } from '@sre/types/LLM.types';

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
     * Sanitizes the message flow to fix malformed message sequences.
     *
     * This method handles issues that occur when debug mode causes delays and the LLM
     * attempts to call tools multiple times, resulting in:
     * - Consecutive user messages anywhere in the array
     * - Consecutive assistant tool_call messages (especially those with errors)
     * - Tool call messages with error results that should be removed
     *
     * The function processes messages that may have either:
     * - Standard format: { role, content, tool_calls? }
     * - SmythOS format: { messageBlock: { role, content, tool_calls }, toolsData: [...] }
     *
     * @param {any[]} messages - The array of message objects to sanitize.
     * @returns {any[]} The sanitized array of message objects with proper alternation.
     *
     * @example
     * // Removes consecutive user messages
     * const messages = [
     *   { role: 'user', content: 'Hello' },
     *   { role: 'assistant', content: 'Hi!' },
     *   { role: 'user', content: 'Topic 1' },
     *   { role: 'user', content: 'Topic 2' }, // duplicate - will be removed
     *   { messageBlock: { role: 'assistant', tool_calls: [...] }, toolsData: [...] }
     * ];
     * const sanitized = LLMHelper.sanitizeMessageFlow(messages);
     */
    public static sanitizeMessageFlow(messages: any[]): any[] {
        if (!Array.isArray(messages) || messages.length === 0) {
            return messages;
        }

        const _messages = JSON.parse(JSON.stringify(messages));
        let sanitized: any[] = [];

        // First pass: Remove errored tool calls and handle consecutive duplicates
        for (let i = 0; i < _messages.length; i++) {
            const current = _messages[i];
            const currentRole = this.getMessageRole(current);

            // Skip messages with no identifiable role
            if (!currentRole) {
                continue;
            }

            // Check if this is a tool call message with an error result
            if (this.isToolCallMessageWithError(current)) {
                // Skip tool call messages that have error results (debug session interrupted, etc.)
                continue;
            }

            // Check for consecutive messages with the same role
            if (sanitized.length > 0) {
                const lastMessage = sanitized[sanitized.length - 1];
                const lastRole = this.getMessageRole(lastMessage);

                // Handle consecutive user messages
                if (currentRole === TLLMMessageRole.User && lastRole === TLLMMessageRole.User) {
                    // Keep the latest user message (replace the previous one)
                    sanitized[sanitized.length - 1] = current;
                    continue;
                }

                // Handle consecutive assistant messages
                if (
                    (currentRole === TLLMMessageRole.Assistant || currentRole === TLLMMessageRole.Model) &&
                    (lastRole === TLLMMessageRole.Assistant || lastRole === TLLMMessageRole.Model)
                ) {
                    // If the last message was a tool call with error and current is valid, replace it
                    if (this.isToolCallMessage(lastMessage) && !this.hasToolCallContent(lastMessage)) {
                        sanitized[sanitized.length - 1] = current;
                        continue;
                    }

                    // If current is a tool call with successful result, keep it
                    // Otherwise, prefer the one with actual content
                    if (this.hasToolCallContent(current) || this.hasMessageContent(current)) {
                        // If last message has no useful content, replace it
                        if (!this.hasToolCallContent(lastMessage) && !this.hasMessageContent(lastMessage)) {
                            sanitized[sanitized.length - 1] = current;
                            continue;
                        }
                    }

                    // If both have content, keep both (could be multi-turn tool calls)
                    // But if the previous was an errored tool call, skip the current duplicate attempt
                    if (this.isToolCallMessage(current) && this.isToolCallMessage(lastMessage)) {
                        // Check if they're calling the same tool - might be a retry
                        if (this.isSameToolCall(lastMessage, current)) {
                            // Keep the one with successful result
                            if (this.hasSuccessfulToolResult(current) && !this.hasSuccessfulToolResult(lastMessage)) {
                                sanitized[sanitized.length - 1] = current;
                            }
                            continue;
                        }
                    }
                }
            }

            sanitized.push(current);
        }

        // Second pass: Remove orphaned tool_use blocks (Anthropic format)
        // Anthropic requires every tool_use to have a corresponding tool_result immediately after
        sanitized = this.removeOrphanedToolUseBlocks(sanitized);

        return sanitized;
    }

    /**
     * Removes messages with orphaned tool_use blocks that don't have matching tool_result blocks.
     * This is required for Anthropic API which mandates every tool_use has a corresponding tool_result.
     */
    private static removeOrphanedToolUseBlocks(messages: any[]): any[] {
        if (messages.length === 0) return messages;

        // Collect all tool_result IDs from the messages
        const toolResultIds = new Set<string>();
        for (const message of messages) {
            const ids = this.getToolResultIds(message);
            ids.forEach((id) => toolResultIds.add(id));
        }

        // Filter out messages that have tool_use without matching tool_result
        const result: any[] = [];
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            const toolUseIds = this.getToolUseIds(message);

            if (toolUseIds.length > 0) {
                // Check if all tool_use IDs have matching tool_results
                const hasAllResults = toolUseIds.every((id) => toolResultIds.has(id));

                if (!hasAllResults) {
                    // This message has orphaned tool_use blocks - remove it
                    // Also need to check if the next message is a tool_result for these IDs and remove it too
                    continue;
                }
            }

            result.push(message);
        }

        return result;
    }

    /**
     * Extracts tool_use IDs from a message (supports both Anthropic content format and SmythOS format).
     */
    private static getToolUseIds(message: any): string[] {
        const ids: string[] = [];

        if (!message) return ids;

        // Anthropic format: content array with tool_use blocks
        if (Array.isArray(message.content)) {
            for (const block of message.content) {
                if (block?.type === 'tool_use' && block?.id) {
                    ids.push(block.id);
                }
            }
        }

        // SmythOS format: messageBlock with tool_calls
        if (message.messageBlock?.tool_calls) {
            for (const toolCall of message.messageBlock.tool_calls) {
                if (toolCall?.id) {
                    ids.push(toolCall.id);
                }
            }
        }

        // Standard OpenAI format: tool_calls array
        if (message.tool_calls) {
            for (const toolCall of message.tool_calls) {
                if (toolCall?.id) {
                    ids.push(toolCall.id);
                }
            }
        }

        return ids;
    }

    /**
     * Extracts tool_result IDs from a message (supports both Anthropic content format and SmythOS format).
     */
    private static getToolResultIds(message: any): string[] {
        const ids: string[] = [];

        if (!message) return ids;

        // Anthropic format: content array with tool_result blocks
        if (Array.isArray(message.content)) {
            for (const block of message.content) {
                if (block?.type === 'tool_result' && block?.tool_use_id) {
                    ids.push(block.tool_use_id);
                }
            }
        }

        // SmythOS format: toolsData array
        if (message.toolsData && Array.isArray(message.toolsData)) {
            for (const tool of message.toolsData) {
                if (tool?.id || tool?.callId) {
                    ids.push(tool.id || tool.callId);
                }
            }
        }

        // OpenAI tool result format
        if (message.tool_call_id) {
            ids.push(message.tool_call_id);
        }

        return ids;
    }

    /**
     * Gets the role from a message, handling both standard and SmythOS message formats.
     */
    private static getMessageRole(message: any): TLLMMessageRole | null {
        if (!message) return null;

        // SmythOS format with messageBlock
        if (message.messageBlock?.role) {
            return message.messageBlock.role as TLLMMessageRole;
        }

        // Standard format
        if (message.role) {
            return message.role as TLLMMessageRole;
        }

        return null;
    }

    /**
     * Checks if a message is a tool call message (has tool_calls array).
     */
    private static isToolCallMessage(message: any): boolean {
        if (!message) return false;

        // SmythOS format
        if (message.messageBlock?.tool_calls?.length > 0) {
            return true;
        }

        // Standard format
        if (message.tool_calls?.length > 0) {
            return true;
        }

        return false;
    }

    /**
     * Checks if a tool call message has error results in its toolsData.
     */
    private static isToolCallMessageWithError(message: any): boolean {
        if (!message) return false;

        // SmythOS format with toolsData
        if (message.toolsData && Array.isArray(message.toolsData)) {
            return message.toolsData.some((tool: any) => {
                if (!tool.result) return false;

                // Check if result is an error object or error string
                try {
                    const result = typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result;
                    return result?.error !== undefined || result?.status >= 400;
                } catch {
                    // If result contains "error" string, consider it an error
                    return typeof tool.result === 'string' && tool.result.toLowerCase().includes('"error"');
                }
            });
        }

        return false;
    }

    /**
     * Checks if a tool call message has successful (non-error) results.
     */
    private static hasSuccessfulToolResult(message: any): boolean {
        if (!message) return false;

        // SmythOS format with toolsData
        if (message.toolsData && Array.isArray(message.toolsData)) {
            return message.toolsData.some((tool: any) => {
                if (!tool.result) return false;

                try {
                    const result = typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result;
                    // Consider successful if no error field
                    return result?.error === undefined;
                } catch {
                    // If we can't parse, check it doesn't contain error
                    return typeof tool.result === 'string' && !tool.result.toLowerCase().includes('"error"');
                }
            });
        }

        return false;
    }

    /**
     * Checks if a tool call message has any tool result content.
     */
    private static hasToolCallContent(message: any): boolean {
        if (!message) return false;

        // SmythOS format with toolsData
        if (message.toolsData && Array.isArray(message.toolsData)) {
            return message.toolsData.some((tool: any) => tool.result && !this.isErrorResult(tool.result));
        }

        return false;
    }

    /**
     * Checks if a result is an error result.
     */
    private static isErrorResult(result: any): boolean {
        if (!result) return false;

        try {
            const parsed = typeof result === 'string' ? JSON.parse(result) : result;
            return parsed?.error !== undefined;
        } catch {
            return typeof result === 'string' && result.toLowerCase().includes('"error"');
        }
    }

    /**
     * Checks if a message has actual content (non-empty, non-tool content).
     */
    private static hasMessageContent(message: any): boolean {
        if (!message) return false;

        // SmythOS format
        if (message.messageBlock) {
            const content = message.messageBlock.content;
            return content && typeof content === 'string' && content.trim().length > 0;
        }

        // Standard format
        const content = message.content;
        if (typeof content === 'string') {
            return content.trim().length > 0;
        }
        if (Array.isArray(content)) {
            return content.some((c: any) => c?.text?.trim().length > 0);
        }

        return false;
    }

    /**
     * Checks if two tool call messages are calling the same tool (potential retry).
     */
    private static isSameToolCall(message1: any, message2: any): boolean {
        const getToolNames = (message: any): string[] => {
            // SmythOS format
            if (message.messageBlock?.tool_calls) {
                return message.messageBlock.tool_calls.map((tc: any) => tc.function?.name || tc.name).filter(Boolean);
            }
            // Standard format
            if (message.tool_calls) {
                return message.tool_calls.map((tc: any) => tc.function?.name || tc.name).filter(Boolean);
            }
            return [];
        };

        const names1 = getToolNames(message1);
        const names2 = getToolNames(message2);

        if (names1.length !== names2.length) return false;

        return names1.every((name, idx) => name === names2[idx]);
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

    /**
     * Normalizes provider-specific finish reason values to TLLMFinishReason enum.
     * Handles provider-specific values from OpenAI, Anthropic, Google AI, and other providers.
     * 
     * @param finishReason - The finish reason from the provider (can be string, null, or undefined)
     * @returns Normalized TLLMFinishReason enum value
     * 
     * @example
     * const normalized = LLMHelper.normalizeFinishReason('end_turn');
     * console.log(normalized); // TLLMFinishReason.Stop
     * 
     * @example
     * const normalized = LLMHelper.normalizeFinishReason('tool_use');
     * console.log(normalized); // TLLMFinishReason.ToolCalls
     * 
     * @example
     * const normalized = LLMHelper.normalizeFinishReason('SAFETY');
     * console.log(normalized); // TLLMFinishReason.ContentFilter
     */
    public static normalizeFinishReason(finishReason: string | null | undefined): TLLMFinishReason {
        if (!finishReason) {
            return TLLMFinishReason.Stop;
        }

        const normalized = finishReason.toLowerCase().trim();

        // Map standard and provider-specific values
        switch (normalized) {
            // Natural stop
            case 'stop':
            case 'end_turn': // Anthropic - natural end of turn
            case 'stop_sequence': // Anthropic - custom stop sequence matched
            case 'pause_turn': // Anthropic - paused for long-running operation
                return TLLMFinishReason.Stop;

            // Token/length limits
            case 'length':
            case 'max_tokens': // Anthropic, Google AI
            case 'incomplete': // OpenAI Responses API - response cut short due to max tokens or content filter
                return TLLMFinishReason.Length;

            // Content filtering and safety
            case 'content_filter':
            case 'contentfilter':
            case 'refusal': // Anthropic - refused due to safety/policy
            case 'safety': // Google AI - flagged by safety filters
            case 'recitation': // Google AI - copyrighted content recitation
            case 'language': // Google AI - unsupported language
            case 'blocklist': // Google AI - forbidden terms
            case 'prohibited_content': // Google AI - prohibited content
            case 'spii': // Google AI - sensitive personally identifiable information
                return TLLMFinishReason.ContentFilter;

            // Tool/function calls
            case 'tool_calls':
            case 'tool_use': // Anthropic - tool invocation
            case 'function_call': // OpenAI deprecated
                return TLLMFinishReason.ToolCalls;

            // Abort
            case 'abort':
                return TLLMFinishReason.Abort;

            // Errors
            case 'error':
            case 'malformed_function_call': // Google AI - invalid function call
                return TLLMFinishReason.Error;

            // Unknown/unmapped
            default:
                return TLLMFinishReason.Unknown;
        }
    }

    /**
     * Gets a user-friendly error message based on the finish reason.
     * 
     * @param finishReason - The normalized finish reason enum value
     * @returns User-friendly error message explaining why the response was interrupted
     * 
     * @example
     * const message = LLMHelper.getFinishReasonErrorMessage(TLLMFinishReason.Length);
     * console.log(message); // "Empty response. This is usually due to output token limit reached..."
     */
    public static getFinishReasonErrorMessage(finishReason: TLLMFinishReason): string {
        switch (finishReason) {
            case TLLMFinishReason.Length:
                return 'Empty response. This is usually due to output token limit reached. Please try again with a higher \'Maximum Output Tokens\'.';
            
            case TLLMFinishReason.ContentFilter:
                return 'The response was blocked by content filtering policies. Please modify your prompt and try again.';
            
            case TLLMFinishReason.Abort:
                return 'The request was aborted before completion.';
            
            case TLLMFinishReason.Error:
                return 'An error occurred while generating the response. Please try again.';
            
            case TLLMFinishReason.ToolCalls:
                return 'The model attempted to call a tool but the response was incomplete.';
            
            case TLLMFinishReason.Unknown:
                return 'The response was interrupted for an unknown reason. Please try again.';
            
            case TLLMFinishReason.Stop:
            default:
                return 'The model stopped before completing the response.';
        }
    }
}
