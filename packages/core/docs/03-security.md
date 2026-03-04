---
title: "Security"
---

# SRE Security Model

Security is a foundational, non-negotiable component of the Smyth Runtime Environment. It is not an add-on, but a core tenant of the architecture, enforced at the lowest levels of the system. The entire security model is built upon the **Candidate/ACL (Access Control List) system**.

## The Access Candidate

An **Access Candidate** is the core identity object in SRE's security model. It represents any entity that can request access to a resource. This could be an agent, a user, an automated system process, or any other defined role.

Every single operation that interacts with a protected resource must be associated with an `AccessCandidate`.

The `AccessCandidate` class encapsulates the identity of the requester, typically containing a role and a unique ID.

```typescript
export class AccessCandidate implements IAccessCandidate {
    public role: TAccessRole;
    public id: string;

    private constructor(role: TAccessRole, id: string) {
        this.role = role;
        this.id = id;
    }

    // ... factory methods like agent(), user(), etc.
}
```

> _For the full source code, see `packages/core/src/subsystems/Security/AccessControl/AccessCandidate.class.ts`._

Factory methods are provided to easily construct a candidate for common roles:

-   `AccessCandidate.agent(agentId)`
-   `AccessCandidate.user(userId)`
-   `AccessCandidate.system(processName)`

## The ACL Enforcement Flow

The SRE uses the `AccessCandidate` to enforce access control and create sandboxed environments for resource access, ensuring true multi-tenancy.

Here is the standard enforcement flow when an entity requests a resource:

1.  **Candidate Creation**: An `AccessCandidate` is created to represent the entity making the request (e.g., `AccessCandidate.agent('agent-007')`).
2.  **Connector Request**: The system requests a handle to a service connector (e.g., the `StorageConnector`).
3.  **Scoped Connector**: Instead of returning a global connector, the service returns a new, temporary connector instance that is **scoped to the candidate**. This is done via the `.user(candidate)` method present on all SRE connectors.
4.  **Isolated Operation**: Any actions performed with this scoped connector are now executed within the candidate's isolated context. For example, if two different agents write a file named `data.txt` to storage, the ACL system ensures they are written to two separate, isolated locations (e.g., `s3://bucket/agent-001/data.txt` and `s3://bucket/agent-002/data.txt`).

This design ensures that tenants (agents, users) cannot access or interfere with each other's resources, as the isolation is enforced automatically at the architectural level.
