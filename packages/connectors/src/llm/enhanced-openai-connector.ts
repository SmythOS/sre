/**
 * Example implementation: Enhanced OpenAI Connector with SmythOS Error Handling
 * 
 * This demonstrates how to integrate the enhanced error handling system
 * with existing SmythOS connectors for better reliability and observability.
 */

import { 
  SmythOSErrorHandler, 
  withErrorHandling, 
  createSmythOSError,
  ErrorCategory,
  ErrorSeverity,
  HandleErrors 
} from './smythos-error-handler';

// OpenAI API types (simplified for example)
interface OpenAIRequest {
  model: string;
  messages: Array<{role: string; content: string}>;
  temperature?: number;
  max_tokens?: number;
}

interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIConnectorConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  retryConfig?: {
    maxRetries?: number;
    baseDelay?: number;
  };
}

/**
 * Enhanced OpenAI Connector with comprehensive error handling
 */
export class EnhancedOpenAIConnector {
  private config: OpenAIConnectorConfig;
  private errorHandler: SmythOSErrorHandler;
  private circuitBreakers: Map<string, any> = new Map();

  constructor(config: OpenAIConnectorConfig) {
    this.config = {
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
      ...config
    };
    
    // Initialize error handler with custom retry config
    this.errorHandler = new SmythOSErrorHandler({
      maxRetries: config.retryConfig?.maxRetries || 3,
      baseDelay: config.retryConfig?.baseDelay || 1000,
      exponentialBackoff: true,
      jitter: true,
      retryableErrors: [
        ErrorCategory.NETWORK,
        ErrorCategory.RATE_LIMIT,
        ErrorCategory.SERVICE_UNAVAILABLE,
        ErrorCategory.TIMEOUT
      ]
    });

    // Set up telemetry listeners
    this.setupTelemetry();
  }

  /**
   * Set up telemetry and monitoring
   */
  private setupTelemetry(): void {
    this.errorHandler.on('error', (data) => {
      console.warn(`[OpenAI Connector] Error on attempt ${data.attempt}:`, {
        error: data.error.message,
        category: data.error.category,
        severity: data.error.severity,
        willRetry: data.willRetry
      });
    });

    this.errorHandler.on('retry_success', (data) => {
      console.info(`[OpenAI Connector] Retry successful after ${data.attempt} attempts for ${data.operation}`);
    });

    this.errorHandler.on('max_retries_exceeded', (data) => {
      console.error(`[OpenAI Connector] Max retries exceeded for ${data.operation}:`, {
        totalAttempts: data.totalAttempts,
        finalError: data.finalError.message
      });
    });

    this.errorHandler.on('circuit_breaker_opened', (data) => {
      console.error(`[OpenAI Connector] Circuit breaker opened for ${data.operation} after ${data.failures} failures`);
    });
  }

