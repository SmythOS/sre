---
title: 'subsystems/Memory Manager'
---

# Memory Manager Subsystem

The Memory Manager Subsystem is responsible for intelligent state and context management for agents. Efficient memory management is critical for creating agents that can maintain conversations, learn over time, and perform efficiently.

All services within the Memory Manager subsystem are accessed via the `SRE.Memory` namespace.

## Core Memory Services

### Cache

The Cache service provides a multi-tiered, generic caching interface. It is used throughout the SRE to store and retrieve frequently accessed data, reducing latency and load on external services. It can be used for caching LLM responses, session data, or any other serializable information.

-   **Interface**: `ICacheConnector`
-   **Service Access**: `SRE.Memory.Cache`
-   **Common Connectors**: `RAMCacheConnector` (for high-speed, in-memory cache), `RedisCacheConnector`

### Runtime Context

The Runtime Context service manages the state of an agent during its execution. It holds the agent's current configuration, its execution graph, and the intermediate values of its components. This service is internal to the agent's execution loop and is crucial for orchestrating complex agent workflows.

### LLM Context

The LLM Context service is responsible for managing the conversation history and context window for Large Language Models. When an agent is in a chat or conversational mode, this service stores the history of interactions and intelligently truncates it to fit within the context limits of the specific LLM being used. This gives the agent its "memory" of the current conversation.
