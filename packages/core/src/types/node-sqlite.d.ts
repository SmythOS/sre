declare module 'node:sqlite' {
    export type SQLiteRunResult = {
        changes?: number;
        lastInsertRowid?: number | bigint;
    };

    export class StatementSync {
        all<T = any>(...params: any[]): T[];
        get<T = any>(...params: any[]): T | undefined;
        run(...params: any[]): SQLiteRunResult;
        iterate<T = any>(...params: any[]): IterableIterator<T>;
        columns(): Array<{ name: string }>;
        setAllowBareNamedParameters(allow: boolean): void;
        setAllowUnknownNamedParameters(allow: boolean): void;
        setReadBigInts(readBigInts: boolean): void;
        setReturnArrays(returnArrays: boolean): void;
    }

    export class DatabaseSync {
        constructor(filename: string);
        open(filename: string): void;
        close(): void;
        exec(sql: string): void;
        prepare(sql: string): StatementSync;
        function(name: string, options: any, func: (...args: any[]) => any): void;
        aggregate(name: string, options: any): void;
        createSession(): any;
        applyChangeset(changeSet: Buffer): void;
        enableLoadExtension(enabled: boolean): void;
        loadExtension(fileName: string, entryPoint?: string): void;
        location(filename: string): void;
    }

    export function backup(sourceFilename: string, destinationFilename: string): void;

    export const constants: Record<string, number>;

    const _default: {
        DatabaseSync: typeof DatabaseSync;
        StatementSync: typeof StatementSync;
        backup: typeof backup;
        constants: typeof constants;
    };
    export default _default;
}
