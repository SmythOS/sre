# SRE Security Model Documentation

## Table of Contents

-   [Overview](#overview)
-   [Core Concepts](#core-concepts)
    -   [Access Control List (ACL)](#access-control-list-acl)
    -   [Access Levels and Roles](#access-levels-and-roles)
    -   [Access Candidate](#access-candidate)
    -   [Access Request](#access-request)
-   [SecureConnector](#secureconnector)
    -   [Key Responsibilities](#key-responsibilities)
    -   [Decorators](#decorators)
-   [Using the `user()` Method](#using-the-user-method)
-   [Implementing a New Connector](#implementing-a-new-connector)
    -   [Steps to Implement a New Connector](#steps-to-implement-a-new-connector)
    -   [Example Implementation: LocalStorage](#example-implementation-localstorage)
-   [Best Practices](#best-practices)
-   [Conclusion](#conclusion)

---

## Overview

Smyth Runtime Environment (SRE) employs a robust security model centered around Access Control Lists (ACLs) to manage and enforce permissions across various connectors and components. This documentation provides a comprehensive guide to understanding the SRE security model, implementing secure connectors, and utilizing the provided tools to ensure consistent and effective access control within your applications.

## Core Concepts

### Access Control List (ACL)

An **Access Control List (ACL)** is a data structure that specifies the permissions associated with various roles and entities (candidates) for accessing resources. ACLs define what actions each role or user can perform on a resource, ensuring fine-grained access control.

-   **Roles**: Predefined categories such as Team, Agent, or User.
-   **Access Levels**: Define the granularity of permissions, e.g., Read, Write, Owner.

**Example ACL Entry:**

```typescript
{
  role: TAccessRole.Team,
  id: 'team1',
  levels: [TAccessLevel.Read, TAccessLevel.Write]
}
```

### Access Levels and Roles

-   **TAccessLevel**: Enumerates the levels of access.

    -   `Read`: Permission to view the resource.
    -   `Write`: Permission to modify the resource.
    -   `Owner`: Highest level of access, including full control.

-   **TAccessRole**: Enumerates the roles that can be assigned access.
    -   `Team`: Represents a group or team.
    -   `Agent`: Represents an individual agent or user.
    -   `User`: Represents a general user.

### Access Candidate

An **Access Candidate** is an entity requesting access to a resource. It can represent a user, agent, or any other entity defined within the system.

**Example:**

```typescript
const agentCandidate = AccessCandidate.agent('agent-123456');
```

### Access Request

An **Access Request** encapsulates the details of an access attempt, including the candidate, the resource identifier, and the desired action.

**Example:**

```typescript
const accessRequest = new AccessRequest(candidate, resourceId, TAccessLevel.Read);
```

## SecureConnector

`SecureConnector` is an abstract class that integrates access control logic into connector implementations. It extends the base `Connector` class and leverages ACLs to enforce security policies automatically.

### Key Responsibilities

1. **Loading and Evaluating ACLs**: Retrieves ACLs for resources and evaluates access based on incoming requests.
2. **Enforcing Access Control**: Utilizes decorators to inject access control checks into connector methods.
3. **Abstract Method Implementation**: Requires subclasses to implement specific methods for ACL retrieval.

### Decorators

-   **`@SecureConnector.AccessControl`**: A method decorator that injects access control logic into connector methods. It ensures that before any method execution, the access request is validated against the ACL.

**Example Usage:**

```typescript:src/subsystems/IO/Storage.service/connectors/S3Storage.class.ts
@SecureConnector.AccessControl
public async read(acRequest: AccessRequest, resourceId: string) {
    // Method implementation
}
```

### Best Practice : Using the `user()` Method

The `user()` method is a best practice utilized by existing connectors such as **Storage** and **Cache** within the SRE framework.

The `user()` method provides a streamlined interface for performing operations with enforced access control. It abstracts the complexity of constructing access requests, allowing developers to interact with resources using a friendly syntax. If you are implementing a new category of connectors, it is recommended to follow the existing pattern and provide a `user()` method for your connectors (see StorageConnector.class.ts for an example).

**Example Usage:**

```typescript:src/subsystems/IO/Storage.service/connectors/S3Storage.class.ts
const storage = ConnectorService.getStorageConnector();
const agent = AccessCandidate.agent('agent-123456');

await storage.user(agent).write('path/to/resource', 'Data');
const data = await storage.user(agent).read('path/to/resource');
```

In this example:

-   **`user(agent)`**: Initializes a storage request scoped to the specified agent.
-   **`.write()` / `.read()`**: Performs operations with access control automatically enforced based on the agent's permissions.

**Example with Cache Connector:**

```typescript:src/subsystems/IO/Cache.service/connectors/CacheConnector.class.ts
const cache = ConnectorService.getCacheConnector();
const userCandidate = AccessCandidate.user('user-7890');

await cache.user(userCandidate).set('cacheKey', 'cacheValue');
const cachedValue = await cache.user(userCandidate).get('cacheKey');
```

## Implementing a New Connector

When creating a new connector, developers can leverage the SRE security model to ensure that access control is handled seamlessly. The primary responsibility is to define how ACLs are retrieved and managed for the resources the connector handles.

### Steps to Implement a New Connector

1. **Extend `SecureConnector`**: Your connector class should inherit from `SecureConnector` to gain access to the security features.
2. **Implement `getResourceACL` Method**: This abstract method must be implemented to define how ACLs are retrieved or constructed for a given resource and candidate.
3. **Decorate Sensitive Methods**: Apply the `@SecureConnector.AccessControl` decorator to methods that require access control enforcement.
4. **Utilize the `user()` Method**: Provide a user-friendly API for performing operations with enforced access control.

### Example Implementation: LocalStorage

Below is an example of implementing a `LocalStorage` connector that manages files on the local filesystem.

```typescript:src/subsystems/IO/Storage.service/connectors/LocalStorage.class.ts
import { promises as fs } from 'fs';
import path from 'path';
import { StorageConnector, IStorageRequest } from '@sre/IO/Storage.service/StorageConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';
import { TAccessLevel, IACL, IAccessCandidate } from '@sre/types/ACL.types';
import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('LocalStorage');

export class LocalStorage extends StorageConnector {
    public name = 'LocalStorage';
    private basePath: string;

    constructor(basePath: string) {
        super();
        this.basePath = basePath;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        const filePath = path.join(this.basePath, resourceId);
        try {
            await fs.access(filePath);
            // Read ACL from file metadata or define default ACL
            // For simplicity, returning a default ACL granting read access
            return new ACL().addAccess(TAccessRole.User, candidate.id, TAccessLevel.Read);
        } catch {
            // File does not exist, grant owner access to the candidate
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }
    }

    @SecureConnector.AccessControl
    protected async read(acRequest: AccessRequest, resourceId: string): Promise<StorageData> {
        const filePath = path.join(this.basePath, resourceId);
        const data = await fs.readFile(filePath, 'utf-8');
        return data;
    }

    @SecureConnector.AccessControl
    protected async write(acRequest: AccessRequest, resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void> {
        const filePath = path.join(this.basePath, resourceId);
        await fs.writeFile(filePath, value, 'utf-8');
        if (acl) {
            // Implement setting ACL metadata as per your storage mechanism
        }
        if (metadata) {
            // Implement setting additional metadata
        }
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, resourceId: string): Promise<void> {
        const filePath = path.join(this.basePath, resourceId);
        await fs.unlink(filePath);
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, resourceId: string): Promise<boolean> {
        const filePath = path.join(this.basePath, resourceId);
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    @SecureConnector.AccessControl
    protected async getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined> {
        // Implement metadata retrieval
        return undefined;
    }

    @SecureConnector.AccessControl
    protected async setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata): Promise<void> {
        // Implement metadata setting
    }

    @SecureConnector.AccessControl
    protected async getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined> {
        // Implement ACL retrieval
        return undefined;
    }

    @SecureConnector.AccessControl
    protected async setACL(acRequest: AccessRequest, resourceId: string, acl: IACL): Promise<void> {
        // Implement ACL setting
    }
}
```

### Explanation

-   **Inheritance**: `LocalStorage` extends `StorageConnector`, inheriting security features from `SecureConnector`.
-   **`getResourceACL` Implementation**: Determines if the file exists. If it does, returns a default ACL granting read access. If not, grants owner-level access to the requesting candidate.
-   **Decorated Methods**: Methods like `read`, `write`, and `delete` are decorated with `@SecureConnector.AccessControl` to enforce access control automatically.
-   **User-Friendly API**: Operations are performed via the `user()` method, which handles access requests internally.

## Best Practices

-   **Implement `getResourceACL` Carefully**: This method defines the access control behavior. Ensure it accurately reflects your access policies and correctly distinguishes between existing and new resources.
-   **Leverage Decorators**: Use the `@SecureConnector.AccessControl` decorator on all methods that require access control to maintain consistency and reduce boilerplate code.
-   **Utilize the `user()` Method**: Perform operations through the `user()` interface to ensure access requests are properly constructed and evaluated. This approach is already adopted by **Storage** and **Cache** connectors, promoting consistency and ease of use across different components.
-   **Avoid Direct ACL Manipulation**: Trust `SecureConnector` to handle access control logic. Do not directly interact with ACL internals to prevent bypassing security checks.
-   **Maintain Consistent ACL Definitions**: Ensure uniformity in ACL definitions across different connectors to provide a predictable and secure access control environment.

## Conclusion

The SRE security model, built upon ACLs and facilitated by the `SecureConnector` class, offers a powerful and flexible framework for enforcing access control across various connectors. By abstracting security logic through decorators and providing intuitive interfaces like `user()`, SRE enables developers to implement secure connectors with ease and consistency. Adhering to the guidelines and best practices outlined in this documentation will ensure that your connectors are both secure and maintainable within the SRE ecosystem.
