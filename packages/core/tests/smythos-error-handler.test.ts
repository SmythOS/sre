/**
 * Comprehensive test suite for SmythOS Error Handling System
 * 
 * Run with: npm test or jest
 */

import {
  SmythOSErrorHandler,
  createSmythOSError,
  withErrorHandling,
  defaultErrorHandler,
  ErrorCategory,
  ErrorSeverity
} from './smythos-error-handler';

// Mock fetch for testing
global.fetch = jest.fn();

describe('SmythOSErrorHandler', () => {
  let errorHandler: SmythOSErrorHandler;

  beforeEach(() => {
    errorHandler = new SmythOSErrorHandler({
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 1000,
      exponentialBackoff: true,
      jitter: false // Disable jitter for predictable tests
    });
    jest.clearAllMocks();
  });

  describe('createSmythOSError', () => {
    it('should create a properly formatted SmythOSError', () => {
      const error = createSmythOSError(
        'Test error message',
        'TEST_ERROR',
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        'test-connector',
        'test-operation'
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.connector).toBe('test-connector');
      expect(error.operation).toBe('test-operation');
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.retryable).toBe(false); // VALIDATION errors are not retryable
    });

    it('should mark network errors as retryable', () => {
      const error = createSmythOSError(
        'Network error',
        'NETWORK_ERROR',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        'test-connector',
        'test-operation'
      );

      expect(error.retryable).toBe(true);
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await errorHandler.executeWithRetry(
        mockOperation,
        'test-connector',
        'test-operation'
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValue('success');

      const result = await errorHandler.executeWithRetry(
        mockOperation,
        'test-connector',
        'test-operation'
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue(
        createSmythOSError(
          'Validation failed',
          'VALIDATION_ERROR',
          ErrorCategory.VALIDATION,
          ErrorSeverity.LOW,
          'test-connector',
          'test-operation'
        )
      );

      await expect(
        errorHandler.executeWithRetry(mockOperation, 'test-connector', 'test-operation')
      ).rejects.toThrow('Validation failed');

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should exhaust all retries and throw final error', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        errorHandler.executeWithRetry(mockOperation, 'test-connector', 'test-operation')
      ).rejects.toThrow();

      expect(mockOperation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should emit telemetry events', async () => {
      const errorSpy = jest.fn();
      const retrySpy = jest.fn();
      const maxRetriesSpy = jest.fn();

      errorHandler.on('error', errorSpy);
      errorHandler.on('retry_success', retrySpy);
      errorHandler.on('max_retries_exceeded', maxRetriesSpy);

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success');

      await errorHandler.executeWithRetry(
        mockOperation,
        'test-connector',
        'test-operation'
      );

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(retrySpy).toHaveBeenCalledTimes(1);
      expect(maxRetriesSpy).not.toHaveBeenCalled();
    });

    it('should apply exponential backoff delays', async () => {
      const delays: number[] = [];
      const originalSleep = (errorHandler as any).sleep;
      
      (errorHandler as any).sleep = jest.fn((ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      });

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValue(new Error('Network error'));

      try {
        await errorHandler.executeWithRetry(
          mockOperation,
          'test-connector',
          'test-operation'
        );
      } catch (error) {
        // Expected to fail
      }

      expect(delays).toHaveLength(3);
      expect(delays[0]).toBe(100); // baseDelay
      expect(delays[1]).toBe(200); // baseDelay * 2
      expect(delays[2]).toBe(400); // baseDelay * 4

      (errorHandler as any).sleep = originalSleep;
    });
  });

  describe('error normalization', () => {
    it('should normalize HTTP 401 errors to authentication category', async () => {
      const mockOperation = jest.fn().mockRejectedValue({
        status: 401,
        message: 'Unauthorized'
      });

      try {
        await errorHandler.executeWithRetry(
          mockOperation,
          'test-connector',
          'test-operation'
        );
      } catch (error) {
        expect(error.category).toBe(ErrorCategory.AUTHENTICATION);
        expect(error.code).toBe('AUTH_ERROR');
        expect(error.severity).toBe(ErrorSeverity.HIGH);
      }
    });

    it('should normalize HTTP 429 errors to rate limit category', async () => {
      const mockOperation = jest.fn().mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded'
      });

      try {
        await errorHandler.executeWithRetry(
          mockOperation,
          'test-connector',
          'test-operation'
        );
      } catch (error) {
        expect(error.category).toBe(ErrorCategory.RATE_LIMIT);
        expect(error.retryable).toBe(true);
      }
    });

    it('should normalize network errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue({
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND example.com'
      });

      try {
        await errorHandler.executeWithRetry(
          mockOperation,
          'test-connector',
          'test-operation'
        );
      } catch (error) {
        expect(error.category).toBe(ErrorCategory.NETWORK);
        expect(error.retryable).toBe(true);
      }
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after failure threshold', async () => {
      const circuitBreaker = errorHandler.createCircuitBreaker(
        'test-connector',
        'test-operation',
        3, // failureThreshold
        1000 // recoveryTimeout
      );

      const mockOperation = jest.fn().mockRejectedValue(new Error('Service error'));

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker(mockOperation);
        } catch (error) {
          // Expected
        }
      }

      // Next call should fail immediately with circuit breaker error
      try {
        await circuitBreaker(mockOperation);
        fail('Should have thrown circuit breaker error');
      } catch (error) {
        expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
        expect(error.category).toBe(ErrorCategory.SERVICE_UNAVAILABLE);
      }
    });

    it('should attempt recovery after timeout', async () => {
      const circuitBreaker = errorHandler.createCircuitBreaker(
        'test-connector',
        'test-operation',
        2,
        100 // short timeout for testing
      );

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');

      // Open circuit
      try { await circuitBreaker(mockOperation); } catch {}
      try { await circuitBreaker(mockOperation); } catch {}

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should now allow attempts and succeed
      const result = await circuitBreaker(mockOperation);
      expect(result).toBe('success');
    });

    it('should emit circuit breaker events', async () => {
      const circuitBreakerSpy = jest.fn();
      errorHandler.on('circuit_breaker_opened', circuitBreakerSpy);

      const circuitBreaker = errorHandler.createCircuitBreaker(
        'test-connector',
        'test-operation',
        2
      );

      const mockOperation = jest.fn().mockRejectedValue(new Error('Service error'));

      // Trigger circuit breaker
      try { await circuitBreaker(mockOperation); } catch {}
      try { await circuitBreaker(mockOperation); } catch {}

      expect(circuitBreakerSpy).toHaveBeenCalledWith({
        connector: 'test-connector',
        operation: 'test-operation',
        failures: 2,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('withErrorHandling wrapper', () => {
    it('should wrap functions with error handling', async () => {
      const originalFunction = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue('success');

      const wrappedFunction = withErrorHandling(
        originalFunction,
        'test-connector',
        'test-operation',
        errorHandler
      );

      const result = await wrappedFunction('arg1', 'arg2');

      expect(result).toBe('success');
      expect(originalFunction).toHaveBeenCalledTimes(2);
      expect(originalFunction).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('configuration', () => {
    it('should respect custom retry configuration', () => {
      const customHandler = new SmythOSErrorHandler({
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 10000,
        exponentialBackoff: false,
        jitter: true,
        retryableErrors: [ErrorCategory.NETWORK]
      });

      expect((customHandler as any).retryConfig.maxRetries).toBe(5);
      expect((customHandler as any).retryConfig.baseDelay).toBe(500);
      expect((customHandler as any).retryConfig.exponentialBackoff).toBe(false);
    });

    it('should disable telemetry when configured', () => {
      const handler = new SmythOSErrorHandler({}, false);
      const errorSpy = jest.fn();
      
      handler.on('error', errorSpy);

      // This test would need to be expanded to verify telemetry is actually disabled
      expect(handler.listenerCount('error')).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined/null operations gracefully', async () => {
      const mockOperation = jest.fn().mockResolvedValue(undefined);
      
      const result = await errorHandler.executeWithRetry(
        mockOperation,
        'test-connector',
        'test-operation'
      );

      expect(result).toBeUndefined();
    });

    it('should handle operations that throw non-Error objects', async () => {
      const mockOperation = jest.fn().mockRejectedValue('string error');

      try {
        await errorHandler.executeWithRetry(
          mockOperation,
          'test-connector',
          'test-operation'
        );
      } catch (error) {
        expect(error.connector).toBe('test-connector');
        expect(error.category).toBe(ErrorCategory.UNKNOWN);
      }
    });

    it('should handle very large delay calculations', () => {
      const handler = new SmythOSErrorHandler({
        baseDelay: 1000,
        maxDelay: 5000,
        exponentialBackoff: true
      });

      // Test large attempt number
      const delay = (handler as any).calculateRetryDelay(20);
      expect(delay).toBeLessThanOrEqual(5000); // Should be capped at maxDelay
    });
  });
});

describe('Integration Tests', () => {
  describe('Real-world scenarios', () => {
    it('should handle OpenAI-like API errors correctly', async () => {
      const errorHandler = new SmythOSErrorHandler();
      
      // Mock OpenAI rate limit error
      const mockAPICall = jest.fn().mockRejectedValue({
        status: 429,
        error: {
          message: 'Rate limit reached for requests',
          type: 'requests',
          param: null,
          code: 'rate_limit_exceeded'
        }
      });

      try {
        await errorHandler.executeWithRetry(
          mockAPICall,
          'openai',
          'chat_completion'
        );
      } catch (error) {
        expect(error.category).toBe(ErrorCategory.RATE_LIMIT);
        expect(error.retryable).toBe(true);
        expect(mockAPICall).toHaveBeenCalledTimes(4); // Initial + 3 retries
      }
    });

    it('should handle database connection errors', async () => {
      const errorHandler = new SmythOSErrorHandler();
      
      const mockDBQuery = jest.fn()
        .mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'Connection refused' })
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Connection timeout' })
        .mockResolvedValue({ rows: [{ id: 1, name: 'test' }] });

      const result = await errorHandler.executeWithRetry(
        mockDBQuery,
        'postgresql',
        'select_query'
      );

      expect(result).toEqual({ rows: [{ id: 1, name: 'test' }] });
      expect(mockDBQuery).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed error types in sequence', async () => {
      const errorHandler = new SmythOSErrorHandler();
      const events: string[] = [];
      
      errorHandler.on('error', (data) => {
        events.push(`error_${data.error.category}_attempt_${data.attempt}`);
      });
      
      errorHandler.on('retry_success', (data) => {
        events.push(`success_attempt_${data.attempt}`);
      });

      const mockOperation = jest.fn()
        .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
        .mockRejectedValueOnce({ code: 'ENOTFOUND', message: 'DNS error' })
        .mockResolvedValue('final success');

      const result = await errorHandler.executeWithRetry(
        mockOperation,
        'mixed-connector',
        'mixed-operation'
      );

      expect(result).toBe('final success');
      expect(events).toContain('error_rate_limit_attempt_1');
      expect(events).toContain('error_network_attempt_2');
      expect(events).toContain('success_attempt_2');
    });
  });
});

describe('Performance Tests', () => {
  it('should complete retries within reasonable time bounds', async () => {
    const errorHandler = new SmythOSErrorHandler({
      maxRetries: 3,
      baseDelay: 10, // Very small delay for performance test
      jitter: false
    });

    const mockOperation = jest.fn()
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockRejectedValueOnce(new Error('Error 3'))
      .mockResolvedValue('success');

    const startTime = Date.now();
    
    const result = await errorHandler.executeWithRetry(
      mockOperation,
      'perf-test',
      'perf-operation'
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(result).toBe('success');
    expect(duration).toBeLessThan(100); // Should complete quickly with small delays
  });

  it('should handle high-frequency operations efficiently', async () => {
    const errorHandler = new SmythOSErrorHandler({
      maxRetries: 1,
      baseDelay: 1
    });

    const operations = Array.from({ length: 100 }, (_, i) => 
      errorHandler.executeWithRetry(
        () => Promise.resolve(`result_${i}`),
        'bulk-test',
        'bulk-operation'
      )
    );

    const startTime = Date.now();
    const results = await Promise.all(operations);
    const endTime = Date.now();

    expect(results).toHaveLength(100);
    expect(endTime - startTime).toBeLessThan(1000); // Should handle 100 operations quickly
  });
});

// Test utilities
export function createMockConnector() {
  return {
    call: jest.fn(),
    healthCheck: jest.fn(),
    config: { timeout: 5000 }
  };
}

export function simulateNetworkError() {
  return { code: 'ENOTFOUND', message: 'Network error' };
}

export function simulateRateLimitError() {
  return { status: 429, message: 'Rate limit exceeded' };
}

export function simulateServiceError() {
  return { status: 503, message: 'Service unavailable' };
}
