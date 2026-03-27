import assert from "assert";
import { describe, it, before, after } from "node:test";
import { createRedisCacheFromEnv } from "../src/connectors/redis";

let cache: ReturnType<typeof createRedisCacheFromEnv>;

describe("RedisCache connector", () => {
  before(async () => {
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    process.env.REDIS_NAMESPACE = "sre:test";
    cache = createRedisCacheFromEnv();
  });

  after(async () => {
    await cache.flushNamespace();
    await cache.quit();
  });

  it("roundtrips strings", async () => {
    await cache.set("k1", "v1", 10);
    const v = await cache.get("k1");
    assert.strictEqual(v, "v1");
  });

  it("respects TTL", async () => {
    await cache.set("ttlKey", "short", 1);
    const v1 = await cache.get("ttlKey");
    assert.strictEqual(v1, "short");
    await new Promise((r) => setTimeout(r, 1500)); // wait 1.5s
    const v2 = await cache.get("ttlKey");
    assert.strictEqual(v2, null);
  });

  it("stores/reads JSON objects", async () => {
    const obj = { a: 1, b: "x" };
    await cache.set("obj", obj, 30);
    const out = await cache.get<any>("obj");
    assert.deepStrictEqual(out, obj);
  });

  it("keys() returns namespaced keys", async () => {
    await cache.set("listA", "1", 30);
    await cache.set("listB", "2", 30);
    const keys = await cache.keys("*");
    assert.ok(keys.length >= 2);
    assert.ok(keys.every((k) => k.includes("sre:test")));
  });

  it("del() removes items", async () => {
    await cache.set("todel", "bye", 30);
    await cache.del("todel");
    const v = await cache.get("todel");
    assert.strictEqual(v, null);
  });
});
