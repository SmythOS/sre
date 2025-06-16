# Storage and StorageInstance

`Storage` is a collection of factory functions that create `StorageInstance` objects for different backends.

```typescript
import { Storage } from '@smythos/sdk';

const local = Storage.LocalStorage();
await local.write('data.txt', 'hello');
```

When accessed from an agent or team, the data owner is set automatically.

```typescript
const uri = await agent.storage.LocalStorage().write('secret.txt', '42');
```

`StorageInstance` exposes `read`, `write`, `delete` and `exists` methods.
