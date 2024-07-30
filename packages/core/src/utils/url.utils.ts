import axios from 'axios';
import { fileTypeFromBuffer } from 'file-type';

export async function getMimeTypeFromUrl(url: string): Promise<string> {
    try {
        // Fetch the first 4100 bytes of the URL content
        const { data } = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { Range: 'bytes=0-4096' },
        });

        // Use file-type to determine the MIME type from the binary data
        const type = await fileTypeFromBuffer(data);

        return type ? type.mime : '';
    } catch (error) {
        throw new Error(`Error fetching the MIME type: ${error.message}`);
    }
}
