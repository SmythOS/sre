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

export async function concurrentAsyncProcess<T, R>(items: T[], callback: (item: T) => Promise<R>, n?: number): Promise<(R | undefined)[]> {
    if (!Array.isArray(items)) return [];

    // Keep 1 CPU free for other tasks
    const limitCount = n ? n : 10;
    const limit = pLimit(limitCount);

    // Process each item with defined limit
    const promises = items.map((item) => limit(() => callback(item)));
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
