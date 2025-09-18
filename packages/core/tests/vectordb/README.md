# WeaviateVectorDB Connector Tests

This directory contains comprehensive test suites for the WeaviateVectorDB connector implementation.

## Test Structure

### Unit Tests (`unit/vectordb/WeaviateVectorDB.test.ts`)
- **Purpose**: Test individual methods and components in isolation
- **Coverage**: 
  - Constructor and initialization
  - Namespace management (create, delete, exists)
  - Vector operations (insert, search, delete)
  - Datasource management
  - ACL and security features
  - Error handling and edge cases
- **Mocking**: Uses mocked Weaviate client and dependencies
- **Run Time**: Fast (< 1 minute)

### Integration Tests (`integration/vectordb/WeaviateVectorDB.integration.test.ts`)
- **Purpose**: Test complete workflows with real Weaviate instance
- **Coverage**:
  - Full vector database workflows
  - Concurrent operations
  - Large dataset handling
  - Data consistency
  - Error recovery
- **Requirements**: Requires running Weaviate instance
- **Run Time**: Medium (2-5 minutes)

### Performance Tests (`performance/vectordb/WeaviateVectorDB.performance.test.ts`)
- **Purpose**: Measure and validate performance characteristics
- **Coverage**:
  - Insert performance (single, batch, concurrent)
  - Search performance (small/large result sets, concurrent)
  - Namespace management performance
  - Memory and resource usage
  - Stress testing
- **Requirements**: Requires running Weaviate instance
- **Run Time**: Long (5-15 minutes)

### Test Utilities (`utils/weaviate-test-utils.ts`)
- **Purpose**: Shared utilities and helpers for testing
- **Features**:
  - Test data generation
  - Mock client creation
  - Performance measurement helpers
  - Cleanup utilities
  - Assertion helpers

## Running Tests

### Prerequisites

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **For Integration/Performance Tests**:
   - Start a Weaviate instance:
     ```bash
     docker run -p 8080:8080 -p 50051:50051 semitechnologies/weaviate:latest
     ```
   - Or set environment variables:
     ```bash
     export WEAVIATE_URL=http://your-weaviate-instance:8080
     export WEAVIATE_API_KEY=your-api-key
     ```

### Running Different Test Suites

#### Unit Tests Only (Fast, No External Dependencies)
```bash
# Run all unit tests
pnpm test unit/vectordb/WeaviateVectorDB.test.ts

# Run with coverage
pnpm test:coverage unit/vectordb/WeaviateVectorDB.test.ts
```

#### Integration Tests (Requires Weaviate Instance)
```bash
# Set environment variable to enable integration tests
export RUN_INTEGRATION_TESTS=true

# Run integration tests
pnpm test integration/vectordb/WeaviateVectorDB.integration.test.ts
```

#### Performance Tests (Requires Weaviate Instance)
```bash
# Set environment variable to enable performance tests
export RUN_PERFORMANCE_TESTS=true

# Run performance tests
pnpm test performance/vectordb/WeaviateVectorDB.performance.test.ts
```

#### All Tests
```bash
# Run all tests (unit tests will run, integration/performance will be skipped without env vars)
pnpm test

# Run all tests with coverage
pnpm test:coverage
```

### Test Configuration

#### Environment Variables

| Variable | Description | Default | Required For |
|----------|-------------|---------|--------------|
| `WEAVIATE_URL` | Weaviate instance URL | `http://localhost:8080` | Integration/Performance |
| `WEAVIATE_API_KEY` | Weaviate API key | `test-key` | Integration/Performance |
| `RUN_INTEGRATION_TESTS` | Enable integration tests | `false` | Integration |
| `RUN_PERFORMANCE_TESTS` | Enable performance tests | `false` | Performance |

#### Test Data

- **Unit Tests**: Use mocked data and clients
- **Integration Tests**: Use real Weaviate instance with test namespaces
- **Performance Tests**: Use larger datasets for performance measurement

## Test Coverage

### Unit Tests Coverage
- ✅ Constructor and initialization
- ✅ Namespace management (create, delete, exists)
- ✅ Vector operations (insert, search, delete)
- ✅ Datasource management (create, delete, list, get)
- ✅ ACL and security features
- ✅ Error handling and edge cases
- ✅ Stop method

### Integration Tests Coverage
- ✅ Complete vector database workflows
- ✅ Concurrent operations
- ✅ Large dataset handling (100+ vectors)
- ✅ Data consistency across operations
- ✅ Error recovery scenarios
- ✅ Performance benchmarks

### Performance Tests Coverage
- ✅ Single vector insertion performance
- ✅ Batch vector insertion performance
- ✅ Concurrent insertion performance
- ✅ Search performance (small/large result sets)
- ✅ Concurrent search performance
- ✅ Namespace management performance
- ✅ Memory usage with large datasets
- ✅ Stress testing with mixed operations

## Test Data Management

### Automatic Cleanup
- All integration and performance tests automatically clean up test data
- Test namespaces are generated with unique timestamps
- Cleanup happens in `afterEach` hooks

### Test Data Patterns
- **Unit Tests**: Use predictable mock data
- **Integration Tests**: Use realistic test data with various content types
- **Performance Tests**: Use larger datasets for meaningful performance measurement

## Debugging Tests

### Common Issues

1. **Weaviate Connection Issues**:
   ```bash
   # Check if Weaviate is running
   curl http://localhost:8080/v1/meta
   ```

2. **Test Timeouts**:
   - Increase timeout in test configuration
   - Check Weaviate instance performance
   - Reduce test data size

3. **Memory Issues**:
   - Reduce dataset sizes in performance tests
   - Check available system memory
   - Monitor Weaviate instance memory usage

### Debug Mode
```bash
# Run tests with verbose output
pnpm test --reporter=verbose

# Run specific test with debug
pnpm test --reporter=verbose unit/vectordb/WeaviateVectorDB.test.ts -t "should create namespace successfully"
```

## Contributing

When adding new tests:

1. **Unit Tests**: Add tests for new methods/features with proper mocking
2. **Integration Tests**: Add workflow tests that verify end-to-end functionality
3. **Performance Tests**: Add performance benchmarks for new operations
4. **Test Utilities**: Add helper functions to `weaviate-test-utils.ts` for reusable functionality

### Test Naming Conventions
- Use descriptive test names that explain the scenario
- Group related tests in `describe` blocks
- Use `it` for individual test cases
- Use `beforeEach`/`afterEach` for setup/cleanup

### Test Data Conventions
- Use `WeaviateTestUtils` for generating test data
- Use unique identifiers to avoid conflicts
- Clean up test data in `afterEach` hooks
- Use realistic data for integration tests
