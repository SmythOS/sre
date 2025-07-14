Command line interface for SmythOS SRE (Smyth Runtime Environment) - an advanced agentic AI platform that provides a comprehensive runtime environment for building and managing AI agents.

## Installation

```bash
pnpm install -g @smythos/cli
```

If installation fails with errors about `cpufeatures.node`, rebuild the optional
native dependency used by `ssh2`:

```bash
pnpm rebuild ssh2 --unsafe-perm
```

## Commands Overview

The SRE CLI provides several commands:

-   `sre agent` - Run SmythOS agent files with various execution modes
-   `sre create` - Create new SmythOS projects
-   `sre update` - Update the CLI and check for updates
-   `sre workflow save` - Export an agent workflow to a file
-   `sre workflow load` - Import a workflow from a file or template

## Workflow Command

Manage agent workflows from the CLI.

### Save

```bash
sre workflow save <agent.smyth> <file>
```

Export the workflow of the specified agent to `<file>` for sharing or version control.

### Load

```bash
sre workflow load <file-or-template>
```

Load a workflow definition from `<file-or-template>` back into an agent. You can also provide a template name instead of a file path.

### Templates

The CLI includes a few starter workflow templates located in the `templates/` folder:

- `echo` - A minimal agent that simply echoes back any prompt.
- `crypto-info` - An agent that fetches cryptocurrency prices from a public API.

You can load a template directly:

```bash
sre workflow load echo
```

---

## Agent Command

Run SmythOS agent files (.smyth) with different execution modes.

### Basic Usage

```bash
sre agent <path-to-agent.smyth> [options]
```

### Available Modes

#### 1. Chat Mode (`--chat`)

Start an interactive chat interface with the agent:

```bash
sre agent ./myagent.smyth --chat
sre agent ./myagent.smyth --chat claude-3.7-sonnet
sre agent ./myagent.smyth --chat gpt-4o
```

**Options:**

-   `--chat` - Start chat with default model (gpt-4o)
-   `--chat <model>` - Start chat with specified model

#### 2. Prompt Mode (`--prompt`)

Query the agent with a single prompt:

```bash
sre agent ./myagent.smyth --prompt "What is the weather in Tokyo?"
sre agent ./myagent.smyth --prompt "Analyze this data" claude-3.7-sonnet
```

**Options:**

-   `--prompt <text>` - Send a prompt to the agent
-   `--prompt <text> <model>` - Send a prompt using specific model

#### 3. Skill Execution (`--skill`)

Execute a specific skill from the agent:

```bash
sre agent ./myagent.smyth --skill getUserInfo
sre agent ./myagent.smyth --skill processData input="sample data" format="json"
sre agent ./myagent.smyth --skill ask question="who are you"
```

**Options:**

-   `--skill <skillname>` - Execute a skill without parameters
-   `--skill <skillname> key1="value1" key2="value2"` - Execute skill with parameters

#### 4. MCP Server Mode (`--mcp`)

Start the agent as an MCP (Model Context Protocol) server:

```bash
sre agent ./myagent.smyth --mcp
sre agent ./myagent.smyth --mcp stdio
sre agent ./myagent.smyth --mcp sse 3388
```

**Options:**

-   `--mcp` - Start MCP server with default settings (stdio)
-   `--mcp stdio` - Start MCP server using stdio transport
-   `--mcp sse` - Start MCP server using SSE transport (default port 3388)
-   `--mcp sse <port>` - Start MCP server using SSE transport on specified port

### Global Options

These options work with all execution modes:

#### Vault Configuration (`--vault`)

Provide a vault file for secure credential storage:

```bash
sre agent ./myagent.smyth --chat --vault ./secrets.vault
sre agent ./myagent.smyth --skill getUserInfo --vault ./myvault.json
```

#### Models Configuration (`--models`)

Specify custom models configuration:

```bash
sre agent ./myagent.smyth --chat --models ./custom-models.json
sre agent ./myagent.smyth --prompt "Hello" --models ./prod-models.json
```

### Complete Examples

```bash
# Interactive chat with custom vault
sre agent ./agent.smyth --chat --vault ./secrets.vault

# Execute skill with parameters and vault
sre agent ./agent.smyth --skill processData input="test" format="json" --vault ./vault.json

# One-time prompt with specific model and custom models config
sre agent ./agent.smyth --prompt "Summarize this data" claude-3.7-sonnet --models ./models.json

# Start MCP server with vault authentication
sre agent ./agent.smyth --mcp sse 8080 --vault ./secrets.vault

# Chat with multiple configurations
sre agent ./agent.smyth --chat gpt-4o --vault ./vault.json --models ./models.json
```

