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

        it('should normalize "stop_sequence" (Anthropic) to TLLMFinishReasonx.Stop', () => {
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
