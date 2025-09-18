# Weaviate VectorDB Connector

A comprehensive VectorDB connector for Weaviate, enabling seamless integration with SmythOS SRE's vector database capabilities.

## Features

- **Full CRUD Operations**: Create, read, update, and delete vectors
- **Namespace Management**: Isolated namespaces per user/agent
- **Security Integration**: Built-in ACL support with SmythOS security model
- **Embedding Support**: Automatic text-to-vector conversion
- **Metadata Management**: Rich metadata support for vectors
- **Datasource Management**: Organize vectors by datasource
- **Production Ready**: Enterprise-grade error handling and logging

## Configuration

```typescript
const weaviateConfig = {
    url: 'http://localhost:8080', // or 'https://your-weaviate-instance.com'
    apiKey: 'your-api-key', // Optional for open source Weaviate
    className: 'SmythVector', // Optional, defaults to 'SmythVector'
    embeddings: {
        provider: 'OpenAI',
        model: 'text-embedding-3-small',
        params: {
            dimensions: 1536
        }
    },
    clientOptions: {
        timeout: 30000,
        headers: {
            'User-Agent': 'SmythOS-SRE'
        }
    }
};
```

## Usage Examples

### Basic Setup

```typescript
import { SRE } from '@smythos/sre';

// Initialize SRE with Weaviate connector
SRE.init({
    VectorDB: {
        Connector: 'Weaviate',
        Settings: weaviateConfig
    }
});

await SRE.ready();
```

### Agent Integration

```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    name: 'Document Assistant',
    model: 'gpt-4o',
    behavior: 'You are a helpful document assistant.'
});

// Access Weaviate through the agent
const vectorDB = agent.vectorDB.Weaviate('documents', weaviateConfig);

// Add documents to the vector database
await vectorDB.createDatasource('documents', {
    text: 'This is a sample document about machine learning.',
    metadata: { category: 'AI', author: 'John Doe' }
});

// Search for similar documents
const results = await vectorDB.search('machine learning concepts', {
    topK: 5,
    includeMetadata: true
});
```

### Direct SRE Usage

```typescript
import { ConnectorService, AccessCandidate } from '@smythos/sre';

const vectorDBConnector = ConnectorService.getVectorDBConnector();
const candidate = AccessCandidate.agent('my-agent-id');
const vectorDB = vectorDBConnector.requester(candidate);

// Create a namespace
await vectorDB.createNamespace('my-documents');

// Insert vectors
const vectorIds = await vectorDB.insert('my-documents', [
    {
        id: 'doc-1',
        text: 'Introduction to machine learning',
        metadata: { category: 'tutorial' }
    },
    {
        id: 'doc-2', 
        text: 'Advanced neural networks',
        metadata: { category: 'advanced' }
    }
]);

// Search vectors
const searchResults = await vectorDB.search('my-documents', 'neural networks', {
    topK: 10,
    includeMetadata: true
});

console.log('Found documents:', searchResults.matches);
```

## API Reference

### Constructor

```typescript
new WeaviateVectorDB(config: WeaviateConfig)
```

**Parameters:**
- `config.url` (string): Weaviate instance URL
- `config.apiKey` (string, optional): API key for authentication
- `config.className` (string, optional): Class name for storing vectors
- `config.embeddings` (TEmbeddings): Embedding configuration
- `config.clientOptions` (object, optional): Additional client options

### Methods

#### `createNamespace(namespace: string, metadata?: object)`
Creates a new namespace (class) in Weaviate.

#### `deleteNamespace(namespace: string)`
Deletes a namespace and all its vectors.

#### `namespaceExists(namespace: string): Promise<boolean>`
Checks if a namespace exists.

#### `search(namespace: string, query: string | number[], options?: QueryOptions)`
Performs vector similarity search.

#### `insert(namespace: string, data: IVectorDataSourceDto | IVectorDataSourceDto[])`
Inserts vectors into the namespace.

#### `delete(namespace: string, target: string | string[] | DeleteFilterOptions)`
Deletes vectors by ID or filter.

#### `createDatasource(namespace: string, datasource: DatasourceDto)`
Creates a datasource for organizing vectors.

#### `deleteDatasource(namespace: string, datasourceId: string)`
Deletes a datasource and its vectors.

#### `listDatasources(namespace: string)`
Lists all datasources in a namespace.

#### `getDatasource(namespace: string, datasourceId: string)`
Gets a specific datasource.

## Security Features

The Weaviate connector integrates with SmythOS SRE's security model:

- **Access Control**: All operations require proper ACL permissions
- **Namespace Isolation**: Each user/agent gets isolated namespaces
- **Resource Scoping**: Vectors are scoped to the requesting entity
- **Audit Logging**: All operations are logged with context

## Error Handling

The connector provides comprehensive error handling:

```typescript
try {
    await vectorDB.search('namespace', 'query');
} catch (error) {
    if (error.message.includes('namespace')) {
        // Handle namespace-related errors
    } else if (error.message.includes('connection')) {
        // Handle connection errors
    }
}
```

## Performance Considerations

- **Batch Operations**: Use batch operations for multiple vectors
- **Connection Pooling**: Weaviate client handles connection pooling
- **Caching**: Metadata is cached for improved performance
- **Async Operations**: All operations are asynchronous

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check Weaviate URL and port
2. **Authentication Failed**: Verify API key
3. **Class Not Found**: Ensure namespace exists before operations
4. **Vector Dimension Mismatch**: Verify embedding dimensions match

### Debug Mode

Enable debug logging:

```typescript
process.env.LOG_LEVEL = 'debug';
```

## Contributing

To contribute to the Weaviate connector:

1. Follow the existing code patterns
2. Add comprehensive tests
3. Update documentation
4. Ensure security compliance

## License

This connector is part of SmythOS SRE and follows the same MIT license.
