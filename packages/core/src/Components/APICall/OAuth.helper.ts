// helper.ts
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import AccessTokenManager from './AccessTokenManager';
import { REQUEST_CONTENT_TYPES } from '@sre/constants';
import axios, { AxiosRequestConfig } from 'axios';
import { Logger } from '@sre/helpers/Log.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { SystemEvents } from '@sre/Core/SystemEvents';

const console = Logger('OAuth.helper');
let managedVault: any;

SystemEvents.on('SRE:Booted', () => {
    try {
        managedVault = ConnectorService.getManagedVaultConnector();
    } catch (error) {
        console.warn('Could not find a compatible ManagedVault connector, OAuth APICalls will not work');
    }
});

export function extractAdditionalParamsForOAuth1(reqConfig: AxiosRequestConfig = {}) {
    let additionalParams = {};
    // Parse URL parameters using URL and URLSearchParams
    const url = new URL(reqConfig.url);
    const searchParams = url.searchParams;
    additionalParams = Object.fromEntries(searchParams.entries());

    // Check content type and add required parameters for OAuth 1 signature
    const contentType = reqConfig.headers?.['Content-Type'] || '';
    if (contentType === REQUEST_CONTENT_TYPES.urlEncodedFormData) {
        // For form data, include the form parameters in the signature
        if (typeof reqConfig.data === 'string') {
            const formData = new URLSearchParams(reqConfig.data);
            additionalParams = { ...additionalParams, ...Object.fromEntries(formData) };
        }
    } else if (contentType === REQUEST_CONTENT_TYPES.json) {
        // For JSON data, include a hash of the request body
        if (reqConfig.data) {
            const hash = crypto.createHash('sha1').update(JSON.stringify(reqConfig.data)).digest('base64');
            additionalParams['oauth_body_hash'] = hash;
        }
    } else if (contentType === REQUEST_CONTENT_TYPES.multipartFormData) {
        const formData = reqConfig.data as FormData;
        for (const [key, value] of formData.entries()) {
            // Exclude binary form data (File, Blob, etc.)
            if (typeof value === 'object' && value !== null && 'size' in value && 'type' in value) {
                continue;
            }

            additionalParams[key] = value;
        }
    }

    return additionalParams;
}

export const buildOAuth1Header = (url, method, oauth1Credentials, additionalParams = {}) => {
    const oauth = new OAuth({
        consumer: {
            key: oauth1Credentials.consumerKey,
            secret: oauth1Credentials.consumerSecret,
        },
        signature_method: 'HMAC-SHA1',
        hash_function(base_string, key) {
            return crypto.createHmac('sha1', key).update(base_string).digest('base64');
        },
    });

    // Include additional parameters if necessary (e.g., for non-standard providers)
    const requestData = {
        url,
        method,
        ...additionalParams,
    };
    const signedRequest = oauth.authorize(requestData, { key: oauth1Credentials.token, secret: oauth1Credentials.tokenSecret });
    return oauth.toHeader(signedRequest);
};

export const retrieveOAuthTokens = async (agent, config) => {
    let tokenKey: any = null;
    try {
        tokenKey = `OAUTH_${config.componentId ?? config.id}_TOKENS`;

        try {
            const result: any = await managedVault.user(AccessCandidate.agent(agent.id)).get(tokenKey);
            const tokensData = typeof result === 'object' ? result : JSON.parse(result || '{}');

            if (!tokensData) {
                throw new Error('Failed to retrieve OAuth tokens from vault. Please authenticate ...');
            }

            const primaryToken = tokensData.primary; // accessToken or token
            const secondaryToken = tokensData.secondary; // refreshToken or tokenSecret
            const type = tokensData.type; // oauth || oauth2

            // Add warning logs for OAuth2
            if (type === 'oauth2' && config.data.oauthService !== 'OAuth2 Client Credentials') {
                if (!secondaryToken) {
                    console.warn('Warning: refresh_token is missing for OAuth2');
                }
                if (!tokensData.expires_in) {
                    console.warn('Warning: expires_in is missing for OAuth2.');
                }
            }

            // sometimes refreshToken is not available . e.g in case of linkedIn. so only add check for primary token
            if (config.data.oauthService !== 'OAuth2 Client Credentials') {
                if (!primaryToken) {
                    throw new Error('Retrieved OAuth tokens do not exist, invalid OR incomplete. Please authenticate ...');
                }
            }

            const responseData: any = {
                primaryToken,
                secondaryToken,
                type,
            };

            if (type === 'oauth') {
                // Check and assign if present
                if ('consumerKey' in tokensData) responseData.consumerKey = tokensData.consumerKey;
                if ('consumerSecret' in tokensData) responseData.consumerSecret = tokensData.consumerSecret;
                responseData.team = tokensData.team;
            } else if (type === 'oauth2') {
                // Check and assign if present
                responseData.tokenURL = tokensData.tokenURL;
                if ('clientID' in tokensData) responseData.clientID = tokensData.clientID;
                if ('clientSecret' in tokensData) responseData.clientSecret = tokensData.clientSecret;
                responseData.expiresIn = tokensData.expires_in ?? 0; // Optional property, default to 0 if not present. time to expire access token
                responseData.team = tokensData.team;
            }

            return { responseData, data: tokensData, keyId: tokenKey };
        } catch (error) {
            throw new Error(`Failed to parse retrieved tokens: ${error}`);
        }
    } catch (error) {
        console.error('Error retrieving OAuth tokens:', error);
        throw error; // rethrow for potential handling by the calling code
    }
};

