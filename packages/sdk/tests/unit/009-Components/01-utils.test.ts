import { describe, it, expect } from 'vitest';
import { createSafeAccessor } from '../../../src/Components/utils';

// ---------------------------------------------------------------------------
// createSafeAccessor()
// ---------------------------------------------------------------------------
describe('createSafeAccessor()', () => {
    // --- __root__ ---
    it('__root__ returns the root argument', () => {
        const root = { id: 'root-object' };
        const proxy = createSafeAccessor({}, root);
        expect((proxy as any).__root__).toBe(root);
    });

    it('__root__ returns undefined when no root is provided', () => {
        const proxy = createSafeAccessor({});
        expect((proxy as any).__root__).toBeUndefined();
    });

    // --- __path__ ---
    it('__path__ returns the currentPath', () => {
        const proxy = createSafeAccessor({}, undefined, 'some.path');
        expect((proxy as any).__path__).toBe('some.path');
    });

    it('__path__ returns empty string when currentPath is not set', () => {
        const proxy = createSafeAccessor({});
        expect((proxy as any).__path__).toBe('');
    });

    it('__path__ returns empty string when currentPath is undefined', () => {
        const proxy = createSafeAccessor({}, undefined, undefined);
        expect((proxy as any).__path__).toBe('');
    });

    // --- __props__ ---
    it('__props__ returns the props argument', () => {
        const props = { description: 'test', default: true };
        const proxy = createSafeAccessor({}, undefined, '', props);
        expect((proxy as any).__props__).toBe(props);
        expect((proxy as any).__props__).toEqual({ description: 'test', default: true });
    });

    it('__props__ returns empty object when props is not provided', () => {
        const proxy = createSafeAccessor({});
        expect((proxy as any).__props__).toEqual({});
    });

    // --- nested path accumulation ---
    it('accumulates nested property paths: proxy.a.b.c.__path__ === "a.b.c"', () => {
        const proxy = createSafeAccessor({});
        expect((proxy as any).a.b.c.__path__).toBe('a.b.c');
    });

    it('accumulates a single-level path: proxy.foo.__path__ === "foo"', () => {
        const proxy = createSafeAccessor({});
        expect((proxy as any).foo.__path__).toBe('foo');
    });

    it('accumulates deeply nested paths', () => {
        const proxy = createSafeAccessor({});
        expect((proxy as any).x.y.z.w.v.__path__).toBe('x.y.z.w.v');
    });

    // --- path accumulation with initial currentPath ---
    it('prepends initial currentPath when accumulating: currentPath="x", proxy.y.__path__ === "x.y"', () => {
        const proxy = createSafeAccessor({}, undefined, 'x');
        expect((proxy as any).y.__path__).toBe('x.y');
    });

    it('prepends initial currentPath for deeper nesting', () => {
        const proxy = createSafeAccessor({}, undefined, 'base');
        expect((proxy as any).level1.level2.__path__).toBe('base.level1.level2');
    });

    // --- function properties on base ---
    it('returns function properties on base directly', () => {
        const fn = () => 42;
        const base = { myFunc: fn };
        const proxy = createSafeAccessor(base);
        expect((proxy as any).myFunc).toBe(fn);
        expect((proxy as any).myFunc()).toBe(42);
    });

    it('returns function properties even when root and path are set', () => {
        const fn = () => 'hello';
        const base = { greet: fn };
        const proxy = createSafeAccessor(base, { id: 'root' }, 'some.path');
        expect((proxy as any).greet).toBe(fn);
    });

    // --- properties existing in base ---
    it('returns properties existing in base directly', () => {
        const base = { name: 'test', value: 123 };
        const proxy = createSafeAccessor(base);
        expect((proxy as any).name).toBe('test');
        expect((proxy as any).value).toBe(123);
    });

    it('returns falsy base properties directly (not as proxy)', () => {
        const base = { empty: '', zero: 0, no: false, nil: null };
        const proxy = createSafeAccessor(base as any);
        expect((proxy as any).empty).toBe('');
        expect((proxy as any).zero).toBe(0);
        expect((proxy as any).no).toBe(false);
        expect((proxy as any).nil).toBeNull();
    });

    // --- properties NOT in base return nested proxies ---
    it('returns a proxy for properties not in base', () => {
        const proxy = createSafeAccessor({});
        const nested = (proxy as any).nonexistent;
        // It should be an object (proxy) with path accumulation
        expect(typeof nested).toBe('object');
        expect(nested.__path__).toBe('nonexistent');
    });

    it('nested proxies preserve root from parent', () => {
        const root = { id: 'the-root' };
        const proxy = createSafeAccessor({}, root);
        const nested = (proxy as any).child;
        expect(nested.__root__).toBe(root);
    });

    // --- combined behavior ---
    it('base properties take precedence over path accumulation', () => {
        const inner = createSafeAccessor({}, undefined, 'body');
        const base = { body: inner, headers: createSafeAccessor({}, undefined, 'headers') };
        const proxy = createSafeAccessor(base, undefined, '');

        // Accessing 'body' returns the base value, not a new proxy
        expect((proxy as any).body).toBe(inner);
        expect((proxy as any).body.__path__).toBe('body');
    });

    it('special properties (__root__, __path__, __props__) take precedence over base properties', () => {
        const base = { __root__: 'should-be-overridden', __path__: 'should-be-overridden' };
        const root = { id: 'real-root' };
        const proxy = createSafeAccessor(base as any, root, 'real-path');
        expect((proxy as any).__root__).toBe(root);
        expect((proxy as any).__path__).toBe('real-path');
    });
});
