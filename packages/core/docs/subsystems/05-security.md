---
title: 'subsystems/Security'
---

# Security Subsystem

The Security Subsystem is responsible for managing the core security primitives of the SRE, specifically focusing on identity, authentication, and secret management. It works in close conjunction with the [SRE Security Model](../security.md) to provide a comprehensive security posture.

All services within the Security subsystem are accessed via the `SRE.Security` namespace.

## Core Security Services

### Vault

The Vault service provides a secure, unified interface for storing and retrieving secrets, such as API keys, database passwords, and other sensitive credentials. By using the Vault service, agents and the SRE core can avoid hardcoding secrets in configuration or code.

The connector model allows the SRE to fetch secrets from various secure backends without changing the application logic.

-   **Interface**: `IVaultConnector`
-   **Service Access**: `SRE.Security.Vault`
-   **Common Connectors**: `JSONFileVaultConnector` (for local development), `HashiCorpVaultConnector`, `AWSSecretsManagerConnector`

### Account

The Account service is responsible for managing identity and authentication. It provides a way to verify the identity of a user or agent and to manage their associated data.

This service is critical for any multi-user or multi-agent environment where authentication is required before granting access to resources.

-   **Interface**: `IAccountConnector`
-   **Service Access**: `SRE.Security.Account`
-   **Common Connectors**: `DummyAccountConnector` (for local development, allows all access), `JSONFileAccountConnector`
