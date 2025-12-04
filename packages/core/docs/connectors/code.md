---
title: 'connectors/Code Execution'
---

# Code Connectors

The Code subsystem provides code execution environments for dynamic component execution.

## Available Connectors

### AWSLambda

**Role**: AWS Lambda code executor  
**Summary**: Executes code in AWS Lambda functions for serverless code execution with automatic scaling and isolation.

| Setting           | Type   | Required | Default | Description                     |
| ----------------- | ------ | -------- | ------- | ------------------------------- |
| `region`          | string | Yes      | -       | AWS region for Lambda functions |
| `accessKeyId`     | string | Yes      | -       | AWS access key ID               |
| `secretAccessKey` | string | Yes      | -       | AWS secret access key           |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Code: {
        Connector: 'AWSLambda',
        Settings: {
            region: 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    },
});
```

**Use Cases:**

-   Serverless code execution
-   Dynamic component deployment
-   Scalable code execution
-   Isolated execution environments
-   Enterprise-grade code execution

**How it Works:**

-   Creates Lambda functions for code execution
-   Handles code packaging and deployment
-   Manages function lifecycle and caching
-   Provides isolated execution environments
-   Automatic scaling based on demand

**Security Notes:**

-   Use IAM roles when running on AWS infrastructure
-   Store credentials securely using environment variables
-   Lambda functions are isolated and secure by default
-   Code is packaged and deployed securely
