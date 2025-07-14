# SmythOS Studio

The Studio UI fetches available components from a running instance of the Studio
Server. By default the server listens on `http://localhost:3010`.

## Getting Started

1. **Build the SRE and dependencies**

   ```bash
   pnpm build
   ```

2. **Start the Studio Server**

   ```bash
   pnpm --filter @smythos/studio-server dev
   ```

3. **Run the Studio app in another terminal**

   ```bash
   pnpm --filter @smythos/studio dev
   ```

Once both are running the Studio will load components from
`http://localhost:3010/components`. Keep the server running whenever you use the
Studio; otherwise component loading will fail. The UI is served by Vite on
`http://localhost:5173` by default.

### Using the Interface

- **Component buttons** in the left sidebar add new nodes to the canvas.
- **Prompt field** lets you enter a prompt that will be passed to the workflow
  when executed.
- **Execute** runs the current workflow with the prompt you entered.
- **Save** stores the current workflow on the Studio Server.
- **Load** retrieves a previously saved workflow from the server.

Selecting a node opens a panel on the right where you can edit its parameters.
If the node does not feed into any others, an **Output Path** field appears to
save its result to disk. Connect nodes by dragging from a node's right handle to
another node's left handle.

### Hello World Example

1. Launch the Studio Server and app as described above.
2. Click **HTTPCall** in the sidebar to add the node.
3. Select the node and set `method` to `GET` and `url` to
   `https://httpbin.org/get`.
4. Specify an output path such as `./output.json`.
5. Press **Execute** to run the workflow. The JSON response from httpbin will be
   written to `output.json`.

For details on the available server endpoints and payloads see the
[Studio Server README](../studio-server/README.md).

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
