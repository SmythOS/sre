# Changelog

All notable changes to `@smythos/cli` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] — 2026-03-02

### Added

- Android Mobile App (React Native) template available in `sre create`
- Batch mode support for non-interactive project creation (pass all options as flags)
- Detailed per-template descriptions in `sre create` help and README

---

## [0.3.6] — 2025-11-13

### Changed

- OpenTelemetry (OTel) integration updates

---

## [0.3.5] — 2025-11-09

### Fixed

- VectorDB embeddings handling improvements
- JSONVault: enhanced error handling when the vault file is missing or malformed

---

## [0.3.3] — 2025-10-20

### Added

- Electron Desktop App template added to `sre create`

---

## [0.3.2] — 2025-10-17

### Changed

- Dependency updates and version bump

---

## [0.3.1] — 2025-10-13

### Fixed

- JSONVault search path resolution

---

## [0.3.0] — 2025-09-29

### Added

- `--mode` flag on `sre agent` to switch between `chat`, `planner`, and other modes
- Planner mode with live task panel UI powered by TokenLoom streaming
- Task event listeners for real-time planner progress updates

### Fixed

- Restored gradient text output in CLI agent chat
- Planner mode streaming implementation stabilized

---

## [0.2.33] — 2025-08-08

### Changed

- Internal dependency version bumps

---

## [0.2.32] — 2025-08-05

### Changed

- Optimized internal Redis connection handling

---

## [0.2.31] — 2025-07-11

### Changed

- Version alignment with `@smythos/sre` and `@smythos/sdk`

---

## [0.2.30] — 2025-07-11

### Added

- Support for unlisted / custom AI models — CLI will auto-resolve the closest known model configuration

---

## [0.2.22] — 2025-07-09

### Changed

- Version alignment bump

---

## [0.2.21] — 2025-07-03

### Changed

- Optimized CLI bundle (reduced output size)

---

## [0.2.20] — 2025-06-30

### Fixed

- Fixed Google AI API key detection and validation

### Changed

- Documentation tweaks and updates

---

## [0.2.16] — 2025-06-23

### Fixed

- `sre agent <file>` now runs `chat` as the default action when no flag is provided

### Changed

- Removed `oclif.manifest.json` from source control (generated artifact, should not be committed)

---

## [0.2.15] — 2025-06-23

### Added

- Environment variable support inside JSON vault files (`${ENV_VAR}` syntax)

### Fixed

- `sre create` git clone failure on certain platforms

---

## [0.2.12] — 2025-06-22

### Fixed

- JSONVault shared vault option

---

## [0.2.11] — 2025-06-22

### Fixed

- MCP code skill: fixed missing `param name` issue

---

## [0.2.10] — 2025-06-20

### Fixed

- OpenAI API key detection hotfix

---

## [0.2.9] — 2025-06-20

### Fixed

- CLI project scaffolding fixes in `sre create`
- Updated `create` command template handling

---

## [0.2.8] — 2025-06-20

### Fixed

- Version bump required for CLI auto-update notifier to detect new releases

---

## [0.2.7] — 2025-06-20

### Fixed

- Update notifier was showing the wrong package manager command

---

## [0.2.6] — 2025-06-20

### Fixed

- Update notifier package manager detection (attempt 2)

---

## [0.2.5] — 2025-06-20

### Fixed

- Auto-update message now shows the correct package manager

---

## [0.2.3] — 2025-06-20

### Fixed

- Improved package manager detection strategy

---

## [0.2.2] — 2025-06-20

### Changed

- Revised CLI package manager detection logic

---

## [0.2.1] — 2025-06-20

### Added

- CLI auto-detects the active package manager (npm / pnpm / yarn) to provide correct update instructions

---

## [0.2.0] — 2025-06-20

### Added

- `sre create` command — scaffold new SmythOS projects from curated templates
- Various CLI tweaks and stability improvements

---

## [0.0.4] — 2025-06-19

### Added

- Custom model support in `sre agent` command
- Vault / secrets integration for the `agent` command

### Fixed

- ModelsProvider resolution fix

---

## [0.0.3] — 2025-06-17

### Added

- CLI update notifier — prompts when a newer version is available on npm
- Improved `.smyth` path detection for JSONVault and LocalStorage

### Changed

- Optimized CLI bundle: code minification and tree-shaking enabled
- Removed `postinstall` script

---

## [0.0.2] — 2025-06-17

### Fixed

- Removed unused `postinstall` script (reverted from 0.0.1)

---

## [0.0.1] — 2025-06-16

### Added

- Initial release of `@smythos/cli`
- `sre agent` command: run `.smyth` agent files directly from the terminal
- Chat mode, skill-call mode, and MCP server mode for agents
- Prompt mode and structured command interface
- `sre update` command to check for and apply CLI updates
