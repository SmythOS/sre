// Type definition for hook execution modes
export enum THook {
    Blocking = 'blocking',
    NonBlocking = 'non-blocking',
}

// Type definition for hook callbacks
type HookCallback = (...args: any[]) => void | Promise<void>;
type AfterHookCallback = (params: { result: any; args: any[]; error?: Error }) => void | Promise<void>;

// Store hooks in separate lists for blocking and non-blocking execution
const blockingHooks: { [key: string]: HookCallback[] } = {};
const nonBlockingHooks: { [key: string]: HookCallback[] } = {};
const blockingAfterHooks: { [key: string]: AfterHookCallback[] } = {};
const nonBlockingAfterHooks: { [key: string]: AfterHookCallback[] } = {};

export class HookService {
    /**
     * Register a new hook callback for a given hook name (executes before method)
     * @param hookName The name of the hook to register
     * @param callback The callback function to execute when the hook is triggered
     * @param mode Execution mode: blocking (default) or non-blocking
     */
    static register(hookName: string, callback: HookCallback, mode: THook = THook.Blocking): void {
        if (typeof callback !== 'function') {
            throw new Error('Hook callback must be a function');
        }

        if (mode === THook.NonBlocking) {
            if (!nonBlockingHooks[hookName]) {
                nonBlockingHooks[hookName] = [];
            }
            nonBlockingHooks[hookName].push(callback);
        } else {
            if (!blockingHooks[hookName]) {
                blockingHooks[hookName] = [];
            }
            blockingHooks[hookName].push(callback);
        }
    }

    /**
     * Register a new after-execution hook callback for a given hook name (executes after method)
     * @param hookName The name of the hook to register
     * @param callback The callback function to execute after the method, receives {result, args, error?}
     * @param mode Execution mode: blocking (default) or non-blocking
     */
    static registerAfter(hookName: string, callback: AfterHookCallback, mode: THook = THook.Blocking): void {
        if (typeof callback !== 'function') {
            throw new Error('After-hook callback must be a function');
        }

        if (mode === THook.NonBlocking) {
            if (!nonBlockingAfterHooks[hookName]) {
                nonBlockingAfterHooks[hookName] = [];
            }
            nonBlockingAfterHooks[hookName].push(callback);
        } else {
            if (!blockingAfterHooks[hookName]) {
                blockingAfterHooks[hookName] = [];
            }
            blockingAfterHooks[hookName].push(callback);
        }
    }

    static trigger(hookName: string, ...args: any[]) {
        // Trigger blocking hooks
        if (blockingHooks[hookName]) {
            blockingHooks[hookName].forEach((callback) => callback(...args));
        }
        // Trigger non-blocking hooks
        if (nonBlockingHooks[hookName]) {
            nonBlockingHooks[hookName].forEach((callback) => callback(...args));
        }
    }

    static triggerAfter(hookName: string, result: any, args: any[], error?: Error) {
        const params = { result, args, error };
        // Trigger blocking after-hooks
        if (blockingAfterHooks[hookName]) {
            blockingAfterHooks[hookName].forEach((callback) => callback(params));
        }
        // Trigger non-blocking after-hooks
        if (nonBlockingAfterHooks[hookName]) {
            nonBlockingAfterHooks[hookName].forEach((callback) => callback(params));
        }
    }
}

/**
 * Decorator function that executes registered hooks before the decorated method
 * @param hookName The name of the hook to trigger
 */
