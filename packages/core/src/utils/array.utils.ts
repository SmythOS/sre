/**
 * Utility method to chunk arrays into smaller batches
 */
export function chunkArr<T>(arr: T[], sizePerChunk: number): T[][] {
    return arr.reduce((chunks, elem, index) => {
        const chunkIndex = Math.floor(index / sizePerChunk);
        const chunk = chunks[chunkIndex] || [];
        chunks[chunkIndex] = chunk.concat([elem]);
        return chunks;
    }, [] as T[][]);
}
