export function createSafeAccessor<T extends object>(base: T, root?: any, currentPath?: string, props?: Record<string, any>): T {
    return new Proxy(base, {
        get(target, prop: string) {
            // special properties, return their values
            if (prop === '__root__') {
                return root;
            }

            if (prop === '__path__') {
                return currentPath || '';
            }

            if (prop === '__props__') {
                return props || {};
            }

            //function properties
            if (typeof target[prop] === 'function') {
                return target[prop];
            }

            if (!(prop in target)) {
                // Build the new path by appending current property
                const newPath = currentPath ? `${currentPath}.${prop}` : prop;
                const obj = {};
                // return another Proxy to go deeper with the accumulated path
                return createSafeAccessor(obj, root, newPath);
            }
            return (target as any)[prop];
        },
    }) as T;
}
