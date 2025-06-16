# Provider Enums

The SDK exposes enumerations for built-in providers.

```ts
export const TStorageProvider = {
    LocalStorage: 'LocalStorage',
    S3: 'S3',
} as const;

export const TVectorDBProvider = {
    Pinecone: 'Pinecone',
    RAMVec: 'RAMVec',
} as const;
```
