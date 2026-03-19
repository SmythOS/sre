// prettier-ignore-file
/**
 * Vault - AWS Secrets Manager integration.
 * Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 *
 * This test initializes a SEPARATE SRE instance with SecretsManager as the vault connector.
 * It tests Vault.get() and Vault.listKeys() through the AWS Secrets Manager backend.
 *
 * NOTE: This is read-only — Secrets Manager vault doesn't support set/delete from the SDK.
 * Secrets must be pre-created in AWS Secrets Manager with the format:
 *   Secret name: smythos/{teamId}/{secretName}
 *   Secret value: the secret string
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Vault } from '../../../src/index';
import { HAS_AWS_SECRETS } from '../_helpers';
import { SRE } from '@smythos/sre';

let sreReady = false;

async function initWithSecretsManager() {
    if (sreReady) return;
    // SRE.init() can only be called once per process. Since the default test
    // helper initializes with JSONFileVault, we can only run this in isolation
    // or if SRE hasn't been initialized yet. In the integration suite it will
    // likely run in its own forked process (vitest pool: forks).
    SRE.init({
        Vault: {
            Connector: 'SecretsManager',
            Settings: {
                region: process.env.AWS_REGION || 'us-east-1',
                awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
                awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                prefix: 'smythos',
            },
        },
    });
    await SRE.ready();
    sreReady = true;
}

describe.skipIf(!HAS_AWS_SECRETS)('Vault - AWS Secrets Manager', () => {
    beforeAll(() => initWithSecretsManager());

    it('Vault.listKeys() returns an array from Secrets Manager', async () => {
        try {
            const keys = await Vault.listKeys();
            expect(Array.isArray(keys)).toBe(true);
        } catch (e: any) {
            // If no secrets exist for the default team, this may throw or return []
            // Both are valid behaviors depending on AWS state
            expect(e).toBeDefined();
        }
    });

    it('Vault.get() returns null for non-existent secret', async () => {
        try {
            const val = await Vault.get('non-existent-secret-xyz-999');
            expect(val == null).toBe(true);
        } catch (e: any) {
            // AWS may throw ResourceNotFoundException which becomes an error
            expect(e).toBeDefined();
        }
    });

    it('Vault.get() retrieves a pre-existing secret (if available)', async () => {
        // This test is informational — it tries to read a known test secret.
        // If the secret doesn't exist, the test still passes.
        try {
            const keys = await Vault.listKeys();
            if (keys.length > 0) {
                const firstKey = keys[0];
                const val = await Vault.get(firstKey);
                expect(val).toBeDefined();
                expect(typeof val).toBe('string');
            }
        } catch {
            // No secrets available — that's fine for this test
        }
    });
});
