import { Cache } from '@smythos/sdk';

// Uses default cache (usually Redis if configured, or LocalStorage/RAM)
const cache = Cache.default();

console.log('Setting value...');
await cache.set('my-key', { foo: 'bar' });

const exists = await cache.exists('my-key');
console.log('Exists:', exists);

const value = await cache.get('my-key');
console.log('Value:', value);

console.log('Deleting value...');
await cache.delete('my-key');

const existsAfter = await cache.exists('my-key');
console.log('Exists after delete:', existsAfter);

// Example with TTL
console.log('Setting value with TTL (2s)...');
await cache.set('ttl-key', 'temporary', 2);

const ttl = await cache.getTTL('ttl-key');
console.log('TTL:', ttl);

// Wait for expiration
await new Promise(resolve => setTimeout(resolve, 2500));
const expiredValue = await cache.get('ttl-key');
console.log('Expired Value:', expiredValue); // Should be null/undefined
