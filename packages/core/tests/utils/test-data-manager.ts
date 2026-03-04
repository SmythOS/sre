import { ConnectorService } from '@sre/Core/ConnectorsService';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Centralized test data manager for consistent file path handling
 */
export class TestDataManager {
    private static instance: TestDataManager;
    private baseDir: string;
    private dataDir: string;

    private constructor() {
        // Get the directory of the current file
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        // Navigate to the project root (3 levels up: utils -> tests -> core -> packages)
        this.baseDir = path.resolve(__dirname, '..', '..');
        this.dataDir = path.join(this.baseDir, 'tests', 'data');
    }

    public static getInstance(): TestDataManager {
        if (!TestDataManager.instance) {
            TestDataManager.instance = new TestDataManager();
        }
        return TestDataManager.instance;
    }

    /**
     * Get the path to a test data file
     */
    public getDataPath(filename: string): string {
        return path.join(this.dataDir, filename);
    }

    public getVaultPath(): string {
        return path.join(this.baseDir, 'tests', 'vault.json');
    }

    /**
     * Read and parse a JSON test data file
     */
    public readJsonData(filename: string): any {
        const filePath = this.getDataPath(filename);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Test data file not found: ${filePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }

    /**
     * Read a test data file as string
     */
    public readData(filename: string): string {
        const filePath = this.getDataPath(filename);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Test data file not found: ${filePath}`);
        }
        return fs.readFileSync(filePath, 'utf-8');
    }

    public readBinaryData(filename: string): Buffer {
        const filePath = this.getDataPath(filename);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Test data file not found: ${filePath}`);
        }
        return fs.readFileSync(filePath);
    }
    /**
     * Read and parse a .smyth agent file
     */
    public readAgentData(filename: string): any {
        return this.readJsonData(filename);
    }

    /**
     * Get the base directory for tests
     */
    public getBaseDir(): string {
        return this.baseDir;
    }

    /**
     * Get the data directory
     */
    public getDataDir(): string {
        return this.dataDir;
    }

    /**
     * Check if a test data file exists
     */
    public dataFileExists(filename: string): boolean {
        return fs.existsSync(this.getDataPath(filename));
    }

    /**
     * List available test data files
     */
    public listDataFiles(): string[] {
        if (!fs.existsSync(this.dataDir)) {
            return [];
        }
        return fs.readdirSync(this.dataDir).filter((file) => file.endsWith('.json') || file.endsWith('.smyth') || file.endsWith('.txt'));
    }
}

// Convenience functions
export const testData = TestDataManager.getInstance();

/**
 * Load agent data from a .smyth file
 */
export function loadAgentData(filename: string): any {
    return testData.readAgentData(filename);
}

/**
 * Load JSON test data
 */
export function loadTestData(filename: string): any {
    return testData.readJsonData(filename);
}

/**
 * Get test data file path
 */
export function getTestDataPath(filename: string): string {
    return testData.getDataPath(filename);
}

export function checkIntegrationTestConsent() {
    if (process.env.ENABLE_INTEGRATION_TESTS !== 'true') {
        console.warn(`⚠️  Skipping conversation tests: ENABLE_INTEGRATION_TESTS is not set to true`);
        console.warn(`!!! Integration tests can consume LLM credits from your configured accounts !!!`);
        console.warn(`!!! They are disabled by default. !!!`);
        console.warn(
            `If you know what your are doing your can enable them by setting ENABLE_INTEGRATION_TESTS environment variable to true in the project root level`
        );

        throw new Error('Integration Test Consent failed');
    }
}
