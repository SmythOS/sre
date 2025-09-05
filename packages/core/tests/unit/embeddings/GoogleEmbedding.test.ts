import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { GoogleEmbeds } from '@sre/IO/VectorDB.service/embed/GoogleEmbedding';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { getLLMCredentials } from '@sre/LLMManager/LLM.service/LLMCredentials.helper';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the Google AI SDK
vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn(),
}));

// Mock the LLM credentials helper
vi.mock('@sre/LLMManager/LLM.service/LLMCredentials.helper', () => ({
    getLLMCredentials: vi.fn(),
}));

describe('GoogleEmbeds - Unit Tests', () => {
    let googleEmbeds: GoogleEmbeds;
    let mockAccessCandidate: AccessCandidate;
    let mockClient: any;
    let mockModel: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Setup mock Google AI client
        mockModel = {
            embedContent: vi.fn(),
        };

        mockClient = {
            getGenerativeModel: vi.fn().mockReturnValue(mockModel),
        };

        (GoogleGenerativeAI as any).mockImplementation(() => mockClient);

        // Setup mock access candidate
        mockAccessCandidate = {
            teamId: 'test-team',
            agentId: 'test-agent',
        } as unknown as AccessCandidate;

        // Setup default mock for getLLMCredentials
        (getLLMCredentials as any).mockResolvedValue({
            apiKey: 'test-api-key',
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.GOOGLE_AI_API_KEY;
    });

    describe('constructor', () => {
        it('should initialize with default model', () => {
            googleEmbeds = new GoogleEmbeds();
            expect(googleEmbeds.model).toBe('gemini-embedding-001');
        });

        it('should initialize with custom model', () => {
            googleEmbeds = new GoogleEmbeds({ model: 'gemini-embedding-001' });
            expect(googleEmbeds.model).toBe('gemini-embedding-001');
        });

        it('should initialize with custom settings', () => {
            const settings = {
                model: 'gemini-embedding-001',
                params: {
                    chunkSize: 256,
                    dimensions: 512,
                    stripNewLines: false,
                },
            };
            googleEmbeds = new GoogleEmbeds(settings);

            expect(googleEmbeds.model).toBe('gemini-embedding-001');
            expect(googleEmbeds.chunkSize).toBe(256);
            expect(googleEmbeds.dimensions).toBe(512);
            expect(googleEmbeds.stripNewLines).toBe(false);
        });

        it('should support dimension specification', () => {
            googleEmbeds = new GoogleEmbeds();
            expect(googleEmbeds.canSpecifyDimensions).toBe(true);
        });

        it('should have correct available models', () => {
            expect(GoogleEmbeds.models).toEqual(['gemini-embedding-001']);
        });
    });

    describe('embedText', () => {
        beforeEach(() => {
            googleEmbeds = new GoogleEmbeds();
        });

        it('should successfully embed a single text', async () => {
            const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            const result = await googleEmbeds.embedText('test text', mockAccessCandidate);

            expect(result).toEqual(mockEmbedding);
            expect(mockModel.embedContent).toHaveBeenCalledWith('test text');
            expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
            expect(mockClient.getGenerativeModel).toHaveBeenCalledWith({
                model: 'gemini-embedding-001',
            });
        });

        it('should process text by stripping newlines when stripNewLines is true', async () => {
            const mockEmbedding = [0.1, 0.2, 0.3];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            await googleEmbeds.embedText('test\ntext\nwith\nnewlines', mockAccessCandidate);

            expect(mockModel.embedContent).toHaveBeenCalledWith('test text with newlines');
        });

        it('should preserve newlines when stripNewLines is false', async () => {
            googleEmbeds = new GoogleEmbeds({ params: { stripNewLines: false } });
            const mockEmbedding = [0.1, 0.2, 0.3];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            await googleEmbeds.embedText('test\ntext\nwith\nnewlines', mockAccessCandidate);

            expect(mockModel.embedContent).toHaveBeenCalledWith('test\ntext\nwith\nnewlines');
        });

        it('should use environment variable when credentials fail', async () => {
            (getLLMCredentials as any).mockRejectedValue(new Error('Credential error'));
            process.env.GOOGLE_AI_API_KEY = 'env-api-key';

            const mockEmbedding = [0.1, 0.2, 0.3];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            const result = await googleEmbeds.embedText('test text', mockAccessCandidate);

            expect(result).toEqual(mockEmbedding);
            expect(GoogleGenerativeAI).toHaveBeenCalledWith('env-api-key');
        });

        it('should throw error when no API key is available', async () => {
            (getLLMCredentials as any).mockRejectedValue(new Error('Credential error'));
            delete process.env.GOOGLE_AI_API_KEY;

            await expect(googleEmbeds.embedText('test text', mockAccessCandidate)).rejects.toThrow(
                'Please provide an API key for Google AI embeddings via credentials or GOOGLE_AI_API_KEY environment variable'
            );
        });

        it('should throw error when embedding response is invalid', async () => {
            mockModel.embedContent.mockResolvedValue({
                embedding: null,
            });

            await expect(googleEmbeds.embedText('test text', mockAccessCandidate)).rejects.toThrow('Invalid embedding response from Google AI');
        });

        it('should throw error when embedding values are missing', async () => {
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: null },
            });

            await expect(googleEmbeds.embedText('test text', mockAccessCandidate)).rejects.toThrow('Invalid embedding response from Google AI');
        });

        it('should wrap Google AI API errors', async () => {
            const apiError = new Error('API quota exceeded');
            mockModel.embedContent.mockRejectedValue(apiError);

            await expect(googleEmbeds.embedText('test text', mockAccessCandidate)).rejects.toThrow('Google Embeddings API error: API quota exceeded');
        });
    });

    describe('embedTexts', () => {
        beforeEach(() => {
            googleEmbeds = new GoogleEmbeds({ params: { chunkSize: 2 } });
        });

        it('should successfully embed multiple texts', async () => {
            const mockEmbeddings = [
                [0.1, 0.2, 0.3],
                [0.4, 0.5, 0.6],
                [0.7, 0.8, 0.9],
            ];

            // Mock each call to embedContent. The order depends on batch processing.
            // Since batches are processed with Promise.all, order may vary but we need to ensure
            // the correct embeddings are returned for the correct texts
            mockModel.embedContent.mockImplementation((text) => {
                if (text === 'text1') return Promise.resolve({ embedding: { values: mockEmbeddings[0] } });
                if (text === 'text2') return Promise.resolve({ embedding: { values: mockEmbeddings[1] } });
                if (text === 'text3') return Promise.resolve({ embedding: { values: mockEmbeddings[2] } });
                return Promise.reject(new Error('Unexpected text'));
            });

            const texts = ['text1', 'text2', 'text3'];
            const result = await googleEmbeds.embedTexts(texts, mockAccessCandidate);

            expect(result).toEqual(mockEmbeddings);
            expect(mockModel.embedContent).toHaveBeenCalledTimes(3);
            expect(mockModel.embedContent).toHaveBeenCalledWith('text1');
            expect(mockModel.embedContent).toHaveBeenCalledWith('text2');
            expect(mockModel.embedContent).toHaveBeenCalledWith('text3');
        });

        it('should handle chunking correctly', async () => {
            googleEmbeds = new GoogleEmbeds({ params: { chunkSize: 2 } });

            const mockEmbeddings = [
                [0.1, 0.2],
                [0.3, 0.4],
                [0.5, 0.6],
                [0.7, 0.8],
                [0.9, 1.0],
            ];

            // Mock each call based on the input text, regardless of call order
            mockModel.embedContent.mockImplementation((text) => {
                if (text === 'text1') return Promise.resolve({ embedding: { values: mockEmbeddings[0] } });
                if (text === 'text2') return Promise.resolve({ embedding: { values: mockEmbeddings[1] } });
                if (text === 'text3') return Promise.resolve({ embedding: { values: mockEmbeddings[2] } });
                if (text === 'text4') return Promise.resolve({ embedding: { values: mockEmbeddings[3] } });
                if (text === 'text5') return Promise.resolve({ embedding: { values: mockEmbeddings[4] } });
                return Promise.reject(new Error('Unexpected text'));
            });

            const texts = ['text1', 'text2', 'text3', 'text4', 'text5'];
            const result = await googleEmbeds.embedTexts(texts, mockAccessCandidate);

            expect(result).toEqual(mockEmbeddings);
            expect(mockModel.embedContent).toHaveBeenCalledTimes(5);
        });

        it('should handle empty texts array', async () => {
            const result = await googleEmbeds.embedTexts([], mockAccessCandidate);
            expect(result).toEqual([]);
            expect(mockModel.embedContent).not.toHaveBeenCalled();
        });

        it('should process texts consistently with embedText', async () => {
            const mockEmbedding = [0.1, 0.2, 0.3];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            const texts = ['text\nwith\nnewlines'];
            await googleEmbeds.embedTexts(texts, mockAccessCandidate);

            expect(mockModel.embedContent).toHaveBeenCalledWith('text with newlines');
        });
    });

    describe('client initialization', () => {
        beforeEach(() => {
            googleEmbeds = new GoogleEmbeds();
        });

        it('should initialize client with credentials from getLLMCredentials', async () => {
            (getLLMCredentials as any).mockResolvedValue({
                apiKey: 'credentials-api-key',
            });

            const mockEmbedding = [0.1, 0.2, 0.3];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            await googleEmbeds.embedText('test', mockAccessCandidate);

            expect(getLLMCredentials).toHaveBeenCalledWith(mockAccessCandidate, {
                provider: 'GoogleAI',
                modelId: 'gemini-embedding-001',
                credentials: undefined,
            });
            expect(GoogleGenerativeAI).toHaveBeenCalledWith('credentials-api-key');
        });

        it('should reuse client instance across multiple calls', async () => {
            const mockEmbedding = [0.1, 0.2, 0.3];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            await googleEmbeds.embedText('test1', mockAccessCandidate);
            await googleEmbeds.embedText('test2', mockAccessCandidate);

            // GoogleGenerativeAI constructor should only be called once
            expect(GoogleGenerativeAI).toHaveBeenCalledTimes(1);
            expect(mockModel.embedContent).toHaveBeenCalledTimes(2);
        });

        it('should pass custom credentials when provided in settings', async () => {
            const customCredentials = { apiKey: 'custom-key' };
            googleEmbeds = new GoogleEmbeds({ credentials: customCredentials });

            const mockEmbedding = [0.1, 0.2, 0.3];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            await googleEmbeds.embedText('test', mockAccessCandidate);

            expect(getLLMCredentials).toHaveBeenCalledWith(mockAccessCandidate, {
                provider: 'GoogleAI',
                modelId: 'gemini-embedding-001',
                credentials: customCredentials,
            });
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            googleEmbeds = new GoogleEmbeds();
        });

        it('should handle network errors gracefully', async () => {
            const networkError = new Error('Network timeout');
            mockModel.embedContent.mockRejectedValue(networkError);

            await expect(googleEmbeds.embedText('test', mockAccessCandidate)).rejects.toThrow('Google Embeddings API error: Network timeout');
        });

        it('should handle API errors with custom messages', async () => {
            const apiError = { message: 'Invalid model specified', code: 'INVALID_MODEL' };
            mockModel.embedContent.mockRejectedValue(apiError);

            await expect(googleEmbeds.embedText('test', mockAccessCandidate)).rejects.toThrow('Google Embeddings API error: Invalid model specified');
        });

        it('should handle errors without message property', async () => {
            const genericError = 'Something went wrong';
            mockModel.embedContent.mockRejectedValue(genericError);

            await expect(googleEmbeds.embedText('test', mockAccessCandidate)).rejects.toThrow('Google Embeddings API error: Something went wrong');
        });
    });

    describe('text processing', () => {
        it('should handle empty string input', async () => {
            googleEmbeds = new GoogleEmbeds();
            const mockEmbedding = [0.1, 0.2, 0.3];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            const result = await googleEmbeds.embedText('', mockAccessCandidate);
            expect(result).toEqual(mockEmbedding);
            expect(mockModel.embedContent).toHaveBeenCalledWith('');
        });

        it('should handle strings with only whitespace', async () => {
            googleEmbeds = new GoogleEmbeds();
            const mockEmbedding = [0.1, 0.2, 0.3];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            const result = await googleEmbeds.embedText('   \t   ', mockAccessCandidate);
            expect(result).toEqual(mockEmbedding);
            expect(mockModel.embedContent).toHaveBeenCalledWith('   \t   ');
        });

        it('should handle very long text inputs', async () => {
            googleEmbeds = new GoogleEmbeds();
            const longText = 'Lorem ipsum '.repeat(1000);
            const mockEmbedding = [0.1, 0.2, 0.3];
            mockModel.embedContent.mockResolvedValue({
                embedding: { values: mockEmbedding },
            });

            const result = await googleEmbeds.embedText(longText, mockAccessCandidate);
            expect(result).toEqual(mockEmbedding);
            // The text should be processed (newlines stripped if stripNewLines is true)
            // Since stripNewLines is true by default and there are no newlines in this text, it should remain unchanged
            expect(mockModel.embedContent).toHaveBeenCalledWith(longText);
        });
    });
});