---

## Create Command

Create a new SmythOS project with interactive setup:

```bash
sre create
sre create "My AI Project"
```

**Features:**

-   Interactive project setup wizard
-   Multiple project templates:
    -   Empty Project
    -   Minimal: Just the basics to get started
    -   Interactive: Chat with one agent
    -   Interactive chat with agent selection
-   Automatic vault setup with API key detection
-   Smart resource folder configuration

**Examples:**

```bash
# Interactive project creation
sre create

# Create project with specific name
sre create "Customer Support Bot"
```

---

## Update Command

Check for and install CLI updates:

```bash
sre update
sre update --check
sre update --force
sre update --package pnpm
```

**Options:**

-   `--check, -c` - Only check for updates without installing
-   `--force, -f` - Force update check and installation
-   `--package, -p <manager>` - Specify package manager (npm, pnpm, yarn)

**Examples:**

```bash
# Check and install updates
sre update

# Only check for updates
sre update --check

# Force update with specific package manager
sre update --force --package npm

# Check updates using yarn
sre update --check --package yarn
```

---

## Global Options

-   `--help, -h` - Show help for any command
-   `--version` - Show CLI version

## File Formats

-   **Agent Files**: `.smyth` files containing agent configuration and workflows
-   **Vault Files**: `.json` or `.vault` files for secure credential storage
-   **Models Files**: `.json` files defining available LLM models

## Models Configuration

The `--models` flag allows you to specify custom model configurations for your agents. You can provide either:

-   **Single JSON file**: A single `.json` file containing model definitions
-   **Directory**: A directory containing multiple `.json` files (all will be merged)

### Usage Examples

```bash
# Single models file
sre agent ./myagent.smyth --chat --models ./models.json

# Directory with multiple model files
sre agent ./myagent.smyth --chat --models ./models-config/

# Multiple model files in a directory
sre agent ./myagent.smyth --skill processData --models ./custom-models/
```

### Models File Format

Each model configuration file should be a JSON object where keys are model names and values are model configurations:

```json
{
    "gemma-3-4b": {
        "provider": "OpenAI",
        "label": "gemma-3-4b-it",
        "modelId": "gemma-3-4b-it",
        "features": ["text", "tools"],
        "tokens": 8000,
        "completionTokens": 512,
        "enabled": true,
        "baseURL": "http://localhost:1234/v1",
        "credentials": ["vault"]
    },
    "gemma-3-1b": {
        "provider": "OpenAI",
        "label": "gemma-3-1b-it",
        "modelId": "gemma-3-1b-it",
        "features": ["text", "tools"],
        "tokens": 4096,
        "completionTokens": 512,
        "enabled": true,
        "baseURL": "http://localhost:1234/v1",
        "credentials": ["vault"]
    }
}
```

### Model Configuration Properties

-   **`provider`**: The LLM provider (e.g., "OpenAI", "Anthropic", "Google")
-   **`label`**: Display name for the model
-   **`modelId`**: The actual model identifier used by the provider
-   **`features`**: Array of supported features (`["text", "tools"]`)
-   **`tokens`**: Maximum input tokens supported
-   **`completionTokens`**: Maximum completion tokens
-   **`enabled`**: Whether the model is available for use
-   **`baseURL`**: Custom API endpoint (optional)
-   **`credentials`**: Array specifying how to retrieve credentials (`["vault"]`)

### Directory Structure Example

When using a directory, you can organize models by provider or type:

```
models-config/
├── openai-models.json
├── anthropic-models.json
├── local-models.json
└── custom-models.json
```

All JSON files in the directory will be automatically merged, allowing you to organize your model configurations however you prefer.

## Configuration

The CLI supports various configuration options through:

-   Command-line flags
-   Environment variables
-   Configuration files
-   Interactive prompts during project creation

For detailed configuration options and advanced usage, see the [SmythOS documentation](https://github.com/smythos/sre).

### Reporting Issues

If you face any issues with the CLI or the code, set environment variable LOG_LEVEL="debug" and run your code again. Then share the logs with us, it will help diagnose the problem.
You can request help on our [Discord](https://discord.gg/smythos) or by creating an issue on [GitHub](https://github.com/SmythOS/smythos/issues)