  /**
   * Enhanced chat completion with comprehensive error handling
   */
  @HandleErrors('openai', 'chat_completion')
  async createChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
    return this.errorHandler.executeWithRetry(
      async () => {
        const response = await this.makeAPIRequest('/chat/completions', request);
        
        // Validate response structure
        if (!response.choices || !Array.isArray(response.choices)) {
          throw createSmythOSError(
            'Invalid response format from OpenAI API',
            'INVALID_RESPONSE',
            ErrorCategory.VALIDATION,
            ErrorSeverity.HIGH,
            'openai',
            'chat_completion',
            undefined,
            { response }
          );
        }

        return response;
      },
      'openai',
      'chat_completion',
      { model: request.model, messageCount: request.messages.length }
    );
  }

  /**
   * Enhanced embedding creation with error handling
   */
  async createEmbedding(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
    // Get or create circuit breaker for embeddings
    const circuitBreakerKey = 'embedding';
    if (!this.circuitBreakers.has(circuitBreakerKey)) {
      this.circuitBreakers.set(
        circuitBreakerKey,
        this.errorHandler.createCircuitBreaker('openai', 'embedding', 5, 30000)
      );
    }

    const circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);

    return circuitBreaker(async () => {
      const response = await this.makeAPIRequest('/embeddings', {
        input: text,
        model: model
      });

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw createSmythOSError(
          'Invalid embedding response',
          'INVALID_EMBEDDING_RESPONSE',
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM,
          'openai',
          'embedding',
          undefined,
          { model, textLength: text.length }
        );
      }

      return response.data[0].embedding;
    });
  }

  /**
   * Enhanced model listing with error handling
   */
  async listModels(): Promise<string[]> {
    const wrappedMethod = withErrorHandling(
      async () => {
        const response = await this.makeAPIRequest('/models', null, 'GET');
        
        if (!response.data || !Array.isArray(response.data)) {
          throw createSmythOSError(
            'Invalid models list response',
            'INVALID_MODELS_RESPONSE',
            ErrorCategory.VALIDATION,
            ErrorSeverity.LOW,
            'openai',
            'list_models'
          );
        }

        return response.data.map((model: any) => model.id);
      },
      'openai',
      'list_models',
      this.errorHandler
    );

    return wrappedMethod();
  }

  /**
   * Low-level API request method with enhanced error handling
   */
  private async makeAPIRequest(
    endpoint: string, 
    body: any, 
    method: 'GET' | 'POST' = 'POST'
  ): Promise<any> {
    const url = `${this.config.baseURL}${endpoint}`;
    const controller = new AbortController();
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.timeout);

    try {
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'SmythOS-OpenAI-Connector/1.0'
        },
        signal: controller.signal
      };

      if (body && method === 'POST') {
        requestOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, requestOptions);

      // Handle different HTTP status codes appropriately
      if (!response.ok) {
        const errorBody = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(errorBody);
        } catch {
          errorData = { message: errorBody };
        }

        // Map HTTP status codes to appropriate error categories
        let category: ErrorCategory;
        let severity: ErrorSeverity;

        switch (response.status) {
          case 400:
            category = ErrorCategory.VALIDATION;
            severity = ErrorSeverity.LOW;
            break;
          case 401:
            category = ErrorCategory.AUTHENTICATION;
            severity = ErrorSeverity.HIGH;
            break;
          case 403:
            category = ErrorCategory.AUTHORIZATION;
            severity = ErrorSeverity.HIGH;
            break;
          case 429:
            category = ErrorCategory.RATE_LIMIT;
            severity = ErrorSeverity.MEDIUM;
            break;
          case 500:
          case 502:
          case 503:
          case 504:
            category = ErrorCategory.SERVICE_UNAVAILABLE;
            severity = ErrorSeverity.HIGH;
            break;
          default:
            category = ErrorCategory.UNKNOWN;
            severity = ErrorSeverity.MEDIUM;
        }

        throw createSmythOSError(
          errorData.error?.message || errorData.message || `HTTP ${response.status}`,
          `HTTP_${response.status}`,
          category,
          severity,
          'openai',
          endpoint.replace('/', '_'),
          undefined,
          {
            statusCode: response.status,
            endpoint,
            errorData,
            headers: Object.fromEntries(response.headers.entries())
          }
        );
      }

      return await response.json();

    } catch (error) {
      // Handle fetch-specific errors
      if (error.name === 'AbortError') {
        throw createSmythOSError(
          `Request timeout after ${this.config.timeout}ms`,
          'REQUEST_TIMEOUT',
          ErrorCategory.TIMEOUT,
          ErrorSeverity.HIGH,
          'openai',
          endpoint.replace('/', '_'),
          error,
          { timeout: this.config.timeout, endpoint }
        );
      }

      // Re-throw SmythOS errors as-is
      if (error.connector === 'openai') {
        throw error;
      }

      // Handle network errors
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw createSmythOSError(
          `Network error: ${error.message}`,
          'NETWORK_ERROR',
          ErrorCategory.NETWORK,
          ErrorSeverity.HIGH,
          'openai',
          endpoint.replace('/', '_'),
          error,
          { endpoint, originalCode: error.code }
        );
      }

      // Catch-all for unexpected errors
      throw createSmythOSError(
        error.message || 'Unknown error occurred',
        'UNKNOWN_ERROR',
        ErrorCategory.UNKNOWN,
        ErrorSeverity.MEDIUM,
        'openai',
        endpoint.replace('/', '_'),
        error,
        { endpoint }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health check method with error handling
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.listModels();
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): any {
    return {
      // This would be implemented to return error statistics
      // from the error handler's telemetry data
      totalRequests: 0,
      totalErrors: 0,
      errorsByCategory: {},
      circuitBreakerStates: Object.fromEntries(this.circuitBreakers.entries())
    };
  }
}

/**
 * Factory function to create enhanced OpenAI connector
 */
export function createOpenAIConnector(config: OpenAIConnectorConfig): EnhancedOpenAIConnector {
  return new EnhancedOpenAIConnector(config);
}

/**
 * Example usage
 */
export async function exampleUsage() {
  const connector = createOpenAIConnector({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000
    }
  });

  try {
    // This will automatically retry on transient failures
    const response = await connector.createChatCompletion({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      temperature: 0.7
    });

    console.log('Response:', response.choices[0].message.content);

    // Health check
    const health = await connector.healthCheck();
    console.log('Health:', health);

  } catch (error) {
    console.error('Final error after all retries:', {
      message: error.message,
      code: error.code,
      category: error.category,
      severity: error.severity,
      retryable: error.retryable
    });
  }
}