export function hook(hookName: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            // Execute non-blocking hooks first (fire and forget)
            if (nonBlockingHooks[hookName]) {
                void Promise.allSettled(nonBlockingHooks[hookName].map((callback) => Promise.resolve().then(() => callback.apply(this, args))));
            }

            // Execute blocking hooks synchronously
            if (blockingHooks[hookName]) {
                blockingHooks[hookName].forEach((callback) => callback.apply(this, args));
            }

            // Call the original method
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

// Store metadata about which methods should be auto-wrapped in child classes
// Maps constructor -> Map<methodName, {hookName, customContext}>
const hookableMethodsMetadata = new WeakMap<
    any,
    Map<string, { hookName: string; customContext?: Record<string, any> | ((instance: any) => Record<string, any>) }>
>();

/**
 * Class decorator that automatically applies hookAsync to ALL child class methods
 * that override parent methods decorated with hookAsync
 *
 * Usage:
 * @hookableClass
 * export class Component {
 *     @hookAsync('Component.process')
 *     async process(...) { ... }
 *
 *     @hookAsync('Component.postProcess')
 *     async postProcess(...) { ... }
 * }
 */
export function hookableClass<T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
        constructor(...args: any[]) {
            super(...args);

            // Get metadata for this class
            const metadataMap = hookableMethodsMetadata.get(constructor);
            if (!metadataMap) return; // No hooks to apply

            const instance = this as any;
            const childPrototype = Object.getPrototypeOf(instance);
            const parentPrototype = constructor.prototype;

            // Only process if this is a child class instance
            if (childPrototype !== parentPrototype) {
                // Apply hooks to all methods that have metadata
                metadataMap.forEach((metadata, methodName) => {
                    // Get the method from the child prototype
                    const childMethod = childPrototype[methodName];
                    const parentMethod = parentPrototype[methodName];

                    // Check if child has overridden the method
                    if (childMethod && typeof childMethod === 'function' && childMethod !== parentMethod) {
                        // Get or create descriptor for the child method
                        let descriptor = Object.getOwnPropertyDescriptor(childPrototype, methodName);

                        // If not own property, create descriptor from the method
                        if (!descriptor) {
                            descriptor = {
                                value: childMethod,
                                writable: true,
                                enumerable: false,
                                configurable: true,
                            };
                        }

                        // Apply hookAsync decorator to child method
                        const modifiedDescriptor = hookAsync(metadata.hookName, metadata.customContext)(childPrototype, methodName, descriptor);

                        // Update the prototype with the modified descriptor
                        if (modifiedDescriptor && modifiedDescriptor.value) {
                            Object.defineProperty(childPrototype, methodName, {
                                value: modifiedDescriptor.value,
                                writable: true,
                                enumerable: false,
                                configurable: true,
                            });
                        }
                    }
                });
            }
        }
    } as T;
}

/**
 * Decorator function that executes registered hooks asynchronously before and after the decorated method
 * Automatically stores metadata for hookableClass decorator to enable automatic child class wrapping
 * @param hookName The name of the hook to trigger
 */
