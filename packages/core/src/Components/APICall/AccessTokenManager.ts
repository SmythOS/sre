// accessTokenManager.ts
import Agent from '@sre/AgentManager/Agent.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import SystemEvents from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import axios from 'axios';

const console = Logger('AccessTokenManager');
let managedVault: any;

SystemEvents.on('SRE:Booted', () => {
    managedVault = ConnectorService.getManagedVaultConnector('oauth');
});
class AccessTokenManager {
    private clientId: string;
    private clientSecret: string;
    private primaryToken: string; // accessToken || token
    private secondaryToken: string; // refreshToken || tokenSecret
    private tokenUrl: string; // tokenURL to refresh accessToken
    private expires_in: any;
    private data: any; // value of key(keyId) in teamSettings that needs to be updated if required
    private keyId: any; // key of object  in teamSettings
    private logger: any; // Use to log console in debugger
    private agent: Agent;
    constructor(
        clientId: string,
        clientSecret: string,
        secondaryToken: string,
        tokenUrl: string,
        expires_in: any,
        primaryToken: string,
        data: any,
        keyId: any,
        logger: any,
        agent: Agent
    ) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.primaryToken = primaryToken;
        this.secondaryToken = secondaryToken;
        this.tokenUrl = tokenUrl;
        this.expires_in = expires_in;
        this.data = data;
        this.keyId = keyId;
        this.logger = logger;
        this.agent = agent;
    }

    async getAccessToken(): Promise<string> {
        try {
            const currentTime: any = new Date().getTime();

            // If there's no secondaryToken (refresh token) and no expires_in, 
            // assume it's a long-lived token and return the primaryToken directly
            if (!this.secondaryToken && !this.expires_in) {
                console.log('Using long-lived access token');
                this.logger.debug('Using long-lived access token. If authentication failes, please re-authenticate and try again');
                return this.primaryToken;
            }

            // Regular token expiration check for tokens with expiration
           // should be alway currentTime >= Number(this.expires_in)
            if (!this.expires_in || currentTime >= Number(this.expires_in)) {
                if (!this.secondaryToken) {
                    this.logger.debug('Refresh token is missing. Please re authenticate');
                    console.log('Refresh token is missing. Please re authenticate...');
                    // Redirect the user to the OAuth authorization URL or initiate the reauthentication flow
                    throw new Error('Reauthentication required');
                }
                this.logger.debug('Access token is expired or missing. Refreshing access token...');
                console.log('Access token is expired or missing. Refreshing access token...');
                return await this.refreshAccessToken();
            } else {
                console.log('Access token is still valid');
                this.logger.debug('Access token is still valid.');
                return this.primaryToken;
            }
        } catch (error) {
            console.error('Error fetching access token:', error);
            this.logger.debug('Error fetching access token');
            throw error;
        }
    }

    async refreshAccessToken(): Promise<string> {
        try {
            const response = await axios.post(
                this.tokenUrl,
                new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    refresh_token: this.secondaryToken,
                    grant_type: 'refresh_token',
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            const newAccessToken: string = response?.data?.access_token;
            console.log('Access token refreshed successfully.');
            this.logger.debug('Access token refreshed successfully.');
            const expiresInMilliseconds: number = response?.data?.expires_in ? response?.data?.expires_in * 1000 : response?.data?.expires_in;
            const expirationTimestamp: number = expiresInMilliseconds ? new Date().getTime() + expiresInMilliseconds : expiresInMilliseconds;
            this.data.primary = newAccessToken;
            this.data.expires_in = expirationTimestamp ? expirationTimestamp?.toString() : expirationTimestamp;
            //const oauthTeamSettings = new OauthTeamSettings();
            //const save: any = await oauthTeamSettings.update({ keyId: this.keyId, data: this.data });

            const save: any = await managedVault.user(AccessCandidate.agent(this.agent.id)).set(this.keyId, JSON.stringify(this.data));
            if (save && save.status === 200) {
                console.log('Access token value is updated successfully.');
                this.logger.debug('Access token value is updated successfully.');
            } else {
                console.log('Warning: new access token value is not updated.');
                this.logger.debug('Warning: new access token value is not updated.');
            }
            return newAccessToken;
        } catch (error) {
            console.error('Failed to refresh access token:', error);
            this.logger.debug(`Failed to refresh access token: ${error}`);
            throw new Error('Failed to refresh access token.');
        }
    }
}

export default AccessTokenManager;
