import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { OAuthConfig, SmythVaultConfig } from '@sre/types/Security.types';
import { IVaultRequest, VaultConnector } from '../VaultConnector';
import { getM2MToken } from '@sre/utils/oauth.utils';
import axios, { AxiosInstance } from 'axios';

const console = Logger('SmythVault');
export class SmythVault extends VaultConnector {
    public name: string = 'SmythVault';
    private oAuthAppId: string;
    private oAuthAppSecret: string;
    private oAuthBaseUrl: string;
    private oAuthResource?: string;
    private oAuthScope?: string;
    private vaultAPI: AxiosInstance;

    constructor(private config: SmythVaultConfig & OAuthConfig) {
        super();
        if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.oAuthAppId = config.oAuthAppID;
        this.oAuthAppSecret = config.oAuthAppSecret;
        this.oAuthBaseUrl = config.oAuthBaseUrl;
        this.oAuthResource = config.oAuthResource || '';
        this.oAuthScope = config.oAuthScope || '';
        this.vaultAPI = axios.create({
            baseURL: `${config.vaultAPIBaseUrl}/v1/api`,
        });
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const vaultAPIHeaders = await this.getVaultRequestHeaders();

        let key = '';
        try {
            const vaultResponse = await this.vaultAPI.get(`/vault/${teamId}/secrets/${keyId}`, { headers: vaultAPIHeaders });
            key = vaultResponse?.data?.secret?.value || null;
        } catch (error) {
            console.warn(`Warn: Failed to get key "${keyId}" from SmythVault, trying to get it from the legacy vault`);
        }

        if (!key) {
            const vaultResponse = await this.vaultAPI.get(`/vault/${teamId}/secrets/name/${keyId}`, { headers: vaultAPIHeaders });

            key = vaultResponse?.data?.secret?.value || null;
        }

        if (!key) {
            // * Note: Adjustment for legacy global vault keys, we can remove it after migrating all keys in Hashicorp Vault with proper key ID such as 'googleai' -> 'GoogleAI'
            const legacyGlobalVaultKey = keyId.toLowerCase();
            const globalVaultKey = legacyGlobalVaultKey === 'anthropic' ? 'claude' : legacyGlobalVaultKey; // Ensure backward compatibility: In SaaS the key was stored under 'claude';
            const vaultResponse = await this.vaultAPI.get(`/vault/${teamId}/secrets/${globalVaultKey}`, { headers: vaultAPIHeaders });

            return vaultResponse?.data?.secret?.value;
        }

        return key || null;
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const vaultAPIHeaders = await this.getVaultRequestHeaders();
        const vaultResponse = await this.vaultAPI.get(`/vault/${teamId}/secrets/${keyId}`, { headers: vaultAPIHeaders });
        return vaultResponse?.data?.secret ? true : false;
    }

    @SecureConnector.AccessControl
    protected async listKeys(acRequest: AccessRequest) {
        //const accountConnector = ConnectorService.getAccountConnector();
        const teamId = acRequest.candidate.id;
        const vaultAPIHeaders = await this.getVaultRequestHeaders();
        const vaultResponse = await this.vaultAPI.get(`/vault/${teamId}/secrets`, { headers: vaultAPIHeaders });
        if (vaultResponse?.data?.secrets) {
            vaultResponse?.data?.secrets?.forEach((secret: any) => {
                if (secret?.metadata?.scope) {
                    try {
                        secret.metadata.scope = JSON.parse(secret.metadata.scope);
                    } catch (error) {
                        secret.metadata.scope = [];
                        console.error('Error:', error);
                    }
                }
            });
        }

        return vaultResponse?.data?.secrets || [];
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

    private async getVaultRequestHeaders() {
        return {
            Authorization: `Bearer ${await getM2MToken({
                baseUrl: this.oAuthBaseUrl,
                oauthAppId: this.oAuthAppId,
                oauthAppSecret: this.oAuthAppSecret,
                resource: this.oAuthResource,
                scope: this.oAuthScope,
            })}`,
        };
    }
}
