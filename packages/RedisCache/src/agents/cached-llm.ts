import { createRedisCacheFromEnv } from "../connectors/redis";

export interface LLM {
  generate(prompt: string): Promise<string>;
}

export class CachedLLM implements LLM {
  constructor(
    private inner: LLM,
    private opts: { ttlSec?: number; namespace?: string } = {},
    private cache = createRedisCacheFromEnv() // reuse one client
  ) {}

  async generate(prompt: string): Promise<string> {
    const ns = this.opts.namespace ?? "agent";
    const key = `${ns}:v1:${hash(`${this.inner.constructor.name}:${prompt}`)}`;

    // 1) Try cache
    const cached = await this.cache.get<string>(key);
    if (cached != null) {
      console.log(`[CACHE HIT] key=${key}`);
      return cached;
    }

    // 2) Call model
    console.log(`[CACHE MISS] key=${key} → querying model...`);
    const out = await this.inner.generate(prompt);

    // 3) Store result
    await this.cache.set(key, out, this.opts.ttlSec ?? 300);
    console.log(`[CACHE STORE] key=${key} → saved with TTL=${this.opts.ttlSec ?? 300}s`);
    return out;
  }

  async close() {
    await this.cache.quit();
  }
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}
