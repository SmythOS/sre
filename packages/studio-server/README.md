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

## API

### `POST /execute`

Execute a workflow sent in the request body. The payload must include a
`workflow` object matching the SmythOS agent schema and an optional `prompt`
string. The server imports the workflow using `Agent.import`, runs it with the
provided prompt and returns the result as JSON.

Example request:

```bash
curl -X POST http://localhost:3010/execute \
  -H 'Content-Type: application/json' \
  -d '{"workflow": {"version":"1.0.0","components":[],"connections":[]}, "prompt": "Hello"}'
```
