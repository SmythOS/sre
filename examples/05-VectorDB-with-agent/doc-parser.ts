import { Doc } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

async function main() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, '../files/bitcoin.pdf');

    const doc = Doc.pdf(filePath);
    const parsedDoc = await doc.parse();

    console.log(parsedDoc);
}

main();
