import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { IAccessCandidate, TAccessRole } from '@sre/types/ACL.types';
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
        const imagePath = testData.getDataPath('file-samples/sample.png');
        const binary = new BinaryInput(`file://${imagePath}`);
        await binary.ready();

        const jsonData = await binary.getJsonData(mockCandidate);
        expect(jsonData.mimetype).toBe('image/png');
        expect(jsonData.size).toBe(fs.statSync(imagePath).size);
        expect(jsonData.name).toContain('.png');
        expect(jsonData.url).toMatch(/^smythfs:\/\/.*\.png$/);
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
});
