export function generateLifecycleRules() {
    const rules = [];

    // Add rules for 1-100 days
    for (let i = 1; i < 100; i++) {
        rules.push({
            ID: `ExpireAfter${i}Days`,
            Filter: {
                // Prefix: '',
                Tag: {
                    Key: 'Expiry',
                   Value: 'ExpireAfter' + i + 'Days'
                }
            },
            Status: 'Enabled',
            Expiration: { Days: i }
        });
    }

    // Add rules for 110-1000 days with 10-day steps
    for (let i = 100; i < 1000; i += 10) {
        rules.push({
            ID: `ExpireAfter${i}Days`,
            Filter: {
                // Prefix: '',
                Tag: {
                    Key: 'Expiry',
                   Value: 'ExpireAfter' + i + 'Days'
                }
            },
            Status: 'Enabled',
            Expiration: { Days: i }
        });
    }

    // Add rules for 1000-10000 days with 100-day steps
    for (let i = 1000; i <= 10000; i += 100) {
        rules.push({
            ID: `ExpireAfter${i}Days`,
            Filter: {
                // Prefix: '',
                Tag: {
                    Key: 'Expiry',
                    Value: 'ExpireAfter' + i + 'Days'
                }
            },
            Status: 'Enabled',
            Expiration: { Days: i }
        });
    }

    return rules;
}


export function generateExpiryMetadata(expiryDays) {
    let metadataValue;

    if (expiryDays >= 1 && expiryDays < 100) {
        metadataValue = `ExpireAfter${expiryDays}Days`;
    } else if (expiryDays >= 100 && expiryDays < 1000) {
        const roundedUpDays = Math.ceil(expiryDays / 10) * 10;
        metadataValue = `ExpireAfter${roundedUpDays}Days`;
    } else if (expiryDays >= 1000 && expiryDays <= 10000) {
        const roundedUpDays = Math.ceil(expiryDays / 100) * 100;
        metadataValue = `ExpireAfter${roundedUpDays}Days`;
    } else {
        throw new Error('Invalid expiry days. Please provide a valid expiry days value.');
    }

    return {
        Key: 'Expiry',
        Value: metadataValue
    };
}

export function ttlToExpiryDays(ttl: number) { // seconds
    return Math.ceil(ttl / (60 * 60 * 24));
}