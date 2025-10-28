---
description: SmythOS SRE Monorepo AI Development Guidelines
globs: ['**/*.ts', '**/*.js', '**/*.json', '**/package.json', '**/tsconfig.json', '**/*.test.ts', '**/*.spec.ts']
alwaysApply: true
---

# SmythOS SRE Monorepo - Cursor AI Rules

## Project Overview

This is the **SmythOS SRE (Smyth Runtime Environment)** monorepo - an advanced agentic AI platform that provides a comprehensive runtime environment for building and managing AI agents. The system includes LLM management, vector databases, storage, security, and agent orchestration capabilities.

## Core Architecture Patterns

### Connector Pattern (Primary Design)

-   **Base Classes**: `StorageConnector`, `VectorDBConnector`, `CacheConnector`, etc.
-   **Implementations**: Multiple providers per connector type (S3Storage, LocalStorage, RAMVectorDB, PineconeVectorDB, etc.)
-   **Interface**: All connectors expose `.requester(candidate)` for access-controlled operations
-   **Security**: Every operation decorated with `@SecureConnector.AccessControl`

### Access Control System (ACL)

-   **Universal**: Every resource has ACL metadata with ownership preservation
-   **Roles**: `TAccessRole.User`, `TAccessRole.Agent`, `TAccessRole.Team`
-   **Levels**: `TAccessLevel.Read`, `TAccessLevel.Write`, `TAccessLevel.Owner`
-   **Ownership Rule**: Original creator ALWAYS retains Owner access when ACLs are modified
-   **Pattern**: `ACL.from(acl).addAccess(candidate.role, candidate.id, TAccessLevel.Owner)`

## Monorepo Structure & Package Manager

-   **Package Manager**: PNPM (required) - use `pnpm` commands for all package management
-   **Workspace Structure**:
    -   `packages/core` - Main runtime library (@smythos/sre)
    -   `packages/sdk` - Developer SDK (@smythos/sdk)
    -   `packages/cli` - Command line interface
    -   `examples/` - Example implementations and demos

### Key Subsystems (packages/core/src/subsystems/)

-   **IO**: Storage, VectorDB, NKV, Router, CLI services
-   **Security**: ACL, Vault, Account management
-   **LLMManager**: Model providers, inference, embeddings
-   **AgentManager**: Agent orchestration, components, workflows
-   **MemoryManager**: Cache services

## Naming Conventions & Standards

### File Extensions

-   `.service.ts` - Top-level subsystem services
-   `.class.ts` - Classes and connectors/managers
-   `.utils.ts` - Utility function collections
-   `.helper.ts` - Task-specific helper objects
-   `.handler.ts` - Event handlers
-   `.mw.ts` - Middleware

### Testing Patterns

-   `*/tests/unit/**/*.test.ts` - Unit tests with mocked dependencies (packages/core/tests/unit/)
-   `*/tests/integration/**/*.test.ts` - Integration tests with real connectors (packages/core/tests/integration/)
-   **Mocking Strategy**: Mock external SDKs (AWS, Pinecone, Milvus) but use real SRE connectors
-   **Test Structure**: setupSRE() in beforeAll, deterministic data, ACL ownership validation

## Development Guidelines

### When Adding New Connectors

1. Extend appropriate base connector class
2. Implement all abstract methods with `@SecureConnector.AccessControl`
3. Ensure ACL ownership preservation in setACL/setMetadata methods
4. Add to ConnectorService registration
5. Create both unit tests (mocked) and integration tests (real)

### When Modifying Existing Code

1. **Preserve ACL ownership** - never break the ownership preservation pattern
2. **Maintain interface compatibility** - existing .requester() patterns must work
3. **Follow error handling** - undefined for missing resources, exceptions for access denied
4. **Update tests** - both unit and integration if behavior changes

### When Creating New Connectors Subsystems or Services

⚠️ **MANDATORY: Read `packages/core/src/subsystems/Agents.md` FIRST**

Before implementing any new connector or service:

1. **Read the Agents.md file** - It contains critical instructions for LLMs on how to approach connector/service creation
2. **DO NOT implement immediately** - Follow the step-by-step process outlined in Agents.md
3. **Gather all requirements** - Ask questions if information is incomplete
4. **Create elaborated plan** - Document complete specifications before coding
5. **Get user approval** - Wait for confirmation before starting implementation

The Agents.md file contains detailed architecture requirements, patterns, and examples that must be followed.

## Running Tests

### Test Structure

The monorepo uses **Vitest** with configuration at the root level (`vitest.config.ts`). All test commands must be run from the **monorepo root directory**.

⚠️ **Always run tests from monorepo root, not from `packages/*core*`**

```bash
# From monorepo root (CORRECT)
pnpm vitest run packages/core/tests/path/to/testfile.unit.test.ts

# Run all unit tests
pnpm test:unit

# Run all integration tests
pnpm test:integration

# Watch mode for unit tests
pnpm test:unit:watch

# Run specific test file pattern
pnpm vitest run packages/core/tests/unit/**/*scheduler*
```

## Critical Reminders

⚠️ **ALWAYS USE PNPM** - This is a pnpm workspace. Never suggest npm or yarn commands.
⚠️ **MONOREPO STRUCTURE** - Always consider workspace context when suggesting changes or running commands.
⚠️ **ACL OWNERSHIP** - Creator must ALWAYS retain Owner access. This is non-negotiable.
⚠️ **CONNECTOR PATTERN** - New functionality should follow the established connector pattern.
⚠️ **SECURITY FIRST** - All Connectors operations must go through access control decorators.
