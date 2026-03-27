import 'dotenv/config';
import { Storage } from '@smythos/sdk';

/**
 * Writes a test blob to Azure Blob Storage, reads it back, and verifies the content matches.
 *
 * Validates AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCESS_KEY and AZURE_BLOB_CONTAINER_NAME from environment variables.
 * If credentials are missing, the function logs an error and returns early.
 *
 * @returns A promise that resolves when the example completes.
 * @throws Error If the read content does not match the written content.
 */
async function main() {
    // Ensure all required environment variables are loaded before proceeding.
    if (!process.env.AZURE_STORAGE_ACCOUNT_NAME || !process.env.AZURE_STORAGE_ACCESS_KEY || !process.env.AZURE_BLOB_CONTAINER_NAME) {
        console.error("Error: Missing Azure config in your .env file. Ensure AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCESS_KEY, and AZURE_BLOB_CONTAINER_NAME are set.");
        return;
    }

    // Initialize the Azure Blob Storage connector with credentials from the .env file
    const azureStorage = Storage.AzureBlobStorage({
        storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
        storageAccountAccessKey: process.env.AZURE_STORAGE_ACCESS_KEY,
        blobContainerName: process.env.AZURE_BLOB_CONTAINER_NAME,
    });

    const resourceId = 'smythos-azure-test.txt';
    const content = 'Hello, world from Azure!';

    console.log(`=== Running Azure Blob Storage Example ===`);

    // Write a file to your container.
    console.log(`Writing "${content}" to "${resourceId}"...`);
    await azureStorage.write(resourceId, content);
    console.log('Write operation complete.');

    // Read the file back.
    console.log(`Reading "${resourceId}"...`);
    const data = await azureStorage.read(resourceId);
    console.log('Read operation complete.');

    // Log the content to verify it's correct.
    const dataAsString = data?.toString();
    console.log(`Content read from blob: "${dataAsString}"`);

    if (dataAsString !== content) {
        throw new Error("Verification failed: Read content does not match written content!");
    }

    console.log('Verification successful!');
    console.log(`=== Example Finished ===`);
}

main().catch(error => {
    console.error("An error occurred:", error.message);
});