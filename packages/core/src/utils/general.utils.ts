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
 * Processes an array of tasks concurrently with a specified concurrency limit.
 *
 * @template T - The type of the result returned by each task.
 *
 * @param {(() => Promise<T>)[]} tasks - An array of functions that return promises.
 * Each function represents a task to be processed.
 * @param {number} [maxConcurrentTasks=10] - The maximum number of concurrent tasks.
 *
 * @returns {Promise<T[]>} - A promise that resolves to an array of results.
 * Only successfully fulfilled promises are included in the result array.
 *
 * @throws {TypeError} - Throws an error if the tasks parameter is not an array of functions.
 *
 * @example
 * const tasks = [
 *     () => await processFile('file1.txt'),
 *     () => await processFile('file2.txt'),
 *     () => await processFile('file3.txt'),
 * ];
 *
 * const maxConcurrentTasks = 2;
 *
 * processWithConcurrencyLimit(tasks, maxConcurrentTasks)
 *     .then(results => console.log(results)) // Array of results from the fulfilled promises
 *     .catch(error => console.error(error));
 *
 * @note Currently, this function ignores tasks that fail to process.
 *       Only successfully fulfilled promises are included in the result array.
 *       To improve this behavior, we could add an option to control whether to exit the function if a task fails.
 */
export async function processWithConcurrencyLimit<T>(tasks: (() => Promise<T>)[], maxConcurrentTasks: number = 10): Promise<T[]> {
    const limit = pLimit(maxConcurrentTasks);

    const limitedTasks = tasks.map((task) => limit(task));

    const results = await Promise.allSettled(limitedTasks);

    // Filter for successfully fulfilled promises and extract their values
    const validResults = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));

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
