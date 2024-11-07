import { NextFunction, Request, Response } from 'express';
import axios from 'axios';
import qs from 'qs';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

function isJWT(token) {
    const parts = token.split('.');
    if (parts.length === 3) {
        try {
            const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));

            // Optionally, check if header contains typical JWT properties
            if (header.alg && header.typ) {
                return true;
            }
        } catch (error) {
            // Errors in parsing mean this isn't a valid JWT
            return false;
        }
    }
    return false; // Not in JWT format if it doesn't have three parts
}

//FIXME : handle JWT tokens as well
const mwFactory = async (providerInfo: any, res: Response) => {
    console.log('Agent Auth OIDC');
    const authOIDCConfigURL = providerInfo.OIDCConfigURL;
    const clientID = providerInfo.clientID;
    const clientSecret = providerInfo.clientSecret;
    const allowedEmails = (providerInfo.allowedEmails || []).filter((e: string) => e.trim());

    if (!authOIDCConfigURL || !clientID || !clientSecret) {
        console.log('OIDC:Auth provider not configured');
        return res.status(401).send({ error: 'Auth provider not configured' });
    }

    const openid: any = await axios.get(authOIDCConfigURL).catch((error) => ({ error }));

    if (openid?.error) {
        console.log('OIDC:Error getting OIDC config');
        return res.status(401).send({ error: 'Error getting OIDC config' });
    }

    const config = { openid: openid.data, clientID, clientSecret };

    let jwks;
    function getKey(header, callback) {
        jwks.getSigningKey(header.kid, function (err, key: any) {
            const signingKey = key?.publicKey || key?.rsaPublicKey;
            callback(null, signingKey);
        });
    }

    // Middleware to validate an opaque access token using the token introspection endpoint
    const validateOpaqueTokenMiddleware = async (token, req: Request) => {
        const auth = {
            username: config.clientID,
            password: config.clientSecret,
        };
        try {
            // Send a POST request to the introspection endpoint
            const response = await axios.post(
                config.openid.introspection_endpoint,
                qs.stringify({
                    token: token, // The token you want to introspect
                    // Optionally include token_type_hint: 'access_token' if needed
                }),
                {
                    // Basic Auth with the client ID and client secret
                    auth,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                },
            );

            //console.log('Token introspection response:', config.openid.introspection_endpoint, response.data);
            // The introspection response will contain a boolean "active" field indicating validity
            if (response.data && response.data.active) {
                // Token is valid; you could attach token details to the request object if needed
                const oidc_introspect_data = response.data; // This attaches the token data to the request object
                //console.log('OIDC:Token introspection response:', oidc_introspect_data);

                try {
                    //TODO : cache this for a short time
                    const userInfo = await axios.get(config.openid.userinfo_endpoint, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });

                    //check if the user is allowed
                    console.log('OIDC:userinfo', userInfo?.data);

                    if (allowedEmails.length > 0) {
                        const email = userInfo?.data?.email || '';
                        const domain = email.split('@')[1];
                        if (!allowedEmails.includes(email) && !allowedEmails.includes(domain)) {
                            console.log('OIDC:User not allowed', email, domain);
                            //the status code should be 403 here, but chatGPT goes in infinite loop if we use it.
                            return { error: 'OIDC:User not allowed', status: 200 };
                        }
                    }

                    req['_agent_authinfo'] = { userinfo: userInfo?.data };

                    return { error: null };
                } catch (error) {
                    return { error: 'OIDC:userinfo failed', status: 401 };
                }
            } else {
                // Token is not active
                return { error: 'OIDC:Agent Access token is invalid or expired', status: 401 };
            }
        } catch (error) {
            // Handle errors, such as network issues or the introspection endpoint being down
            console.error('Token introspection error:', error);
            return { error: 'OIDC:Internal server error during token validation', status: 500 };
        }
    };

    const validateJWTTokenMiddleware = async (token, req: Request) => {
        if (!token) {
            return res.status(401).json({ error: 'Access token is required' });
        }

        // Check if token is a JWT
        if (token.split('.').length === 3) {
            // Token is a JWT, validate it
            try {
                const decoded = jwt.verify(token, getKey, {
                    algorithms: ['RS256'],
                });

                console.log(decoded);
                return { error: null };
            } catch (err) {
                return res.status(401).json({ error: 'Invalid JWT token' });
            }
        } else if (config.openid.introspection_endpoint) {
            // Token is not a JWT, use introspection endpoint
            try {
                const response = await axios.post(
                    config.openid.introspection_endpoint,
                    qs.stringify({
                        token: token,
                    }),
                    {
                        auth: {
                            username: config.clientID,
                            password: config.clientSecret,
                        },
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    },
                );

                if (response.data && response.data.active) {
                    return { error: null };
                } else {
                    return { error: 'Access token is invalid or expired', status: 401 };
                }
            } catch (error) {
                console.error('Token introspection error:', error);
                return { error: 'Internal server error during token validation', status: 500 };
            }
        } else {
            // No suitable method to validate the token
            return { error: 'Unable to validate access token', status: 401 };
        }
    };

    const validateTokenMiddleware = async (req: Request, res: Response, next: NextFunction) => {
        const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
        if (!token) {
            console.log('OIDC:Access token is required');
            return res.status(401).json({ error: 'Access token is required' });
        }

        const isJWTToken = isJWT(token);

        if (isJWTToken) {
            // Set up JWKS client using the JWKS URI from the OpenID configuration
            jwks = jwksClient({
                jwksUri: config.openid.jwks_uri,
            });
            const result: any = await validateJWTTokenMiddleware(token, req);
            if (result.error) {
                console.log('OIDC:JWT validation failed', result.error);
                return res.status(result.status).json({ error: result.error });
            }
            return next();
        } else {
            const result: any = await validateOpaqueTokenMiddleware(token, req);
            if (result.error) {
                console.log('OIDC:Token validation failed', result.error);
                return res.status(result.status).json({ error: result.error });
            }
            return next();
        }
    };
    return validateTokenMiddleware;
};

