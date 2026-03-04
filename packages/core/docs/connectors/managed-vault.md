---
title: 'connectors/Managed Vault'
---

# ManagedVault Connectors

The ManagedVault subsystem provides enterprise-grade secret management with access controls.

## Available Connectors

### SecretManagerManagedVault

**Role**: AWS Secrets Manager with managed access  
**Summary**: Provides managed secret storage using AWS Secrets Manager with fine-grained access control and audit capabilities.

| Setting              | Type   | Required | Default | Description                                       |
| -------------------- | ------ | -------- | ------- | ------------------------------------------------- |
| `region`             | string | Yes      | -       | AWS region for Secrets Manager                    |
| `vaultName`          | string | Yes      | -       | Name identifier for the managed vault             |
| `awsAccessKeyId`     | string | No       | -       | AWS access key ID (can use IAM roles instead)     |
| `awsSecretAccessKey` | string | No       | -       | AWS secret access key (can use IAM roles instead) |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    ManagedVault: {
        Connector: 'SecretManagerManagedVault',
        Settings: {
            region: 'us-east-1',
            vaultName: 'my-managed-vault',
            awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
            awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    },
});
```

**Use Cases:**

-   Enterprise secret management
-   Managed access controls
-   Audit and compliance requirements
-   Multi-tenant secret isolation
-   AWS-integrated environments

**Security Features:**

-   Automatic encryption at rest using AWS KMS
-   Fine-grained IAM access control
-   Audit logging through CloudTrail
-   Automatic secret rotation capabilities
-   Cross-region replication support

---

### NullManagedVault

**Role**: No-operation managed vault connector  
**Summary**: Provides a null implementation for managed vault operations. Used when managed secrets are not required.

| Setting                | Type | Required | Default | Description                                  |
| ---------------------- | ---- | -------- | ------- | -------------------------------------------- |
| _No specific settings_ | any  | No       | -       | NullManagedVault accepts any settings object |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    ManagedVault: {
        Connector: 'NullManagedVault',
        Settings: {},
    },
});
```

**Use Cases:**

-   Development environments
-   Applications without managed secrets
-   Testing scenarios
-   External secret management
-   Simplified deployments

## Managed Vault vs Regular Vault

**Regular Vault**: Basic secret storage and retrieval
**Managed Vault**: Enterprise features with:

-   Access control policies
-   Audit logging
-   Multi-tenant isolation
-   Advanced security features
-   Compliance requirements
