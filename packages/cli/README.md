# SmythOS SRE CLI

Command line interface for SmythOS SRE (Smyth Runtime Environment)

## Installation

```bash
pnpm install -g @smythos/cli
```

## Commands

### Agent Command

Run a SmythOS agent with various execution modes:

#### Basic Usage

```bash
sre agent <path>
```

#### Chat Mode

Start an interactive chat interface with the agent:

```bash
sre agent <path> --chat [model]
```

Examples:

```bash
sre agent ./my-agent.json --chat
sre agent ./my-agent.json --chat claude-3.7-sonnet
sre agent ./my-agent.json --chat gpt-4
```

#### MCP Server Mode

Start the agent as an MCP (Model Context Protocol) server:

```bash
sre agent <path> --mcp [serverType]
```

Examples:

```bash
sre agent ./my-agent.json --mcp
sre agent ./my-agent.json --mcp stdio
sre agent ./my-agent.json --mcp sse
```

#### Skill Execution

Execute a specific skill from the agent:

```bash
sre agent <path> --skill <skillname> --params [params...]
```

Examples:

```bash
sre agent ./my-agent.json --skill getUserInfo
sre agent ./my-agent.json --skill processData --params input1 input2 input3
sre agent ./my-agent.json --skill generateReport --params --format json --output ./report.json
```

#### Endpoint Execution

Execute the agent as an API endpoint:

**POST endpoint:**

```bash
sre agent <path> --endpoint <skillname> --post [params...]
```

**GET endpoint:**

```bash
sre agent <path> --endpoint <skillname> --get [params...]
```

Examples:

```bash
sre agent ./my-agent.json --endpoint api/users --post name="John Doe" email="john@example.com"
sre agent ./my-agent.json --endpoint api/search --get query="machine learning" limit=10
```

#### Additional Options

-   `--vault [path]`: Path to vault file for secure credential storage
-   `--vault-key [path]`: Path to vault key file
-   `--models [path]`: Path to models configuration (default: ./models.json)
-   `--data-path [path]`: Path to data directory

#### Complete Examples

```bash
# Run agent with custom vault and models
sre agent ./agent.json --vault ./secrets.vault --vault-key ./vault.key --models ./custom-models.json

# Start chat with custom data path
sre agent ./agent.json --chat --data-path ./agent-data

# Execute skill with vault authentication
sre agent ./agent.json --skill authenticatedTask --vault ./secrets.vault --params userId=123

# Run as API endpoint with custom configuration
sre agent ./agent.json --endpoint api/process --post data="sample" --vault ./secrets.vault --models ./prod-models.json
```

## Other Commands

### Project Management

```bash
sre init          # Initialize a new SRE project
sre build         # Build the current SRE project
sre dev           # Start development server
```

### Utility Commands

```bash
sre version       # Show version information
sre update        # Check for and install updates
sre update --check # Only check for updates
```

## Configuration

The CLI supports various configuration options through command-line flags, environment variables, and configuration files. See the documentation for detailed configuration options.
