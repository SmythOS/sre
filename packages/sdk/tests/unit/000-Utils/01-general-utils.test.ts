import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uid, nGramSearch, isFile, isValidPathFormat } from '../../../src/utils/general.utils';
import { ControlledPromise } from '../../../src/utils/index';
import { SDKLog } from '../../../src/utils/console.utils';
import { showHelp, HELP } from '../../../src/utils/help';

// ---------------------------------------------------------------------------
// Mock fs for isFile tests
// ---------------------------------------------------------------------------
vi.mock('fs', () => {
    return {
        default: {
            statSync: vi.fn(),
        },
    };
});

import fs from 'fs';
const statSyncMock = vi.mocked(fs.statSync);

// ---------------------------------------------------------------------------
// uid()
// ---------------------------------------------------------------------------
describe('uid()', () => {
    it('returns a non-empty string', () => {
        const id = uid();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    it('returns an uppercase string with no dots', () => {
        const id = uid();
        expect(id).toBe(id.toUpperCase());
        expect(id).not.toContain('.');
    });

    it('generates unique values on consecutive calls', () => {
        const ids = new Set(Array.from({ length: 100 }, () => uid()));
        // With Date.now() + Math.random(), collisions are near-impossible
        expect(ids.size).toBeGreaterThanOrEqual(98);
    });

    it('contains only base-36 characters (0-9, A-Z)', () => {
        for (let i = 0; i < 20; i++) {
            const id = uid();
            expect(id).toMatch(/^[0-9A-Z]+$/);
        }
    });
});

// ---------------------------------------------------------------------------
// nGramSearch()
// ---------------------------------------------------------------------------
describe('nGramSearch()', () => {
    const fruits = ['apple', 'banana', 'cherry', 'date', 'elderberry'];

    // --- null / empty guard ---
    it('returns null for empty search string', () => {
        expect(nGramSearch('', fruits)).toBeNull();
    });

    it('returns null for empty array', () => {
        expect(nGramSearch('apple', [])).toBeNull();
    });

    it('returns null when array is undefined-ish (guarded by ?.length)', () => {
        expect(nGramSearch('apple', null as any)).toBeNull();
        expect(nGramSearch('apple', undefined as any)).toBeNull();
    });

    it('returns null when str is falsy', () => {
        expect(nGramSearch(null as any, fruits)).toBeNull();
        expect(nGramSearch(undefined as any, fruits)).toBeNull();
    });

    // --- basic matching ---
    it('returns exact match when present', () => {
        expect(nGramSearch('apple', fruits)).toBe('apple');
    });

    it('is case insensitive', () => {
        expect(nGramSearch('APPLE', fruits)).toBe('apple');
        expect(nGramSearch('Apple', fruits)).toBe('apple');
    });

    it('returns closest fuzzy match', () => {
        expect(nGramSearch('aple', fruits)).toBe('apple');
        expect(nGramSearch('banan', fruits)).toBe('banana');
        expect(nGramSearch('cher', fruits)).toBe('cherry');
    });

    // --- short strings (shorter than gram size) ---
    it('handles search string shorter than gram size', () => {
        // 'da' is shorter than n=3, stored as single ngram "da".
        // No candidate has "da" as a trigram, so all scores are 0 and first candidate wins.
        const result = nGramSearch('da', fruits);
        expect(result).toBe('apple'); // first candidate when all scores tie at 0

        // With gram size 2, 'da' matches 'date' which contains bigram 'da'
        const result2 = nGramSearch('da', fruits, 2);
        expect(result2).toBe('date');
    });

    it('handles candidate strings shorter than gram size', () => {
        const arr = ['ab', 'cd', 'ef'];
        const result = nGramSearch('ab', arr);
        expect(result).toBe('ab');
    });

    it('handles both search and candidates shorter than gram size', () => {
        const arr = ['hi', 'no', 'ok'];
        const result = nGramSearch('hi', arr);
        expect(result).toBe('hi');
    });

    // --- custom gram size ---
    it('accepts a custom gram size', () => {
        const result = nGramSearch('apple', fruits, 2);
        expect(result).toBe('apple');
    });

    it('works with gram size 1 (unigrams)', () => {
        const result = nGramSearch('xyz', ['xylophone', 'yo-yo', 'zebra'], 1);
        expect(result).not.toBeNull();
    });

    // --- edge: single-element array ---
    it('returns the only candidate when array has one element', () => {
        expect(nGramSearch('anything', ['solo'])).toBe('solo');
    });

    // --- edge: empty-string candidates ---
    it('handles empty-string candidates gracefully', () => {
        // union size can be 0 when both are empty substrings -> similarity 0
        const result = nGramSearch('test', ['', 'testing']);
        expect(result).toBe('testing');
    });

    // --- tie-breaking: first best wins ---
    it('returns the first candidate when scores are tied', () => {
        const arr = ['aaa', 'bbb', 'ccc'];
        // 'zzz' shares nothing with any, all score 0 -> first candidate wins
        expect(nGramSearch('zzz', arr)).toBe('aaa');
    });
});

// ---------------------------------------------------------------------------
// isValidPathFormat()
// ---------------------------------------------------------------------------
describe('isValidPathFormat()', () => {
    // --- valid paths ---
    it('accepts Unix absolute paths', () => {
        expect(isValidPathFormat('/usr/local/bin')).toBe(true);
        expect(isValidPathFormat('/tmp/file.txt')).toBe(true);
        expect(isValidPathFormat('/')).toBe(true);
    });

    it('accepts Unix home paths', () => {
        expect(isValidPathFormat('~/Documents/file.txt')).toBe(true);
        expect(isValidPathFormat('~/')).toBe(true);
    });

    it('accepts Unix relative paths (./ and ../)', () => {
        expect(isValidPathFormat('./file.txt')).toBe(true);
        expect(isValidPathFormat('../parent/file.txt')).toBe(true);
    });

    it('accepts Windows absolute paths', () => {
        expect(isValidPathFormat('C:\\')).toBe(true);
        expect(isValidPathFormat('D:\\Users\\file.txt')).toBe(true);
        expect(isValidPathFormat('C:/Users/file.txt')).toBe(true);
    });

    it('accepts Windows UNC paths', () => {
        expect(isValidPathFormat('\\\\server\\share')).toBe(true);
        expect(isValidPathFormat('\\\\server\\share\\folder')).toBe(true);
    });

    it('accepts Windows relative paths (.\\  and ..\\)', () => {
        expect(isValidPathFormat('.\\file.txt')).toBe(true);
        expect(isValidPathFormat('..\\parent\\file.txt')).toBe(true);
    });

    it('accepts generic relative paths (no leading dot)', () => {
        expect(isValidPathFormat('file.txt')).toBe(true);
        expect(isValidPathFormat('some/path/file.txt')).toBe(true);
    });

    // --- invalid paths ---
    it('rejects paths with null byte', () => {
        expect(isValidPathFormat('/path/\0/bad')).toBe(false);
    });

    it('rejects paths with < > " | ? *', () => {
        expect(isValidPathFormat('/path/<bad>')).toBe(false);
        expect(isValidPathFormat('/path/file"name')).toBe(false);
        expect(isValidPathFormat('/path/file|name')).toBe(false);
        expect(isValidPathFormat('/path/file?name')).toBe(false);
        expect(isValidPathFormat('/path/file*name')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isFile()
// ---------------------------------------------------------------------------
describe('isFile()', () => {
    beforeEach(() => {
        statSyncMock.mockReset();
    });

    it('returns false for empty string', () => {
        expect(isFile('')).toBe(false);
    });

    it('returns false for null/undefined', () => {
        expect(isFile(null as any)).toBe(false);
        expect(isFile(undefined as any)).toBe(false);
    });

    it('returns false for strings >= 1000 chars', () => {
        const longPath = '/tmp/' + 'a'.repeat(1000);
        expect(isFile(longPath)).toBe(false);
    });

    it('returns false for strings with invalid path characters', () => {
        expect(isFile('/path/<bad>')).toBe(false);
        // statSync should not be called for invalid format
        expect(statSyncMock).not.toHaveBeenCalled();
    });

    it('returns true when statSync says path is a file', () => {
        statSyncMock.mockReturnValue({ isFile: () => true } as any);
        expect(isFile('/tmp/real-file.txt')).toBe(true);
        expect(statSyncMock).toHaveBeenCalledWith('/tmp/real-file.txt');
    });

    it('returns false when statSync says path is a directory (not a file)', () => {
        statSyncMock.mockReturnValue({ isFile: () => false } as any);
        expect(isFile('/tmp/some-dir')).toBe(false);
    });

    it('returns false when statSync throws (file not found)', () => {
        statSyncMock.mockImplementation(() => {
            throw new Error('ENOENT');
        });
        expect(isFile('/tmp/nonexistent.txt')).toBe(false);
    });

    it('returns false when statSync throws (permission denied)', () => {
        statSyncMock.mockImplementation(() => {
            throw new Error('EACCES');
        });
        expect(isFile('/root/secret.txt')).toBe(false);
    });

    it('accepts a string that is exactly 999 chars (under limit)', () => {
        statSyncMock.mockReturnValue({ isFile: () => true } as any);
        const path = '/' + 'a'.repeat(998);
        expect(path.length).toBe(999);
        expect(isFile(path)).toBe(true);
    });

    it('rejects a string that is exactly 1000 chars (at limit)', () => {
        const path = '/' + 'a'.repeat(999);
        expect(path.length).toBe(1000);
        expect(isFile(path)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ControlledPromise
// ---------------------------------------------------------------------------
describe('ControlledPromise', () => {
    it('is an instance of Promise', () => {
        const cp = new ControlledPromise(() => {});
        expect(cp).toBeInstanceOf(Promise);
        // prevent unhandled rejection
        cp.catch(() => {});
    });

    it('can be resolved externally via .resolve()', async () => {
        const cp = new ControlledPromise<string>(() => {});
        expect(cp.isSettled()).toBe(false);

        cp.resolve('hello');
        const result = await cp;
        expect(result).toBe('hello');
        expect(cp.isSettled()).toBe(true);
    });

    it('can be rejected externally via .reject()', async () => {
        const cp = new ControlledPromise<string>(() => {});
        expect(cp.isSettled()).toBe(false);

        cp.reject(new Error('boom'));
        await expect(cp).rejects.toThrow('boom');
        expect(cp.isSettled()).toBe(true);
    });

    it('ignores subsequent resolve after first resolve (settles once)', async () => {
        const cp = new ControlledPromise<string>(() => {});
        cp.resolve('first');
        cp.resolve('second'); // should be a no-op

        const result = await cp;
        expect(result).toBe('first');
        expect(cp.isSettled()).toBe(true);
    });

    it('ignores subsequent reject after first resolve', async () => {
        const cp = new ControlledPromise<string>(() => {});
        cp.resolve('ok');
        cp.reject(new Error('nope')); // no-op

        const result = await cp;
        expect(result).toBe('ok');
    });

    it('ignores subsequent resolve after first reject', async () => {
        const cp = new ControlledPromise<string>(() => {});
        cp.reject(new Error('fail'));
        cp.resolve('too late'); // no-op

        await expect(cp).rejects.toThrow('fail');
    });

    it('ignores subsequent reject after first reject', async () => {
        const cp = new ControlledPromise<string>(() => {});
        cp.reject(new Error('first-fail'));
        cp.reject(new Error('second-fail')); // no-op

        await expect(cp).rejects.toThrow('first-fail');
    });

    it('executor receives resolve, reject, and isSettled', async () => {
        let executorCalled = false;
        const cp = new ControlledPromise<number>((resolve, reject, isSettled) => {
            executorCalled = true;
            expect(typeof resolve).toBe('function');
            expect(typeof reject).toBe('function');
            expect(typeof isSettled).toBe('function');
            expect(isSettled()).toBe(false);
            resolve(42);
        });

        expect(executorCalled).toBe(true);
        const result = await cp;
        expect(result).toBe(42);
        expect(cp.isSettled()).toBe(true);
    });

    it('isSettled returns false before resolution', () => {
        const cp = new ControlledPromise(() => {});
        expect(cp.isSettled()).toBe(false);
        // clean up
        cp.resolve(undefined as any);
    });
});

// ---------------------------------------------------------------------------
// SDKLog
// ---------------------------------------------------------------------------
describe('SDKLog', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('has warn, error, info, debug, and log methods', () => {
        expect(typeof SDKLog.warn).toBe('function');
        expect(typeof SDKLog.error).toBe('function');
        expect(typeof SDKLog.info).toBe('function');
        expect(typeof SDKLog.debug).toBe('function');
        expect(typeof SDKLog.log).toBe('function');
    });

    it('warn() calls console.warn', () => {
        SDKLog.warn('test warning');
        expect(console.warn).toHaveBeenCalled();
    });

    it('error() calls console.error', () => {
        SDKLog.error('test error');
        expect(console.error).toHaveBeenCalled();
    });

    it('info() calls console.info', () => {
        SDKLog.info('test info');
        expect(console.info).toHaveBeenCalled();
    });

    it('debug() calls console.debug', () => {
        SDKLog.debug('test debug');
        expect(console.debug).toHaveBeenCalled();
    });

    it('log() calls console.log', () => {
        SDKLog.log('test log');
        expect(console.log).toHaveBeenCalled();
    });

    it('passes multiple arguments through', () => {
        SDKLog.info('a', 'b', 'c');
        expect(console.info).toHaveBeenCalledWith('[INFO]', 'a', 'b', 'c');
    });

    it('log passes arguments directly (no prefix)', () => {
        SDKLog.log('raw', 'message');
        expect(console.log).toHaveBeenCalledWith('raw', 'message');
    });
});

// ---------------------------------------------------------------------------
// showHelp() / HELP
// ---------------------------------------------------------------------------
describe('showHelp()', () => {
    beforeEach(() => {
        // showHelp uses SDKLog.log internally (via const console = SDKLog)
        // We spy on the real console.log which SDKLog.log delegates to
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs a message with the url when url is provided', () => {
        showHelp('https://example.com');
        expect(console.log).toHaveBeenCalled();
    });

    it('uses default message prefix "Learn more:"', () => {
        showHelp('https://example.com');
        // SDKLog.log passes args directly to console.log
        const callArg = (console.log as any).mock.calls[0][0];
        expect(callArg).toContain('Learn more:');
        expect(callArg).toContain('https://example.com');
    });

    it('uses custom message when provided', () => {
        showHelp('https://docs.io', 'Read the docs:');
        const callArg = (console.log as any).mock.calls[0][0];
        expect(callArg).toContain('Read the docs:');
    });

    it('does nothing when url is empty', () => {
        showHelp('');
        expect(console.log).not.toHaveBeenCalled();
    });

    it('does nothing when url is falsy', () => {
        showHelp(null as any);
        expect(console.log).not.toHaveBeenCalled();
        showHelp(undefined as any);
        expect(console.log).not.toHaveBeenCalled();
    });
});

describe('HELP constant', () => {
    it('has SRE and SDK sections', () => {
        expect(HELP).toHaveProperty('SRE');
        expect(HELP).toHaveProperty('SDK');
    });

    it('SRE has SECURITY_MODEL key', () => {
        expect(HELP.SRE).toHaveProperty('SECURITY_MODEL');
    });

    it('SDK has expected keys', () => {
        expect(HELP.SDK).toHaveProperty('AGENT_STORAGE_ACCESS');
        expect(HELP.SDK).toHaveProperty('AGENT_VECTORDB_ACCESS');
        expect(HELP.SDK).toHaveProperty('CHAT_PERSISTENCE');
    });
});
