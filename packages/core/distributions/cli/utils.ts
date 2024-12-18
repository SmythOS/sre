import axios from 'axios';
import * as fs from 'fs';
import * as util from 'util';

export const validateFilePath = (name: string) => (path: string) => {
    if (!fs.existsSync(path)) {
        // throw new Error(`${name} file not found: ${path}`);
        console.error(`${name} file not found: ${path}`);
        process.exit(1);
    }
    return path;
};

export async function checkNewVersion() {
    const url = 'https://proxy-02.api.smyth.ai/static/sre/manifest.json';
    const currentVersion = '0.0.1';

    try {
        const { data: manifest } = await axios.get<{
            version: string;
            url: string;
            message: string;
        }>(url);

        const hasNewVersion = isNewerVersion(currentVersion, manifest.version);

        if (hasNewVersion && manifest.message && manifest.url) {
            console.log('\n=== New Version Available ===');
            console.log(manifest.message);
            console.log(`\nDownload the new version from: ${manifest.url}\n`);
        }
    } catch (error) {
        // Silently handle errors since version check is non-critical
    }
}

function isNewerVersion(current: string, target: string): boolean {
    const currentParts = current.split('.').map((p) => parseInt(p, 10));
    const targetParts = target.split('.').map((p) => parseInt(p, 10));

    for (let i = 0; i < Math.max(currentParts.length, targetParts.length); i++) {
        const currentPart = currentParts[i] || 0;
        const targetPart = targetParts[i] || 0;

        if (targetPart > currentPart) return true;
        if (targetPart < currentPart) return false;
    }

    return false;
}
