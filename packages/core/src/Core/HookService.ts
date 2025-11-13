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

// Symbol to mark methods that have been wrapped by hookAsync
const HOOK_WRAPPED_SYMBOL = Symbol('__hookAsync_wrapped');

/**
 * Creates a hook wrapper function for a given method
 */
function createHookWrapper(
    hookName: string,
    methodToWrap: Function,
    customContext?: Record<string, any> | ((instance: any) => Record<string, any>)
): Function {
    const wrapped = async function (this: any, ...args: any[]) {
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
            result = await methodToWrap.apply(this, args);
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

    // Mark as wrapped to prevent double-wrapping
    (wrapped as any)[HOOK_WRAPPED_SYMBOL] = true;
    return wrapped;
}

/**
 * Decorator function that executes registered hooks asynchronously before and after the decorated method
 * Automatically wraps child class methods that override the decorated method
 *
 * How it works:
 * 1. When applied to a parent class method, it wraps that method
 * 2. When a child class overrides the method and calls super.process(), the parent wrapper detects it
 * 3. On first detection, the child method is automatically wrapped with the same hook logic
 * 4. The parent wrapper skips its own hooks and delegates to the child wrapper, ensuring hooks execute only once
 * 5. Subsequent calls to the child method use the wrapped version directly
 *
 * Note: For this to work, child classes should call super.process() at least once.
 * If a child overrides without calling super, the method will be wrapped on the first super call.
 * Hooks will only execute once per method call, even when super is used.
 *
 * @param hookName The name of the hook to trigger
 */
export function hookAsync(hookName: string, customContext?: Record<string, any> | ((instance: any) => Record<string, any>)) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const wrappedParentMethod = createHookWrapper(hookName, originalMethod, customContext);

        descriptor.value = async function (...args: any[]) {
            // Check if a child class has overridden this method
            // Walk up the prototype chain starting from the instance's immediate prototype
            // to find where the child class defined its override
            let currentPrototype = Object.getPrototypeOf(this);
            const targetPrototype = target.prototype;
            let childMethod: Function | undefined;
            let childPrototype: any;

            while (currentPrototype && currentPrototype !== targetPrototype) {
                const descriptor = Object.getOwnPropertyDescriptor(currentPrototype, propertyKey);
                if (descriptor && descriptor.value && typeof descriptor.value === 'function') {
                    const method = descriptor.value;
                    // Check if this is a child override
                    if (method !== wrappedParentMethod && method !== originalMethod) {
                        // Check if it's already wrapped
                        if ((method as any)[HOOK_WRAPPED_SYMBOL]) {
                            // Child method is already wrapped - we're being called via super from wrapped child
                            // Call the original parent method directly to avoid infinite recursion
                            // The child wrapper already handles hooks, so we just need parent logic
                            return await originalMethod.apply(this, args);
                        } else {
                            // Child method needs wrapping
                            childMethod = method;
                            childPrototype = currentPrototype;
                            break;
                        }
                    }
                }
                currentPrototype = Object.getPrototypeOf(currentPrototype);
            }

            // If we found an unwrapped child method, wrap it and call it
            if (childMethod && childPrototype) {
                // Wrap the child method and replace it on the prototype
                const wrappedChildMethod = createHookWrapper(hookName, childMethod, customContext);
                Object.defineProperty(childPrototype, propertyKey, {
                    value: wrappedChildMethod,
                    writable: true,
                    enumerable: false,
                    configurable: true,
                });
                // Call the wrapped child method (hooks will execute once)
                return await wrappedChildMethod.apply(this, args);
            }

            // No child override found - use the parent's wrapped method
            // This handles direct calls to parent method (no child override)
            return await wrappedParentMethod.apply(this, args);
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
