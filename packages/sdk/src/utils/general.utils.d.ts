export declare function uid(): string;
export declare function isFile(str: string): boolean;
/**
* Validates if a string is in a valid file path format for both Windows and Unix systems
* Supports both absolute and relative paths
*/
export declare function isValidPathFormat(path: string): boolean;
