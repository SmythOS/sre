import { CachedLLM } from "../src/agents/cached-llm";
import { pickAvailableAdapter } from "../src/agents/adapters";

async function main() {
  process.env.REDIS_URL ||= "redis://127.0.0.1:6379";
  process.env.REDIS_NAMESPACE ||= "sre:demo";

  const prompt = process.argv.slice(2).join(" ") || "Summarize: Using Redis cache to avoid recomputation.";
  const base = pickAvailableAdapter();
  const llm = new CachedLLM(base, { ttlSec: 120, namespace: "demo-llm" });

  console.time("first");
  const a = await llm.generate(prompt);
  console.timeEnd("first");
  console.log("OUT 1:", a);

  console.time("second");
  const b = await llm.generate(prompt);
  console.timeEnd("second");
  console.log("OUT 2:", b);

  await llm.close();        // <-- ensures Redis connection is closed
  console.log("✅ Demo complete (second call should be faster due to cache).");
}

main().catch((e) => { console.error(e); process.exit(1); });
