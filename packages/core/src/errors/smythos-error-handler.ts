/**
 * Enhanced Error Handling for SmythOS SRE Connectors
 * 
 * This module provides comprehensive error handling, retry logic, and 
 * standardized error responses for all SmythOS connectors.
 */

import { EventEmitter } from 'events';

// Error categories for better error classification
export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  QUOTA_EXCEEDED = 'quota_exceeded',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  CONFIGURATION = 'configuration',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

// Severity levels for error reporting
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Standard error interface for all SmythOS connectors
export interface SmythOSError extends Error {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  connector: string;
  operation: string;
  timestamp: Date;
  retryable: boolean;
  metadata?: Record<string, any>;
  originalError?: Error;
}

// Retry configuration interface
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  jitter: boolean;
  retryableErrors: ErrorCategory[];
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  exponentialBackoff: true,
  jitter: true,
  retryableErrors: [
    ErrorCategory.NETWORK,
    ErrorCategory.RATE_LIMIT,
    ErrorCategory.SERVICE_UNAVAILABLE,
    ErrorCategory.TIMEOUT
  ]
};

/**
 * Creates a standardized SmythOS error
 */
export function createSmythOSError(
  message: string,
  code: string,
  category: ErrorCategory,
  severity: ErrorSeverity,
  connector: string,
  operation: string,
  originalError?: Error,
  metadata?: Record<string, any>
): SmythOSError {
  const error = new Error(message) as SmythOSError;
  error.code = code;
  error.category = category;
  error.severity = severity;
  error.connector = connector;
  error.operation = operation;
  error.timestamp = new Date();
  error.retryable = DEFAULT_RETRY_CONFIG.retryableErrors.includes(category);
  error.originalError = originalError;
  error.metadata = metadata;
  
  return error;
}

/**
 * Enhanced error handler with retry logic and telemetry
 */
export class SmythOSErrorHandler extends EventEmitter {
  private retryConfig: RetryConfig;
  private telemetryEnabled: boolean;

  constructor(
    retryConfig: Partial<RetryConfig> = {},
    telemetryEnabled: boolean = true
  ) {
    super();
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.telemetryEnabled = telemetryEnabled;
  }

  /**
   * Executes an operation with built-in retry logic and error handling
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    connector: string,
    operationName: string,
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: SmythOSError | null = null;
    let attempt = 0;

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        const result = await operation();
        
        // Emit success telemetry if previous attempts failed
        if (attempt > 0 && this.telemetryEnabled) {
          this.emit('retry_success', {
            connector,
            operation: operationName,
            attempt,
            context
          });
        }
        
        return result;
      } catch (error) {
        attempt++;
        const smythOSError = this.normalizeError(
          error,
          connector,
          operationName,
          context
        );
        
        lastError = smythOSError;

        // Emit error telemetry
        if (this.telemetryEnabled) {
          this.emit('error', {
            error: smythOSError,
            attempt,
            willRetry: attempt <= this.retryConfig.maxRetries && smythOSError.retryable
          });
        }

        // Don't retry if error is not retryable or max retries exceeded
        if (!smythOSError.retryable || attempt > this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay for next retry
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);
      }
    }

    // All retries exhausted, throw the last error
    if (this.telemetryEnabled) {
      this.emit('max_retries_exceeded', {
        connector,
        operation: operationName,
        totalAttempts: attempt,
        finalError: lastError,
        context
      });
    }

    throw lastError;
  }

  /**
   * Normalizes various error types into SmythOSError format
   */
  private normalizeError(
    error: any,
    connector: string,
    operation: string,
    context?: Record<string, any>
  ): SmythOSError {
    // If already a SmythOSError, return as-is
    if (this.isSmythOSError(error)) {
      return error;
    }

    // Handle common error patterns
    let category = ErrorCategory.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let code = 'UNKNOWN_ERROR';

    // Network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || error.message?.includes('network')) {
      category = ErrorCategory.NETWORK;
      code = 'NETWORK_ERROR';
      severity = ErrorSeverity.HIGH;
    }
    // Authentication errors
    else if (error.status === 401 || error.code === 401 || 
             error.message?.toLowerCase().includes('auth')) {
      category = ErrorCategory.AUTHENTICATION;
      code = 'AUTH_ERROR';
      severity = ErrorSeverity.HIGH;
    }
    // Authorization errors
    else if (error.status === 403 || error.code === 403) {
      category = ErrorCategory.AUTHORIZATION;
      code = 'AUTHORIZATION_ERROR';
      severity = ErrorSeverity.HIGH;
    }
    // Rate limiting
    else if (error.status === 429 || error.code === 429) {
      category = ErrorCategory.RATE_LIMIT;
      code = 'RATE_LIMIT_ERROR';
      severity = ErrorSeverity.MEDIUM;
    }
    // Service unavailable
    else if (error.status === 503 || error.code === 503) {
      category = ErrorCategory.SERVICE_UNAVAILABLE;
      code = 'SERVICE_UNAVAILABLE';
      severity = ErrorSeverity.HIGH;
    }
    // Validation errors
    else if (error.status === 400 || error.code === 400 ||
             error.message?.toLowerCase().includes('validation')) {
      category = ErrorCategory.VALIDATION;
      code = 'VALIDATION_ERROR';
      severity = ErrorSeverity.LOW;
    }

