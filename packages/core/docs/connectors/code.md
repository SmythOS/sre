---
title: 'connectors/Code Execution'
---

# Code Connectors

The Code Connector manages the secure execution of code snippets. It abstracts the underlying runtime environment, whether it's a local sandbox or a cloud function.

## Interface: `ICodeRequest`

### Methods

#### `prepare(codeUID, input, config)`
Prepares code for execution. This might involves compiling, validating, or resolving dependencies.
- **codeUID**: `string` - Unique identifier for the code.
- **input**: `CodeInput` - Contains source code and dependencies.
- **config**: `CodeConfig` - Runtime configuration (e.g., 'nodejs', timeout).
- **Returns**: `Promise<CodePreparationResult>`

#### `execute(codeUID, inputs, config)`
Executes code immediately.
- **inputs**: `Record<string, any>` - Arguments to pass to the code.
- **Returns**: `Promise<CodeExecutionResult>`

#### `deploy(codeUID, input, config)`
Deploys the code for future execution (e.g., creating a Lambda function).
- **Returns**: `Promise<CodeDeployment>`

#### `executeDeployment(codeUID, deploymentId, inputs, config)`
Executes a previously deployed function.
- **deploymentId**: `string` - ID of the deployment.
- **Returns**: `Promise<CodeExecutionResult>`

## Connectors

### ECMASandbox

Executes JavaScript/TypeScript in an isolated VM or remote sandbox service.

- **Settings**:
  - `sandboxUrl`: Optional URL for remote execution.

### AWSLambda

Deploys and executes code as AWS Lambda functions.

- **Settings**:
  - `region`: AWS Region.
  - `accessKeyId`: AWS Access Key.
  - `secretAccessKey`: AWS Secret Key.

## Usage Example

```typescript
const codeService = ConnectorService.getCodeConnector().requester(candidate);

const result = await codeService.execute('script-1', {
    code: 'export default async ({ name }) => `Hello ${name}`;',
    inputs: { name: 'World' }
}, { runtime: 'nodejs' });

console.log(result.output); // "Hello World"
```
