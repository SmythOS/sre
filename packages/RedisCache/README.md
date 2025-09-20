🚀 Redis Cache Connector for SmythOS

This contribution adds a Redis cache connector for SmythOS SRE projects, plus a demo AI agent that shows how caching improves agent workflows.

✨ Features

set/get/del/keys/flushNamespace/quit API

JSON auto-serialization & parsing

TTL support (per key and global default)

Namespacing to prevent collisions across agents

Retries with exponential backoff for transient Redis errors

TLS support (rediss:// or REDIS_TLS=true)

Demo agent shows [CACHE MISS] / [CACHE HIT] in real time

📦 Requirements

Docker Desktop

Node.js v18+

(Optional) API keys for OpenAI or Google Gemini if you want to use real LLMs

⚡ Quick Start
1. Start Redis
npm run redis:up
npm run redis:ping   # expect "PONG"

2. Run connector smoke test
npm run redis:cache-check


Expected output:

get(hello) -> world
get(obj) -> { a: 1, b: 'x' }
keys(*) -> [ 'sre:check:hello', 'sre:check:obj' ]
after del(hello) -> null
✅ Connector smoke passed

3. Run automated tests
npm run test:redis


✅ All 5 tests should pass.

🤖 AI Agent Demo with Redis Cache

The included demo agent wraps an LLM (OpenAI, Google Gemini, or a mock fallback) with the Redis cache connector. It shows how caching avoids recomputation.

Run demo
npm run agent:demo:prompt

Example output
first: 420.123ms
[CACHE MISS] key=demo-llm:v1:abc123 → querying model...
[CACHE STORE] key=demo-llm:v1:abc123 → saved with TTL=120s
OUT 1: MOCK_SUMMARY: Summarize the value of caching with Redis in agent workflows

second: 2.345ms
[CACHE HIT] key=demo-llm:v1:abc123
OUT 2: MOCK_SUMMARY: Summarize the value of caching with Redis in agent workflows

✅ Demo complete (second call should be faster due to cache).


OUT 1 → cache miss (model queried, slower)

OUT 2 → cache hit (from Redis, instant)

👉 This proves the benefit of caching in agent workflows: speed + cost savings + reliability.

🔧 Configuration

Set via .env.local or environment variables:

Variable	Default	Notes
REDIS_URL	redis://127.0.0.1:6379	Use rediss:// for TLS
REDIS_NAMESPACE	sre:dev	Prefix added to all keys
REDIS_TLS	false	Force TLS if needed
REDIS_USERNAME	(none)	Redis ACL username
REDIS_PASSWORD	(none)	Redis password
REDIS_DEFAULT_TTL	(none)	Global TTL (seconds)
OPENAI_API_KEY	(none)	Enables OpenAI adapter
GOOGLEAI_API_KEY	(none)	Enables Google Gemini adapter
OPENAI_MODEL	gpt-4o-mini	Optional override
GOOGLEAI_MODEL	gemini-1.5-flash	Optional override

If no API keys are provided, the demo uses a MockAdapter that produces deterministic fake summaries.

📂 Project Structure
src/
  connectors/
    redis/
      index.ts          # Redis connector
  utils/
    retry.ts            # retry/backoff helper
  agents/
    cached-llm.ts       # Redis-cached wrapper for LLMs
    adapters.ts         # OpenAI, Google, and Mock adapters
scripts/
  redis-cache-check.ts  # connector smoke test
  demo-agent.ts         # AI agent demo with cache
test/
  redis.test.ts         # automated tests

🔮 Future Extensions

Batch methods (mget/mset) for efficiency

Cache metrics (hit/miss counters, logging hooks)

Async iterator with SCAN for large keyspaces