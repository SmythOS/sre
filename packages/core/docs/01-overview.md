---
title: 'Overview'
---

# Smyth Runtime Environment (SRE) Docs

Welcome to the technical documentation for the Smyth Runtime Environment (SRE) core.

The SRE is a sophisticated, production-ready runtime platform designed specifically for AI Agents. Think of it as the "Operating System for AI Agents"—a robust foundation that handles the complexities of AI agent execution, allowing developers to focus on building intelligent behaviors rather than infrastructure.

This documentation provides a deep dive into the internal architecture and design of the SRE. For information on building agents, please see the SDK documentation.

## Core Concepts

To understand how SRE works, start with these fundamental concepts.

- **[Core Architecture](./02-architecture.md)**: Learn about the SRE's kernel-inspired design, its lifecycle, and the flexible connector model that powers its modularity.
- **[Security Model](./03-security.md)**: Understand the foundational Candidate/ACL system that enforces secure, multi-tenant resource access throughout the environment.
- **[Component System](./04-components.md)**: Discover how Components act as the building blocks of agent behavior and how they are orchestrated by the runtime.

## Subsystems

SRE's functionality is partitioned into several discrete subsystems. Each is responsible for a specific domain of the runtime's capabilities.

- **[Subsystem Overview](./subsystems/00-intro.md)**: Get a high-level view of all the major subsystems and how they fit together.
    - **[Agent Manager](./subsystems/01-agent-manager.md)**: The heart of agent execution.
    - **[Memory Manager](./subsystems/02-memory-manager.md)**: Manages agent state, context, and caching.
    - **[LLM Manager](./subsystems/03-llm-manager.md)**: The abstraction layer for all LLM providers.
    - **[IO Subsystem](./subsystems/04-io.md)**: The gateway to all external services like storage and databases.
    - **[Security Subsystem](./subsystems/05-security.md)**: Manages secrets and identity.

## Extend SRE

Learn how to add your own functionality to the SRE.

- **[Custom Components](./extend/Components.md)**: Guide to creating new agent components.
- **[Custom Connectors](./extend/Connectors.md)**: Guide to creating new service connectors.
- **[Custom Subsystems](./extend/Subsystems.md)**: An overview of adding new top-level subsystems.
