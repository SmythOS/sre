import { Logger } from '@sre/helpers/Log.helper';
import { getInstallCommand } from './package-manager.utils';

const console = Logger('LazyLoader');

const lazyLoadedModules = new Map<string, any>();

export async function LazyLoadFallback<T>(client: T | string, packageName?: string): Promise<T> {
    if (typeof client === 'string') {
        packageName = client;
        client = undefined;
    }

    if (client) {
        if (packageName) {
            lazyLoadedModules.set(packageName, client);
        }

        return client as T;
    }
    // Import the entire module
    try {
        if (lazyLoadedModules.has(packageName)) {
            console.debug(`Reusing cached module "${packageName}"`);
            return lazyLoadedModules.get(packageName) as T;
        }
        console.debug(`Importing module "${packageName}"`);
        const _module = await import(packageName);
        lazyLoadedModules.set(packageName, _module);
        return _module as T;
    } catch (error) {
        console.print(
            `Failed to import module "${packageName}". Please install the required package:\n` +
                `  ${getInstallCommand(packageName)}\n\n` +
                `Original error: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
    }
}
