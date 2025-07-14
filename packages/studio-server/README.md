# SmythOS Studio Server

This package exposes a lightweight Express server used by the SmythOS studio.

## Running

### Environment Variables

Before launching the server make sure the required API keys are available in the
environment. At minimum you need an `OPENROUTER_API_KEY` so the runtime can make
LLM requests. Workflows that use other connectors (for example Neon/PostgreSQL)
require additional variables such as `NEON_HOST`, `NEON_USER`, `NEON_PASSWORD`
and `NEON_DATABASE`.

You can store these in a `.env` file:

```bash
OPENROUTER_API_KEY=your-openrouter-key
NEON_HOST=your-neon-host
NEON_USER=your-neon-user
NEON_PASSWORD=your-neon-password
NEON_DATABASE=your-database
```

Export the variables before starting the server:

```bash
export $(grep -v '^#' .env | xargs)
pnpm --filter @smythos/studio-server dev
```

By default the server listens on port `3010`. Once running you can list the
available components with:

```bash
curl http://localhost:3010/components
```

This endpoint returns an array of component descriptors. Each entry contains the
component `name`, the configurable `settings` schema and any expected `inputs`.
Example response:

```json
[
  {
    "name": "TextInput",
    "settings": { "placeholder": { "type": "string" } },
    "inputs": {}
  }
]
```

## API

### `POST /execute`

Execute a workflow sent in the request body. The payload must include a
`workflow` object matching the SmythOS agent schema and an optional `prompt`
string. You can also specify `outputPaths` to save terminal node output to disk.
The server imports the workflow using `Agent.import`, runs it with the provided
prompt and returns the result as JSON.

Example request:

```bash
curl -X POST http://localhost:3010/execute \
  -H 'Content-Type: application/json' \
  -d '{"workflow": {"version":"1.0.0","components":[],"connections":[]}, "prompt": "Hello"}'
```

The `workflow` object must include a `version` and arrays of `components` and
`connections` as shown below:

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

## GitCommit Node Tutorial

The server includes a `GitCommit` component for saving repository changes. The node takes two settings:

- `repoPath` – path to the local Git repository
- `message` – commit message

When executed the server adds all modified files and creates a commit using the Git connector.

A minimal workflow demonstrating the node can be found at `packages/studio-server/workflows/git-commit.smyth`. It clones a repository, appends text to a file and then commits the update.

