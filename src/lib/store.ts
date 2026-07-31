import { Redis } from "@upstash/redis";

/**
 * Storage abstraction for all persistent demo state: sessions, bookings,
 * CRM rows, audit log, rate counters, and the daily budget meter.
 *
 * Production driver: Upstash Redis (Vercel Marketplace, KV_REST_API_* env).
 * Dev/CI driver: in-process memory (per-process only; fine for local dev and
 * key-free CI, never used in production).
 */
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set(
    key: string,
    value: unknown,
    opts?: { ttlSeconds?: number },
  ): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomic increment; sets TTL only when the key is created by this call. */
  incrBy(
    key: string,
    by: number,
    opts?: { ttlSeconds?: number },
  ): Promise<number>;
  listPush(key: string, value: unknown): Promise<number>;
  listRange<T>(key: string, start: number, stop: number): Promise<T[]>;
  /** Delete every key under a prefix. Returns number deleted. Demo-scale only. */
  clearPrefix(prefix: string): Promise<number>;
  ping(): Promise<boolean>;
  readonly driver: "redis" | "memory";
}

class RedisStore implements Store {
  readonly driver = "redis" as const;
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    return (await this.redis.get<T>(key)) ?? null;
  }

  async set(key: string, value: unknown, opts?: { ttlSeconds?: number }) {
    if (opts?.ttlSeconds) {
      await this.redis.set(key, value, { ex: opts.ttlSeconds });
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string) {
    await this.redis.del(key);
  }

  async incrBy(key: string, by: number, opts?: { ttlSeconds?: number }) {
    const next = await this.redis.incrby(key, by);
    if (opts?.ttlSeconds && next === by) {
      await this.redis.expire(key, opts.ttlSeconds);
    }
    return next;
  }

  async listPush(key: string, value: unknown) {
    return this.redis.rpush(key, value);
  }

  async listRange<T>(key: string, start: number, stop: number): Promise<T[]> {
    return this.redis.lrange<T>(key, start, stop);
  }

  async clearPrefix(prefix: string) {
    let cursor = "0";
    let deleted = 0;
    do {
      const [next, keys] = await this.redis.scan(cursor, {
        match: `${prefix}*`,
        count: 100,
      });
      cursor = next;
      if (keys.length > 0) {
        await this.redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== "0");
    return deleted;
  }

  async ping() {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}

type MemoryEntry = { value: unknown; expiresAt: number | null };

class MemoryStore implements Store {
  readonly driver = "memory" as const;
  private kv = new Map<string, MemoryEntry>();
  private lists = new Map<string, unknown[]>();

  private live(key: string): MemoryEntry | undefined {
    const entry = this.kv.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.kv.delete(key);
      return undefined;
    }
    return entry;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.live(key);
    return entry === undefined ? null : (structuredClone(entry.value) as T);
  }

  async set(key: string, value: unknown, opts?: { ttlSeconds?: number }) {
    this.kv.set(key, {
      value: structuredClone(value),
      expiresAt: opts?.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : null,
    });
  }

  async del(key: string) {
    this.kv.delete(key);
    this.lists.delete(key);
  }

  async incrBy(key: string, by: number, opts?: { ttlSeconds?: number }) {
    const entry = this.live(key);
    const current = typeof entry?.value === "number" ? entry.value : 0;
    const next = current + by;
    this.kv.set(key, {
      value: next,
      expiresAt:
        entry?.expiresAt ??
        (opts?.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : null),
    });
    return next;
  }

  async listPush(key: string, value: unknown) {
    const list = this.lists.get(key) ?? [];
    list.push(structuredClone(value));
    this.lists.set(key, list);
    return list.length;
  }

  async listRange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const list = this.lists.get(key) ?? [];
    const end = stop === -1 ? list.length : stop + 1;
    return structuredClone(list.slice(start, end)) as T[];
  }

  async clearPrefix(prefix: string) {
    let deleted = 0;
    for (const key of [...this.kv.keys()]) {
      if (key.startsWith(prefix)) {
        this.kv.delete(key);
        deleted++;
      }
    }
    for (const key of [...this.lists.keys()]) {
      if (key.startsWith(prefix)) {
        this.lists.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async ping() {
    return true;
  }
}

declare global {
  var __novagaitStore: Store | undefined;
}

function redisEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/** Singleton accessor. Redis when marketplace env vars exist, memory otherwise. */
export function getStore(): Store {
  if (!globalThis.__novagaitStore) {
    const env = redisEnv();
    globalThis.__novagaitStore = env
      ? new RedisStore(new Redis({ url: env.url, token: env.token }))
      : new MemoryStore();
  }
  return globalThis.__novagaitStore;
}

/** Test hook: replace the singleton (unit tests use a fresh MemoryStore). */
export function __setStoreForTests(store: Store | undefined) {
  globalThis.__novagaitStore = store;
}

export function newMemoryStore(): Store {
  return new MemoryStore();
}
