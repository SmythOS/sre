import { createClient } from "redis";

(async () => {
  const client = createClient({ url: "redis://127.0.0.1:6379" });
  client.on("error", (err) => console.error("Redis error:", err));
  await client.connect();

  await client.set("hello", "world");
  const val = await client.get("hello");
  console.log("hello ->", val);

  await client.quit();
})();
