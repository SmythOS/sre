# SmythOS Studio

The Studio UI fetches available components from a running instance of the Studio Server. By default the server listens on `http://localhost:3010`.

To start the server in development run:

```bash
pnpm --filter @smythos/studio-server dev
```

Once running the Studio will load components from `http://localhost:3010/components`.
Make sure the server remains running whenever you use the Studio; otherwise component loading will fail.

## Workflow Serialization

The Studio converts visual workflows into the JSON format accepted by `Agent.import` before execution. The `serializeWorkflow` utility produces objects with the following structure:

```json
{
  "version": "1.0.0",
  "components": [
    { "id": "1", "name": "TextInput", "data": { "placeholder": "hi" } }
  ],
  "connections": [
    { "sourceId": "1", "sourceIndex": 0, "targetId": "2", "targetIndex": 0 }
  ]
}
```

This payload is sent to the studio server for execution and can be loaded directly with `Agent.import`.
