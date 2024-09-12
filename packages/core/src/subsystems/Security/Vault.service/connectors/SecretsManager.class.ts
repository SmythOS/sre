import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { SecretsManagerConfig } from '@sre/types/Security.types';
import { IVaultRequest, VaultConnector } from '../VaultConnector';
import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const console = Logger('SecretsManager');
export class SecretsManager extends VaultConnector {
    public name: string = 'SecretsManager';
    private secretsManager: SecretsManagerClient;

    constructor(private config: SecretsManagerConfig) {
        super();
        if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.secretsManager = new SecretsManagerClient({
            region: config.region,
            ...(config.awsAccessKeyId && config.awsSecretAccessKey ? {
                accessKeyId: config.awsAccessKeyId,
                secretAccessKey: config.awsSecretAccessKey,
            } : {}),
        });
    }

    user(candidate: AccessCandidate): IVaultRequest {
        return {
            get: async (keyId: string) => this.get(candidate.readRequest, keyId),
            set: async (keyId: string, value: string) => this.set(candidate.writeRequest, keyId, value),
            delete: async (keyId: string) => this.delete(candidate.writeRequest, keyId),
            exists: async (keyId: string) => this.exists(candidate.readRequest, keyId),
        };
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, secretId: string) {
        try {
            const accountConnector = ConnectorService.getAccountConnector();
            const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
            const secret = await this.secretsManager.send(new GetSecretValueCommand({ SecretId: `${teamId}/${secretId}` }));
            return secret.SecretString;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    protected async set(acRequest: AccessRequest, secretId: string, value: string) {
        throw new Error('SecretsManager.set not allowed');
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, keyId: string) {
        throw new Error('SecretsManager.delete not allowed');
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
        const secret = await this.get(acRequest, keyId);
        return !!secret;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(candidate);

        const acl = new ACL();

        acl.addAccess(TAccessRole.Team, teamId, TAccessLevel.Owner)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Read)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Write);

        return acl;
    }

}
