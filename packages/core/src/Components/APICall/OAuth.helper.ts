// helper.ts
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { REQUEST_CONTENT_TYPES } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import AccessTokenManager from './AccessTokenManager';

const logger = Logger('OAuth.helper');
let managedVault: any;

SystemEvents.on('SRE:Booted', () => {
    try {
        managedVault = ConnectorService.getManagedVaultConnector();
    } catch (error) {
        logger.warn('Could not find a compatible ManagedVault connector, OAuth APICalls will not work');
    }
});

export function extractAdditionalParamsForOAuth1(reqConfig: AxiosRequestConfig = {}) {
    let additionalParams = {};

    // Validate URL doesn't contain unresolved template variables
    if (reqConfig.url && (reqConfig.url.includes('{{') || reqConfig.url.includes('${{'))) {
        logger.warn('Warning: URL contains unresolved template variables for OAuth1 signature:', reqConfig.url);
    }

    // Parse URL parameters
    try {
        const url = new URL(reqConfig.url);
        const searchParams = url.searchParams;
        additionalParams = Object.fromEntries(searchParams.entries());

        // Log if we have query parameters for debugging
        if (searchParams.toString()) {
            logger.debug('OAuth1: Found query parameters:', Object.keys(additionalParams));
        }
    } catch (error) {
        logger.warn('Failed to parse URL for OAuth1 parameters:', error);
    }

    // Get the content type, handling different header formats
    const headers = reqConfig.headers || {};
    let contentType = '';

    // Headers might be an object or array of objects
    if (Array.isArray(headers)) {
        const contentTypeHeader = headers.find((h) => Object.keys(h).some((k) => k.toLowerCase() === 'content-type'));
        if (contentTypeHeader) {
            const key = Object.keys(contentTypeHeader).find((k) => k.toLowerCase() === 'content-type');
            contentType = contentTypeHeader[key];
        }
    } else {
        contentType = headers['Content-Type'] || headers['content-type'] || '';
    }

    // Extract body parameters based on content type
    const method = (reqConfig.method || 'GET').toUpperCase();

    if (contentType.includes(REQUEST_CONTENT_TYPES.urlEncodedFormData)) {
        // For form data, include the form parameters in the signature
        if (reqConfig.data) {
            let formParams = {};
            if (typeof reqConfig.data === 'string') {
                // Check for unresolved template variables in form data
                if (reqConfig.data.includes('{{') || reqConfig.data.includes('${{')) {
                    logger.warn('Warning: Form data contains unresolved template variables for OAuth1 signature');
                }
                const formData = new URLSearchParams(reqConfig.data);
                formParams = Object.fromEntries(formData.entries());
            } else if (reqConfig.data instanceof URLSearchParams) {
                formParams = Object.fromEntries(reqConfig.data.entries());
            } else if (typeof reqConfig.data === 'object') {
                // Handle plain object
                formParams = reqConfig.data;
            }
            logger.debug('OAuth1: Including form parameters in signature:', Object.keys(formParams));
            additionalParams = { ...additionalParams, ...formParams };
        }
    } else if (contentType.includes(REQUEST_CONTENT_TYPES.json) || contentType.includes('application/') || contentType.includes('text/')) {
        // For JSON and other non-form data, use oauth_body_hash
        if (reqConfig.data && method !== 'GET' && method !== 'HEAD') {
            let bodyString = '';
            if (typeof reqConfig.data === 'string') {
                bodyString = reqConfig.data;
            } else {
                bodyString = JSON.stringify(reqConfig.data);
            }
            // Check for unresolved template variables
            if (bodyString.includes('{{') || bodyString.includes('${{')) {
                logger.warn('Warning: Request body contains unresolved template variables for OAuth1 signature');
            }
            const hash = crypto.createHash('sha1').update(bodyString).digest('base64');
            additionalParams['oauth_body_hash'] = hash;
            logger.debug('OAuth1: Added oauth_body_hash for', contentType);
        }
    } else if (contentType.includes(REQUEST_CONTENT_TYPES.multipartFormData)) {
        // For multipart form data, only include text fields
        if (reqConfig.data && typeof reqConfig.data === 'object' && 'entries' in reqConfig.data) {
            const formData = reqConfig.data as FormData;
            for (const [key, value] of formData.entries()) {
                // Only include string values, exclude Files/Blobs
                if (typeof value === 'string') {
                    additionalParams[key] = value;
                } else if (typeof value === 'object' && value !== null && ('size' in value || 'type' in value)) {
                    // Skip binary data (Files, Blobs, etc.)
                    continue;
                } else {
                    // Include other simple values
                    additionalParams[key] = String(value);
                }
            }
        }
    } else if (!contentType && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        // No content type specified but has data
        if (reqConfig.data) {
            const bodyString = typeof reqConfig.data === 'string' ? reqConfig.data : JSON.stringify(reqConfig.data);
            const hash = crypto.createHash('sha1').update(bodyString).digest('base64');
            additionalParams['oauth_body_hash'] = hash;
        }
    }

    logger.debug('OAuth1: Total parameters for signature:', Object.keys(additionalParams).length);
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

    // OAuth1 requires the base URL without query parameters for signature
    // The query parameters should be included separately in additionalParams
    let baseUrl = url;
    try {
        const urlObj = new URL(url);
        // Remove query parameters from URL for signature base
        baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
        logger.debug('OAuth1: Base URL for signature:', baseUrl);
    } catch (error) {
        logger.warn('Failed to parse URL for OAuth1 signature:', error);
    }

    // Include additional parameters in the request data
    const requestData = {
        url: baseUrl,
        method: method.toUpperCase(),
        data: additionalParams, // Parameters should be in data field for oauth-1.0a library
    };

    const token =
        oauth1Credentials.token && oauth1Credentials.token !== ''
            ? { key: oauth1Credentials.token, secret: oauth1Credentials.tokenSecret || '' }
            : null;

    const signedRequest = oauth.authorize(requestData, token);
    return oauth.toHeader(signedRequest);
};

