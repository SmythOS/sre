import { createRedisCacheFromEnv } from "../src/connectors/redis";


(async () => {
  // fallback if env file isn’t picked up by your shell
  process.env.REDIS_URL ||= "redis://127.0.0.1:6379";
  process.env.REDIS_NAMESPACE ||= "sre:check";

  const cache = createRedisCacheFromEnv();

  await cache.set("hello", "world", 10);
  console.log("get(hello) ->", await cache.get("hello"));

  await cache.set("obj", { a: 1, b: "x" }, 10);
  console.log("get(obj) ->", await cache.get<any>("obj"));

  console.log("keys(*) ->", await cache.keys("*"));
  await cache.del("hello");
  console.log("after del(hello) ->", await cache.get("hello"));

  await cache.flushNamespace();
  await cache.quit();
  console.log("✅ Connector smoke passed");
})();
