# Storage Connectors

The Storage subsystem provides file and blob storage capabilities for the SRE. It handles persistent data storage, file uploads, downloads, and management operations.

## Available Connectors

### LocalStorage

**Role**: Local filesystem storage connector  
**Summary**: Provides file storage capabilities using the local filesystem, suitable for development and single-node deployments.

| Setting  | Type   | Required | Default            | Description                      |
| -------- | ------ | -------- | ------------------ | -------------------------------- |
| `folder` | string | No       | `~/.smyth/storage` | Directory path for storing files |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Storage: {
        Connector: 'LocalStorage',
        Settings: {
            folder: './data/storage',
        },
    },
});
```

**Use Cases:**

-   Development and testing environments
-   Single-node applications
-   Local file processing workflows
-   Applications with simple storage requirements

---

### S3

**Role**: Amazon S3 cloud storage connector  
**Summary**: Provides scalable cloud storage using Amazon S3, suitable for production deployments requiring high availability and durability.

| Setting           | Type   | Required | Default | Description                            |
| ----------------- | ------ | -------- | ------- | -------------------------------------- |
| `region`          | string | Yes      | -       | AWS region where the bucket is located |
| `accessKeyId`     | string | Yes      | -       | AWS access key ID                      |
| `secretAccessKey` | string | Yes      | -       | AWS secret access key                  |
| `bucket`          | string | Yes      | -       | S3 bucket name for storing files       |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            region: 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            bucket: 'my-app-storage',
        },
    },
});
```

**Use Cases:**

-   Production environments requiring scalability
-   Multi-region deployments
-   Applications with high availability requirements
-   Integration with AWS ecosystem
-   Large-scale data storage and processing

**Security Notes:**

-   Use IAM roles when running on AWS infrastructure
-   Store credentials securely using environment variables or AWS Secrets Manager
-   Configure appropriate bucket policies and CORS settings
-   Enable encryption at rest and in transit for sensitive data

---

### GCS

**Role**: Google Cloud Storage connector  
**Summary**: Provides scalable cloud storage using Google Cloud Storage, suitable for production deployments requiring high availability and durability on Google Cloud Platform.

| Setting       | Type   | Required | Default | Description                                     |
| ------------- | ------ | -------- | ------- | ----------------------------------------------- |
| `projectId`   | string | Yes      | -       | Google Cloud Project ID where the bucket is located |
| `clientEmail` | string | Yes      | -       | Service account email address                   |
| `privateKey`  | string | Yes      | -       | Service account private key                     |
| `bucket`      | string | Yes      | -       | GCS bucket name for storing files               |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Storage: {
        Connector: 'GCS',
        Settings: {
            projectId: 'my-project-id',
            clientEmail: process.env.GCP_CLIENT_EMAIL,
            privateKey: process.env.GCP_PRIVATE_KEY,
            bucket: 'my-app-storage',
        },
    },
});
```

**Use Cases:**

-   Production environments requiring scalability on Google Cloud Platform
-   Multi-region deployments within GCP infrastructure
-   Applications with high availability requirements
-   Integration with Google Cloud ecosystem
-   Large-scale data storage and processing

**Security Notes:**

-   Use service accounts with minimal required permissions
-   Store credentials securely using environment variables or Google Secret Manager
-   Configure appropriate bucket policies and IAM settings
-   Enable encryption at rest and in transit for sensitive data