export const retrieveOAuthTokens = async (agent, config) => {
    let tokenKey: any = null;
    try {
        // To support both old and new OAuth configuration, we check for both oauth_con_id and config.id (component id)
        tokenKey = config?.data?.oauth_con_id || `OAUTH_${config?.id}_TOKENS`;

        try {
            const result: any = await managedVault.user(AccessCandidate.agent(agent.id)).get(tokenKey);
            const vaultEntry = typeof result === 'object' ? result : JSON.parse(result || '{}');

            if (!vaultEntry) {
                throw new Error('Failed to retrieve OAuth tokens from vault. Please authenticate ...');
            }

            const tokens = vaultEntry?.customProperties?.tokens;
            const credentials = vaultEntry?.credentials;
            //* Resolve vault keys of the credentials from vault (if any)
            await Promise.all(
                Object.keys(credentials).map(async (key) => {
                    if (typeof credentials[key] !== 'string') return;
                    credentials[key] = await TemplateString(credentials[key]).parseTeamKeysAsync(agent.teamId).asyncResult;
                })
            );

            // TODO: not yet added field
            const type = vaultEntry?.authType;
            const service = vaultEntry?.provider;

            // Add warning logs for OAuth2
            if (type === 'oauth2' && service !== 'oauth2_client_credentials') {
                if (!tokens?.secondary) {
                    logger.warn('Warning: refresh_token is missing for OAuth2');
                }
                if (!tokens?.expires_in) {
                    logger.warn('Warning: expires_in is missing for OAuth2.');
                }
            }

            // sometimes refreshToken is not available . e.g in case of linkedIn. so only add check for primary token
            if (service !== 'oauth2_client_credentials') {
                if (!tokens?.primary) {
                    throw new Error('Retrieved OAuth tokens do not exist, invalid OR incomplete. Please authenticate ...');
                }
            }

            const oauthConfig: any = {
                primaryToken: tokens?.primary,
                secondaryToken: tokens?.secondary,
                expiresIn: tokens?.expires_in || 0,
                type,
                service,
                consumerKey: credentials?.consumerKey,
                consumerSecret: credentials?.consumerSecret,
                tokenURL: credentials?.tokenURL,
                clientID: credentials?.clientID,
                clientSecret: credentials?.clientSecret,
                team: agent.teamId || vaultEntry?.teamId,
            };

            return { oauthConfig, settingValue: vaultEntry, keyId: tokenKey };
        } catch (error) {
            throw new Error(`Failed to parse retrieved tokens: ${error}`);
        }
    } catch (error) {
        logger.error('Error retrieving OAuth tokens:', error);
        throw error; // rethrow for potential handling by the calling code
    }
};

