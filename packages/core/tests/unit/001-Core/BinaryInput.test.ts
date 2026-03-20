import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { IAccessCandidate, TAccessRole } from '@sre/types/ACL.types';
import { getBase64FileInfo } from '@sre/utils';
import { MAX_FILE_SIZE } from '@sre/constants';
import { setupSRE } from '../../utils/sre';
import { testData } from '../../utils/test-data-manager';

setupSRE();

describe('BinaryInput Tests', () => {
    const mockCandidate: IAccessCandidate = {
        id: 'test-user',
        role: TAccessRole.User,
    };

    it('should handle string input as text/plain', async () => {
        const textContent = 'Hello, World!';
        const binary = new BinaryInput(textContent, 'test.txt');

        await binary.ready();
        const buffer = await binary.getBuffer();

        expect(buffer.toString()).toBe(textContent);

        const jsonData = await binary.getJsonData(mockCandidate);

        expect(jsonData.mimetype).toBe('text/plain');
        expect(jsonData.name).toContain('.txt');
        expect(jsonData.size).toBe(textContent.length);
        expect(jsonData.url).toMatch(/^smythfs:\/\/.*\.txt$/);
    });

    it('should handle URL input', async () => {
        const imageUrl = 'https://fastly.picsum.photos/id/358/536/354.jpg?hmac=B5MKNtRmR2RBqLeb7thQXV573rQcrX5Hrih-N8SuliM';

        const binary = new BinaryInput(imageUrl);
        await binary.ready();

        const jsonData = await binary.getJsonData(mockCandidate);
        expect(jsonData.mimetype).toBe('image/jpeg');
        expect(jsonData.size).toBe(35108);
        expect(jsonData.name).toContain('.jpg');
        expect(jsonData.url).toMatch(/^smythfs:\/\/.*\.jpg$/);
    });

    it('should handle base64 encoded data', async () => {
        const textContent =
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
        const base64Data = `data:text/plain;base64,${Buffer.from(textContent).toString('base64')}`;
        const binary = new BinaryInput(base64Data, 'test.txt');

        await binary.ready();
        const buffer = await binary.getBuffer();

        expect(buffer.toString()).toBe(textContent);
    });

    it('should handle existing BinaryInput object', async () => {
        const original = new BinaryInput('test content', 'test.txt');
        await original.ready();

        const copy = BinaryInput.from(original);
        await copy.ready();

        expect(copy).toBeInstanceOf(BinaryInput);
        const originalJson = await original.getJsonData(mockCandidate);
        const copyJson = await copy.getJsonData(mockCandidate);
        expect(copyJson).toEqual(originalJson);
    });

    it('should upload binary data and generate SmythFS URL', async () => {
        const content = 'Test content';
        const binary = new BinaryInput(content, 'test.txt');

        await binary.upload(mockCandidate);
        const jsonData = await binary.getJsonData(mockCandidate);

        expect(jsonData.url).toMatch(/^smythfs:\/\/.*\.txt$/);
        expect(jsonData.size).toBe(content.length);
        expect(jsonData.mimetype).toBe('text/plain');
    });

    it('should handle file reading and writing through SmythFS', async () => {
        const content = 'Test content';
        const binary = new BinaryInput(content, 'test.txt');

        await binary.upload(mockCandidate);
        const readData = await binary.readData(mockCandidate);

        expect(readData.toString()).toBe(content);
    });

    // Test with specific file types
    const files = {
        png: {
            mimetype: 'image/png',
            extension: 'png',
            path: testData.getDataPath('file-samples/sample.png'),
        },
        msword: {
            mimetype: 'application/msword',
            extension: 'doc',
            path: testData.getDataPath('file-samples/sample.doc'),
        },
    };

    it.each(Object.entries(files))('should handle %s file', async (name, file) => {
        const buffer = fs.readFileSync(file.path);
        const base64 = buffer.toString('base64');
        const binary = new BinaryInput(`data:${file.mimetype};base64,${base64}`);
        await binary.ready();
        const jsonData = await binary.getJsonData(mockCandidate);
        expect(jsonData.mimetype).toBe(file.mimetype);
        expect(jsonData.name).toContain(`.${file.extension}`);
        expect(jsonData.size).toBe(buffer.length);
        const regex = new RegExp(`^smythfs:\\/\\/.*\\.${file.extension}$`);
        expect(jsonData.url).toMatch(regex);
    });

    // --- Error path tests ---

    it('should reject ready() when load() receives unsupported data', async () => {
        // Passing a number (unsupported type) triggers the "unsupported or invalid data format" throw in load()
        const binary = new BinaryInput(12345 as any, 'test.bin');
        await expect(binary.ready()).rejects.toThrow('BinaryInput: unsupported or invalid data format');
    });

    it('should reject ready() when base64 data exceeds MAX_FILE_SIZE', async () => {
        // Build a base64 data URL whose decoded size exceeds MAX_FILE_SIZE
        // Each base64 char encodes 6 bits → 4 chars = 3 bytes, so we need (MAX_FILE_SIZE + 1) * 4/3 chars
        const oversizedLength = Math.ceil((MAX_FILE_SIZE + 1) * 4 / 3);
        const oversizedBase64 = 'A'.repeat(oversizedLength);
        const dataUrl = `data:application/octet-stream;base64,${oversizedBase64}`;

        const binary = new BinaryInput(dataUrl, 'large.bin');
        await expect(binary.ready()).rejects.toThrow(/exceeds the \d+MB limit/);
    });
});

describe('Base64 Utils - _cleanUpBase64Data (via getBase64FileInfo)', () => {
    it('should reject non-string input via getBase64FileInfo', async () => {
        // _cleanUpBase64Data is private, but called internally by getBase64FileInfo
        // Passing a non-string triggers the type guard; getBase64FileInfo returns null for non-base64
        const result = await getBase64FileInfo(12345 as any);
        expect(result).toBeNull();
    });

    it('should throw when base64 data exceeds MAX_FILE_SIZE', async () => {
        const oversizedLength = Math.ceil((MAX_FILE_SIZE + 1) * 4 / 3);
        const oversizedBase64 = 'A'.repeat(oversizedLength);
        const dataUrl = `data:application/octet-stream;base64,${oversizedBase64}`;

        await expect(getBase64FileInfo(dataUrl)).rejects.toThrow(/exceeds the \d+MB limit/);
    });
});
