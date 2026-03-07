import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Credentials } from './Credentials.class';
import { AccessCandidate } from '../AccessControl/AccessCandidate.class';

export class ManagedOAuth2Credentials extends Credentials {
    #accessToken: string;
    #refreshToken: string;
    #expiresIn: number;
    #scope: string;
    #tokenUrl: string;
    #service: string;
    #clientId: string;
    #clientSecret: string;

    public get accessToken(): string {
        return this.#accessToken;
    }
    public get refreshToken(): string {
        return this.#refreshToken;
    }
    public get expiresIn(): number {
        return this.#expiresIn;
    }
    public get scope(): string {
        return this.#scope;
    }
    public get tokenUrl(): string {
        return this.#tokenUrl;
    }
    public get service(): string {
        return this.#service;
    }

    private constructor(data: any) {
        super();
        this.parseData(data);
    }

    static async load(keyId: string, candidate: AccessCandidate): Promise<ManagedOAuth2Credentials> {
        const managedVault = ConnectorService.getManagedVaultConnector();
        const result = await managedVault.requester(candidate).get(keyId);
        const data = typeof result === 'object' ? result : JSON.parse(result || '{}');

        return new ManagedOAuth2Credentials(data);
    }

    private parseData(data: any) {
        //SRE v1.0 format

        const tokens = data.customProperties.tokens;
        const credentials = data.credentials;
        //SRE v1.5.0+ format
        if (!tokens) throw new Error('oAuth2Manager:Invalid data format');

        this.#accessToken = tokens.primary;
        this.#refreshToken = tokens.secondary;
        this.#expiresIn = tokens.expires_in;
        this.#scope = credentials.scope;
        this.#tokenUrl = credentials.tokenURL;
        this.#service = credentials.service;
        this.#clientId = credentials.clientID;
        this.#clientSecret = credentials.clientSecret;
    }

    /**
     * Get a fresh access token using the refresh token
     */
    public async refreshAccessToken() {
        console.log('Refreshing access token...');

        const tokenUrl = this.#tokenUrl;
        const body = new URLSearchParams({
            client_id: this.#clientId,
            client_secret: this.#clientSecret,
            refresh_token: this.#refreshToken,
            grant_type: 'refresh_token',
        });

        try {
            const res = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
            });

            const text = await res.text();
            let json: any;
            try {
                json = JSON.parse(text);
            } catch {
                throw new Error(`Invalid JSON response: ${text}`);
            }

            if (!res.ok) {
                const errorMsg = json.error_description || json.error?.message || json.error || text;
                throw new Error(`HTTP ${res.status}: ${errorMsg}`);
            }

            this.#accessToken = json.access_token;
            this.#expiresIn = Date.now() + json.expires_in * 1000;
            return this.#accessToken;
        } catch (error: any) {
            throw new Error(`Failed to refresh access token: ${error.message}`);
        }
    }
}
