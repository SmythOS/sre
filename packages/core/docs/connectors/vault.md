# Vault Connectors

The Vault subsystem provides secure storage and management of sensitive information such as API keys, passwords, tokens, and other secrets. It ensures encrypted storage and controlled access to confidential data.

## Available Connectors

### JSONFileVault

**Role**: File-based secure vault connector  
**Summary**: Provides encrypted local file storage for secrets using JSON format. Suitable for development environments and single-node deployments requiring basic secret management.

| Setting  | Type   | Required | Default               | Description                                   |
| -------- | ------ | -------- | --------------------- | --------------------------------------------- |
| `file`   | string | No       | `~/.smyth/vault.json` | Path to the vault file                        |
| `shared` | string | No       | `"default"`           | Shared team name for cross-team secret access |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './secrets/vault.json',
            shared: 'production',
        },
    },
});
```

**vault.json research path:**
The JSONFileVault connector will search for the vault.json file in the following order:

1. The path specified in the `file` setting
2. The `.smyth/vault.json` file
3. The `.smyth/vault/vault.json` file
4. The `.smyth/.sre/vault.json` file
5. The `~/.smyth/vault.json` file
6. The `~/.smyth/vault/vault.json` file
7. The `~/.smyth/.sre/vault.json` file

The search paths and the used path are visible in SRE logs in case you need to debug the vault file search.

**Use Cases:**

-   Development and testing environments
-   Single-node applications
-   Simple secret management requirements
-   Local development workflows
-   Small teams with basic security needs

**Security Notes:**

-   Vault file is encrypted using AES-256
-   Keep encryption key secure and separate from vault file
-   Use proper file permissions (600) for vault and key files
-   Consider using environment variables for sensitive paths

---

### SecretsManager

**Role**: AWS Secrets Manager connector  
**Summary**: Provides integration with AWS Secrets Manager for enterprise-grade secret storage with automatic rotation, fine-grained access control, and audit logging.

| Setting              | Type   | Required | Default | Description                                       |
| -------------------- | ------ | -------- | ------- | ------------------------------------------------- |
| `region`             | string | Yes      | -       | AWS region where secrets are stored               |
| `awsAccessKeyId`     | string | No       | -       | AWS access key ID (can use IAM roles instead)     |
| `awsSecretAccessKey` | string | No       | -       | AWS secret access key (can use IAM roles instead) |
| `prefix`             | string | No       | smythos | Prefix to add to the secret name                  |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Vault: {
        Connector: 'SecretsManager',
        Settings: {
            region: 'us-east-1',
            awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
            awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            prefix: 'smythos', // Optional, defaults to 'smythos'
        },
    },
});
```

**Secret Naming Convention:**

The SecretsManager connector uses a structured naming format to organize secrets in AWS Secrets Manager:

**Format:** `<prefix>/<teamId>/<secretName>`

-   **prefix**: Namespace for SRE secrets (default: `"smythos"`)
-   **teamId**: Team identifier (default: `"default"`)
-   **secretName**: Name of the secret (e.g., `"openai"`, `"anthropic"`, `"custom-key"`)

**Examples:**

1. **Agent with default team** (no `teamId` specified):

    ```typescript
    const agent = new Agent({
        id: 'my-agent',
        behavior: '...',
        model: 'gpt-4o',
    });
    ```

    Secret path in AWS: `smythos/default/openai`

2. **Agent with custom team**:

    ```typescript
    const agent = new Agent({
        id: 'my-agent',
        behavior: '...',
        teamId: 'team-id-0001',
        model: 'gpt-4o',
    });
    ```

    Secret path in AWS: `smythos/team-id-0001/openai`

This structure enables multi-tenant configurations where different teams can have isolated API keys and secrets, allowing for fine-grained access control and billing separation.

**Use Cases:**

-   Production environments requiring enterprise security
-   Multi-region deployments
-   Applications with compliance requirements
-   Automatic secret rotation needs
-   Integration with AWS ecosystem

**Security Features:**

-   Automatic encryption at rest using AWS KMS
-   Fine-grained IAM access control
-   Audit logging through CloudTrail
-   Automatic secret rotation capabilities
-   Cross-region replication support

---

### NullVault

**Role**: No-operation vault connector  
**Summary**: Provides a null implementation that discards all vault operations. Used for testing or when secret management is handled externally.

| Setting                | Type | Required | Default | Description                           |
| ---------------------- | ---- | -------- | ------- | ------------------------------------- |
| _No specific settings_ | any  | No       | -       | NullVault accepts any settings object |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Vault: {
        Connector: 'NullVault',
        Settings: {},
    },
});
```

**Use Cases:**

-   Testing environments
-   Development with external secret management
-   Applications using environment variables only
-   Debugging vault-related issues

## Vault Operations

All vault connectors support these standard operations:

| Operation           | Description                |
| ------------------- | -------------------------- |
| `get(keyId)`        | Retrieve a secret value    |
| `set(keyId, value)` | Store a secret value       |
| `delete(keyId)`     | Remove a secret            |
| `exists(keyId)`     | Check if secret exists     |
| `list()`            | List all available secrets |

## Security Best Practices

### General Guidelines

-   Never store secrets in code or configuration files
-   Use environment variables for connector credentials
-   Implement proper access controls and permissions
-   Regular audit and rotate secrets
-   Use separate vaults for different environments

### JSONFileVault Security

-   Store vault files outside of version control
-   Use strong encryption keys (256-bit minimum)
-   Set restrictive file permissions (600)
-   Regular backup encrypted vault files
-   Consider using hardware security modules for keys

### SecretsManager Security

-   Use IAM roles instead of access keys when possible
-   Implement least-privilege access policies
-   Enable CloudTrail for audit logging
-   Use KMS customer-managed keys for encryption
-   Implement secret rotation policies

## Integration Examples

### Environment Variable Fallback

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: process.env.VAULT_PATH || './.smyth/vault.json',
            fileKey: process.env.VAULT_KEY_PATH,
        },
    },
});
```

### Multi-Environment Setup

```typescript
import { SRE } from '@smythos/sre';

// Development
SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            shared: 'development',
        },
    },
});

// Production
SRE.init({
    Vault: {
        Connector: 'SecretsManager',
        Settings: {
            region: 'us-east-1',
        },
    },
});
```
