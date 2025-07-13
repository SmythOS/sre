# SmythOS Studio

The Studio UI fetches available components from a running instance of the Studio Server. By default the server listens on `http://localhost:3010`.

To start the server in development run:

```bash
pnpm --filter @smythos/studio-server dev
```

Once running the Studio will load components from `http://localhost:3010/components`.
