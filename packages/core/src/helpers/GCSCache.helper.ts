import { Storage, Bucket, LifecycleRule } from '@google-cloud/storage';
import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('GCSCache');

export function generateLifecycleRules(): LifecycleRule[] {
    const rules: LifecycleRule[] = [];

    // Add rules for 1-100 days
    for (let i = 1; i < 100; i++) {
        rules.push({
            condition: {
                age: i,
                matchesSuffix: [`ExpireAfter${i}Days`]
            },
            action: {
                type: 'Delete'
            }
        });
    }

    // Add rules for 110-1000 days with 10-day steps
    for (let i = 100; i < 1000; i += 10) {
        rules.push({
            condition: {
                age: i,
                matchesSuffix: [`ExpireAfter${i}Days`]
            },
            action: {
                type: 'Delete'
            }
        });
    }

    // Add rules for 1000-10000 days with 100-day steps
    for (let i = 1000; i <= 10000; i += 100) {
        rules.push({
            condition: {
                age: i,
                matchesSuffix: [`ExpireAfter${i}Days`]
            },
            action: {
                type: 'Delete'
            }
        });
    }

    return rules;
}

export function generateExpiryMetadata(expiryDays: number) {
    let metadataValue: string;

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
        Key: 'expiry-tag',
        Value: metadataValue,
    };
}

export function getNonExistingRules(existingRules: LifecycleRule[], newRules: LifecycleRule[]): LifecycleRule[] {
    return newRules.filter((newRule) => 
        !existingRules.some((existingRule) => 
            existingRule.condition.age === newRule.condition.age &&
            JSON.stringify(existingRule.condition.matchesSuffix) === JSON.stringify(newRule.condition.matchesSuffix)
        )
    );
}

export function ttlToExpiryDays(ttl: number): number {
    // seconds to days
    return Math.ceil(ttl / (60 * 60 * 24));
}

export async function checkAndInstallLifecycleRules(bucketName: string, storage: Storage): Promise<void> {
    // Validate inputs
    if (!bucketName || bucketName.trim() === '') {
        throw new Error('Bucket name is required and cannot be empty');
    }

    if (!storage) {
        throw new Error('Storage client is required');
    }

    console.log(`Checking lifecycle rules for GCS bucket: ${bucketName}`);

    try {
        const bucket = storage.bucket(bucketName);
        
        // Check existing lifecycle configuration
        const [metadata] = await bucket.getMetadata();
        const existingRules = metadata.lifecycle?.rule || [];
        
        const newRules = generateLifecycleRules();
        const nonExistingNewRules = getNonExistingRules(existingRules, newRules);
        
        if (nonExistingNewRules.length > 0) {
            const allRules = [...existingRules, ...nonExistingNewRules];
            
            await bucket.setMetadata({
                lifecycle: {
                    rule: allRules
                }
            });
            
            console.log(`Added ${nonExistingNewRules.length} new lifecycle rules to GCS bucket: ${bucketName}`);
        } else {
            console.log('Lifecycle configuration already exists');
        }
    } catch (error) {
        if (error.code === 404) {
            console.log('Bucket not found or no lifecycle configuration. Creating new configuration...');
            
            const bucket = storage.bucket(bucketName);
            const lifecycleRules = generateLifecycleRules();
            
            await bucket.setMetadata({
                lifecycle: {
                    rule: lifecycleRules
                }
            });
            
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