export const handleOAuthHeaders = async (agent, config, reqConfig, logger, additionalParams = {}, rootUrl) => {
    let headers = {}; // Initialize headers as an empty object
    const { responseData: oauthTokens, data, keyId } = await retrieveOAuthTokens(agent, config);

    try {
        // Extract template variable key IDs for consumerKey, consumerSecret, clientID, and clientSecret
        const keys = ['consumerKey', 'consumerSecret', 'clientID', 'clientSecret'];
        let oAuthConfigString = JSON.stringify({
            consumerKey: config.data.consumerKey,
            consumerSecret: config.data.consumerSecret,
            clientID: config.data.clientID,
            clientSecret: config.data.clientSecret,
            tokenURL: config.data.tokenURL,
        });

        oAuthConfigString = await TemplateString(oAuthConfigString).parseTeamKeysAsync(oauthTokens.team || agent.teamId).asyncResult;

        const oAuthConfig = JSON.parse(oAuthConfigString);

        if (oAuthConfig.oauthService === 'OAuth2 Client Credentials') {
            const accessToken = await getClientCredentialToken(data, logger, keyId, oauthTokens, config, agent);
            headers['Authorization'] = `Bearer ${accessToken}`;
        } else {
            if (oauthTokens.type === 'oauth') {
                // For OAuth1, generate and replace the signature in headers
                const oauthHeader = buildOAuth1Header(
                    rootUrl,
                    reqConfig.method,
                    {
                        consumerKey: oAuthConfig.consumerKey,
                        consumerSecret: oAuthConfig.consumerSecret,
                        token: oauthTokens.primaryToken,
                        tokenSecret: oauthTokens.secondaryToken,
                    },
                    additionalParams,
                );

                headers = { ...reqConfig.headers, ...oauthHeader };
                logger.debug('OAuth1 access token check success.');
            } else if (oauthTokens.type === 'oauth2') {
                // For OAuth2, add the 'Authorization' header with the bearer token
                const accessTokenManager = new AccessTokenManager(
                    oAuthConfig.clientID,
                    oAuthConfig.clientSecret,
                    oauthTokens.secondaryToken,
                    oAuthConfig.tokenURL,
                    oauthTokens.expiresIn,
                    oauthTokens.primaryToken,
                    data,
                    keyId,
                    logger,
                    agent,
                );

                const accessToken = await accessTokenManager.getAccessToken();
                headers['Authorization'] = `Bearer ${accessToken}`;
            }
        }
        return headers;
    } catch (error) {
        logger.error(`Access token check failed: ${error}`);
        throw error;
    }
};

const getKeyIdsFromTemplateVars = (str: string): string[] => {
    if (!str) return [];

    const pattern = /{{KEY\((.*?)\)}}/g;
    const keyIds: any = [];
    let match: any = [];

    while ((match = pattern.exec(str)) !== null) {
        if (match?.length < 2) continue;
        keyIds.push(match[1]);
    }

    return keyIds;
};

async function getClientCredentialToken(data, logger, keyId, oauthTokens, config, agent) {
    const logAndThrowError = (message) => {
        logger.debug(message);
        throw new Error(message);
    };

    try {
        data = data[keyId] || {};
        const { clientID, clientSecret, tokenURL } = config.data;
        const currentTime = new Date().getTime();
        // Check for token expiration
        if (!oauthTokens.expiresIn || currentTime >= Number(oauthTokens.expiresIn)) {
            // Verify required parameters
            if (!clientID || !clientSecret || !tokenURL) {
                logAndThrowError('Missing client_id, client_secret OR token_url');
            }

            const params = new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientID,
                client_secret: clientSecret,
            });

            const response = await axios.post(tokenURL, params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            console.log('Access token refreshed successfully.');
            logger.debug('Access token refreshed successfully.');

            const newAccessToken = response.data.access_token;
            const expiresInMilliseconds = response.data.expires_in * 1000;
            const expirationTimestamp = currentTime + expiresInMilliseconds;

            // Set data if it's empty
            if (Object.keys(data).length === 0) {
                data = {
                    primary: '',
                    secondary: '',
                    type: 'oauth2',
                    tokenURL,
                    expires_in: '',
                    team: agent.teamId,
                    oauth_info: {
                        oauth_keys_prefix: `OAUTH_${config.componentId ?? config.id}`,
                        service: 'oauth2_client_credentials',
                        tokenURL,
                        clientID,
                        clientSecret,
                    },
                };
            }

            data.primary = newAccessToken;
            data.expires_in = expirationTimestamp.toString();
            //const oauthTeamSettings = new OauthTeamSettings();
            //const save = await oauthTeamSettings.update({ keyId: keyId, data: data });
            await managedVault.user(AccessCandidate.agent(agent.id)).set(keyId, data);

            return newAccessToken;
        } else {
            console.log('Access token value is still valid.');
            logger.debug('Access token value is still valid.');
            return oauthTokens.primaryToken;
        }
    } catch (error) {
        logAndThrowError(`Failed to refresh access token: ${error}`);
    }
}
