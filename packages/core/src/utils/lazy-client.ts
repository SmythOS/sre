import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('LazyLoader');

const lazyLoadedModules = new Map<string, any>();

export async function LazyLoadFallback<T>(client: T | string): Promise<T> {
    if (typeof client !== 'string') {
        //if string we assume it is a module name
        return client;
    }
    // Import the entire module
    try {
        if (lazyLoadedModules.has(client)) {
            console.debug(`Reusing cached module "${client}"`);
            return lazyLoadedModules.get(client) as T;
        }
        console.debug(`Importing module "${client}"`);
        const _module = await import(client);
        lazyLoadedModules.set(client, _module);
        return _module as T;
    } catch (error) {
        console.print(
            `Failed to import module "${client}". Please install the required package:\n` +
                `  pnpm add ${client}\n\n` +
                `Original error: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
    }
}
