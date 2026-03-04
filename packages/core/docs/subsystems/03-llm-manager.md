---
title: 'subsystems/LLM Manager'
---

# LLM Manager Subsystem

The LLM (Large Language Model) Manager Subsystem provides a powerful, unified abstraction layer for interacting with various LLM providers. Its primary goal is to decouple the agent's logic from the specific implementation details and APIs of any single LLM provider.

## Key Features

### Unified Model Abstraction

The LLM Manager provides a single, consistent interface for all supported LLM providers. This means an agent can be switched from using OpenAI's GPT-4 to Anthropic's Claude by changing only the model identifier in its configuration. The agent's core prompting logic does not need to change.

This abstraction handles:

-   Differences in API request/response formats.
-   Varying authentication mechanisms.
-   Provider-specific features like tool-calling and function-calling.

### Smart Inference and Caching

To optimize performance and reduce costs, the LLM Manager integrates directly with the **Memory Manager Subsystem**. It can be configured to automatically cache LLM responses. When a prompt is repeated, the cached response can be served instantly, bypassing a costly API call to the LLM provider.

### Usage Tracking

The subsystem includes built-in hooks for tracking token usage (both prompt and completion tokens) for every LLM call. This data is essential for monitoring costs, analyzing agent performance, and enforcing usage limits.

### Supported Providers

The LLM Manager uses the same connector model as other SRE subsystems, allowing for easy extension to new providers. Common connectors include:

-   `OpenAIConnector`
-   `AnthropicConnector`
-   `GoogleAIConnector` (for Gemini and Vertex AI)
-   `AWSBedrockConnector`
-   `GroqConnector`
-   `PerplexityConnector`
