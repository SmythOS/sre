import { NextFunction, Request, Response } from 'express';
import axios from 'axios';
import qs from 'qs';

const mwFactory = (config: any) => {
    // Middleware to validate an access token using the token introspection endpoint
    const validateTokenMiddleware = async (req: Request, res: Response, next: NextFunction) => {
        // Extract the token from the request header or URL query
        const token = req.headers['authorization']?.split(' ')[1] || req.query.token;

        if (!token) {
            return res.status(401).json({ error: 'Access token is required' });
        }

        if (token == config.token) {
            next();
        } else {
            // Token is not active
            res.status(401).json({ error: 'Invalid access token' });
        }
    };
    return validateTokenMiddleware;
};

export default mwFactory;