    return createSmythOSError(
      error.message || 'An unknown error occurred',
      code,
      category,
      severity,
      connector,
      operation,
      error,
      { ...context, originalStatusCode: error.status || error.code }
    );
  }

  /**
   * Checks if an error is already a SmythOSError
   */
  private isSmythOSError(error: any): error is SmythOSError {
    return error && 
           typeof error.code === 'string' &&
           typeof error.category === 'string' &&
           typeof error.severity === 'string' &&
           typeof error.connector === 'string' &&
           typeof error.operation === 'string';
  }

  /**
   * Calculates retry delay with exponential backoff and optional jitter
   */
  private calculateRetryDelay(attempt: number): number {
    let delay = this.retryConfig.baseDelay;

    if (this.retryConfig.exponentialBackoff) {
      delay = Math.min(
        this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
        this.retryConfig.maxDelay
      );
    }

    // Add jitter to avoid thundering herd problem
    if (this.retryConfig.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Creates a circuit breaker for a specific connector operation
   */
  createCircuitBreaker(
    connector: string,
    operation: string,
    failureThreshold: number = 5,
    recoveryTimeout: number = 60000
  ) {
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'closed' | 'open' | 'half-open' = 'closed';

    return async <T>(fn: () => Promise<T>): Promise<T> => {
      const now = Date.now();

      // If circuit is open, check if we should try again
      if (state === 'open') {
        if (now - lastFailureTime < recoveryTimeout) {
          throw createSmythOSError(
            'Circuit breaker is open',
            'CIRCUIT_BREAKER_OPEN',
            ErrorCategory.SERVICE_UNAVAILABLE,
            ErrorSeverity.HIGH,
            connector,
            operation
          );
        }
        state = 'half-open';
      }

      try {
        const result = await fn();
        
        // Reset on success
        if (state === 'half-open') {
          state = 'closed';
          failures = 0;
        }
        
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (failures >= failureThreshold) {
          state = 'open';
          
          if (this.telemetryEnabled) {
            this.emit('circuit_breaker_opened', {
              connector,
              operation,
              failures,
              timestamp: now
            });
          }
        }

        throw error;
      }
    };
  }
}

/**
 * Utility function to wrap connector methods with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  connector: string,
  operation: string,
  errorHandler?: SmythOSErrorHandler
): (...args: T) => Promise<R> {
  const handler = errorHandler || new SmythOSErrorHandler();
  
  return async (...args: T): Promise<R> => {
    return handler.executeWithRetry(
      () => fn(...args),
      connector,
      operation,
      { arguments: args }
    );
  };
}

// Export default error handler instance
export const defaultErrorHandler = new SmythOSErrorHandler();

/**
 * Decorator for automatic error handling (if using TypeScript decorators)
 */
export function HandleErrors(connector: string, operation?: string) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operationName = operation || propertyName;

    descriptor.value = async function(...args: any[]) {
      return defaultErrorHandler.executeWithRetry(
        () => method.apply(this, args),
        connector,
        operationName,
        { className: target.constructor.name, methodName: propertyName }
      );
    };
  };
}