export function hookAsync(hookName: string, customContext?: Record<string, any> | ((instance: any) => Record<string, any>)) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        // Store metadata for this hookable method (for hookableClass decorator)
        if (!hookableMethodsMetadata.has(target.constructor)) {
            hookableMethodsMetadata.set(target.constructor, new Map());
        }
        const metadataMap = hookableMethodsMetadata.get(target.constructor)!;
        metadataMap.set(propertyKey, { hookName, customContext });

        descriptor.value = async function (...args: any[]) {
            // Check if we're being called via super from a child class that has its own wrapper
            // If this[propertyKey] is different from our wrapped method, a child has overridden it
            const instanceMethod = (this as any)[propertyKey];
            const isSuperCall = instanceMethod !== descriptor.value && instanceMethod !== originalMethod;

            // If called via super from a wrapped child, skip hooks and call original method directly
            // The child wrapper already handles hooks, so we just need parent logic
            if (isSuperCall) {
                return await originalMethod.apply(this, args);
            }

            // Get additional context if contextFn is provided
            let _context;
            if (typeof customContext === 'function') {
                _context = { instance: this, args: args, context: await customContext(this) };
            } else if (typeof customContext === 'object') {
                _context = { instance: this, args: args, context: customContext };
            } else {
                _context = { instance: this, args: args, context: {} };
            }
            // Execute non-blocking pre-hooks first (fire and forget)
            if (nonBlockingHooks[hookName]) {
                void Promise.allSettled(nonBlockingHooks[hookName].map((callback) => Promise.resolve(callback.apply(_context, args)))).catch((err) =>
                    console.error(`Non-blocking hook ${hookName} error:`, err)
                );
            }

            let result: any;
            let error: Error | undefined;

            try {
                // Execute blocking pre-hooks and wait for them
                if (blockingHooks[hookName]) {
                    await Promise.all(blockingHooks[hookName].map((callback) => Promise.resolve(callback.apply(_context, args))));
                }

                // Call the original method
                result = await originalMethod.apply(this, args);
            } catch (err) {
                error = err instanceof Error ? err : new Error(String(err));
            }

            // Execute after-hooks regardless of success or failure
            try {
                // Execute non-blocking after-hooks first (fire and forget)
                if (nonBlockingAfterHooks[hookName]) {
                    void Promise.allSettled(
                        nonBlockingAfterHooks[hookName].map((callback) => Promise.resolve(callback.apply(_context, [{ result, args, error }])))
                    ).catch((err) => console.error(`Non-blocking after-hook ${hookName} error:`, err));
                }

                // Execute blocking after-hooks and wait for them
                if (blockingAfterHooks[hookName]) {
                    await Promise.all(
                        blockingAfterHooks[hookName].map((callback) => Promise.resolve(callback.apply(_context, [{ result, args, error }])))
                    );
                }
            } catch (afterHookError) {
                // Log after-hook errors but don't let them override the original error
                console.error('Error in after-hooks:', afterHookError);
            }

            // Re-throw the original error if there was one
            if (error) {
                throw error;
            }

            return result;
        };

        return descriptor;
    };
}
/**
 * Decorator function that executes registered hooks asynchronously before the decorated method
 * @param hookName The name of the hook to trigger
 * @param contextFn Optional function to extract additional context from the class instance
 */
export function hookAsyncWithContext(hookName: string, contextFn?: (instance: any) => Record<string, any>) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            // Get additional context if contextFn is provided
            const additionalContext = typeof contextFn === 'function' ? await contextFn(this) : {};
            const contextualArgs = [additionalContext, ...args];
            const _context = { instance: this, args: args, context: additionalContext };

            // Execute non-blocking pre-hooks first (fire and forget)
            if (nonBlockingHooks[hookName]) {
                void Promise.allSettled(
                    nonBlockingHooks[hookName].map((callback) => Promise.resolve().then(() => callback.apply(_context, contextualArgs)))
                );
            }

            let result: any;
            let error: Error | undefined;

            try {
                // Execute blocking pre-hooks and wait for them
                if (blockingHooks[hookName]) {
                    await Promise.all(blockingHooks[hookName].map((callback) => Promise.resolve(callback.apply(_context, contextualArgs))));
                }

                // Call the original method
                result = await originalMethod.apply(this, args);
            } catch (err) {
                error = err instanceof Error ? err : new Error(String(err));
            }

            // Execute after-hooks regardless of success or failure
            try {
                // Execute non-blocking after-hooks first (fire and forget)
                if (nonBlockingAfterHooks[hookName]) {
                    void Promise.allSettled(
                        nonBlockingAfterHooks[hookName].map((callback) => Promise.resolve(callback.apply(_context, [{ result, args, error }])))
                    ).catch((err) => console.error(`Non-blocking after-hook ${hookName} error:`, err));
                }

                // Execute blocking after-hooks and wait for them
                if (blockingAfterHooks[hookName]) {
                    await Promise.all(
                        blockingAfterHooks[hookName].map((callback) => Promise.resolve(callback.apply(_context, [{ result, args, error }])))
                    );
                }
            } catch (afterHookError) {
                // Log after-hook errors but don't let them override the original error
                console.error('Error in after-hooks:', afterHookError);
            }

            // Re-throw the original error if there was one
            if (error) {
                throw error;
            }

            return result;
        };

        return descriptor;
    };
}
