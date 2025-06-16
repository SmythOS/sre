# Doc and DocParser

`Doc` is a collection of helper functions for parsing files into structured documents. The returned instance exposes a `.parse()` method which extracts text, metadata and optional images from the source.

```typescript
import { Doc } from '@smythos/sdk';

const parsed = await Doc.pdf('file.pdf').parse();
console.log(parsed.title);
```

Supported factories include `pdf`, `docx`, `md` and `text`. See [`doc-parser.ts`](../../examples/04-VectorDB-no-agent/doc-parser.ts) for a working script.
