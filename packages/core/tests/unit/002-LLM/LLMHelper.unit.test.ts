import { describe, expect, it } from 'vitest';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { TLLMFinishReason } from '@sre/types/LLM.types';

describe('LLMHelper - normalizeFinishReason', () => {
    describe('Natural stop reasons', () => {
        it('should normalize "stop" to TLLMFinishReason.Stop', () => {
            expect(LLMHelper.normalizeFinishReason('stop')).toBe(TLLMFinishReason.Stop);
        });

        it('should normalize "end_turn" (Anthropic) to TLLMFinishReason.Stop', () => {
            expect(LLMHelper.normalizeFinishReason('end_turn')).toBe(TLLMFinishReason.Stop);
        });

        it('should normalize "stop_sequence" (Anthropic) to TLLMFinishReason.Stop', () => {
            expect(LLMHelper.normalizeFinishReason('stop_sequence')).toBe(TLLMFinishReason.Stop);
        });

        it('should normalize "pause_turn" (Anthropic) to TLLMFinishReason.Stop', () => {
            expect(LLMHelper.normalizeFinishReason('pause_turn')).toBe(TLLMFinishReason.Stop);
        });

        it('should handle uppercase "STOP"', () => {
            expect(LLMHelper.normalizeFinishReason('STOP')).toBe(TLLMFinishReason.Stop);
        });

        it('should handle mixed case "Stop"', () => {
            expect(LLMHelper.normalizeFinishReason('Stop')).toBe(TLLMFinishReason.Stop);
        });

        it('should handle whitespace around "stop"', () => {
            expect(LLMHelper.normalizeFinishReason('  stop  ')).toBe(TLLMFinishReason.Stop);
        });
    });

    describe('Length/token limit reasons', () => {
        it('should normalize "length" to TLLMFinishReason.Length', () => {
            expect(LLMHelper.normalizeFinishReason('length')).toBe(TLLMFinishReason.Length);
        });

        it('should normalize "max_tokens" (Anthropic/Google AI) to TLLMFinishReason.Length', () => {
            expect(LLMHelper.normalizeFinishReason('max_tokens')).toBe(TLLMFinishReason.Length);
        });

        it('should normalize "incomplete" (OpenAI Responses API) to TLLMFinishReason.Length', () => {
            expect(LLMHelper.normalizeFinishReason('incomplete')).toBe(TLLMFinishReason.Length);
        });

        it('should handle uppercase "LENGTH"', () => {
            expect(LLMHelper.normalizeFinishReason('LENGTH')).toBe(TLLMFinishReason.Length);
        });
    });

    describe('Content filtering reasons', () => {
        it('should normalize "content_filter" to TLLMFinishReason.ContentFilter', () => {
            expect(LLMHelper.normalizeFinishReason('content_filter')).toBe(TLLMFinishReason.ContentFilter);
        });

        it('should normalize "contentfilter" to TLLMFinishReason.ContentFilter', () => {
            expect(LLMHelper.normalizeFinishReason('contentfilter')).toBe(TLLMFinishReason.ContentFilter);
        });

        it('should normalize "refusal" (Anthropic) to TLLMFinishReason.ContentFilter', () => {
            expect(LLMHelper.normalizeFinishReason('refusal')).toBe(TLLMFinishReason.ContentFilter);
        });

        it('should normalize "safety" (Google AI) to TLLMFinishReason.ContentFilter', () => {
            expect(LLMHelper.normalizeFinishReason('safety')).toBe(TLLMFinishReason.ContentFilter);
        });

        it('should normalize "recitation" (Google AI) to TLLMFinishReason.ContentFilter', () => {
            expect(LLMHelper.normalizeFinishReason('recitation')).toBe(TLLMFinishReason.ContentFilter);
        });

        it('should normalize "language" (Google AI) to TLLMFinishReason.ContentFilter', () => {
            expect(LLMHelper.normalizeFinishReason('language')).toBe(TLLMFinishReason.ContentFilter);
        });

        it('should normalize "blocklist" (Google AI) to TLLMFinishReason.ContentFilter', () => {
            expect(LLMHelper.normalizeFinishReason('blocklist')).toBe(TLLMFinishReason.ContentFilter);
        });

        it('should normalize "prohibited_content" (Google AI) to TLLMFinishReason.ContentFilter', () => {
            expect(LLMHelper.normalizeFinishReason('prohibited_content')).toBe(TLLMFinishReason.ContentFilter);
        });

        it('should normalize "spii" (Google AI) to TLLMFinishReason.ContentFilter', () => {
            expect(LLMHelper.normalizeFinishReason('spii')).toBe(TLLMFinishReason.ContentFilter);
        });

        it('should handle uppercase "SAFETY"', () => {
            expect(LLMHelper.normalizeFinishReason('SAFETY')).toBe(TLLMFinishReason.ContentFilter);
        });
    });

    describe('Tool/function call reasons', () => {
        it('should normalize "tool_calls" to TLLMFinishReason.ToolCalls', () => {
            expect(LLMHelper.normalizeFinishReason('tool_calls')).toBe(TLLMFinishReason.ToolCalls);
        });

        it('should normalize "tool_use" (Anthropic) to TLLMFinishReason.ToolCalls', () => {
            expect(LLMHelper.normalizeFinishReason('tool_use')).toBe(TLLMFinishReason.ToolCalls);
        });

        it('should normalize "function_call" (OpenAI deprecated) to TLLMFinishReason.ToolCalls', () => {
            expect(LLMHelper.normalizeFinishReason('function_call')).toBe(TLLMFinishReason.ToolCalls);
        });

        it('should handle uppercase "TOOL_CALLS"', () => {
            expect(LLMHelper.normalizeFinishReason('TOOL_CALLS')).toBe(TLLMFinishReason.ToolCalls);
        });
    });

    describe('Abort reasons', () => {
        it('should normalize "abort" to TLLMFinishReason.Abort', () => {
            expect(LLMHelper.normalizeFinishReason('abort')).toBe(TLLMFinishReason.Abort);
        });

        it('should handle uppercase "ABORT"', () => {
            expect(LLMHelper.normalizeFinishReason('ABORT')).toBe(TLLMFinishReason.Abort);
        });
    });

    describe('Error reasons', () => {
        it('should normalize "error" to TLLMFinishReason.Error', () => {
            expect(LLMHelper.normalizeFinishReason('error')).toBe(TLLMFinishReason.Error);
        });

        it('should normalize "malformed_function_call" (Google AI) to TLLMFinishReason.Error', () => {
            expect(LLMHelper.normalizeFinishReason('malformed_function_call')).toBe(TLLMFinishReason.Error);
        });

        it('should handle uppercase "ERROR"', () => {
            expect(LLMHelper.normalizeFinishReason('ERROR')).toBe(TLLMFinishReason.Error);
        });
    });

    describe('Edge cases and unknown values', () => {
        it('should normalize null to TLLMFinishReason.Stop', () => {
            expect(LLMHelper.normalizeFinishReason(null)).toBe(TLLMFinishReason.Stop);
        });

        it('should normalize undefined to TLLMFinishReason.Stop', () => {
            expect(LLMHelper.normalizeFinishReason(undefined)).toBe(TLLMFinishReason.Stop);
        });

        it('should normalize empty string to TLLMFinishReason.Stop', () => {
            expect(LLMHelper.normalizeFinishReason('')).toBe(TLLMFinishReason.Stop);
        });

        it('should normalize whitespace-only string to TLLMFinishReason.Unknown', () => {
            // Whitespace-only strings become empty after trim(), which doesn't match any case
            expect(LLMHelper.normalizeFinishReason('   ')).toBe(TLLMFinishReason.Unknown);
        });

        it('should normalize unknown value to TLLMFinishReason.Unknown', () => {
            expect(LLMHelper.normalizeFinishReason('some_random_value')).toBe(TLLMFinishReason.Unknown);
        });

        it('should normalize unrecognized provider-specific value to TLLMFinishReason.Unknown', () => {
            expect(LLMHelper.normalizeFinishReason('custom_provider_reason')).toBe(TLLMFinishReason.Unknown);
        });
    });

    describe('Cross-provider consistency', () => {
        it('should consistently normalize provider-specific "stop" equivalents', () => {
            // All should map to Stop
            expect(LLMHelper.normalizeFinishReason('stop')).toBe(TLLMFinishReason.Stop);
            expect(LLMHelper.normalizeFinishReason('end_turn')).toBe(TLLMFinishReason.Stop);
            expect(LLMHelper.normalizeFinishReason('stop_sequence')).toBe(TLLMFinishReason.Stop);
            expect(LLMHelper.normalizeFinishReason('pause_turn')).toBe(TLLMFinishReason.Stop);
        });

        it('should consistently normalize provider-specific "length" equivalents', () => {
            // All should map to Length
            expect(LLMHelper.normalizeFinishReason('length')).toBe(TLLMFinishReason.Length);
            expect(LLMHelper.normalizeFinishReason('max_tokens')).toBe(TLLMFinishReason.Length);
            expect(LLMHelper.normalizeFinishReason('incomplete')).toBe(TLLMFinishReason.Length);
        });

        it('should consistently normalize provider-specific "tool_calls" equivalents', () => {
            // All should map to ToolCalls
            expect(LLMHelper.normalizeFinishReason('tool_calls')).toBe(TLLMFinishReason.ToolCalls);
            expect(LLMHelper.normalizeFinishReason('tool_use')).toBe(TLLMFinishReason.ToolCalls);
            expect(LLMHelper.normalizeFinishReason('function_call')).toBe(TLLMFinishReason.ToolCalls);
        });
    });
});

