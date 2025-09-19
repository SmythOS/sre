import { MemcachedCache } from '@sre/MemoryManager/Cache.service/connectors/MemcachedCache.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TAccessLevel } from '@sre/types/ACL.types';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { vi } from "vitest";

vi.mock("@sre/Security/SecureConnector.class", async () => {
  const actual = await vi.importActual<any>("@sre/Security/SecureConnector.class");

  class MockSecureConnector extends actual.SecureConnector {
    static AccessControl() {
      return function (
        _target: any,
        _propertyKey: string,
        descriptor: PropertyDescriptor
      ) {
        return descriptor;
      };
    }
  }

  return { ...actual, SecureConnector: MockSecureConnector };
});

describe('MemcachedCache (integration)', () => {
  let cache: MemcachedCache;
  let acRequest: AccessRequest;

  beforeAll(() => {
    cache = new MemcachedCache({
      hosts: 'localhost:11211',
      prefix: 'test:cache',
      metadataPrefix: 'test:meta',
    } as any);

    acRequest = new AccessRequest({ id: 'user1', role: 'user' } as any)
    .resource("memcached:test");  ;
  });

  afterAll(async () => {
    await cache.stop();
  });

  it('should set and get a simple value', async () => {
    await cache.set(acRequest, 'foo', 'bar', undefined, undefined, 5);
    const val = await cache.get(acRequest, 'foo');
    expect(val).toBe('bar');
  });

  it('should check if a key exists', async () => {
    await cache.set(acRequest, 'existsKey', '123');
    const exists = await cache.exists(acRequest, 'existsKey');
    expect(exists).toBe(true);
  });

  it('should delete a key', async () => {
    await cache.set(acRequest, 'toDelete', 'value');
    await cache.delete(acRequest, 'toDelete');
    const val = await cache.get(acRequest, 'toDelete');
    expect(val).toBeNull();
  });

  it('should store and retrieve metadata', async () => {
    const metadata = { custom: 'meta', expiresAt: Date.now() + 5000 };
    await cache.setMetadata(acRequest, 'metaKey', metadata);

    const result = await cache.getMetadata(acRequest, 'metaKey');
    expect(result).toMatchObject(metadata);
  });

  it('should update TTL', async () => {
    await cache.set(acRequest, 'ttlKey', 'withTTL', undefined, undefined, 2);
    let ttl = await cache.getTTL(acRequest, 'ttlKey');
    expect(ttl).toBeGreaterThan(0);

    await cache.updateTTL(acRequest, 'ttlKey', 10);
    ttl = await cache.getTTL(acRequest, 'ttlKey');
    expect(ttl).toBeGreaterThanOrEqual(10);
  });

  it('should return expired key as null', async () => {
    await cache.set(acRequest, 'expireKey', 'will-expire', undefined, undefined, 1);
    await new Promise((res) => setTimeout(res, 1500));
    const val = await cache.get(acRequest, 'expireKey');
    expect(val).toBeNull();
  });
});
