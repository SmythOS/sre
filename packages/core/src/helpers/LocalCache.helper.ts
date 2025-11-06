interface CacheItem<T> {
    value: T;
    expiry: number;
}

/**
 * A local cache helper used to cache data, functions or object instances
 * This is useful when you need to cache an object and refresh the cache if the object is accessed within a certain time period
 *
 * @template K - The type of the key
 * @template V - The type of the value
 */
export class LocalCache<K, V> {
    private cache: Map<K, V>;
    private expiryMap: Map<K, number>;
    private timeouts: Map<K, NodeJS.Timeout>;
    private defaultTTL: number = 60 * 60 * 1000;

    constructor(defaultTTL: number = 60 * 60 * 1000) {
        this.defaultTTL = defaultTTL;
        this.cache = new Map<K, V>();
        this.expiryMap = new Map<K, number>();
        this.timeouts = new Map<K, NodeJS.Timeout>();
    }

    set(key: K, value: V, ttlMs: number = this.defaultTTL): void {
        this.cache.set(key, value);
        const expiry = Date.now() + ttlMs;
        this.expiryMap.set(key, expiry);

        // Clear any existing timeout for this key
        this.clearTimeout(key);

        // Set a new timeout to remove the item when it expires
        const timeout = setTimeout(() => {
            this.delete(key);
        }, ttlMs);
        this.timeouts.set(key, timeout);
        timeout.unref(); //unblock the event loop
    }

    updateTTL(key: K, ttlMs: number = this.defaultTTL): void {
        if (!this.has(key)) {
            return;
        }
        const expiry = Date.now() + ttlMs;
        this.expiryMap.set(key, expiry);

        // Clear existing timeout and set a new one
        this.clearTimeout(key);
        const timeout = setTimeout(() => {
            this.delete(key);
        }, ttlMs);
        this.timeouts.set(key, timeout);
        timeout.unref(); //unblock the event loop
    }

    /**
     * Get the value from the cache, and update the TTL if provided
     * @param key - The key to get the value from the cache
     * @param ttlMs - The TTL in milliseconds
     * @returns The value from the cache
     */
    get(key: K, ttlMs?: number): V | undefined {
        if (!this.has(key)) {
            return undefined;
        }
        const value = this.cache.get(key);
        if (value === undefined) {
            return undefined;
        }
        this.updateTTL(key, ttlMs);
        return value;
    }

    /**
     * Check if the key exists in the cache
     * @param key - The key to check if it exists in the cache
     * @returns True if the key exists in the cache, false otherwise
     */
    has(key: K): boolean {
        if (!this.cache.has(key)) {
            return false;
        }
        const expiry = this.expiryMap.get(key);
        if (expiry && Date.now() > expiry) {
            this.delete(key);
            return false;
        }
        return true;
    }

    delete(key: K): boolean {
        this.clearTimeout(key);
        this.expiryMap.delete(key);
        return this.cache.delete(key);
    }

    clear(): void {
        for (const key of this.cache.keys()) {
            this.clearTimeout(key);
        }
        this.cache.clear();
        this.expiryMap.clear();
        this.timeouts.clear();
    }

    private clearTimeout(key: K): void {
        const timeout = this.timeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(key);
        }
    }
}
