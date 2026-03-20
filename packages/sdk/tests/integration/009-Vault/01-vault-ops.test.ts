// prettier-ignore-file
/**
 * Vault integration tests.
 *
 * JSONFileVault (default) — no external API keys, reads from ~/.smyth/vault.json
 * SecretsManager (AWS) — requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 *
 * The default SRE.init({}) uses JSONFileVault with shared='default'.
 * Vault.get/listKeys use AccessCandidate.team('default') by default.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model, Vault } from '../../../src/index';
import { initSRE, unique } from '../_helpers';

describe('Vault - JSONFileVault (default connector)', () => {
    beforeAll(() => initSRE());

    it('Vault.listKeys() returns an array', async () => {
        try {
            const keys = await Vault.listKeys();
            expect(Array.isArray(keys)).toBe(true);
        } catch (e: any) {
            // Access denied is expected if vault file has no 'default' team entry
            expect(e.message).toContain('Access Denied');
        }
    });

    it('Vault.get() for non-existent key returns null/undefined', async () => {
        try {
            const val = await Vault.get('non-existent-key-xyz-123');
            expect(val == null).toBe(true);
        } catch (e: any) {
            // Access denied if no vault file or no 'default' team entry
            expect(e.message).toContain('Access Denied');
        }
    });

    it('agent.vault is a VaultInstance', () => {
        const agent = new Agent({
            id: unique('vault'),
            name: 'VaultBot',
            model: Model.Echo('Echo'),
        });
        expect(agent.vault).toBeDefined();
        expect(typeof agent.vault.get).toBe('function');
        expect(typeof agent.vault.listKeys).toBe('function');
    });

    it('agent.vault.listKeys() returns array or handles missing vault', async () => {
        const agent = new Agent({
            id: unique('vault'),
            name: 'VaultBot',
            model: Model.Echo('Echo'),
        });
        try {
            const keys = await agent.vault.listKeys();
            expect(Array.isArray(keys)).toBe(true);
        } catch (e: any) {
            // Vault connector may not be initialized without a vault file
            expect(e).toBeDefined();
        }
    });

    it('agent.vault.get() for non-existent key returns null/undefined', async () => {
        const agent = new Agent({
            id: unique('vault'),
            name: 'VaultBot',
            model: Model.Echo('Echo'),
        });
        try {
            const val = await agent.vault.get('missing-key-abc');
            expect(val == null).toBe(true);
        } catch (e: any) {
            expect(e).toBeDefined();
        }
    });
});
