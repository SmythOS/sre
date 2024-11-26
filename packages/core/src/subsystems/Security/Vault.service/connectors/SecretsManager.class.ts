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
            ...(config.awsAccessKeyId && config.awsSecretAccessKey
                ? {
                      accessKeyId: config.awsAccessKeyId,
                      secretAccessKey: config.awsSecretAccessKey,
                  }
                : {}),
        });
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
    protected async exists(acRequest: AccessRequest, keyId: string) {
        const secret = await this.get(acRequest, keyId);
        return !!secret;
    }

    @SecureConnector.AccessControl
    protected async listKeys(acRequest: AccessRequest) {
        console.warn('SecretsManager.listKeys is not implemented');
        return [];
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
