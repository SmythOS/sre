import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { INKVRequest, NKVConnector } from '../NKVConnector';
import { ACLAccessDeniedError, IAccessCandidate, TAccessLevel, TAccessResult } from '@sre/types/ACL.types';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { StorageData } from '@sre/types/Storage.types';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import Joi from 'joi';

export class NKVRAM extends NKVConnector {
    public name = 'RAM';
    private storage: Map<string, any> = new Map();
    private namespaces: Set<string> = new Set();
    private accountConnector: AccountConnector;
    private cacheConnector: CacheConnector;

    constructor() {
        super();
        this.accountConnector = ConnectorService.getAccountConnector();
        this.cacheConnector = ConnectorService.getCacheConnector('Redis'); // Still use Redis for ACLs
    }

    public key(...parts: string[]) {
        return parts.join(':');
    }

    public mdKey(...parts: string[]) {
        return parts.join(':');
    }

    @NKVRAM.Validate
    @NKVRAM.NamespaceAccessControl
    protected async get(acRequest: AccessRequest, namespace: string, key: string): Promise<StorageData> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const storageKey = this.key(`team_${teamId}`, namespace, key);
        return this.storage.get(storageKey) || null;
    }

    @NKVRAM.Validate
    @NKVRAM.NamespaceAccessControl
    protected async set(acRequest: AccessRequest, namespace: string, key: string, value: any): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const storageKey = this.key(`team_${teamId}`, namespace, key);

        // Store the value
        this.storage.set(storageKey, value);

        // Track namespace
        const nsKey = this.key(`team_${teamId}`, namespace);
        if (!this.namespaces.has(nsKey)) {
            this.namespaces.add(nsKey);
            this.storage.set(nsKey, ''); // Namespace sentinel
        }
    }

    @NKVRAM.Validate
    @NKVRAM.NamespaceAccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, key: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const storageKey = this.key(`team_${teamId}`, namespace, key);
        this.storage.delete(storageKey);
    }

    @NKVRAM.Validate
    @NKVRAM.NamespaceAccessControl
    protected async exists(acRequest: AccessRequest, namespace: string, key: string): Promise<boolean> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const storageKey = this.key(`team_${teamId}`, namespace, key);
        return this.storage.has(storageKey);
    }

    @NKVRAM.NamespaceAccessControl
    public async list(acRequest: AccessRequest, namespace: string): Promise<{ key: string; data: StorageData }[]> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const prefix = this.key(`team_${teamId}`, namespace);
        const results: { key: string; data: StorageData }[] = [];

        // Find all keys that start with the prefix
        for (const [storageKey, value] of this.storage.entries()) {
            if (storageKey.startsWith(prefix + ':')) {
                // Extract the actual key (remove prefix and separator)
                const actualKey = storageKey.substring(prefix.length + 1);
                results.push({
                    key: actualKey,
                    data: value as StorageData,
                });
            }
        }

        return results;
    }

    @NKVRAM.NamespaceAccessControl
    public async deleteAll(acRequest: AccessRequest, namespace: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const prefix = this.key(`team_${teamId}`, namespace);
        const keysToDelete: string[] = [];

        // Find all keys that start with the prefix (excluding the namespace sentinel)
        for (const storageKey of this.storage.keys()) {
            if (storageKey.startsWith(prefix + ':')) {
                keysToDelete.push(storageKey);
            }
        }

        // Delete all found keys
        for (const key of keysToDelete) {
            this.storage.delete(key);
        }
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        // Delegate ACL management to the cache connector (Redis)
        return this.cacheConnector.getResourceACL(resourceId, candidate);
    }

    /**
     * Get all keys matching a prefix (for internal use)
     */
    private getKeysByPrefix(prefix: string): string[] {
        const keys: string[] = [];
        for (const key of this.storage.keys()) {
            if (key.startsWith(prefix)) {
                keys.push(key);
            }
        }
        return keys;
    }

    /**
     * Clear all data (useful for testing)
     */
    public clearAll(): void {
        this.storage.clear();
        this.namespaces.clear();
    }

    /**
     * Get storage statistics
     */
    public getStats(): { totalKeys: number; totalNamespaces: number } {
        return {
            totalKeys: this.storage.size,
            totalNamespaces: this.namespaces.size,
        };
    }

    static NamespaceAccessControl(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        // Store the original method in a variable
        const originalMethod = descriptor.value;

        // Modify the descriptor's value to wrap the original method
        descriptor.value = async function (...args: any[]) {
            // Extract the method arguments
            let [acRequest, namespace, key] = args;
            const isNamespaceSearch = key === undefined;

            // Inject the access control logic
            const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
            const resourceId = isNamespaceSearch ? namespace : `${namespace}:${key}`;
            const finalKey = this.key(`team_${teamId}`, resourceId);
            const accessTicket = await this.getAccessTicket(finalKey, acRequest);

            if (accessTicket.access !== TAccessResult.Granted) throw new ACLAccessDeniedError('Access Denied');

            // Call the original method with the original arguments
            return originalMethod.apply(this, args);
        };

        // Return the modified descriptor
        return descriptor;
    }

    static Validate(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        // Store the original method in a variable
        const originalMethod = descriptor.value;

        // Modify the descriptor's value to wrap the original method
        descriptor.value = async function (...args: any[]) {
            // Extract the method arguments
            let [acRequest, namespace, key] = args;

            // Validate the arguments
            const schemaValidator = Joi.object().keys({
                namespace: Joi.string().min(1).required(),
                key: Joi.string().min(1).required(),
            });
            const validationResult = schemaValidator.validate({ namespace, key });

            if (validationResult.error) {
                throw new Error(`Validation Error: ${validationResult.error.message}`);
            }

            // Call the original method with the original arguments
            return originalMethod.apply(this, args);
        };

        // Return the modified descriptor
        return descriptor;
    }
}
