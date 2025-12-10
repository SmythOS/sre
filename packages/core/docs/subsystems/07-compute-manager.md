# Compute Manager

The Compute Manager is responsible for secure code execution. It provides an abstraction layer for running untrusted or dynamic code in isolated environments (sandboxes).

## Code Service

The Code Service allows agents to prepare, deploy, and execute code snippets. It supports different runtime environments and enforces resource limits and security policies.

-   **Interface**: `ICodeConnector`
-   **Service Access**: `ConnectorService.getCodeConnector()`
-   **Default Implementation**: `ECMASandbox`

### Code Connector

The `CodeConnector` extends `SecureConnector` and provides methods for managing the code execution lifecycle.

#### Key Methods

-   `prepare(codeUID: string, input: CodeInput, config: CodeConfig): Promise<CodePreparationResult>`: Prepares code for execution (e.g., validation, dependency resolution).
-   `deploy(codeUID: string, input: CodeInput, config: CodeConfig): Promise<CodeDeployment>`: Deploys the code (e.g., to a serverless function).
-   `execute(codeUID: string, inputs: Record<string, any>, config: CodeConfig): Promise<CodeExecutionResult>`: Executes the code with provided inputs.
-   `executeDeployment(codeUID: string, deploymentId: string, inputs: Record<string, any>, config: CodeConfig): Promise<CodeExecutionResult>`: Executes a previously deployed function.

### Connectors

#### 1. ECMASandbox (Default)

The `ECMASandbox` connector executes JavaScript/TypeScript code in an isolated environment. It can run locally using Node.js's `vm` module or connect to a remote sandbox service.

-   **Config**: `sandboxUrl` (optional) - URL of the remote sandbox service.

#### 2. AWSLambda

The `AWSLambda` connector deploys and executes code as AWS Lambda functions. This is suitable for production environments requiring high scalability and isolation.

-   **Config**: `region`, `accessKeyId`, `secretAccessKey`

### Configuration

To configure the Code Service, add a `Code` entry to the SRE configuration:

```typescript
SRE.init({
    Code: {
        Connector: 'ECMASandbox',
        Settings: {
            // sandboxUrl: 'http://localhost:3000' // Optional remote sandbox
        },
    },
});
```

### Usage

The `CodeService` is primarily used by specific Agent Components that require dynamic code execution, such as:

-   **ServerlessCode**: A component that deploys and runs code on AWS Lambda.
-   **ECMASandbox**: A component that runs JavaScript/TypeScript snippets safely.

**Note**: Do not confuse the `CodeService` with "Agent Skills". Agent Skills (defined via the SDK) are typically standard API endpoints or internal functions executed within the Agent's main runtime context. The `CodeService` is specifically for isolated, sandboxed execution of arbitrary code logic.
