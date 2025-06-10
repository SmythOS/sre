import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('== 🚀 Generating SDK Types ==');
execSync('node generate-types.js', { cwd: __dirname, stdio: 'inherit' });

console.log('== 🚀 Generating SDK Components ==');
execSync('node generate-components.js', { cwd: __dirname, stdio: 'inherit' });
