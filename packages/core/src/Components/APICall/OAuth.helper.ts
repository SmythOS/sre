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
            const tokensData = typeof result === 'object' ? result : JSON.parse(result || '{}');

            if (!tokensData) {
                throw new Error('Failed to retrieve OAuth tokens from vault. Please authenticate ...');
            }

            // Check if it's new structure (has auth_data and auth_settings) or old structure
            const isNewStructure = tokensData.auth_data !== undefined && tokensData.auth_settings !== undefined;

            //* Resolve vault keys inside auth_data
            if (isNewStructure) {
                await Promise.all(
                    Object.keys(tokensData.auth_settings).map(async (key) => {
                        if (typeof tokensData.auth_settings[key] !== 'string') return;
                        tokensData.auth_settings[key] = await TemplateString(tokensData.auth_settings[key]).parseTeamKeysAsync(agent.teamId)
                            .asyncResult;
                    })
                );
            }

            // Extract tokens based on structure
            const primaryToken = isNewStructure ? tokensData.auth_data?.primary : tokensData.primary;
            const secondaryToken = isNewStructure ? tokensData.auth_data?.secondary : tokensData.secondary;
            const expiresIn = isNewStructure ? tokensData.auth_data?.expires_in : tokensData.expires_in;

            // Extract settings based on structure
            const type = isNewStructure ? tokensData.auth_settings?.type : tokensData.type || tokensData.oauth_info?.type;
            const service = isNewStructure ? tokensData.auth_settings?.service : tokensData.oauth_info?.service;

            // Add warning logs for OAuth2
            if (type === 'oauth2' && service !== 'oauth2_client_credentials') {
                if (!secondaryToken) {
                    logger.warn('Warning: refresh_token is missing for OAuth2');
                }
                if (!expiresIn) {
                    logger.warn('Warning: expires_in is missing for OAuth2.');
                }
            }

            // sometimes refreshToken is not available . e.g in case of linkedIn. so only add check for primary token
            if (service !== 'oauth2_client_credentials') {
                if (!primaryToken) {
                    throw new Error('Retrieved OAuth tokens do not exist, invalid OR incomplete. Please authenticate ...');
                }
            }

            const responseData: any = {
                primaryToken,
                secondaryToken,
                type,
                service,
            };

            if (type === 'oauth') {
                // Extract OAuth1 credentials based on structure
                if (isNewStructure) {
                    responseData.consumerKey = tokensData.auth_settings?.consumerKey;
                    responseData.consumerSecret = tokensData.auth_settings?.consumerSecret;
                    responseData.tokenURL = tokensData.auth_settings?.tokenURL;
                } else {
                    responseData.consumerKey = tokensData.consumerKey || tokensData.oauth_info?.consumerKey;
                    responseData.consumerSecret = tokensData.consumerSecret || tokensData.oauth_info?.consumerSecret;
                    responseData.tokenURL = tokensData.tokenURL || tokensData.oauth_info?.tokenURL;
                }
                responseData.team = tokensData.team || agent.teamId;
            } else if (type === 'oauth2') {
                // Extract OAuth2 credentials based on structure
                if (isNewStructure) {
                    responseData.tokenURL = tokensData.auth_settings?.tokenURL;
                    responseData.clientID = tokensData.auth_settings?.clientID;
                    responseData.clientSecret = tokensData.auth_settings?.clientSecret;
                    responseData.scope = tokensData.auth_settings?.scope;
                    responseData.audience = tokensData.auth_settings?.audience;
                } else {
                    responseData.tokenURL = tokensData.tokenURL || tokensData.oauth_info?.tokenURL;
                    responseData.clientID = tokensData.clientID || tokensData.oauth_info?.clientID;
                    responseData.clientSecret = tokensData.clientSecret || tokensData.oauth_info?.clientSecret;
                    // Extract scope and audience from oauth_info (old structure)
                    responseData.scope = tokensData.scope || tokensData.oauth_info?.scope;
                    responseData.audience = tokensData.audience || tokensData.oauth_info?.audience;
                }
                responseData.expiresIn = expiresIn ?? 0; // Optional property, default to 0 if not present
                responseData.team = tokensData.team || agent.teamId;
            }

            return { responseData, tokensData, keyId: tokenKey, isNewStructure };
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
    const { responseData: oauthTokens, tokensData, keyId, isNewStructure } = await retrieveOAuthTokens(agent, config);

    try {
        // Build OAuth config string with template support
        let oAuthConfigString = JSON.stringify({
            consumerKey: oauthTokens.consumerKey || '',
            consumerSecret: oauthTokens.consumerSecret || '',
            clientID: oauthTokens.clientID || '',
            clientSecret: oauthTokens.clientSecret || '',
            tokenURL: oauthTokens.tokenURL || '',
        });

        oAuthConfigString = await TemplateString(oAuthConfigString).parseTeamKeysAsync(oauthTokens.team || agent.teamId).asyncResult;

        const oAuthConfig = JSON.parse(oAuthConfigString);
        // Avoid logging sensitive OAuth config in plaintext
        // console.log('oAuthConfig', { ...oAuthConfig, clientSecret: '***' });
        if (oauthTokens.service === 'oauth2_client_credentials') {
            const accessToken = await getClientCredentialToken(tokensData, logger, keyId, oauthTokens, config, agent, isNewStructure);
            headers['Authorization'] = `Bearer ${accessToken}`;
        } else {
            if (oauthTokens.type === 'oauth') {
                // For OAuth1, generate and replace the signature in headers
                // Use the full URL (with path but without query params) for OAuth1
                const oauthHeader = buildOAuth1Header(
                    reqConfig.url,
                    reqConfig.method,
                    {
                        consumerKey: oAuthConfig.consumerKey,
                        consumerSecret: oAuthConfig.consumerSecret,
                        token: oauthTokens.primaryToken,
                        tokenSecret: oauthTokens.secondaryToken,
                    },
                    additionalParams
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
                    tokensData,
                    keyId,
                    logger,
                    agent,
                    isNewStructure
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

async function getClientCredentialToken(tokensData, logger, keyId, oauthTokens, config, agent, isNewStructure = false) {
    const logAndThrowError = (message) => {
        logger.debug(message);
        throw new Error(message);
    };

    try {
        const { clientID, clientSecret, tokenURL, scope, audience } = oauthTokens;
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

            // Add audience if provided (required by some providers like Auth0)
            if (audience && typeof audience === 'string' && audience.trim()) {
                params.append('audience', audience.trim());
            }

            // Add scope if provided (OAuth2 Client Credentials supports scopes)
            if (scope && typeof scope === 'string' && scope.trim()) {
                params.append('scope', scope.trim());
            }

            const response = await axios.post(tokenURL, params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            logger.log('Access token refreshed successfully.');
            logger.debug('Access token refreshed successfully.');

            const newAccessToken = response.data.access_token;
            const expiresInMilliseconds = response.data.expires_in * 1000;
            const expirationTimestamp = currentTime + expiresInMilliseconds;

            // Maintain the same structure format when saving
            let updatedData;
            if (isNewStructure) {
                // Maintain new structure format; preserve existing fields
                const parts = String(config?.data?.oauth_con_id ?? '').split('_');
                const prefixSuffix = parts.length > 1 ? parts[1] : parts[0];
                const oauthKeysPrefix = prefixSuffix ? `OAUTH_${prefixSuffix}` : undefined;
                updatedData = {
                    ...(tokensData || {}),
                    auth_data: {
                        ...(tokensData?.auth_data || {}),
                        primary: newAccessToken,
                        expires_in: expirationTimestamp.toString(),
                    },
                    auth_settings: {
                        ...(tokensData?.auth_settings || {}),
                        type: 'oauth2',
                        tokenURL,
                        clientID,
                        clientSecret,
                        ...(oauthKeysPrefix ? { oauth_keys_prefix: oauthKeysPrefix } : {}),
                        service: 'oauth2_client_credentials',
                    },
                };
            } else {
                // Maintain old structure format
                updatedData = {
                    ...tokensData,
                    primary: newAccessToken,
                    expires_in: expirationTimestamp.toString(),
                };
                // Ensure required fields are present for old structure
                if (!updatedData.type) updatedData.type = 'oauth2';
                if (!updatedData.tokenURL) updatedData.tokenURL = tokenURL;
                if (!updatedData.team) updatedData.team = agent.teamId;
                if (!updatedData.oauth_info) {
                    updatedData.oauth_info = {
                        oauth_keys_prefix: `OAUTH_${config?.data?.oauth_con_id?.split('_')[1] || config?.id}`,
                        service: 'oauth2_client_credentials',
                        tokenURL,
                        clientID,
                        clientSecret,
                    };
                }
            }

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
