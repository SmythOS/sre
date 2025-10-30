import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Generate a service-specific authentication key
 */
export function generateServiceKey(serviceName: string): string {
    const secret = process.env.SRE_SECRET;

    if (!secret || secret.trim().length < 32) {
        throw new Error('SRE_SECRET must be at least 32 characters');
    }

    return createHmac('sha256', secret).update(`sre-service:${serviceName}`).digest('hex');
}

/**
 * Validate a service key
 */
export function validateServiceKey(serviceName: string, providedKey: string): boolean {
    try {
        const expectedKey = generateServiceKey(serviceName);

        // Constant-time comparison to prevent timing attacks
        return timingSafeEqual(Buffer.from(expectedKey), Buffer.from(providedKey));
    } catch {
        return false;
    }
}
