# CLAUDE.md — SmythOS SRE

Open-source runtime and SDK for production AI agents. OS-kernel-inspired architecture with pluggable connectors.

## Getting Started

```bash
pnpm install          # install dependencies
pnpm build            # build all packages
pnpm test:run         # verify everything works
```

## Monorepo Layout

- `packages/core/` — Runtime kernel (subsystems, connectors, 40+ components)
- `packages/sdk/` — Developer-facing SDK (agents, skills, streaming)
- `packages/cli/` — CLI for scaffolding and running .smyth workflows
- `examples/` — Example projects

## Commands

```bash
pnpm build            # build all packages
pnpm lint             # lint all packages
pnpm test:run         # run tests once (always run before submitting)
pnpm test:coverage    # coverage report
```

## Branch Workflow

- Feature branches are created from `dev` and PR'd back into `dev`.
- `dev` is merged into `main` for releases.
- Use `origin/dev` as the base for code reviews and diffs.

## Naming Conventions

**File suffixes**: `.service.ts` (services), `.class.ts` (classes/connectors), `.utils.ts` (utilities), `.helper.ts` (helpers), `.handler.ts` (event handlers), `.mw.ts` (middlewares)

**Declarations**: Constants → `UPPER_SNAKE_CASE`, Types/Enums → `TPrefix`, Interfaces → `IPrefix`, Classes → `PascalCase`

## Warnings

- **DO NOT EDIT** `packages/core/src/subsystems/LLMManager/models.ts` — model definitions live in the DB at runtime; edits here have no effect.

## Security Context

- Secrets must use the Vault subsystem — never hardcoded or read directly from env vars.
- Never commit `.smyth/vault.json` or API keys in source files.

## Testing

- Tests live in `packages/*/tests/**/*.test.ts`
- Integration tests require env var `ENABLE_INTEGRATION_TESTS=true` (disabled by default)

## Code Review Rules

When reviewing PRs, enforce:
1. **Prettier**: 4 spaces, single quotes, 150 char width.
2. **Naming**: Follow file suffix and declaration conventions above.
3. **Utils purity**: `/utils` must not depend on code outside `/utils`.
4. **Tests required** for bug fixes and new features. Verify with `pnpm test:run`.
5. **Strict typing** — avoid `any` unless interfacing with untyped externals.
6. **No unnecessary deps** — evaluate before adding new packages.
7. **DCO**: All commits must be signed (`git commit -s`).
