import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
//import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { VaultConnector } from '../VaultConnector';

import type * as SecretsManagerTypes from '@aws-sdk/client-secrets-manager';
import { LazyLoadFallback } from '@sre/utils/lazy-client';

let SecretsManagerModule: typeof SecretsManagerTypes | undefined;
//#IFDEF STATIC SECRETS_MANAGER_STATIC
import * as _SecretsManagerModule from '@aws-sdk/client-secrets-manager';
SecretsManagerModule = _SecretsManagerModule;
//#ENDIF

const console = Logger('SecretsManager');

export type SecretsManagerConfig = {
    region: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
};
export class SecretsManager extends VaultConnector {
    public name: string = 'SecretsManager';
    private secretsManager: SecretsManagerTypes.SecretsManagerClient;

    constructor(protected _settings: SecretsManagerConfig) {
        super(_settings);
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.lazyInit(_settings);
    }

    async lazyInit(_settings: SecretsManagerConfig) {
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        const { SecretsManagerClient } = await LazyLoadFallback<typeof SecretsManagerTypes>(SecretsManagerModule, '@aws-sdk/client-secrets-manager');

        this.secretsManager = new SecretsManagerClient({
            region: _settings.region,
            ...(_settings.awsAccessKeyId && _settings.awsSecretAccessKey
                ? {
                      accessKeyId: _settings.awsAccessKeyId,
                      secretAccessKey: _settings.awsSecretAccessKey,
                  }
                : {}),
        });

        this.started = true;
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, secretName: string) {
        await this.ready();
        try {
            const secret = await this.getSecretByName(secretName);
            return secret?.SecretString;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
        await this.ready();
        const secret = await this.get(acRequest, keyId);
        return !!secret;
    }

    @SecureConnector.AccessControl
    protected async listKeys(acRequest: AccessRequest) {
        await this.ready();
        console.warn('SecretsManager.listKeys is not implemented');
        return [];
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        await this.ready();
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(candidate);

        const acl = new ACL();

        acl.addAccess(TAccessRole.Team, teamId, TAccessLevel.Owner)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Read)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Write);

        return acl;
    }

    private async getSecretByName(secretName: string) {
        await this.ready();
        const { ListSecretsCommand, GetSecretValueCommand } = await LazyLoadFallback<typeof SecretsManagerTypes>(
            SecretsManagerModule,
            '@aws-sdk/client-secrets-manager'
        );
        try {
            const secrets = [];
            let nextToken: string | undefined;
            do {
                const listResponse: SecretsManagerTypes.ListSecretsCommandOutput = await this.secretsManager.send(
                    new ListSecretsCommand({ NextToken: nextToken, Filters: [{ Key: 'tag-key', Values: ['smyth-vault'] }] })
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

            const formattedSecrets = [];
            const $promises = [];
            for (const secret of secrets) {
                $promises.push(getSpecificSecret(secret, this.secretsManager));
            }
            const results = await Promise.all($promises);
            for (const result of results) {
                formattedSecrets.push(result);
            }
            const secret = formattedSecrets.find((s) => s.Name === secretName);
            return secret;
        } catch (error) {
            console.error(error);
        }

        async function getSpecificSecret(secret, secretsManager: SecretsManagerTypes.SecretsManagerClient) {
            const data: SecretsManagerTypes.GetSecretValueCommandOutput = await secretsManager.send(
                new GetSecretValueCommand({ SecretId: secret.ARN })
            );
            let secretString = data.SecretString;
            let secretName = secret.Name;

            if (secretString) {
                try {
                    let parsedSecret = JSON.parse(secretString);
                    if (Object.keys(parsedSecret).length === 1) {
                        secretName = Object.keys(parsedSecret)[0];
                        secretString = parsedSecret[secretName];
                    }
                } catch (error) {}
            }
            return {
                Name: secretName,
                ARN: secret.ARN,
                CreatedDate: secret.CreatedDate,
                SecretId: secret.Name,
                SecretString: secretString,
            };
        }
    }
}