export const handleOAuthHeaders = async (agent, config, reqConfig, logger, additionalParams = {}) => {
    let headers = {}; // Initialize headers as an empty object
    const { oauthConfig, settingValue, keyId } = await retrieveOAuthTokens(agent, config);

    try {
        // Build OAuth config string with template support
        // let oAuthConfigString = JSON.stringify({
        //     consumerKey: oauthConfig.consumerKey || '',
        //     consumerSecret: oauthConfig.consumerSecret || '',
        //     clientID: oauthConfig.clientID || '',
        //     clientSecret: oauthConfig.clientSecret || '',
        //     tokenURL: oauthConfig.tokenURL || '',
        // });

        // oAuthConfigString = await TemplateString(oAuthConfigString).parseTeamKeysAsync(oauthConfig.team || agent.teamId).asyncResult;

        // const oAuthConfig = JSON.parse(oAuthConfigString);

        // Avoid logging sensitive OAuth config in plaintext
        // console.log('oAuthConfig', { ...oAuthConfig, clientSecret: '***' });
        if (oauthConfig.service === 'oauth2_client_credentials') {
            const accessToken = await getClientCredentialToken(settingValue, logger, keyId, oauthConfig, config, agent);
            headers['Authorization'] = `Bearer ${accessToken}`;
        } else {
            if (oauthConfig.type === 'oauth') {
                // For OAuth1, generate and replace the signature in headers
                // Use the full URL (with path but without query params) for OAuth1
                const oauthHeader = buildOAuth1Header(
                    reqConfig.url,
                    reqConfig.method,
                    {
                        consumerKey: oauthConfig.consumerKey,
                        consumerSecret: oauthConfig.consumerSecret,
                        token: oauthConfig.primaryToken,
                        tokenSecret: oauthConfig.secondaryToken,
                    },
                    additionalParams
                );

                headers = { ...reqConfig.headers, ...oauthHeader };
                logger.debug('OAuth1 access token check success.');
            } else if (oauthConfig.type === 'oauth2') {
                // For OAuth2, add the 'Authorization' header with the bearer token
                const accessTokenManager = new AccessTokenManager(
                    oauthConfig.clientID,
                    oauthConfig.clientSecret,
                    oauthConfig.secondaryToken,
                    oauthConfig.tokenURL,
                    oauthConfig.expiresIn,
                    oauthConfig.primaryToken,
                    settingValue,
                    keyId,
                    logger,
                    agent
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

async function getClientCredentialToken(settingValue, logger, keyId, oauthTokens, config, agent) {
    const logAndThrowError = (message) => {
        logger.debug(message);
        throw new Error(message);
    };

    try {
        const { clientID, clientSecret, tokenURL } = oauthTokens;
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

            logger.log('Access token refreshed successfully.');
            logger.debug('Access token refreshed successfully.');

            const newAccessToken = response.data.access_token;
            const expiresInMilliseconds = response.data.expires_in * 1000;
            const expirationTimestamp = currentTime + expiresInMilliseconds;

            const updatedData = {
                ...(settingValue || {}),
                customProperties: {
                    ...(settingValue?.customProperties || {}),
                    tokens: {
                        ...(settingValue?.customProperties?.tokens || {}),
                        primary: newAccessToken,
                        expires_in: expirationTimestamp.toString(),
                    },
                },
            };

            await managedVault.user(AccessCandidate.agent(agent.id)).set(keyId, JSON.stringify(updatedData));

            return newAccessToken;
        } else {
            logger.log('Access token value is still valid.');
            logger.debug('Access token value is still valid.');
            return oauthTokens.primaryToken;
        }
    } catch (error) {
        logAndThrowError(`Failed to refresh access token: ${error}`);
    }
}
