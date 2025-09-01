import { Storage } from '@smythos/sdk';

async function main() {
    const gcsStorage = Storage.GCS({
        projectId: process.env.GCP_PROJECT_ID,
        clientEmail: process.env.GCP_CLIENT_EMAIL,
        privateKey: process.env.GCP_PRIVATE_KEY,
        bucket: process.env.GCP_BUCKET_NAME,
    });

    await gcsStorage.write('test.txt', 'Hello, world!');

    const data = await gcsStorage.read('test.txt');

    const dataAsString = data.toString();

    console.log(dataAsString);
}

main();
