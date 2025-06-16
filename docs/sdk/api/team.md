# Team

`Team` represents a group of agents sharing the same storage and vector database scope.

```typescript
import { Team } from '@smythos/sdk';

const team = new Team('team-001');
const agent = team.addAgent({ name: 'Assistant', model: 'gpt-4o' });
```

You can also access team-scoped helpers:

```typescript
const storage = team.storage.LocalStorage();
const vec = team.vectorDB.RAMVec('demo');
```
