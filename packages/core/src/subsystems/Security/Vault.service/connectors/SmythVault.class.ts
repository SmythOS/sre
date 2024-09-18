import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import SmythRuntime from '@sre/Core/SmythRuntime.class';
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

    user(candidate: AccessCandidate): IVaultRequest {
        return {
            get: async (keyId: string) => this.get(candidate.readRequest, keyId),
            set: async (keyId: string, value: string) => this.set(candidate.writeRequest, keyId, value),
            delete: async (keyId: string) => this.delete(candidate.writeRequest, keyId),
            exists: async (keyId: string) => this.exists(candidate.readRequest, keyId),
        };
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const vaultAPIHeaders = await this.getVaultRequestHeaders();
        const vaultResponse = await this.vaultAPI.get(`/vault/${teamId}/secrets/${keyId}`, { headers: vaultAPIHeaders });
        return vaultResponse?.data?.secret?.value;
    }

    @SecureConnector.AccessControl
    protected async set(acRequest: AccessRequest, keyId: string, value: string) {
        throw new Error('SmythVault.set not allowed');
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, keyId: string) {
        throw new Error('SmythVault.delete not allowed');
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const vaultAPIHeaders = await this.getVaultRequestHeaders();
        const vaultResponse = await this.vaultAPI.get(`/vault/${teamId}/secrets/${keyId}`, { headers: vaultAPIHeaders });
        return vaultResponse?.data?.secret ? true : false;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const accountConnector = ConnectorService.getAccountConnector('SmythAccount');
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
            })}`
        };
    }
}
