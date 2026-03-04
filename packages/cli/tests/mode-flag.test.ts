/**
 * Tests for --mode flag functionality
 */

import { expect, test, describe } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

describe('CLI Mode Flag', () => {
    const cliPath = path.join(__dirname, '../dist/index.cjs');
    
    test('help should show --mode flag with options', async () => {
        try {
            const { stdout } = await execAsync(`node ${cliPath} agent --help`);
            
            expect(stdout).toContain('--mode=<mode>');
            expect(stdout).toContain('Set the agent');
            expect(stdout).toContain('execution mode');
            expect(stdout).toContain('--mode planner');
        } catch (error) {
            // Help command might exit with code 0 or 1, check stdout
            if (error.stdout) {
                expect(error.stdout).toContain('--mode=<mode>');
                expect(error.stdout).toContain('Set the agent execution mode');
            } else {
                throw error;
            }
        }
    });

    test('should reject invalid mode values', async () => {
        try {
            await execAsync(`node ${cliPath} agent ./test.smyth --mode invalid-mode`);
            // If no error thrown, test should fail
            expect(true).toBe(false);
        } catch (error) {
            const errorOutput = (error.stderr || error.stdout || '').toString();
            expect(errorOutput).toContain('Expected --mode=invalid-mode to be one of: default, planner');
        }
    });

    test('should accept valid mode values in help', async () => {
        // Test that these don't error on help
        try {
            await execAsync(`node ${cliPath} agent ./test.smyth --mode default --help`);
        } catch (error) {
            // Help might exit with code 1, but should show help not mode error
            expect(error.stderr || '').not.toContain('Expected --mode=default to be one of');
        }

        try {
            await execAsync(`node ${cliPath} agent ./test.smyth --mode planner --help`);
        } catch (error) {
            // Help might exit with code 1, but should show help not mode error
            expect(error.stderr || '').not.toContain('Expected --mode=planner to be one of');
        }
    });
});
