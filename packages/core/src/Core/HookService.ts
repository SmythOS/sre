// Type definition for hook callbacks
type HookCallback = (...args: any[]) => void;

// Store hooks in a map where each hook name can have multiple callbacks
const hooks: { [key: string]: HookCallback[] } = {};

export class HookService {
    /**
     * Register a new hook callback for a given hook name
     * @param hookName The name of the hook to register
     * @param callback The callback function to execute when the hook is triggered
     */
    static register(hookName: string, callback: HookCallback): void {
        if (typeof callback !== 'function') {
            throw new Error('Hook callback must be a function');
        }

        if (!hooks[hookName]) {
            hooks[hookName] = [];
        }

        hooks[hookName].push(callback);
    }

    static trigger(hookName: string, ...args: any[]) {
        if (hooks[hookName]) {
            hooks[hookName].forEach((callback) => callback(...args));
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
            // Execute all registered hooks for this hook name
            if (hooks[hookName]) {
                hooks[hookName].forEach((callback) => {
                    callback.apply(this, args);
                });
            }

            // Call the original method
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

/**
 * Decorator function that executes registered hooks asynchronously before the decorated method
 * @param hookName The name of the hook to trigger
 * @param contextFn Optional function to extract additional context from the class instance
 */
export function hookAsync(hookName: string, contextFn?: (instance: any) => Record<string, any>) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            // Execute all registered hooks for this hook name
            if (hooks[hookName]) {
                // Get additional context if contextFn is provided
                const additionalContext = typeof contextFn === 'function' ? await contextFn(this) : {};

                // Wait for all hooks to complete before proceeding
                await Promise.all(hooks[hookName].map((callback) => callback.apply(this, [...args, additionalContext])));
            }

            // Call the original method
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}
