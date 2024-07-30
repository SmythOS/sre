import pLimit from 'p-limit';
export function uid() {
    return (Date.now() + Math.random()).toString(36).replace('.', '').toUpperCase();
}

/**
 * this function is used to check if a class is a subclass of another class
 * @param subClass
 * @param superClass
 * @returns
 */
export function isSubclassOf(subClass: any, superClass: any): boolean {
    if (typeof subClass !== 'function' || typeof superClass !== 'function') {
        return false;
    }

    let prototype = Object.getPrototypeOf(subClass.prototype);
    let depth = 10;

    while (prototype && depth >= 0) {
        if (prototype === superClass.prototype) {
            return true;
        }
        prototype = Object.getPrototypeOf(prototype);
        depth++;
    }

    return false;
}

/**
 * Processes an array of items concurrently with a specified concurrency limit.
 *
 * @template T - The type of items to be processed.
 * @template R - The type of the result returned by the processing function.
 *
 * @param {Object} params - The parameters for the function.
 * @param {T[]} params.items - The array of items to be processed.
 * @param {(item: T) => Promise<R>} params.processItem - The asynchronous function to process each item.
 * @param {number} [params.maxConcurrentItems=10] - The maximum number of concurrent processes. Defaults to 10 if not provided.
 *
 * @returns {Promise<(R)[]>} - A promise that resolves to an array of results.
 * Only successfully fulfilled promises are included in the result array.
 *
 * @throws {TypeError} - Throws an error if the items parameter is not an array.
 *
 * @example
 * const items = [1, 2, 3, 4, 5];
 * const itemProcessor = async (item: number) => {
 *     // Simulate an asynchronous operation
 *     return item * 2;
 * };
 *
 * processWithConcurrencyLimit({ items, itemProcessor, maxConcurrentItems: 2 })
 *     .then(results => console.log(results)) // [2, 4, 6, 8, 10]
 *     .catch(error => console.error(error));
 *
 * @note Currently, this function ignores items that fail to process.
 *       Only successfully fulfilled promises are included in the result array.
 *       To improve this behavior, we could add an option to control whether to exit the function if a process fails.
 */
export async function processWithConcurrencyLimit<T, R>({
    items,
    itemProcessor,
    maxConcurrentItems,
}: {
    items: T[];
    itemProcessor: (item: T) => Promise<R>;
    maxConcurrentItems?: number;
}): Promise<R[]> {
    if (!Array.isArray(items)) return [];

    const concurrencyLimiter = pLimit(maxConcurrentItems || 10);

    // Process each item with defined limit
    const promises = items.map((item) => concurrencyLimiter(() => itemProcessor(item)));
    const results = await Promise.allSettled(promises);

    // Filter for successfully fulfilled promises and extract their values
    const validResults = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])).filter((item) => item);

    return validResults;
}

export const detectURLSourceType = (url: string) => {
    const urlObj = new URL(url);
    const ext = urlObj.pathname.split('.').pop();

    switch (ext) {
        case 'pdf':
            return 'PDF';
        case 'xml':
            return 'SITEMAP';
        case 'html':
        case 'htm':
        case 'txt':
            return 'WEBPAGE';
        case 'doc':
        case 'docx':
            return 'WORD';
        default:
            return 'WEBPAGE';
    }
};
