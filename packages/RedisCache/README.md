📘 Redis Cache Connector (SmythOS SRE)

This contribution adds a small, typed Redis cache utility for agents:

API: set(key, val, ttl?), get(key), del(key), keys(pattern), flushNamespace(), quit()

Features: namespacing (NAMESPACE:key), TTL, optional TLS via rediss://, simple retry/backoff.

⚡ Quick start (local)

Requirements:

Docker Desktop

Node.js 18+ (or later)

# 1) start Redis in Docker
npm run redis:up
npm run redis:ping   # expect "PONG"

# 2) (optional) set environment variables in .env.local
# REDIS_URL=redis://127.0.0.1:6379
# REDIS_NAMESPACE=sre:dev
# REDIS_TLS=false

# 3) run connector smoke test
npm run redis:cache-check

# expect output like:
# get(hello) -> world
# get(obj)  -> { a: 1, b: 'x' }
# keys(*)   -> [ 'sre:check:hello', 'sre:check:obj' ]
# after del(hello) -> null
# ✅ Connector smoke passed

# 4) run tests
npm run test:redis

🔧 Usage
import { createRedisCacheFromEnv } from "./src/connectors/redis";

async function main() {
  const cache = createRedisCacheFromEnv();

  // store an object for 60 seconds
  await cache.set("foo", { bar: 1 }, 60);

  // retrieve it back
  const v = await cache.get("foo");   // -> { bar: 1 }
  console.log("value:", v);

  // delete it
  await cache.del("foo");

  // close connection
  await cache.quit();
}

main().catch(console.error);


👉 The API is deliberately simple and mirrors Redis:

set(key, value, ttlSeconds?) → stores string, Buffer, or JSON object

get(key) → auto-parses JSON if possible, otherwise returns string

del(key) → removes a key

keys(pattern) → list matching keys (supports wildcards)

flushNamespace() → deletes all keys in the current namespace

quit() → closes the connection

⚙️ Configuration

The connector reads configuration from environment variables:

Variable	Default	Notes
REDIS_URL	redis://127.0.0.1:6379	Use rediss:// for TLS
REDIS_NAMESPACE	sre:dev	Prefix added to all keys
REDIS_TLS	false	Force TLS, useful if URL doesn’t use rediss://
REDIS_USERNAME	(none)	Only if Redis ACL is enabled
REDIS_PASSWORD	(none)	Password for Redis auth
REDIS_DEFAULT_TTL	(none)	TTL in seconds for all set calls if not overridden
📝 Notes

TLS: If you provide a rediss:// URL, TLS is used automatically. You can also force it with REDIS_TLS=true.

Retries: All Redis calls are wrapped in a retry/backoff helper, so transient disconnects don’t crash the agent.

Namespacing: Prevents key collisions when multiple agents share the same Redis.
Example:

REDIS_NAMESPACE=agent1
set("foo", 42)  → stored as "agent1:foo"

📂 Folder layout
src/
  connectors/
    redis/
      index.ts          # main connector
  utils/
    retry.ts            # retry/backoff helper
scripts/
  redis-cache-check.ts  # smoke test script
test/
  redis.test.ts         # Node test file

🚀 Future Extensions

Potential next steps (if someone wants to expand this connector):

Batch methods: Add mget/mset for efficiency when working with multiple keys.

Metrics: Add cache hit/miss counters + logging hooks for observability.

Iteration: Add scan()-based async iterator for very large keyspaces.

🧪 Example script (optional)

You can also create scripts/redis-example.ts to play with the connector:

import { createRedisCacheFromEnv } from "../src/connectors/redis";

async function main() {
  const cache = createRedisCacheFromEnv();

  await cache.set("demo", { hello: "world" }, 30);
  console.log("get(demo) ->", await cache.get("demo"));

  await cache.del("demo");
  console.log("after del(demo) ->", await cache.get("demo"));

  await cache.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


Run with:

ts-node scripts/redis-example.ts