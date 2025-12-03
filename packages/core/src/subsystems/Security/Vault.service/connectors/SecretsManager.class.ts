import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { VaultConnector } from '../VaultConnector';
import {
    SecretsManagerClient,
    GetSecretValueCommand,
    ListSecretsCommand,
    ListSecretsCommandOutput,
    GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';

const defaultPrefix = 'smythos';
const console = Logger('SecretsManager');

export type SecretsManagerConfig = {
    region: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    prefix?: string;
};
export class SecretsManager extends VaultConnector {
    public name: string = 'SecretsManager';
    private secretsManager: SecretsManagerClient;
    private prefix: string;

    constructor(protected _settings: SecretsManagerConfig) {
        super(_settings);
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');
        this.prefix = _settings.prefix || defaultPrefix;
        this.secretsManager = new SecretsManagerClient({
            region: _settings.region,
            ...(_settings.awsAccessKeyId && _settings.awsSecretAccessKey
                ? {
                    accessKeyId: _settings.awsAccessKeyId,
                    secretAccessKey: _settings.awsSecretAccessKey,
                }
                : {}),
        });
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, secretName: string) {
        try {
            const accountConnector = ConnectorService.getAccountConnector();
            const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
            // try fetchting by Id, if not found, try fetching by name
            let secret = await this.getSecretById(teamId, secretName);
            if (!secret) {
                secret = await this.getSecretByName(acRequest, secretName);
            }
            return secret;
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
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const secrets = [];
        let nextToken: string | undefined;

        do {
            const listResponse: ListSecretsCommandOutput = await this.secretsManager.send(
                new ListSecretsCommand({ NextToken: nextToken, Filters: [{ Key: 'tag-key', Values: ['smyth-vault'] }, { Key: 'name', Values: [this.getVaultKey(teamId, '')] }] })
            );
            if (listResponse.SecretList) {
                for (const secret of listResponse.SecretList) {
                    if (secret.Name) {
                        secrets.push({
                            ARN: secret.ARN,
                            Name: secret.Name,
                            CreatedDate: secret.CreatedDate,
                        });
                    }
                }
            }
            nextToken = listResponse.NextToken;
        } while (nextToken);

      const $promises = [];
        for (const secret of secrets) {
            $promises.push(getSpecificSecret(secret, this.secretsManager));
        }
        const formattedSecrets = await Promise.all($promises);
        return formattedSecrets;

        async function getSpecificSecret(secret, secretsManager: SecretsManagerClient) {
            const data: GetSecretValueCommandOutput = await secretsManager.send(new GetSecretValueCommand({ SecretId: secret.ARN }));
            let secretString = data.SecretString;
    
            if (secretString) {
              try {
                let parsedSecret = JSON.parse(secretString);
                const secretId = secret.Name?.split('/').pop();
                const key = parsedSecret.key;
                const value = parsedSecret.value;
                const metadata = parsedSecret.metadata;
                return {
                  id: secretId,
                  key,
                  value,
                  metadata,
                };
              } catch (error) {
              }
            }
            return null;
        }
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

    private async getSecretByName(acRequest: AccessRequest, secretName: string) {
        try {
            const secrets = await this.listKeys(acRequest);
            const secret = secrets.find((s) => s.key === secretName);
            return secret?.value;
        } catch (error) {
            console.error(error);
            return null;
        }      
    }

    private getVaultKey(teamId: string, secretName: string) {
        return `${this.prefix.length ? `${this.prefix}/` : ''}${teamId}/${secretName}`;
    }

    private async getSecretById(teamId: string, secretId: string) {
        try {
            const secret: GetSecretValueCommandOutput = await this.secretsManager.send(new GetSecretValueCommand({ SecretId: this.getVaultKey(teamId, secretId) }));
            return this.getSecretValue(secret);
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    private getSecretValue(secret: GetSecretValueCommandOutput) {
        try {
            const parsedSecret = typeof secret.SecretString === 'string' ? JSON.parse(secret.SecretString) : secret.SecretString;
            return parsedSecret.value;
        } catch (error) {
            return null;
        }
    
    }
}
