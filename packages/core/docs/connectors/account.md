---
title: 'connectors/Account Management'
---

# Account Connectors

The Account subsystem in SRE provides team membership checks and settings retrieval for teams, users, and agents. It does not implement authentication flows or user management; instead, connectors expose a consistent API for access control context and key-value settings.

## Available Connectors

### DummyAccount

**Role**: In-memory development connector  
**Summary**: Minimal, development-only connector that keeps data in memory (seeded from settings). Everyone is a member of the default team. Supports key-value settings lookup for teams, users, and agents. No authentication, permissions, or persistence.

| Setting | Type   | Required | Default | Description                                      |
| ------- | ------ | -------- | ------- | ------------------------------------------------ |
| `data`  | object | No       | `{}`    | Initial in-memory dataset. See Data Model below. |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Account: {
        Connector: 'DummyAccount',
        Settings: {
            data: {
                default: {
                    users: { 'user-1': { settings: { theme: 'dark' } } },
                    agents: { 'agent-1': { settings: { canCallTools: 'true' } } },
                    settings: { orgMode: 'test' },
                },
            },
        },
    },
});
```

---

### JSONFileAccount

**Role**: JSON file–backed account/settings connector  
**Summary**: Loads a JSON file from disk and exposes the same membership and settings APIs as `DummyAccount`. Good for reproducible local/dev setups where you want persisted data without a database.

| Setting | Type   | Required | Default | Description                 |
| ------- | ------ | -------- | ------- | --------------------------- |
| `file`  | string | Yes      | -       | Path to the JSON data file. |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Account: {
        Connector: 'JSONFileAccount',
        Settings: {
            file: './.smyth/account.json',
        },
    },
});
```

**Notes:**

-   Everyone is a member of the default team.
-   `getResourceACL` is not implemented.

---

### AWSAccount

**Role**: Database-backed example connector (placeholder)  
**Summary**: Despite the name, the current implementation uses MySQL via `mysql2/promise`. It demonstrates how to fetch team settings from a database table. Several methods are still unimplemented.

| Setting    | Type   | Required | Default | Description             |
| ---------- | ------ | -------- | ------- | ----------------------- |
| `host`     | string | Yes      | -       | Database host.          |
| `password` | string | Yes      | -       | Database user password. |
| `database` | string | No       | `app`   | Database name.          |
| `user`     | string | No       | `app`   | Database user.          |

**Behavior:**

-   `getAllTeamSettings` reads rows from `TeamSettings` and maps `{ key, value }`.
-   `getTeamSetting` selects a single key from `TeamSettings`.
-   `isTeamMember` returns `true` for all inputs (placeholder).
-   `getCandidateTeam` returns the team ID if the candidate role is Team; otherwise default team.
-   `getResourceACL`, `getAllUserSettings`, `getUserSetting`, `getAgentSetting` are not implemented.

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Account: {
        Connector: 'AWSAccount',
        Settings: {
            host: process.env.DB_HOST!,
            user: process.env.DB_USER || 'app',
            password: process.env.DB_PASSWORD!,
            database: process.env.DB_NAME || 'app',
        },
    },
});
```

## Connector Operations

All account connectors extend a common base and expose these operations:

| Operation                                 | Description                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `isTeamMember(teamId, candidate)`         | Whether a candidate belongs to a team (default team usually allows all). |
| `getCandidateTeam(candidate)`             | Resolves the team for a candidate.                                       |
| `getAllTeamSettings(request, teamId)`     | Returns team settings as a list of `{ key, value }`.                     |
| `getAllUserSettings(request, accountId)`  | Returns user settings as a list of `{ key, value }`.                     |
| `getTeamSetting(request, teamId, key)`    | Returns a single team setting value.                                     |
| `getUserSetting(request, accountId, key)` | Returns a single user setting value.                                     |
| `getAgentSetting(request, agentId, key)`  | Returns a single agent setting value.                                    |
| `getResourceACL(resourceId, candidate)`   | Returns an ACL object (not implemented by the current connectors).       |

### Data Model (DummyAccount, JSONFileAccount)

Both connectors use the same simple data model:

```json
{
    "<teamId>": {
        "users": {
            "<userId>": { "settings": { "key": "value" } }
        },
        "agents": {
            "<agentId>": { "settings": { "key": "value" } }
        },
        "settings": { "key": "value" }
    }
}
```

The default team ID is used as a catch-all when a candidate is not explicitly associated with another team.

## Security Notes

-   DummyAccount: development-only. Do not use in production.
-   JSONFileAccount: store files outside web roots; set restrictive file permissions; back up regularly.
-   AWSAccount (placeholder): store DB credentials securely (e.g., Vault); use least-privilege DB users; add proper membership checks before production use.

## Integration Examples

### Environment-Based Configuration

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Account: {
        Connector: process.env.NODE_ENV === 'production' ? 'AWSAccount' : 'JSONFileAccount',
        Settings:
            process.env.NODE_ENV === 'production'
                ? {
                      host: process.env.DB_HOST!,
                      user: process.env.DB_USER || 'app',
                      password: process.env.DB_PASSWORD!,
                      database: process.env.DB_NAME || 'app',
                  }
                : {
                      file: './.smyth/account.json',
                  },
    },
});
```

### Multi-Connector Setup

```typescript
import { SRE } from '@smythos/sre';

// Development
SRE.init({
    Account: {
        Connector: 'JSONFileAccount',
        Settings: {
            file: './dev-account.json',
        },
    },
});

// Production (placeholder)
SRE.init({
    Account: {
        Connector: 'AWSAccount',
        Settings: {
            host: 'db.internal',
            user: 'app',
            password: '***',
            database: 'app',
        },
    },
});
```
