import { GetBucketLifecycleConfigurationCommandOutput, PutBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3';

import { GetBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { Logger } from '@sre/helpers/Log.helper';
const console = Logger('S3Cache');
const lifeCycleRuleNotExistsErrorCode = 'NoSuchLifecycleConfiguration';

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
                    Value: 'ExpireAfter' + i + 'Days',
                },
            },
            Status: 'Enabled',
            Expiration: { Days: i },
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
                    Value: 'ExpireAfter' + i + 'Days',
                },
            },
            Status: 'Enabled',
            Expiration: { Days: i },
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
                    Value: 'ExpireAfter' + i + 'Days',
                },
            },
            Status: 'Enabled',
            Expiration: { Days: i },
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
        Value: metadataValue,
    };
}

export function getNonExistingRules(existingRules: any[], newRules: any[]) {
    return newRules.filter((rule) => !existingRules.some((existingRule) => existingRule.ID === rule.ID));
}

export function ttlToExpiryDays(ttl: number) {
    // seconds
    return Math.ceil(ttl / (60 * 60 * 24));
}

export async function checkAndInstallLifecycleRules(bucketName: string, s3Client: S3Client) {
    // Validate inputs
    if (!bucketName || bucketName.trim() === '') {
        throw new Error('Bucket name is required and cannot be empty');
    }

    if (!s3Client) {
        throw new Error('S3Client is required');
    }

    console.log(`Checking lifecycle rules for bucket: ${bucketName}`);

    try {
        // Check existing lifecycle configuration
        const getLifecycleCommand = new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName });
        const existingLifecycle: GetBucketLifecycleConfigurationCommandOutput = await s3Client.send(getLifecycleCommand);
        const existingRules = existingLifecycle.Rules;
        const newRules = generateLifecycleRules();
        const nonExistingNewRules = getNonExistingRules(existingRules, newRules);
        if (nonExistingNewRules.length > 0) {
            const params = {
                Bucket: bucketName,
                LifecycleConfiguration: { Rules: [...existingRules, ...nonExistingNewRules] },
            };
            const putLifecycleCommand = new PutBucketLifecycleConfigurationCommand(params);
            // Put the new lifecycle configuration
            await s3Client.send(putLifecycleCommand);
            console.log(`Added ${nonExistingNewRules.length} new lifecycle rules to bucket: ${bucketName}`);
        } else {
            console.log('Lifecycle configuration already exists');
        }
    } catch (error) {
        if (error.code === lifeCycleRuleNotExistsErrorCode || error.name === lifeCycleRuleNotExistsErrorCode) {
            console.log('No lifecycle configuration found. Creating new configuration...');

            const lifecycleRules = generateLifecycleRules();

            const params = {
                Bucket: bucketName,
                LifecycleConfiguration: { Rules: lifecycleRules },
            };
            const putLifecycleCommand = new PutBucketLifecycleConfigurationCommand(params);
            // Put the new lifecycle configuration
            await s3Client.send(putLifecycleCommand);
            console.log('Lifecycle configuration created successfully.');
        } else {
            console.error('Error checking lifecycle configuration:', error);
            console.error('Bucket name provided:', bucketName);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                code: error.code,
            });
        }
    }
}
