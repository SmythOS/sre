import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { OpenAIEmbeds } from '@sre/IO/VectorDB.service/embed/OpenAIEmbedding';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { getLLMCredentials } from '@sre/LLMManager/LLM.service/LLMCredentials.helper';
import OpenAI, { OpenAI as OpenAIClient } from 'openai';

// Mock the OpenAI SDK
vi.mock('openai', () => {
    // We expose a mock class for the client constructor via named export `OpenAI`
    const OpenAICtor = vi.fn();
    // The default export must expose APIError for createOpenAIError
    class APIError extends Error {
        status: number;
        code?: string;
        type?: string;
        constructor(status: number, data: any, message: string, _headers: any) {
            super(message);
            this.status = status;
            this.code = data?.code;
            this.type = data?.type;
        }
    }
    return {
        OpenAI: OpenAICtor,
        default: { APIError },
    } as any;
});

// Mock the LLM credentials helper
vi.mock('@sre/LLMManager/LLM.service/LLMCredentials.helper', () => ({
    getLLMCredentials: vi.fn(),
}));

describe('OpenAIEmbeds - Unit Tests', () => {
    let openaiEmbeds: OpenAIEmbeds;
    let mockAccessCandidate: AccessCandidate;
    let mockClient: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Setup mock OpenAI client
        mockClient = {
            embeddings: {
                create: vi.fn(),
            },
        };

        (OpenAIClient as any).mockImplementation(() => mockClient);

        // Setup mock access candidate
        mockAccessCandidate = {
            teamId: 'test-team',
            agentId: 'test-agent',
        } as unknown as AccessCandidate;

        // Default mock for getLLMCredentials
        (getLLMCredentials as any).mockResolvedValue({
            apiKey: 'test-api-key',
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (process as any).env.OPENAI_API_KEY;
    });

    describe('constructor', () => {
        it('should initialize with default model', () => {
            openaiEmbeds = new OpenAIEmbeds();
            expect(openaiEmbeds.model).toBe('text-embedding-ada-002');
        });

        it('should initialize with custom model', () => {
            openaiEmbeds = new OpenAIEmbeds({ model: 'text-embedding-3-large' } as any);
            expect(openaiEmbeds.model).toBe('text-embedding-3-large');
        });

        it('should initialize with custom settings', () => {
            const settings = {
                model: 'text-embedding-3-large',
                params: {
                    chunkSize: 256,
                    dimensions: 512,
                    stripNewLines: false,
                    timeout: 1234,
                },
            } as any;
            openaiEmbeds = new OpenAIEmbeds(settings);

            expect(openaiEmbeds.model).toBe('text-embedding-3-large');
            expect(openaiEmbeds.chunkSize).toBe(256);
            expect(openaiEmbeds.dimensions).toBe(512);
            expect(openaiEmbeds.stripNewLines).toBe(false);
        });

        it('should support dimension specification except for ada-002', () => {
            openaiEmbeds = new OpenAIEmbeds();
            expect(openaiEmbeds.canSpecifyDimensions).toBe(false);

            openaiEmbeds = new OpenAIEmbeds({ model: 'text-embedding-3-large' } as any);
            expect(openaiEmbeds.canSpecifyDimensions).toBe(true);
        });

        it('should have correct available models', () => {
            expect(OpenAIEmbeds.models).toEqual(['text-embedding-ada-002', 'text-embedding-3-large']);
        });
    });

    describe('embedText', () => {
        beforeEach(() => {
            openaiEmbeds = new OpenAIEmbeds();
        });

        it('should successfully embed a single text', async () => {
            const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
            mockClient.embeddings.create.mockResolvedValue({
                data: [{ embedding: mockEmbedding }],
            });

            const result = await openaiEmbeds.embedText('test text', mockAccessCandidate);

            expect(result).toEqual(mockEmbedding);
            expect(mockClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-ada-002',
                input: 'test text',
            });
            // Validate client created with credentials
            expect(OpenAIClient).toHaveBeenCalledWith({
                dangerouslyAllowBrowser: true,
                apiKey: 'test-api-key',
                timeout: undefined,
                maxRetries: 0,
            });
        });

        it('should process text by stripping newlines when stripNewLines is true', async () => {
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1] }] });

            await openaiEmbeds.embedText('test\ntext\nwith\nnewlines', mockAccessCandidate);

            expect(mockClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-ada-002',
                input: 'test text with newlines',
            });
        });

        it('should preserve newlines when stripNewLines is false', async () => {
            openaiEmbeds = new OpenAIEmbeds({ params: { stripNewLines: false } } as any);
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1] }] });

            await openaiEmbeds.embedText('test\ntext\nwith\nnewlines', mockAccessCandidate);

            expect(mockClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-ada-002',
                input: 'test\ntext\nwith\nnewlines',
            });
        });

        it('should include dimensions for models that support it', async () => {
            openaiEmbeds = new OpenAIEmbeds({ model: 'text-embedding-3-large', params: { dimensions: 128 } } as any);
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1] }] });

            await openaiEmbeds.embedText('hello', mockAccessCandidate);

            expect(mockClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-3-large',
                input: 'hello',
                dimensions: 128,
            });
        });

        it('should NOT include dimensions for ada-002 even if specified', async () => {
            openaiEmbeds = new OpenAIEmbeds({ model: 'text-embedding-ada-002', params: { dimensions: 64 } } as any);
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1] }] });

            await openaiEmbeds.embedText('hello', mockAccessCandidate);

            const callArg = mockClient.embeddings.create.mock.calls[0][0];
            expect(callArg).toEqual({ model: 'text-embedding-ada-002', input: 'hello' });
            expect((callArg as any).dimensions).toBeUndefined();
        });

        it('should pass timeout client option from settings', async () => {
            openaiEmbeds = new OpenAIEmbeds({ params: { timeout: 4321 } } as any);
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.2] }] });

            await openaiEmbeds.embedText('test', mockAccessCandidate);

            expect(OpenAIClient).toHaveBeenCalledWith({
                dangerouslyAllowBrowser: true,
                apiKey: 'test-api-key',
                timeout: 4321,
                maxRetries: 0,
            });
        });

        it('should reuse client instance across multiple calls', async () => {
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1] }] });

            await openaiEmbeds.embedText('test1', mockAccessCandidate);
            await openaiEmbeds.embedText('test2', mockAccessCandidate);

            expect(OpenAIClient).toHaveBeenCalledTimes(1);
            expect(mockClient.embeddings.create).toHaveBeenCalledTimes(2);
        });

        it('should pass custom credentials when provided in settings', async () => {
            const customCredentials = { apiKey: 'custom-key' } as any;
            openaiEmbeds = new OpenAIEmbeds({ credentials: customCredentials } as any);
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.3] }] });

            await openaiEmbeds.embedText('test', mockAccessCandidate);

            expect(getLLMCredentials).toHaveBeenCalledWith(mockAccessCandidate, {
                provider: 'OpenAI',
                modelId: 'text-embedding-ada-002',
                credentials: customCredentials,
            });
        });
    });

    describe('embedTexts', () => {
        beforeEach(() => {
            openaiEmbeds = new OpenAIEmbeds({ params: { chunkSize: 2 } } as any);
        });

        it('should successfully embed multiple texts', async () => {
            const mockEmbeddings = [
                [0.1, 0.2, 0.3],
                [0.4, 0.5, 0.6],
                [0.7, 0.8, 0.9],
            ];

            mockClient.embeddings.create.mockImplementation((req: any) => {
                const inputs = Array.isArray(req.input) ? req.input : [req.input];
                const data = inputs.map((t: string) => {
                    if (t === 'text1') return { embedding: mockEmbeddings[0] };
                    if (t === 'text2') return { embedding: mockEmbeddings[1] };
                    if (t === 'text3') return { embedding: mockEmbeddings[2] };
                    throw new Error('Unexpected text');
                });
                return Promise.resolve({ data });
            });

            const texts = ['text1', 'text2', 'text3'];
            const result = await openaiEmbeds.embedTexts(texts, mockAccessCandidate);

            expect(result).toEqual(mockEmbeddings);
            expect(mockClient.embeddings.create).toHaveBeenCalledTimes(2); // chunkSize = 2 => 2 batches
            expect(mockClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-ada-002',
                input: ['text1', 'text2'],
            });
            expect(mockClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-ada-002',
                input: ['text3'],
            });
        });

        it('should handle empty texts array', async () => {
            const result = await openaiEmbeds.embedTexts([], mockAccessCandidate);
            expect(result).toEqual([]);
            expect(mockClient.embeddings.create).not.toHaveBeenCalled();
        });

        it('should process texts consistently with embedText', async () => {
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
            const texts = ['text\nwith\nnewlines'];
            await openaiEmbeds.embedTexts(texts, mockAccessCandidate);

            expect(mockClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-ada-002',
                input: ['text with newlines'],
            });
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            openaiEmbeds = new OpenAIEmbeds();
        });

        it('should wrap OpenAI API errors', async () => {
            const apiError: any = { statusCode: 429, message: 'API quota exceeded', code: 'rate_limit_exceeded', name: 'Error' };
            mockClient.embeddings.create.mockRejectedValue(apiError);

            await expect(openaiEmbeds.embedText('test', mockAccessCandidate)).rejects.toEqual(expect.any((OpenAI as any).APIError));
        });
    });

    describe('text processing', () => {
        it('should handle empty string input', async () => {
            openaiEmbeds = new OpenAIEmbeds();
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });

            const result = await openaiEmbeds.embedText('', mockAccessCandidate);
            expect(result).toEqual([0.1, 0.2, 0.3]);
            expect(mockClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-ada-002',
                input: '',
            });
        });

        it('should handle strings with only whitespace', async () => {
            openaiEmbeds = new OpenAIEmbeds();
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });

            const result = await openaiEmbeds.embedText('   \t   ', mockAccessCandidate);
            expect(result).toEqual([0.1, 0.2, 0.3]);
            expect(mockClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-ada-002',
                input: '   \t   ',
            });
        });

        it('should handle very long text inputs', async () => {
            openaiEmbeds = new OpenAIEmbeds();
            const longText = 'Lorem ipsum '.repeat(1000);
            mockClient.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });

            const result = await openaiEmbeds.embedText(longText, mockAccessCandidate);
            expect(result).toEqual([0.1, 0.2, 0.3]);
            expect(mockClient.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-ada-002',
                input: longText,
            });
        });
    });
});
