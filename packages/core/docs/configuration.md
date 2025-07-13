# SRE Configuration

SRE provides several ways to configure its behavior, including environment variables, command-line arguments, and settings files. This document outlines the available configuration methods and settings.

## Configuration Layers

Configuration is applied in the following order of precedence (higher numbers override lower numbers):

1.  **Default values:** Hardcoded defaults within the application.
2.  **User settings folder (~/.smyth/):** Global settings for the current user's home directory.
3.  **Project settings folder (.smyth/):** Project-specific settings.
4.  **Environment variables:** System-wide or session-specific variables, which may be loaded from `.env` files.
5.  **User Code:** User code can override configuration by passing a custom config to SRE and its connectors.

## The .smyth Folder

SRE uses `.smyth` folders to store configuration, secrets, and some persistent data used by connectors:

### Location

The `.smyth` folder can be located in two places:

-   **User settings folder:**

    -   **Location:** `~/.smyth/` (where `~` is your home directory).
    -   **Scope:** Applies to all SRE sessions for the current user.

-   **Project settings folder:**
    -   **Location:** `.smyth/` within your project's root directory.
    -   **Scope:** Applies only when running SRE from that specific project. Project settings override user settings.

### Content

In this section, ".smyth" refers to either the user settings folder or the project settings folder, depending on the discovery order.

#### .smyth/.sre/ Subfolder

This subfolder contains the actual settings for SRE.

-   `.smyth/.sre/vault.json`: This file is present if you are using the default vault connector to manage API keys and secrets. It contains LLM API keys, other third-party API keys, and user-specified keys. It can be encrypted to protect the keys. (You can use other vault connectors to manage your secrets, such as AWS Secret Manager. In that case, this file will be ignored.)

-   `.smyth/.sre/config.json`: If present, this file defines the SRE startup configuration.

#### Other Subfolders

SRE can load connectors that need to store data locally. These connectors can be configured to store data in specific locations, but if no location is specified, they fall back to a default location, which is a subfolder of the `.smyth` folder.

For example, the Local Storage connector uses the `.smyth/storage/` folder to store local data if no other location is specified.

**Note on environment variables in settings:** String values within your `vault.json` or `config.json` files can reference environment variables using the `$env(VAR_NAME)` syntax. These variables will be automatically resolved at runtime. For example, if you have an environment variable `OPENAI_API_KEY`, you could use it in `vault.json` like this: `"openai": "$env(OPENAI_API_KEY)"`.

### vault.json Structure

The vault stores keys for different teams, but must have at least a "default" team configured. This is the team ID used for any agent that does not belong to a specific team. If an agent belongs to a specific team, it can only load secrets from that team's vault by default. The vault connector provides a configuration option to specify a shared vault entry that can be used as a fallback if a key is not found in the team's vault. This can be a completely separate entry (for example, called "shared"), or you can specify an existing entry (e.g., "default").

```json
{
    "default": {
        "echo": "",
        "openai": "sk-hardcoded-key",
        "anthropic": "$env(ANTHROPIC_API_KEY)",
        "googleai": "",
        "groq": "",
        "togetherai": "",
        "tavily": "",
        "my_custom_key": "1234567890"
    },
    "team-id-0001": {
        "echo": "...",
        "openai": "...",
        "anthropic": "...",
        "googleai": "...",
        "groq": "...",
        "togetherai": "...",
        "tavily": "...",
        "my_custom_key": "..."
    },
    "team-id-0002": {
        //...
    }
}
```

### config.json Structure

(TBD)

### Debug Logging

To capture detailed debugging information for each agent, configure the Log service
to use the `DebugLog` connector:

```json
{
    "Log": { "Connector": "DebugLog" }
}
```

Logs are written to `~/.smyth/logs/<agent-id>/debug.jsonl`. Each line is a JSON
object containing the timestamp and execution details.

### Docker Execution

When the `Docker` connector is selected for the Code service, code snippets run
inside a Docker container. The container image and execution timeout are
specified in the Code configuration:

```json
{
    "Code": {
        "Connector": "Docker",
        "Settings": {
            "image": "python:3.12-slim",
            "timeout": 10000
        }
    }
}
```

The `image` field sets the Docker image used to execute the code, while
`timeout` (in milliseconds) controls how long the container is allowed to run.
