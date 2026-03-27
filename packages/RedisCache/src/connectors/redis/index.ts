import { createClient, type RedisClientType } from "redis";
import { withRetry } from "../../utils/retry";


export type RedisCacheOptions = {
  url?: string;             // e.g. redis://127.0.0.1:6379 or rediss://host:6379
  namespace?: string;       // e.g. "sre:dev"
  tls?: boolean;            // if true, convert redis:// -> rediss://
  username?: string;
  password?: string;
  defaultTTL?: number;      // seconds
};

const nsKey = (ns: string | undefined, k: string) => (ns ? `${ns}:${k}` : k);

function withTls(url: string, tls?: boolean) {
  if (!tls) return url;
  if (url.startsWith("rediss://")) return url;
  if (url.startsWith("redis://")) return "rediss://" + url.slice("redis://".length);
  return url;
}

export class RedisCache {
  // Loosen generics to avoid RedisJSON/plugin typing conflicts across platforms
  private client: RedisClientType<any, any>;
  // Some redis versions type connect() => Promise<RedisClientType>; others => Promise<void>.
  // Keep it flexible:
  private ready: Promise<unknown>;
  private opts: RedisCacheOptions;

  constructor(opts: RedisCacheOptions = {}) {
    this.opts = opts;

    const url = withTls(opts.url ?? "redis://127.0.0.1:6379", opts.tls);

    this.client = createClient({
      url,
      username: opts.username,
      password: opts.password,
    }) as RedisClientType<any, any>;

    this.ready = this.client.connect();
    this.client.on("error", (err) => {
      console.error("[RedisCache] client error:", err);
    });
  }

  private async ensure() { await this.ready; }

async set(key: string, value: Buffer | string | object, ttlSec?: number): Promise<void> {
  await this.ensure();
  const k = nsKey(this.opts.namespace, key);

  let toStore: string | Buffer;
  if (typeof value === "string" || Buffer.isBuffer(value)) {
    toStore = value as any;
  } else {
    toStore = JSON.stringify(value);
  }

  // Compute TTL once, outside the retry closure
  const ttlVal = (ttlSec ?? this.opts.defaultTTL) ?? 0;

  await withRetry(() => {
    if (ttlVal > 0) {
      return this.client.set(k, toStore as any, { EX: ttlVal as number });
    }
    return this.client.set(k, toStore as any);
  });
}


  async get<T = string>(key: string): Promise<T | null> {
  await this.ensure();
  const k = nsKey(this.opts.namespace, key);

  // one declaration only
  const raw: unknown = await withRetry(() => (this.client as any).get(k));
  if (raw == null) return null;

  if (typeof raw === "string") {
    try { return JSON.parse(raw) as T; }
    catch { return raw as unknown as T; }
  }

  if (Buffer.isBuffer(raw as any)) {
    const s = (raw as any as Buffer).toString("utf8");
    try { return JSON.parse(s) as T; }
    catch { return s as unknown as T; }
  }

  // Fallback for any odd return types
  try { return JSON.parse(String(raw)) as T; }
  catch { return (String(raw) as unknown) as T; }
}


async del(key: string): Promise<void> {
  await this.ensure();

  // compute once outside the retry closure
  const delKey = nsKey(this.opts.namespace, key);

  await withRetry(() => this.client.del(delKey));
}


 async keys(pattern = "*"): Promise<string[]> {
  await this.ensure();

  // Compute once outside the retry closure to avoid TDZ issues
  const patternKey = nsKey(this.opts.namespace, pattern);

  const out = await withRetry(() => this.client.keys(patternKey));
  return out as string[];
}


  async flushNamespace(): Promise<void> {
    if (!this.opts.namespace) return;
    const all = await this.keys("*");
    for (const k of all) await this.client.del(k);
  }

  async quit(): Promise<void> {
    await this.ensure();
    await this.client.quit();
  }
}

export function createRedisCacheFromEnv(): RedisCache {
  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const namespace = process.env.REDIS_NAMESPACE || "sre:dev";
  const tls = (process.env.REDIS_TLS || "false").toLowerCase() === "true";
  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;
  const defaultTTL = process.env.REDIS_DEFAULT_TTL
    ? parseInt(process.env.REDIS_DEFAULT_TTL, 10)
    : undefined;

  return new RedisCache({ url, namespace, tls, username, password, defaultTTL });
}
