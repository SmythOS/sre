---
title: 'subsystems/Overview'
---

# SRE Subsystems

The functionality of the Smyth Runtime Environment is partitioned into several discrete **Subsystems**. Each subsystem is responsible for a specific domain of the SRE's capabilities, such as memory management, I/O, or security.

Each subsystem exposes its functionality through one or more services, which are in turn powered by the SRE's pluggable **Connector** architecture. This structure ensures a clean separation of concerns and allows for a high degree of modularity.

## Core Subsystems

Here are the primary subsystems within the SRE:

- **[Agent Manager](./01-agent-manager.md)**: The heart of agent execution. Responsible for the agent lifecycle, performance monitoring, and component workflow orchestration.

- **[Memory Manager](./02-memory-manager.md)**: Provides intelligent state and context management for agents, including multi-tiered caching and conversation history.

- **[LLM Manager](./03-llm-manager.md)**: A powerful abstraction layer for various LLM providers, handling API variations, smart inference, and response caching.

- **[IO Subsystem](./04-io.md)**: The gateway to the outside world. It provides unified connector interfaces for all input/output operations like Storage, VectorDBs, and Logging.

- **[Security Subsystem](./05-security.md)**: Manages all security-related primitives, including the Vault service for secret management and the Account service for identity and authentication.
