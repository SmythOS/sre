import path from 'path';
import { builtinModules } from 'node:module';

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    orange: '\x1b[33m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgBlue: '\x1b[44m',
};

// Custom colorful logging plugin
export default function colorfulLogs(title = 'CLI Builder') {
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function getProgressBar(percent, length = 20) {
        const completeChars = Math.round(percent * length);
        const incompleteChars = length - completeChars;
        const completeBar = completeChars > 0 ? '█'.repeat(completeChars) : '';
        const incompleteBar = incompleteChars > 0 ? '░'.repeat(incompleteChars) : '';
        return `${colors.green}${completeBar}${colors.dim}${incompleteBar}${colors.reset}`;
    }

    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIdx = 0;
    let spinnerInterval;
    let startTime;
    let processedFiles = 0;
    const totalFiles = new Set();
    let currentFile = '';
    let hasShownFinalMessage = false;

    return {
        name: 'colorful-logs',
        buildStart() {
            startTime = Date.now();
            hasShownFinalMessage = false;
            console.log(
                `\n${colors.bright}${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
            );
            console.log(`${colors.bright} ${colors.green}    ${title}`);

            console.log(`\n\n`);
            console.log(`${colors.yellow}⚡ ${colors.green}Building ...${colors.reset}\n`);

            spinnerInterval = setInterval(() => {
                const spinner = spinnerFrames[spinnerIdx];
                spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;

                if (currentFile && totalFiles.size > 0) {
                    process.stdout.write(
                        `\r${colors.cyan}${spinner} ${colors.green}Processing ${colors.yellow}${processedFiles}${colors.green} files... ${
                            colors.reset
                        }${currentFile.padEnd(50)}`
                    );
                }
            }, 80);
        },
        load(id) {
            // Ignore Node.js core modules and anything in node_modules
            const cleanId = id.startsWith('node:') ? id.substring(5) : id;
            if (builtinModules.includes(cleanId) || id.includes('node_modules')) {
                return null;
            }
            totalFiles.add(id);
            return null;
        },
        transform(code, id) {
            // Ignore Node.js core modules and anything in node_modules
            const cleanId = id.startsWith('node:') ? id.substring(5) : id;
            if (builtinModules.includes(cleanId) || id.includes('node_modules')) {
                return null;
            }
            processedFiles++;
            const relativePath = path.relative(process.cwd(), id);
            currentFile = relativePath;
            return null;
        },
        buildEnd(error) {
            if (spinnerInterval) {
                clearInterval(spinnerInterval);
            }
            if (error) {
                console.log(`\n${colors.red}✗ ${colors.bright}Build failed with error:${colors.reset}`);
                console.log(`  ${colors.red}${error.message}${colors.reset}\n`);
            }
        },
        generateBundle(outputOptions, bundle) {
            if (spinnerInterval) {
                clearInterval(spinnerInterval);
                spinnerInterval = null;
            }

            if (!hasShownFinalMessage) {
                const progressBar = getProgressBar(1);
                process.stdout.write(
                    `\r${colors.green}✓ ${colors.reset}[${progressBar}] ${colors.yellow}100% ${colors.bright}Complete!${colors.reset}${''.padEnd(
                        60
                    )}\n`
                );

                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
                console.log(`${colors.green}✓ ${colors.bright}CLI Build complete in ${colors.yellow}${duration}s${colors.reset}!`);
                console.log(`${colors.magenta}➤ ${colors.white}Processed: ${colors.yellow}${totalFiles.size} files${colors.reset}`);
                console.log(`${colors.magenta}➤ ${colors.white}Output: ${colors.yellow}dist/index.js${colors.reset}`);
                console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
                hasShownFinalMessage = true;
            }
        },
    };
}
