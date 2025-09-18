import { WeaviateVectorDB, WeaviateConfig } from '../../src/subsystems/IO/VectorDB.service/connectors/WeaviateVectorDB.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

/**
 * Test utilities for WeaviateVectorDB connector testing
 */
export class WeaviateTestUtils {
    /**
     * Creates a test configuration for WeaviateVectorDB
     */
    static createTestConfig(overrides: Partial<WeaviateConfig> = {}): WeaviateConfig {
        return {
            url: 'http://localhost:8080',
            apiKey: 'test-api-key',
            className: 'TestClass',
            embeddings: {
                provider: 'OpenAI' as any,
                params: { dimensions: 1536 },
            },
            ...overrides,
        };
    }

    /**
     * Creates a test access candidate
     */
    static createTestCandidate(role: TAccessRole = TAccessRole.User, id: string = 'test-user'): AccessCandidate {
        return new AccessCandidate(id, role);
    }

    /**
     * Creates a test access request
     */
    static createTestAccessRequest(
        candidate: AccessCandidate = this.createTestCandidate(),
        level: TAccessLevel = TAccessLevel.Read
    ): AccessRequest {
        return new AccessRequest(candidate, level);
    }

    /**
     * Creates test vector data
     */
    static createTestVectorData(id: string = 'test-vector', text: string = 'test content') {
        return {
            id,
            text,
            metadata: { test: 'metadata' },
        };
    }

    /**
     * Creates multiple test vector data
     */
    static createMultipleTestVectors(count: number = 3) {
        return Array.from({ length: count }, (_, i) => 
            this.createTestVectorData(`test-vector-${i}`, `Test content ${i}`)
        );
    }

    /**
     * Creates test datasource data
     */
    static createTestDatasourceData(text: string = 'Test datasource content') {
        return {
            text,
            metadata: { 
                title: 'Test Datasource',
                author: 'Test Author',
                smyth_metadata: { version: '1.0' }
            },
            label: 'Test Datasource',
        };
    }

    /**
     * Generates a unique test namespace
     */
    static generateTestNamespace(prefix: string = 'test'): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Waits for a specified amount of time
     */
    static async wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retries an operation with exponential backoff
     */
    static async retry<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 1000
    ): Promise<T> {
        let lastError: Error;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                if (attempt < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    await this.wait(delay);
                }
            }
        }
        
        throw lastError!;
    }

    /**
     * Cleans up test data
     */
    static async cleanupTestData(
        connector: WeaviateVectorDB,
        accessRequest: AccessRequest,
        namespace: string
    ): Promise<void> {
        try {
            // Delete namespace (this will also delete all vectors)
            await connector.deleteNamespace(accessRequest, namespace);
        } catch (error) {
            // Ignore cleanup errors
            console.warn('Cleanup warning:', error);
        }
    }

    /**
     * Asserts that search results contain expected content
     */
    static assertSearchResults(
        results: any[],
        expectedMinCount: number = 1,
        expectedContent?: string
    ): void {
        expect(results.length).toBeGreaterThanOrEqual(expectedMinCount);
        
        if (expectedContent) {
            const resultTexts = results.map(r => r.text || '');
            expect(resultTexts.some(text => text.includes(expectedContent))).toBe(true);
        }
    }

    /**
     * Asserts that a vector was inserted successfully
     */
    static assertVectorInserted(
        insertedIds: string[],
        expectedId: string
    ): void {
        expect(insertedIds).toContain(expectedId);
        expect(insertedIds.length).toBeGreaterThan(0);
    }

    /**
     * Asserts that a datasource was created successfully
     */
    static assertDatasourceCreated(datasource: any): void {
        expect(datasource).toBeDefined();
        expect(datasource.id).toBeDefined();
        expect(datasource.namespace).toBeDefined();
    }

    /**
     * Creates a mock Weaviate client for testing
     */
    static createMockWeaviateClient() {
        return {
            schema: {
                classCreator: vi.fn().mockReturnThis(),
                classDeleter: vi.fn().mockReturnThis(),
                getter: vi.fn().mockReturnThis(),
                withClass: vi.fn().mockReturnThis(),
                withClassName: vi.fn().mockReturnThis(),
                do: vi.fn(),
            },
            data: {
                creator: vi.fn().mockReturnThis(),
                deleter: vi.fn().mockReturnThis(),
                withClassName: vi.fn().mockReturnThis(),
                withId: vi.fn().mockReturnThis(),
                withProperties: vi.fn().mockReturnThis(),
                withVector: vi.fn().mockReturnThis(),
                do: vi.fn(),
            },
            batch: {
                objectsBatchDeleter: vi.fn().mockReturnThis(),
                withClassName: vi.fn().mockReturnThis(),
                withWhere: vi.fn().mockReturnThis(),
                do: vi.fn(),
            },
            graphql: {
                get: vi.fn().mockReturnThis(),
                withClassName: vi.fn().mockReturnThis(),
                withFields: vi.fn().mockReturnThis(),
                withNearVector: vi.fn().mockReturnThis(),
                withLimit: vi.fn().mockReturnThis(),
                withWhere: vi.fn().mockReturnThis(),
                do: vi.fn(),
            },
        };
    }

    /**
     * Creates mock search results
     */
    static createMockSearchResults(count: number = 1) {
        return {
            data: {
                Get: {
                    'TestClass_user_test-namespace': Array.from({ length: count }, (_, i) => ({
                        _additional: { id: `test-id-${i}`, distance: 0.2 },
                        content: `Test content ${i}`,
                        metadata: { test: 'metadata' },
                    })),
                },
            },
        };
    }

    /**
     * Creates mock schema response
     */
    static createMockSchemaResponse(classes: string[] = []) {
        return {
            classes: classes.map(className => ({ class: className })),
        };
    }
}

// Import vi for mocking
import { vi } from 'vitest';
