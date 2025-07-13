# SmythOS Studio Server

This package exposes a lightweight Express server used by the SmythOS studio.

## Running

Start the development server:

```bash
pnpm --filter @smythos/studio-server dev
```

By default the server listens on port `3010`. Once running you can list the
available components with:

```bash
curl http://localhost:3010/components
```
