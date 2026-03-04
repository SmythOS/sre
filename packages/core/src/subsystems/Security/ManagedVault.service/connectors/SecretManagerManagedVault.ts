import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

import {
    CreateSecretCommand,
    DeleteSecretCommand,
    DescribeSecretCommand,
    DescribeSecretCommandOutput,
    GetSecretValueCommand,
    GetSecretValueCommandOutput,
    ListSecretsCommand,
    ListSecretsCommandOutput,
    PutSecretValueCommand,
    RestoreSecretCommand,
    SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { ManagedVaultConnector } from '../ManagedVaultConnector';
import { SecretsManagerConfig } from '../../Vault.service/connectors/SecretsManager.class';
const DELETION_MARKER_ERROR_MESSAGE = "You can't create this secret because a secret with this name is already scheduled for deletion."

const console = Logger('SecretManagerManagedVault');

export class SecretManagerManagedVault extends ManagedVaultConnector {
    public name: string = 'SecretManagerManagedVault';
    public scope: string = 'smyth-managed-vault';
    private secretsManager: SecretsManagerClient;
    private prefix: string;

    constructor(protected _settings: SecretsManagerConfig & { vaultName: string, prefix: string }) {
        super(_settings);

        this.prefix = _settings.prefix || '';
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
            const secret = await this.getSecretByName(acRequest, secretName);
            return secret?.value;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    @SecureConnector.AccessControl
    protected async set(acRequest: AccessRequest, secretName: string, value: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const secret = await this.getSecretByName(acRequest, secretName);
        if (secret) {
            await this.secretsManager.send(new PutSecretValueCommand({ SecretId: secret.secretId, SecretString: value }));
        } else {
            const vaultKey = this.getVaultKey(secretName, teamId);
            try {
                await this.secretsManager.send(
                    new CreateSecretCommand({
                        Name: vaultKey,
                        Description: `Smyth Managed Vault Secret`,
                        SecretString: JSON.stringify({ [secretName]: value }),
                        Tags: [{ Key: this.scope, Value: 'true' }],
                    })
                );
            } catch (error) {
                console.warn(error.message);
                if (error.message === DELETION_MARKER_ERROR_MESSAGE) {
                    // The secret already exists — check if it's pending deletion
                    const secretDesc: DescribeSecretCommandOutput = await this.secretsManager.send(new DescribeSecretCommand({ SecretId: vaultKey }));

                    if (secretDesc.DeletedDate) {
                        console.debug(`Secret ${vaultKey} is pending deletion, restoring...`);
                        await this.secretsManager.send(new RestoreSecretCommand({ SecretId: vaultKey }));
                    } else {
                        console.debug(`Secret ${vaultKey} already exists, updating value...`);
                    }

                    // Update or re-put the secret value
                    await this.secretsManager.send(
                        new PutSecretValueCommand({
                            SecretId: vaultKey,
                            SecretString: JSON.stringify({
                                [secretName]: value,
                            }),
                        })
                    );

                } else {
                    throw error;
                }
            }
        }
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, secretName: string) {
        const secret = await this.getSecretByName(acRequest, secretName);
        if (secret) {
            await this.secretsManager.send(new DeleteSecretCommand({ SecretId: secret.secretId, RecoveryWindowInDays: 7 }));
        }
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, secretName: string) {
        const secret = await this.get(acRequest, secretName);
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

    private async getSecretByName(acRequest: AccessRequest, secretName: string) {
        try {

            const accountConnector = ConnectorService.getAccountConnector();
            const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
            const vaultKey = this.getVaultKey(secretName, teamId);
            let secret: GetSecretValueCommandOutput | null = null;
            try {
              const describeSecret: DescribeSecretCommandOutput = await this.secretsManager.send(new DescribeSecretCommand({ SecretId: vaultKey }));
              if (describeSecret.DeletedDate) {
                secret = null;
              } else {
                secret = await this.secretsManager.send(new GetSecretValueCommand({ SecretId: vaultKey }));
              }
            } catch (error) {
                secret = null;
                console.warn('Secret not found by Id, trying to get it by name');
            }
            if (secret) {
                return this.getFormattedSecret(secret);
            }

            // if not found by Id, try to get it by name
            const secrets = [];
            let nextToken: string | undefined;
            let listingVaultKey = this.getVaultKey('', teamId);
            do {
                const listResponse: ListSecretsCommandOutput = await this.secretsManager.send(
                    new ListSecretsCommand({ NextToken: nextToken, Filters: [{ Key: 'tag-key', Values: [this.scope] }, { Key: 'name', Values: [listingVaultKey] }] })
                );
                if (listResponse.SecretList) {
                    for (const secret of listResponse.SecretList) {
                        if (secret.Name) {
                            secrets.push({
                                ARN: secret.ARN,
                                Name: secret.Name,
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
            const results = await Promise.all($promises);
            const secretData = results.find((s) => s.key === secretName);
            return secretData;
        } catch (error) {
            console.error(error);
        }

        async function getSpecificSecret(secret, secretsManager: SecretsManagerClient) {
            const data: GetSecretValueCommandOutput = await secretsManager.send(new GetSecretValueCommand({ SecretId: secret.ARN }));
            return this.getFormattedSecret(data);
        }
    }

    getVaultKey(secretName: string, teamId: string) {
        return `${this.prefix.length ? `${this.prefix}/` : ''}${teamId}/${secretName}`;
    }

    getFormattedSecret(secret: GetSecretValueCommandOutput) {
        let secretString = secret.SecretString;
        let secretName = secret.Name;

        if (secretString) {
            try {
                let parsedSecret = JSON.parse(secretString);
                if (Object.keys(parsedSecret).length === 1) {
                    secretName = Object.keys(parsedSecret)[0];
                    secretString = parsedSecret[secretName];
                }
            } catch (error) { }
        }
        return {
            secretId: secret.Name,
            key: secretName,
            value: secretString,
        };
    }
}
