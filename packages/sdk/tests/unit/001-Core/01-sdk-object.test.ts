import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @smythos/sre
// ---------------------------------------------------------------------------
vi.mock('@smythos/sre', async () => {
    return {
        SRE: {
            init: vi.fn(),
            ready: vi.fn().mockResolvedValue(true),
            initializing: false,
        },
    };
});

import { SDKObject } from '../../../src/Core/SDKObject.class';
import { SRE } from '@smythos/sre';

// ---------------------------------------------------------------------------
// Test subclass to access protected members
// ---------------------------------------------------------------------------
class TestSDKObject extends SDKObject {
    public callInit(resolve?: boolean) {
        return this.init(resolve);
    }
    public callInitSignal() {
        return this.initSignal();
    }
}

// ---------------------------------------------------------------------------
// SDKObject
// ---------------------------------------------------------------------------
describe('SDKObject', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (SRE as any).initializing = false;
    });

    // 1. Constructor creates instance
    it('constructor creates an instance', () => {
        const obj = new TestSDKObject();
        expect(obj).toBeInstanceOf(SDKObject);
    });

    // 2. ready getter returns a promise that resolves to true
    it('ready getter returns a promise that resolves to true', async () => {
        const obj = new TestSDKObject();
        const result = await obj.ready;
        expect(result).toBe(true);
    });

    // 3. init() calls SRE.init if not initializing
    it('init() calls SRE.init when SRE is not initializing', async () => {
        (SRE as any).initializing = false;
        const obj = new TestSDKObject();
        await obj.ready;
        expect(SRE.init).toHaveBeenCalledWith({});
    });

    // 4. init() skips SRE.init if already initializing
    it('init() skips SRE.init when SRE is already initializing', async () => {
        (SRE as any).initializing = true;
        const obj = new TestSDKObject();
        await obj.ready;
        expect(SRE.init).not.toHaveBeenCalled();
    });

    // 5. on/emit - can register and receive events
    it('on/emit - can register and receive events', async () => {
        const obj = new TestSDKObject();
        await obj.ready;

        const listener = vi.fn();
        obj.on('test', listener);
        obj.emit('test');

        expect(listener).toHaveBeenCalledOnce();
    });

    // 6. once - listener fires only once
    it('once - listener fires only once', async () => {
        const obj = new TestSDKObject();
        await obj.ready;

        const listener = vi.fn();
        obj.once('ping', listener);
        obj.emit('ping');
        obj.emit('ping');

        expect(listener).toHaveBeenCalledOnce();
    });

    // 7. off - removes listener
    it('off - removes a registered listener', async () => {
        const obj = new TestSDKObject();
        await obj.ready;

        const listener = vi.fn();
        obj.on('evt', listener);
        obj.off('evt', listener);
        obj.emit('evt');

        expect(listener).not.toHaveBeenCalled();
    });

    // 8. removeListener - removes listener
    it('removeListener - removes a registered listener', async () => {
        const obj = new TestSDKObject();
        await obj.ready;

        const listener = vi.fn();
        obj.on('evt', listener);
        obj.removeListener('evt', listener);
        obj.emit('evt');

        expect(listener).not.toHaveBeenCalled();
    });

    // 9. Multiple events - can listen to different events
    it('can listen to multiple different events', async () => {
        const obj = new TestSDKObject();
        await obj.ready;

        const listenerA = vi.fn();
        const listenerB = vi.fn();
        obj.on('alpha', listenerA);
        obj.on('beta', listenerB);

        obj.emit('alpha');
        expect(listenerA).toHaveBeenCalledOnce();
        expect(listenerB).not.toHaveBeenCalled();

        obj.emit('beta');
        expect(listenerB).toHaveBeenCalledOnce();
    });

    // 10. Event with args - args are passed through
    it('event arguments are passed through to the listener', async () => {
        const obj = new TestSDKObject();
        await obj.ready;

        const listener = vi.fn();
        obj.on('data', listener);
        obj.emit('data', 'hello', 42, { key: 'value' });

        expect(listener).toHaveBeenCalledWith('hello', 42, { key: 'value' });
    });
});
