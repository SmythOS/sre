# How to run the tests

We have two types of tests here:

-   unit tests
-   integration tests

# Unit Tests

The unit tests are located in the `tests/unit` folder and do not rely on external services (except APICall cases that use httpbin.org).

Run from `packages/core`:

```bash
pnpm run test:unit
pnpm run test:unit:watch
```

If you are an external contributor, please run unit tests before and after your changes to ensure nothing breaks.

# Integration Tests

The integration tests live in `tests/integration` and rely on external services (LLM providers, storage, etc.).

**⚠️ Important: Integration tests require a Vault file for API keys before they can run.**

## Vault setup (required for integration tests)

Create a Vault file in your user home directory:

-   macOS/Linux: `~/.smyth/.sre/vault.json`
-   Windows: `%USERPROFILE%\.smyth\.sre\vault.json`

Example `vault.json` (you can reference environment variables using `$env(VAR_NAME)`):

```json
{
    "default": {
        "echo": "",
        "openai": "...",
        "anthropic": "...",
        "googleai": "...",
        "groq": "...",
        "togetherai": "...",
        "xai": "...",
        "perplexity": "..."
    }
}
```

## Running integration tests

Once your vault is configured, run from the repository root:

```bash
pnpm -F @smythos/sre test:integration
pnpm -F @smythos/sre test:integration:watch
```

Or from `packages/core`:

```bash
pnpm run test:integration
pnpm run test:integration:watch
```

# Important Notes

-   Running LLM integration tests may incur costs with your providers.
-   Always use pnpm in this monorepo.
