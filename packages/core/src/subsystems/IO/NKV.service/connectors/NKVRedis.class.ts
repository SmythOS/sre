import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { INKVRequest, NKVConnector } from '../NKVConnector';
import { ACLAccessDeniedError, IAccessCandidate, TAccessLevel, TAccessResult } from '@sre/types/ACL.types';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { StorageData } from '@sre/types/Storage.types';
import { RedisCache } from '@sre/MemoryManager/Cache.service/connectors/RedisCache.class';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import Joi from 'joi';

export class NKVRedis extends NKVConnector {
    public name = 'Redis';
    private redisCacheConnector: RedisCache;
    private accountConnector: AccountConnector;
    private schemaValidator: Joi.ObjectSchema;
    constructor() {
        super();
        this.redisCacheConnector = ConnectorService.getCacheConnector('Redis') as RedisCache;
        this.accountConnector = ConnectorService.getAccountConnector();
        this.schemaValidator = Joi.object().keys({
            namespace: Joi.string().min(1).required(),
            key: Joi.string().min(1).required(),
        });
    }

    @NKVRedis.Validate
    @NKVRedis.NamespaceAccessControl
    protected async get(acRequest: AccessRequest, namespace: string, key: string): Promise<StorageData> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        return await this.redisCacheConnector.user(AccessCandidate.team(teamId)).get(`${namespace}:${key}`);
    }

    @NKVRedis.Validate
    @NKVRedis.NamespaceAccessControl
    protected async set(acRequest: AccessRequest, namespace: string, key: string, value: any) {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

        await this.redisCacheConnector.user(AccessCandidate.team(teamId)).set(`${namespace}:${key}`, value);
        // to set namespace ownership
        const isNewNs = !(await this.redisCacheConnector.user(AccessCandidate.team(teamId)).exists(namespace));
        if (isNewNs) {
            await this.redisCacheConnector.user(AccessCandidate.team(teamId)).set(namespace, '', undefined, { ns: true });
        }
    }

    @NKVRedis.Validate
    @NKVRedis.NamespaceAccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, key: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        await this.redisCacheConnector.user(AccessCandidate.team(teamId)).delete(`${namespace}:${key}`);
    }

    @NKVRedis.Validate
    @NKVRedis.NamespaceAccessControl
    protected async exists(acRequest: AccessRequest, namespace: string, key: string): Promise<boolean> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        return await this.redisCacheConnector.user(AccessCandidate.team(teamId)).exists(`${namespace}:${key}`);
    }

    @NKVRedis.NamespaceAccessControl
    public async list(acRequest: AccessRequest, namespace: string): Promise<{ id: string; data: StorageData }[]> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        let keys = await this.fetchKeysByPrefix(`${this.redisCacheConnector.prefix(teamId)}:${namespace}`);

        // filter out metadata keys & namespace sentinel keys
        keys = keys.filter(
            (key) =>
                !key.endsWith(`:${this.redisCacheConnector.metadataSuffix}`) && // if doesn't end with metadata suffix
                key !== `${this.redisCacheConnector.prefix(teamId)}:${namespace}` // if not the namespace sentinel key
        );

        if (keys.length <= 0) return [];
        // Start a transaction
        const pipeline = this.redisCacheConnector.client.pipeline();

        // Add get commands for all keys to the transaction
        keys.forEach((key) => {
            pipeline.get(key);
        });

        // Execute the transaction
        const results = await pipeline.exec();

        // Combine the keys and their corresponding values
        return keys.map((key, index) => {
            return {
                id: key.replace(`${this.redisCacheConnector.prefix(teamId)}:${namespace}:`, ''),
                data: results[index][1] as StorageData,
            };
        });
    }

    @NKVRedis.NamespaceAccessControl
    public async deleteAll(acRequest: AccessRequest, namespace: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        let keys = await this.fetchKeysByPrefix(`${this.redisCacheConnector.prefix(teamId)}:${namespace}`);
        // filter out namespace sentinel key + namespace metadata key metadata key
        keys = keys.filter((key) => {
            return ![
                `${this.redisCacheConnector.prefix(teamId)}:${namespace}`,
                `${this.redisCacheConnector.prefix(teamId)}:${namespace}:${this.redisCacheConnector.metadataSuffix}`,
            ].includes(key);
        });
        await this.redisCacheConnector.client.del(keys);
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        return this.redisCacheConnector.getResourceACL(resourceId, candidate);
    }

    private async fetchKeysByPrefix(prefix: string): Promise<string[]> {
        let cursor = '0';
        const keys = [];

        do {
            // SCAN with match for the prefix and count for batch size (optional)
            const result = await this.redisCacheConnector.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 10000);
            cursor = result[0];
            keys.push(...result[1]);
        } while (cursor !== '0');

        return keys;
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
            const finalKey = `${this.redisCacheConnector.prefix(teamId)}:${resourceId}`;
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
            const validationResult = this.schemaValidator.validate({ namespace, key });

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