export default mwFactory;

//TODO : test below updated code that handles jwt tokens as well
/*
import { NextFunction, Request, Response } from 'express';
import axios from 'axios';
import qs from 'qs';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const mwFactory = async (providerInfo: any, res: Response) => {
    const authOIDCConfigURL = providerInfo.OIDCConfigURL;
    const clientID = providerInfo.clientID;
    const clientSecret = providerInfo.clientSecret;

    if (!authOIDCConfigURL || !clientID || !clientSecret) {
        return res.status(401).send({ error: 'Auth provider not configured' });
    }

    const openid: any = await axios.get(authOIDCConfigURL).catch((error) => ({ error }));

    if (openid?.error) {
        return res.status(401).send({ error: 'Error getting OIDC config' });
    }

    const config = { openid: openid.data, clientID, clientSecret };

    // Set up JWKS client using the JWKS URI from the OpenID configuration
    const jwks = jwksClient({
        jwksUri: config.openid.jwks_uri,
    });

    function getKey(header, callback) {
        jwks.getSigningKey(header.kid, function (err, key) {
            var signingKey = key.publicKey || key.rsaPublicKey;
            callback(null, signingKey);
        });
    }

    // Middleware to validate an access token using JWT validation or token introspection endpoint
    const validateTokenMiddleware = async (req: Request, res: Response, next: NextFunction) => {
        const token = req.headers['authorization']?.split(' ')[1] || req.query.token;

        if (!token) {
            return res.status(401).json({ error: 'Access token is required' });
        }

        // Check if token is a JWT
        if (token.split('.').length === 3) {
            // Token is a JWT, validate it
            try {
                const decoded = jwt.verify(token, getKey, {
                    algorithms: ['RS256'],
                });

                req.user = decoded; // This attaches the token data to the request object
                return next(); // Proceed to the next middleware
            } catch (err) {
                return res.status(401).json({ error: 'Invalid JWT token' });
            }
        } else if (config.openid.introspection_endpoint) {
            // Token is not a JWT, use introspection endpoint
            try {
                const response = await axios.post(
                    config.openid.introspection_endpoint,
                    qs.stringify({
                        token: token,
                    }),
                    {
                        auth: {
                            username: config.clientID,
                            password: config.clientSecret,
                        },
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    },
                );

                if (response.data && response.data.active) {
                    req.user = response.data;
                    return next();
                } else {
                    return res.status(401).json({ error: 'Access token is invalid or expired' });
                }
            } catch (error) {
                console.error('Token introspection error:', error);
                return res.status(500).json({ error: 'Internal server error during token validation' });
            }
        } else {
            // No suitable method to validate the token
            return res.status(401).json({ error: 'Unable to validate access token' });
        }
    };

    return validateTokenMiddleware;
};

export default mwFactory;


*/
