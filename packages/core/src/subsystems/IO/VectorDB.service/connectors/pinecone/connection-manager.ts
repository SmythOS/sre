import { Pinecone } from '@pinecone-database/pinecone';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { LocalCache } from '@sre/helpers/LocalCache.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ManagedVaultConnector } from '@sre/Security/ManagedVault.service/ManagedVaultConnector';
import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { withSafeRetry } from './retry-utils';
import { PineconeConnectorSettings, PineconeOperationName } from './types';

const console = Logger('PineconeConnectionManager');

const API_KEY_CACHE_TTL_MS = 5 * 60 * 1000;

export class PineconeConnectionManager {
    private client?: Pinecone;
    private readonly apiKeyCache = new LocalCache<string, string>(API_KEY_CACHE_TTL_MS);
    private readonly managedVault?: ManagedVaultConnector;
    private readonly vault?: VaultConnector;

    constructor(private readonly settings: PineconeConnectorSettings) {
        try {
            this.managedVault = ConnectorService.getManagedVaultConnector();
        } catch (error) {
            console.warn('ManagedVault connector unavailable, falling back to Vault if configured');
        }
        try {
            this.vault = ConnectorService.getVaultConnector();
        } catch (error) {
            console.warn('Vault connector unavailable; direct API key usage only');
        }
    }

    public get indexName(): string {
        return this.settings.indexName;
    }

    public reset(): void {
        this.client = undefined;
        this.apiKeyCache.clear();
    }

    public async shutdown(): Promise<void> {
        this.client = undefined;
        this.apiKeyCache.clear();
    }

    public async getClient(acRequest: AccessRequest, signal?: AbortSignal): Promise<Pinecone> {
        if (!this.client) {
            const apiKey = await this.resolveApiKey(acRequest, signal);
            this.client = await this.createClient(apiKey, signal);
        }
        return this.client;
    }

    private async createClient(apiKey: string, signal?: AbortSignal): Promise<Pinecone> {
        return await withSafeRetry(
            'init',
            async () => {
                if (signal?.aborted) {
                    throw signal.reason ?? new Error('Initialization aborted');
                }
                return new Pinecone({ apiKey });
            },
            { attempts: 2, baseDelayMs: 100, maxDelayMs: 500 },
            { defaultMs: 3000 },
            signal
        );
    }

    private async resolveApiKey(acRequest: AccessRequest, signal?: AbortSignal): Promise<string> {
        const cacheKey = `${acRequest.candidate.role}:${acRequest.candidate.id}`;
        const cached = this.apiKeyCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const rawKey = await this.fetchApiKey(acRequest, signal);
        if (!rawKey || typeof rawKey !== 'string') {
            throw new Error('Pinecone API key could not be resolved');
        }
        this.apiKeyCache.set(cacheKey, rawKey, API_KEY_CACHE_TTL_MS);
        return rawKey;
    }

    private async fetchApiKey(acRequest: AccessRequest, signal?: AbortSignal): Promise<string | undefined> {
        const { auth } = this.settings;
        if (auth?.apiKey) {
            return auth.apiKey;
        }

        const operation: PineconeOperationName = 'init';

        if (auth?.vaultKey && this.managedVault) {
            try {
                return await withSafeRetry(
                    operation,
                    async () => {
                        const requester = this.managedVault!.requester(acRequest.candidate);
                        return requester.get(auth.vaultKey!);
                    },
                    { attempts: 3, baseDelayMs: 150, maxDelayMs: 1500 },
                    { defaultMs: 2000 },
                    signal
                );
            } catch (error) {
                console.error('Failed to fetch Pinecone API key from ManagedVault', error);
            }
        }

        if (auth?.vaultKey && this.vault) {
            try {
                return await withSafeRetry(
                    operation,
                    async () => {
                        const requester = this.vault!.requester(acRequest.candidate);
                        return requester.get(auth.vaultKey!);
                    },
                    { attempts: 3, baseDelayMs: 150, maxDelayMs: 1500 },
                    { defaultMs: 2000 },
                    signal
                );
            } catch (error) {
                console.error('Failed to fetch Pinecone API key from Vault', error);
            }
        }

        throw new Error('No Pinecone API key available; configure auth.vaultKey or auth.apiKey');
    }
}
