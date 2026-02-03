import { createClient } from "redis";

(async () => {
  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const ns  = process.env.REDIS_NAMESPACE || "sre:dev";

  const client = createClient({ url });
  client.on("error", (e) => console.error("[redis] error:", e));
  await client.connect();

  const key = `${ns}:hello`;
  await client.set(key, "world", { EX: 30 });
  const val = await client.get(key);

  console.log("Redis roundtrip:", key, "->", val);
  await client.quit();
})();