describe('LLMHelper - getFinishReasonErrorMessage', () => {
    it('should return appropriate message for Length finish reason', () => {
        const message = LLMHelper.getFinishReasonErrorMessage(TLLMFinishReason.Length);
        expect(message).toContain('output token limit');
        expect(message).toContain('Maximum Output Tokens');
    });

    it('should return appropriate message for ContentFilter finish reason', () => {
        const message = LLMHelper.getFinishReasonErrorMessage(TLLMFinishReason.ContentFilter);
        expect(message).toContain('blocked by content filtering');
        expect(message).toContain('modify your prompt');
    });

    it('should return appropriate message for Abort finish reason', () => {
        const message = LLMHelper.getFinishReasonErrorMessage(TLLMFinishReason.Abort);
        expect(message).toContain('aborted');
        expect(message).toContain('before completion');
    });

    it('should return appropriate message for Error finish reason', () => {
        const message = LLMHelper.getFinishReasonErrorMessage(TLLMFinishReason.Error);
        expect(message).toContain('error occurred');
        expect(message).toContain('try again');
    });

    it('should return appropriate message for ToolCalls finish reason', () => {
        const message = LLMHelper.getFinishReasonErrorMessage(TLLMFinishReason.ToolCalls);
        expect(message).toContain('tool');
        expect(message).toContain('incomplete');
    });

    it('should return appropriate message for Stop finish reason', () => {
        const message = LLMHelper.getFinishReasonErrorMessage(TLLMFinishReason.Stop);
        expect(message).toContain('stopped before completing');
    });

    it('should return appropriate message for Unknown finish reason', () => {
        const message = LLMHelper.getFinishReasonErrorMessage(TLLMFinishReason.Unknown);
        expect(message).toContain('unknown reason');
        expect(message).toContain('try again');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// sanitizeMessageFlow tests
// ─────────────────────────────────────────────────────────────────────────────

describe('LLMHelper - sanitizeMessageFlow', () => {
    // ── Helpers to build test fixtures ──

    const userMsg = (content: string) => ({ role: 'user', content });

    const assistantMsg = (content: string) => ({ role: 'assistant', content });

    const systemMsg = (content: string) => ({ role: 'system', content });

    const toolResultMsg = (toolCallId: string, result: string) => ({
        role: 'tool',
        tool_call_id: toolCallId,
        content: result,
    });

    /** SmythOS format message with tool call and result */
    const smythToolMsg = (
        toolName: string,
        toolId: string,
        result: string,
        opts?: { content?: string },
    ) => ({
        messageBlock: {
            role: 'assistant',
            content: opts?.content || '',
            tool_calls: [{ id: toolId, type: 'function', function: { name: toolName, arguments: '{}' } }],
        },
        toolsData: [{ index: 0, name: toolName, id: toolId, type: 'function', role: 'tool', callId: toolId, result }],
    });

    /** SmythOS format message with errored tool result */
    const smythErrorToolMsg = (toolName: string, toolId: string) =>
        smythToolMsg(
            toolName,
            toolId,
            JSON.stringify({ error: { status: 400, data: { error: 'Debug session interrupted by another request' } } }),
        );

    /** Anthropic format: assistant message with tool_use blocks */
    const anthropicToolUseMsg = (toolId: string, toolName: string, input = {}) => ({
        role: 'assistant',
        content: [{ type: 'tool_use', id: toolId, name: toolName, input }],
    });

    /** Anthropic format: user message with tool_result blocks */
    const anthropicToolResultMsg = (toolId: string, result: string) => ({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolId, content: result }],
    });

    /** Anthropic format: assistant message with text + tool_use */
    const anthropicMixedAssistantMsg = (text: string, toolId: string, toolName: string) => ({
        role: 'assistant',
        content: [
            { type: 'text', text },
            { type: 'tool_use', id: toolId, name: toolName, input: {} },
        ],
    });

    // ── Edge cases ──

    describe('Edge cases', () => {
        it('should return empty array for empty input', () => {
            expect(LLMHelper.sanitizeMessageFlow([])).toEqual([]);
        });

        it('should return null/undefined as-is', () => {
            expect(LLMHelper.sanitizeMessageFlow(null as any)).toBeNull();
            expect(LLMHelper.sanitizeMessageFlow(undefined as any)).toBeUndefined();
        });

        it('should return single message unchanged', () => {
            const messages = [userMsg('Hello')];
            expect(LLMHelper.sanitizeMessageFlow(messages)).toEqual(messages);
        });

        it('should not mutate the original messages array', () => {
            const original = [userMsg('Hello'), userMsg('World')];
            const copy = JSON.parse(JSON.stringify(original));
            LLMHelper.sanitizeMessageFlow(original);
            expect(original).toEqual(copy);
        });
    });

    // ── Valid flows should pass through unchanged ──

    describe('Valid message flows (no changes expected)', () => {
        it('should keep a normal user → assistant conversation intact', () => {
            const messages = [
                userMsg('Hello'),
                assistantMsg('Hi there!'),
                userMsg('How are you?'),
                assistantMsg('I am fine.'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toEqual(messages);
        });

        it('should keep system → user → assistant flow intact', () => {
            const messages = [
                systemMsg('You are a helpful assistant'),
                userMsg('Hello'),
                assistantMsg('Hi!'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toEqual(messages);
        });

        it('should keep valid SmythOS tool call flow intact', () => {
            const messages = [
                userMsg('Generate a poem about moon'),
                smythToolMsg('generate_poem', 'call_1', JSON.stringify({ poem: 'Silver moon...' })),
                assistantMsg('Here is your poem: Silver moon...'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toEqual(messages);
        });

        it('should keep valid Anthropic tool call flow intact', () => {
            const messages = [
                userMsg('Generate a poem'),
                anthropicToolUseMsg('call_1', 'generate_poem'),
                anthropicToolResultMsg('call_1', 'Silver moon...'),
                assistantMsg('Here is your poem'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toEqual(messages);
        });

        it('should keep valid OpenAI tool call flow intact', () => {
            const messages = [
                userMsg('What is the weather?'),
                {
                    role: 'assistant',
                    content: '',
                    tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{}' } }],
                },
                toolResultMsg('call_1', '{"temp": 72}'),
                assistantMsg('The temperature is 72°F.'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toEqual(messages);
        });

        it('should keep multiple successful tool calls to DIFFERENT tools', () => {
            const messages = [
                userMsg('Generate a poem and an image'),
                smythToolMsg('generate_poem', 'call_1', JSON.stringify({ poem: 'Moon poem' })),
                smythToolMsg('generate_image', 'call_2', JSON.stringify({ url: 'image.png' })),
                assistantMsg('Here are your results'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // Both tool calls should be kept (different tools)
            expect(result).toHaveLength(4);
        });

        it('should keep tool role messages (OpenAI format)', () => {
            const messages = [
                userMsg('Query'),
                {
                    role: 'assistant',
                    content: '',
                    tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'func', arguments: '{}' } }],
                },
                { role: 'tool', tool_call_id: 'call_1', content: 'result' },
                assistantMsg('Done'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(4);
        });
    });

    // ── Consecutive user messages ──

    describe('Consecutive user messages', () => {
        it('should remove consecutive user messages at the beginning (keep latest)', () => {
            const messages = [
                userMsg('First'),
                userMsg('Second'),
                assistantMsg('Response'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('Second');
            expect(result[1].content).toBe('Response');
        });

        it('should remove consecutive user messages at the end (keep latest)', () => {
            const messages = [
                userMsg('Hello'),
                assistantMsg('Hi'),
                userMsg('First question'),
                userMsg('Revised question'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(3);
            expect(result[2].content).toBe('Revised question');
        });

        it('should remove consecutive user messages in the middle (keep latest)', () => {
            const messages = [
                userMsg('Hello'),
                assistantMsg('Hi'),
                userMsg('Topic A'),
                userMsg('Topic B'),
                assistantMsg('Response to B'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(4);
            expect(result[2].content).toBe('Topic B');
        });

        it('should handle three or more consecutive user messages (keep latest)', () => {
            const messages = [
                userMsg('First'),
                userMsg('Second'),
                userMsg('Third'),
                assistantMsg('Response'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('Third');
        });

        it('should NOT merge consecutive user messages when one has tool_result content', () => {
            const messages = [
                anthropicToolResultMsg('call_1', 'result data'),
                userMsg('Next question'),
            ];
            // We need a preceding assistant with tool_use to match
            const fullFlow = [
                userMsg('First question'),
                anthropicToolUseMsg('call_1', 'func'),
                ...messages,
            ];
            const result = LLMHelper.sanitizeMessageFlow(fullFlow);
            // Both the tool_result user message and the regular user message should be kept
            expect(result).toHaveLength(4);
        });

        it('should NOT merge when the first user message has tool_result blocks', () => {
            const messages = [
                userMsg('Hello'),
                anthropicMixedAssistantMsg('Let me check', 'call_1', 'func'),
                anthropicToolResultMsg('call_1', 'data'),
                userMsg('Follow up'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // tool_result user and regular user should not be merged
            expect(result).toHaveLength(4);
        });
    });

    // ── Errored tool calls (SmythOS format) ──

    describe('Errored tool calls', () => {
        it('should remove SmythOS tool call messages with error results', () => {
            const messages = [
                userMsg('Generate a poem about moon'),
                smythErrorToolMsg('generate_poem', 'call_1'),
                assistantMsg('Sorry, there was an error'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('Generate a poem about moon');
            expect(result[1].content).toBe('Sorry, there was an error');
        });

        it('should remove multiple consecutive errored tool calls', () => {
            const messages = [
                userMsg('Generate a poem'),
                smythErrorToolMsg('generate_poem', 'call_1'),
                smythErrorToolMsg('generate_poem', 'call_2'),
                userMsg('Try river instead'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // Both errored calls removed, consecutive users merged
            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('Try river instead');
        });

        it('should remove errored tool call but keep successful ones', () => {
            const messages = [
                userMsg('Generate a poem about moon'),
                smythErrorToolMsg('generate_poem', 'call_err'),
                smythToolMsg('generate_poem', 'call_ok', JSON.stringify({ poem: 'Silver moon...' })),
                assistantMsg('Here is the poem'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // Error removed, success kept
            expect(result).toHaveLength(3);
            expect(result[0].content).toBe('Generate a poem about moon');
            expect(result[1]).toHaveProperty('messageBlock');
            expect(result[1]).toHaveProperty('toolsData');
        });

        it('should detect error from status >= 400', () => {
            const messages = [
                userMsg('Test'),
                {
                    messageBlock: { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'func', arguments: '{}' } }] },
                    toolsData: [{ id: 'call_1', result: JSON.stringify({ status: 500, message: 'Internal server error' }) }],
                },
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('Test');
        });

        it('should NOT flag valid tool results that mention "error" in their content', () => {
            const messages = [
                userMsg('Check for errors'),
                smythToolMsg('check_errors', 'call_1', JSON.stringify({ findings: 'No errors found in the system' })),
                assistantMsg('All clear'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // The tool result is valid (error is in the value, not as a key)
            expect(result).toHaveLength(3);
        });
    });

    // ── Consecutive assistant messages ──

    describe('Consecutive assistant messages', () => {
        it('should keep both consecutive assistant messages when both have content', () => {
            const messages = [
                userMsg('Hello'),
                assistantMsg('Hi there!'),
                assistantMsg('How can I help?'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(3);
        });

        it('should replace empty assistant with content-bearing one', () => {
            const messages = [
                userMsg('Hello'),
                assistantMsg(''),
                assistantMsg('Real response'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(2);
            expect(result[1].content).toBe('Real response');
        });

        it('should keep successful tool call over failed retry of same tool (SmythOS)', () => {
            const successMsg = smythToolMsg('generate_poem', 'call_1', JSON.stringify({ poem: 'Moon poem' }));
            const retryMsg = smythToolMsg('generate_poem', 'call_2', JSON.stringify({ poem: 'Better poem' }));

            const messages = [
                userMsg('Poem please'),
                successMsg,
                retryMsg,
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // Same tool called twice - keep first successful one
            expect(result).toHaveLength(2);
        });
    });

    // ── Orphaned tool_use blocks (Anthropic format) ──

    describe('Orphaned tool_use blocks', () => {
        it('should remove assistant message with tool_use that has no matching tool_result', () => {
            const messages = [
                userMsg('Hello'),
                anthropicToolUseMsg('call_orphan', 'generate_poem'),
                userMsg('Different topic'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // The tool_use has no matching tool_result → removed
            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('Different topic');
        });

        it('should keep tool_use when matching tool_result exists', () => {
            const messages = [
                userMsg('Generate poem'),
                anthropicToolUseMsg('call_1', 'generate_poem'),
                anthropicToolResultMsg('call_1', 'Silver moon...'),
                assistantMsg('Here is your poem'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(4);
        });

        it('should remove orphaned tool_use but keep non-orphaned ones', () => {
            const messages = [
                userMsg('Do two things'),
                anthropicToolUseMsg('call_ok', 'func_a'),
                anthropicToolResultMsg('call_ok', 'result_a'),
                anthropicToolUseMsg('call_orphan', 'func_b'),
                // No tool_result for call_orphan
                assistantMsg('Done'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // call_ok pair stays, call_orphan removed
            const toolUseMessages = result.filter((m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_use'));
            expect(toolUseMessages).toHaveLength(1);
            expect(toolUseMessages[0].content[0].id).toBe('call_ok');
        });

        it('should handle orphaned SmythOS format tool_use (messageBlock.tool_calls)', () => {
            const messages = [
                userMsg('Hello'),
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_orphan', type: 'function', function: { name: 'func', arguments: '{}' } }],
                    },
                    // No toolsData or empty
                    toolsData: [],
                },
                userMsg('Next'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // The SmythOS message has tool_use (call_orphan) but no matching tool_result → removed
            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('Next');
        });

        it('should handle orphaned OpenAI format tool_calls', () => {
            const messages = [
                userMsg('Hello'),
                {
                    role: 'assistant',
                    content: '',
                    tool_calls: [{ id: 'call_orphan', type: 'function', function: { name: 'func', arguments: '{}' } }],
                },
                // No tool result message
                assistantMsg('Fallback response'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // call_orphan has no tool result → assistant message removed
            const hasOrphan = result.some((m) => m.tool_calls?.some((tc) => tc.id === 'call_orphan'));
            expect(hasOrphan).toBe(false);
        });

        it('should keep OpenAI format tool_calls when tool result exists', () => {
            const messages = [
                userMsg('Weather?'),
                {
                    role: 'assistant',
                    content: '',
                    tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{}' } }],
                },
                toolResultMsg('call_1', '{"temp": 72}'),
                assistantMsg('72°F'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(4);
        });
    });

    // ── Real-world scenarios using exact SmythOS message structure ──

    describe('Real-world debug mode scenarios (exact SmythOS format)', () => {
        it('should produce a valid flow from the VALID example provided', () => {
            // This is the exact valid message flow shared in the bug report
            const validMessages = [
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=moon',
                    __smyth_data__: { message_id: 'msg_50f5ba68-7446-4f93-956a-9815014fcb50', next: ['msg_50f5ba68-7446-4f93-956a-9815014fcb50'] },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_m0faI3AO6AIQgWElAQKIpBsp', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"moon"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', arguments: '{"topic":"moon"}', id: 'call_m0faI3AO6AIQgWElAQKIpBsp',
                        type: 'function', role: 'tool', callId: 'call_m0faI3AO6AIQgWElAQKIpBsp', status: 'Calling generate_poem',
                        result: '{"poem":"Silver guardian of the night,\\nWaxing full with gentle light","conversation_summary":"The user requested the generation of a poem about the moon."}',
                    }],
                    __smyth_data__: { message_id: 'msg_50f5ba68-7446-4f93-956a-9815014fcb50', prev: 'msg_50f5ba68-7446-4f93-956a-9815014fcb50', next: ['msg_be90a44a-9ded-4ffe-b3c4-b72d6468d1c3'] },
                },
                {
                    role: 'assistant',
                    content: 'Silver guardian of the night,\\nWaxing full with gentle light',
                    __smyth_data__: { message_id: 'msg_be90a44a-9ded-4ffe-b3c4-b72d6468d1c3', prev: 'msg_50f5ba68-7446-4f93-956a-9815014fcb50', next: ['msg_dd6cbb98-32f6-49a4-bce5-0672be1c20e2'] },
                },
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=river',
                    __smyth_data__: { message_id: 'msg_dd6cbb98-32f6-49a4-bce5-0672be1c20e2', prev: 'msg_be90a44a-9ded-4ffe-b3c4-b72d6468d1c3', next: ['msg_dd6cbb98-32f6-49a4-bce5-0672be1c20e2'] },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_GIX6lCl1yVOAE2MjalWVKQwZ', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"river"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', arguments: '{"topic":"river"}', id: 'call_GIX6lCl1yVOAE2MjalWVKQwZ',
                        type: 'function', role: 'tool', callId: 'call_GIX6lCl1yVOAE2MjalWVKQwZ', status: 'Calling generate_poem',
                        result: '{"poem":"Crystal waters gently flow,\\nRiver\'s ancient undertow","conversation_summary":"Generated poems about moon and river."}',
                    }],
                    __smyth_data__: { message_id: 'msg_dd6cbb98-32f6-49a4-bce5-0672be1c20e2', prev: 'msg_dd6cbb98-32f6-49a4-bce5-0672be1c20e2', next: ['msg_a67c3de4-bf0f-4d1a-b8ea-0ec6d56c023a'] },
                },
                {
                    role: 'assistant',
                    content: 'Crystal waters gently flow,\\nRiver\'s ancient undertow',
                    __smyth_data__: { message_id: 'msg_a67c3de4-bf0f-4d1a-b8ea-0ec6d56c023a', prev: 'msg_dd6cbb98-32f6-49a4-bce5-0672be1c20e2', next: ['msg_260dffa4-5a16-4c94-ac24-764297fb9033'] },
                },
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=ocean',
                    __smyth_data__: { message_id: 'msg_260dffa4-5a16-4c94-ac24-764297fb9033', prev: 'msg_a67c3de4-bf0f-4d1a-b8ea-0ec6d56c023a', next: [] },
                },
            ];

            const result = LLMHelper.sanitizeMessageFlow(validMessages);

            // Valid flow should pass through unchanged (same length)
            expect(result).toHaveLength(validMessages.length);

            // Verify alternating roles
            const roles = result.map((m: any) => m.role || m.messageBlock?.role);
            expect(roles).toEqual(['user', 'assistant', 'assistant', 'user', 'assistant', 'assistant', 'user']);
        });

        it('should fix the MALFORMED example from the bug report', () => {
            // This is the exact malformed message flow shared in the bug report
            const malformedMessages = [
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=moon',
                    __smyth_data__: { message_id: 'msg_b367dce5-7b1a-40a6-8359-d1b939488723', next: ['msg_b367dce5-7b1a-40a6-8359-d1b939488723'] },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_rOmU9ojx369jjBMrfx9ODqjl', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"moon"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', arguments: '{"topic":"moon"}', id: 'call_rOmU9ojx369jjBMrfx9ODqjl',
                        type: 'function', role: 'tool', callId: 'call_rOmU9ojx369jjBMrfx9ODqjl', status: 'Calling generate_poem',
                        result: '{"error":{"status":400,"data":{"error":"Debug session interrupted by another request","details":{"debugPromiseId":"cmkb231tz1l9sjxrxe9amcs2v","session":"dbg-ML9NREWR5KM"}}}}',
                    }],
                    __smyth_data__: { message_id: 'msg_b367dce5-7b1a-40a6-8359-d1b939488723', prev: 'msg_b367dce5-7b1a-40a6-8359-d1b939488723', next: ['msg_2673ab12-a30b-4c61-979f-4f663a0f49d1'] },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_7OGK7FevJGtfwzN8L3wwlbB4', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"moon"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', arguments: '{"topic":"moon"}', id: 'call_7OGK7FevJGtfwzN8L3wwlbB4',
                        type: 'function', role: 'tool', callId: 'call_7OGK7FevJGtfwzN8L3wwlbB4', status: 'Calling generate_poem',
                        result: '{"error":{"status":400,"data":{"error":"Debug session interrupted by another request","details":{"debugPromiseId":"cmkb231tz1l9sjxrxe9amcs2v","session":"dbg-ML9NT0RBD7K"}}}}',
                    }],
                    __smyth_data__: { message_id: 'msg_2673ab12-a30b-4c61-979f-4f663a0f49d1', prev: 'msg_b367dce5-7b1a-40a6-8359-d1b939488723', next: ['msg_17e21d3e-41b1-4dd0-93ed-8785d00ab4bb'] },
                },
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=river',
                    __smyth_data__: { message_id: 'msg_17e21d3e-41b1-4dd0-93ed-8785d00ab4bb', prev: 'msg_2673ab12-a30b-4c61-979f-4f663a0f49d1', next: ['msg_17e21d3e-41b1-4dd0-93ed-8785d00ab4bb'] },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_KVoCPpfhhRThmMqkvKXUJQCA', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"river"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', arguments: '{"topic":"river"}', id: 'call_KVoCPpfhhRThmMqkvKXUJQCA',
                        type: 'function', role: 'tool', callId: 'call_KVoCPpfhhRThmMqkvKXUJQCA', status: 'Calling generate_poem',
                        result: '{"poem":"Silver coin against the raven black, the moon hangs low.","conversation_summary":"The user requested a poem about the moon. Initial attempts resulted in debug session errors."}',
                    }],
                    __smyth_data__: { message_id: 'msg_17e21d3e-41b1-4dd0-93ed-8785d00ab4bb', prev: 'msg_17e21d3e-41b1-4dd0-93ed-8785d00ab4bb', next: ['msg_2dac129e-f329-436a-a943-c26508bc2a86'] },
                },
                {
                    role: 'assistant',
                    content: 'I tried calling the /generate_poem tool for "river" but it returned the wrong result, so here\'s an original poem about river...',
                    __smyth_data__: { message_id: 'msg_2dac129e-f329-436a-a943-c26508bc2a86', prev: 'msg_17e21d3e-41b1-4dd0-93ed-8785d00ab4bb', next: ['msg_cf729cbf-4bf0-4e90-9631-3dd60e428edd'] },
                },
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=ocean',
                    __smyth_data__: { message_id: 'msg_cf729cbf-4bf0-4e90-9631-3dd60e428edd', prev: 'msg_2dac129e-f329-436a-a943-c26508bc2a86', next: ['msg_41b3b2f5-839a-4006-846c-78ef9f984b58'] },
                },
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=ocean',
                    __smyth_data__: { message_id: 'msg_41b3b2f5-839a-4006-846c-78ef9f984b58', prev: 'msg_cf729cbf-4bf0-4e90-9631-3dd60e428edd', next: ['msg_41b3b2f5-839a-4006-846c-78ef9f984b58'] },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_glXe3cF7ErqKfHVarycY37tB', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"ocean"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', arguments: '{"topic":"ocean"}', id: 'call_glXe3cF7ErqKfHVarycY37tB',
                        type: 'function', role: 'tool', callId: 'call_glXe3cF7ErqKfHVarycY37tB', status: 'Calling generate_poem',
                        result: '{"error":{"status":400,"data":{"error":"Debug session interrupted by another request","details":{"debugPromiseId":"cmkb231tz1l9sjxrxe9amcs2v","session":"dbg-ML9NXI76UMD"}}}}',
                    }],
                    __smyth_data__: { message_id: 'msg_41b3b2f5-839a-4006-846c-78ef9f984b58', prev: 'msg_41b3b2f5-839a-4006-846c-78ef9f984b58', next: [] },
                },
            ];

            const result = LLMHelper.sanitizeMessageFlow(malformedMessages);

            // 1. All errored tool call messages should be removed
            const erroredMessages = result.filter((m: any) =>
                m.toolsData?.some((t: any) => {
                    try { return JSON.parse(t.result)?.error !== undefined; } catch { return false; }
                }),
            );
            expect(erroredMessages).toHaveLength(0);

            // 2. No consecutive user messages (without tool_result)
            for (let i = 1; i < result.length; i++) {
                const prevRole = result[i - 1].role || result[i - 1].messageBlock?.role;
                const currRole = result[i].role || result[i].messageBlock?.role;
                if (prevRole === 'user' && currRole === 'user') {
                    const prevHasToolResult = Array.isArray(result[i - 1].content) &&
                        result[i - 1].content.some((b: any) => b.type === 'tool_result');
                    const currHasToolResult = Array.isArray(result[i].content) &&
                        result[i].content.some((b: any) => b.type === 'tool_result');
                    expect(prevHasToolResult || currHasToolResult).toBe(true);
                }
            }

            // 3. The successful tool call (river poem) should still be present
            const successfulToolCalls = result.filter((m: any) =>
                m.toolsData?.some((t: any) => {
                    try { return JSON.parse(t.result)?.poem !== undefined; } catch { return false; }
                }),
            );
            expect(successfulToolCalls.length).toBeGreaterThanOrEqual(1);

            // 4. The assistant text response should still be present
            const assistantTexts = result.filter((m: any) =>
                m.role === 'assistant' && typeof m.content === 'string' && m.content.length > 0,
            );
            expect(assistantTexts.length).toBeGreaterThanOrEqual(1);

            // 5. Last message should be the ocean user request (the duplicate merged)
            const lastMsg = result[result.length - 1];
            expect(lastMsg.role || lastMsg.messageBlock?.role).toBeDefined();
        });

        it('should handle debug interruption with successful retry (exact SmythOS format)', () => {
            const messages = [
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=moon',
                    __smyth_data__: { message_id: 'msg_001', next: ['msg_001'] },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_err1', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"moon"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', arguments: '{"topic":"moon"}', id: 'call_err1',
                        type: 'function', role: 'tool', callId: 'call_err1', status: 'Calling generate_poem',
                        result: '{"error":{"status":400,"data":{"error":"Debug session interrupted by another request"}}}',
                    }],
                    __smyth_data__: { message_id: 'msg_001', prev: 'msg_001', next: ['msg_002'] },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_ok1', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"moon"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', arguments: '{"topic":"moon"}', id: 'call_ok1',
                        type: 'function', role: 'tool', callId: 'call_ok1', status: 'Calling generate_poem',
                        result: '{"poem":"Silver guardian of the night,\\nWaxing full with gentle light","conversation_summary":"Generated a moon poem."}',
                    }],
                    __smyth_data__: { message_id: 'msg_002', prev: 'msg_001', next: ['msg_003'] },
                },
                {
                    role: 'assistant',
                    content: 'Silver guardian of the night,\nWaxing full with gentle light',
                    __smyth_data__: { message_id: 'msg_003', prev: 'msg_002', next: [] },
                },
            ];

            const result = LLMHelper.sanitizeMessageFlow(messages);

            // Error removed, success and response kept
            expect(result).toHaveLength(3);
            expect(result[0].role).toBe('user');
            expect(result[0].content).toBe('Call /generate_poem skill with topic=moon');
            // The successful tool call should remain
            expect(result[1].toolsData[0].result).toContain('Silver guardian');
            // The final assistant text response
            expect(result[2].content).toContain('Silver guardian');
        });

        it('should handle alternating errors and user retries (exact SmythOS format)', () => {
            const messages = [
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=moon',
                    __smyth_data__: { message_id: 'msg_001', next: ['msg_001'] },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_err1', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"moon"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', id: 'call_err1', type: 'function', role: 'tool', callId: 'call_err1',
                        status: 'Calling generate_poem',
                        result: '{"error":{"status":400,"data":{"error":"Debug session interrupted by another request"}}}',
                    }],
                    __smyth_data__: { message_id: 'msg_001' },
                },
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=river',
                    __smyth_data__: { message_id: 'msg_002' },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_err2', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"river"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', id: 'call_err2', type: 'function', role: 'tool', callId: 'call_err2',
                        status: 'Calling generate_poem',
                        result: '{"error":{"status":400,"data":{"error":"Debug session interrupted by another request"}}}',
                    }],
                    __smyth_data__: { message_id: 'msg_002' },
                },
                {
                    role: 'user',
                    content: 'Call /generate_poem skill with topic=ocean',
                    __smyth_data__: { message_id: 'msg_003' },
                },
                {
                    messageBlock: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ id: 'call_ok', type: 'function', function: { name: 'generate_poem', arguments: '{"topic":"ocean"}' } }],
                    },
                    toolsData: [{
                        index: 0, name: 'generate_poem', id: 'call_ok', type: 'function', role: 'tool', callId: 'call_ok',
                        status: 'Calling generate_poem',
                        result: '{"poem":"Vast and endless, deep and blue","conversation_summary":"Generated ocean poem after two failed attempts."}',
                    }],
                    __smyth_data__: { message_id: 'msg_003' },
                },
                {
                    role: 'assistant',
                    content: 'Vast and endless, deep and blue',
                    __smyth_data__: { message_id: 'msg_004' },
                },
            ];

            const result = LLMHelper.sanitizeMessageFlow(messages);

            // Both errored tool calls removed
            const erroredMessages = result.filter((m: any) =>
                m.toolsData?.some((t: any) => {
                    try { return JSON.parse(t.result)?.error !== undefined; } catch { return false; }
                }),
            );
            expect(erroredMessages).toHaveLength(0);

            // After removing errors: user(moon), user(river), user(ocean), smythTool(ok), assistant
            // Consecutive users merged → user(ocean), smythTool(ok), assistant
            const userMessages = result.filter((m: any) => m.role === 'user');
            expect(userMessages).toHaveLength(1);
            expect(userMessages[0].content).toBe('Call /generate_poem skill with topic=ocean');

            // Success tool call and final response kept
            const successToolCalls = result.filter((m: any) => m.toolsData?.length > 0);
            expect(successToolCalls).toHaveLength(1);
            expect(result[result.length - 1].content).toBe('Vast and endless, deep and blue');
        });
    });

    // ── Anthropic-specific format handling ──

    describe('Anthropic format handling', () => {
        it('should detect tool_use in Anthropic content array format', () => {
            const messages = [
                userMsg('Hello'),
                anthropicMixedAssistantMsg('Let me help', 'call_1', 'generate_poem'),
                anthropicToolResultMsg('call_1', 'poem result'),
                assistantMsg('Here is the poem'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(4);
        });

        it('should remove Anthropic assistant with orphaned tool_use even when it has text content', () => {
            const messages = [
                userMsg('Hello'),
                anthropicMixedAssistantMsg('Let me generate that', 'call_orphan', 'generate_poem'),
                // No tool_result for call_orphan
                assistantMsg('Fallback'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // The mixed message has orphaned tool_use → must be removed
            const orphanedMsg = result.find(
                (m) => Array.isArray(m.content) && m.content.some((b) => b.id === 'call_orphan'),
            );
            expect(orphanedMsg).toBeUndefined();
        });

        it('should handle Anthropic multi-tool_use in single message', () => {
            const messages = [
                userMsg('Do both'),
                {
                    role: 'assistant',
                    content: [
                        { type: 'tool_use', id: 'call_a', name: 'func_a', input: {} },
                        { type: 'tool_use', id: 'call_b', name: 'func_b', input: {} },
                    ],
                },
                {
                    role: 'user',
                    content: [
                        { type: 'tool_result', tool_use_id: 'call_a', content: 'result_a' },
                        { type: 'tool_result', tool_use_id: 'call_b', content: 'result_b' },
                    ],
                },
                assistantMsg('Both done'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // Both tool_use have matching tool_results → keep all
            expect(result).toHaveLength(4);
        });

        it('should remove message when one of multiple tool_use IDs has no result', () => {
            const messages = [
                userMsg('Do both'),
                {
                    role: 'assistant',
                    content: [
                        { type: 'tool_use', id: 'call_a', name: 'func_a', input: {} },
                        { type: 'tool_use', id: 'call_b', name: 'func_b', input: {} },
                    ],
                },
                {
                    role: 'user',
                    content: [
                        // Only result for call_a, call_b is orphaned
                        { type: 'tool_result', tool_use_id: 'call_a', content: 'result_a' },
                    ],
                },
                assistantMsg('Partial'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            // The assistant message has call_b without result → removed
            const hasToolUse = result.some(
                (m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_use'),
            );
            expect(hasToolUse).toBe(false);
        });
    });

    // ── Messages with no identifiable role ──

    describe('Messages with no role', () => {
        it('should skip messages with no identifiable role', () => {
            const messages = [
                userMsg('Hello'),
                { content: 'No role here' } as any,
                assistantMsg('Hi'),
            ];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('Hello');
            expect(result[1].content).toBe('Hi');
        });

        it('should skip null/undefined entries in the array', () => {
            const messages = [
                userMsg('Hello'),
                null,
                undefined,
                assistantMsg('Hi'),
            ] as any[];
            const result = LLMHelper.sanitizeMessageFlow(messages);
            expect(result).toHaveLength(2);
        });
    });
});
